import {
  DocumentNode,
  getIntrospectionQuery,
  graphql,
  GraphQLError,
  GraphQLID,
  GraphQLInt,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  print,
} from "graphql";
import { GraphQLFormattedError } from "graphql";
import { gql } from "graphql-tag";
import { defer, Observable, of } from "rxjs";

import { ApolloCache, InMemoryCache } from "@apollo/client/cache";
import { ApolloClient, NetworkStatus } from "@apollo/client/core";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { ApolloLink } from "@apollo/client/link/core";
import { Operation } from "@apollo/client/link/core";

import {
  ObservableStream,
  spyOnConsole,
} from "../../testing/internal/index.js";

describe("General functionality", () => {
  it("should not impact normal non-@client use", () => {
    const query = gql`
      {
        field
      }
    `;

    const link = new ApolloLink(() => of({ data: { field: 1 } }));
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      resolvers: {
        Query: {
          count: () => 0,
        },
      },
    });

    return client.query({ query }).then(({ data }) => {
      expect({ ...data }).toMatchObject({ field: 1 });
    });
  });

  it("should not interfere with server introspection queries", () => {
    const query = gql`
      ${getIntrospectionQuery()}
    `;

    const error = new GraphQLError("no introspection result found");
    const link = new ApolloLink(() => of({ errors: [error] }));

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      resolvers: {
        Query: {
          count: () => 0,
        },
      },
    });

    return client
      .query({ query })
      .then(() => {
        throw new global.Error("should not call");
      })
      .catch((error: GraphQLError) =>
        expect(error.message).toMatch(/no introspection/)
      );
  });

  it("should support returning default values from resolvers", () => {
    const query = gql`
      {
        field @client
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      resolvers: {
        Query: {
          field: () => 1,
        },
      },
    });

    return client.query({ query }).then(({ data }) => {
      expect({ ...data }).toMatchObject({ field: 1 });
    });
  });

  it("should cache data for future lookups", async () => {
    const query = gql`
      {
        field @client
      }
    `;

    let count = 0;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      resolvers: {
        Query: {
          field: () => {
            count += 1;
            return 1;
          },
        },
      },
    });

    {
      const { data } = await client.query({ query });

      expect(data).toMatchObject({ field: 1 });
      expect(count).toBe(1);
    }

    {
      const { data } = await client.query({ query });

      expect(data).toMatchObject({ field: 1 });
      expect(count).toBe(1);
    }
  });

  it("should honour `fetchPolicy` settings", () => {
    const query = gql`
      {
        field @client
      }
    `;

    let count = 0;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      resolvers: {
        Query: {
          field: () => {
            count += 1;
            return 1;
          },
        },
      },
    });

    return client
      .query({ query })
      .then(({ data }) => {
        expect({ ...data }).toMatchObject({ field: 1 });
        expect(count).toBe(1);
      })
      .then(() =>
        client
          .query({ query, fetchPolicy: "network-only" })
          .then(({ data }) => {
            expect({ ...data }).toMatchObject({ field: 1 });
            expect(count).toBe(2);
          })
      );
  });

  it("should work with a custom fragment matcher", () => {
    const query = gql`
      {
        foo {
          ... on Bar {
            bar @client
          }
          ... on Baz {
            baz @client
          }
        }
      }
    `;

    const link = new ApolloLink(() =>
      of({
        data: { foo: [{ __typename: "Bar" }, { __typename: "Baz" }] },
      })
    );

    const resolvers = {
      Bar: {
        bar: () => "Bar",
      },
      Baz: {
        baz: () => "Baz",
      },
    };

    const fragmentMatcher = (
      { __typename }: { __typename: string },
      typeCondition: string
    ) => __typename === typeCondition;

    const client = new ApolloClient({
      cache: new InMemoryCache({
        possibleTypes: {
          Foo: ["Bar", "Baz"],
        },
      }),
      link,
      resolvers,
      fragmentMatcher,
    });

    return client.query({ query }).then(({ data }) => {
      expect(data).toMatchObject({ foo: [{ bar: "Bar" }, { baz: "Baz" }] });
    });
  });
});

describe("Cache manipulation", () => {
  it(
    "should be able to query @client fields and the cache without defining " +
      "local resolvers",
    () => {
      const query = gql`
        {
          field @client
        }
      `;

      const cache = new InMemoryCache();
      const client = new ApolloClient({
        cache,
        link: ApolloLink.empty(),
        resolvers: {},
      });

      cache.writeQuery({ query, data: { field: "yo" } });

      client
        .query({ query })
        .then(({ data }) => expect({ ...data }).toMatchObject({ field: "yo" }));
    }
  );

  it("should be able to write to the cache using a local mutation", () => {
    const query = gql`
      {
        field @client
      }
    `;

    const mutation = gql`
      mutation start {
        start @client
      }
    `;

    const resolvers = {
      Mutation: {
        start: (_1: any, _2: any, { cache }: { cache: InMemoryCache }) => {
          cache.writeQuery({ query, data: { field: 1 } });
          return { start: true };
        },
      },
    };

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      resolvers,
    });

    return client
      .mutate({ mutation })
      .then(() => client.query({ query }))
      .then(({ data }) => {
        expect({ ...data }).toMatchObject({ field: 1 });
      });
  });

  it("should be able to write to the cache with a local mutation and have things rerender automatically", async () => {
    const query = gql`
      {
        field @client
      }
    `;

    const mutation = gql`
      mutation start {
        start @client
      }
    `;

    const resolvers = {
      Query: {
        field: () => 0,
      },
      Mutation: {
        start: (_1: any, _2: any, { cache }: { cache: InMemoryCache }) => {
          cache.writeQuery({ query, data: { field: 1 } });
          return { start: true };
        },
      },
    };

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      resolvers,
    });

    const stream = new ObservableStream(client.watchQuery({ query }));

    await expect(stream).toEmitMatchedValue({ data: { field: 0 } });
    await client.mutate({ mutation });
    await expect(stream).toEmitMatchedValue({ data: { field: 1 } });
  });

  it("should support writing to the cache with a local mutation using variables", () => {
    const query = gql`
      {
        field @client
      }
    `;

    const mutation = gql`
      mutation start($id: ID!) {
        start(field: $id) @client {
          field
        }
      }
    `;

    const resolvers = {
      Mutation: {
        start: (
          _1: any,
          variables: { field: string },
          { cache }: { cache: ApolloCache<any> }
        ) => {
          cache.writeQuery({ query, data: { field: variables.field } });
          return {
            __typename: "Field",
            field: variables.field,
          };
        },
      },
    };

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      resolvers,
    });

    return client
      .mutate({ mutation, variables: { id: "1234" } })
      .then(({ data }) => {
        expect({ ...data }).toEqual({
          start: { field: "1234", __typename: "Field" },
        });
      })
      .then(() => client.query({ query }))
      .then(({ data }) => {
        expect({ ...data }).toMatchObject({ field: "1234" });
      });
  });

  it("should read @client fields from cache on refetch (#4741)", async () => {
    const query = gql`
      query FetchInitialData {
        serverData {
          id
          title
        }
        selectedItemId @client
      }
    `;

    const mutation = gql`
      mutation Select {
        select(itemId: $id) @client
      }
    `;

    const serverData = {
      __typename: "ServerData",
      id: 123,
      title: "Oyez and Onoz",
    };

    let selectedItemId = -1;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new ApolloLink(() => of({ data: { serverData } })),
      resolvers: {
        Query: {
          selectedItemId() {
            return selectedItemId;
          },
        },
        Mutation: {
          select(_, { itemId }) {
            selectedItemId = itemId;
          },
        },
      },
    });

    const stream = new ObservableStream(client.watchQuery({ query }));

    await expect(stream).toEmitApolloQueryResult({
      data: {
        serverData,
        selectedItemId: -1,
      },
      dataState: "complete",
      loading: false,
      networkStatus: 7,
      partial: false,
    });

    await client.mutate({
      mutation,
      variables: { id: 123 },
      refetchQueries: ["FetchInitialData"],
    });

    await expect(stream).toEmitApolloQueryResult({
      data: {
        serverData,
        selectedItemId: 123,
      },
      dataState: "complete",
      loading: false,
      networkStatus: 7,
      partial: false,
    });
  });

  it("should rerun @client(always: true) fields on entity update", async () => {
    const query = gql`
      query GetClientData($id: ID) {
        clientEntity(id: $id) @client(always: true) {
          id
          title
          titleLength @client(always: true)
        }
      }
    `;

    const mutation = gql`
      mutation AddOrUpdate {
        addOrUpdate(id: $id, title: $title) @client
      }
    `;

    const fragment = gql`
      fragment ClientDataFragment on ClientData {
        id
        title
      }
    `;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new ApolloLink(() => of({ data: {} })),
      resolvers: {
        ClientData: {
          titleLength(data) {
            return data.title.length;
          },
        },
        Query: {
          clientEntity(_root, { id }, { cache }) {
            return cache.readFragment({
              id: cache.identify({ id, __typename: "ClientData" }),
              fragment,
            });
          },
        },
        Mutation: {
          addOrUpdate(_root, { id, title }, { cache }) {
            return cache.writeFragment({
              id: cache.identify({ id, __typename: "ClientData" }),
              fragment,
              data: { id, title, __typename: "ClientData" },
            });
          },
        },
      },
    });

    const entityId = 1;
    const shortTitle = "Short";
    const longerTitle = "A little longer";
    await client.mutate({
      mutation,
      variables: {
        id: entityId,
        title: shortTitle,
      },
    });
    const stream = new ObservableStream(
      client.watchQuery({ query, variables: { id: entityId } })
    );

    {
      const result = await stream.takeNext();

      expect(result.data.clientEntity).toEqual({
        id: entityId,
        title: shortTitle,
        titleLength: shortTitle.length,
        __typename: "ClientData",
      });
    }

    await client.mutate({
      mutation,
      variables: {
        id: entityId,
        title: longerTitle,
      },
    });

    {
      const result = await stream.takeNext();

      expect(result.data.clientEntity).toEqual({
        id: entityId,
        title: longerTitle,
        titleLength: longerTitle.length,
        __typename: "ClientData",
      });
    }

    await expect(stream).not.toEmitAnything();
  });
});

describe("Sample apps", () => {
  it("should support a simple counter app using local state", async () => {
    const query = gql`
      query GetCount {
        count @client
        lastCount # stored in db on server
      }
    `;

    const increment = gql`
      mutation Increment($amount: Int = 1) {
        increment(amount: $amount) @client
      }
    `;

    const decrement = gql`
      mutation Decrement($amount: Int = 1) {
        decrement(amount: $amount) @client
      }
    `;

    const link = new ApolloLink((operation) => {
      expect(operation.operationName).toBe("GetCount");
      return of({ data: { lastCount: 1 } });
    });

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
      resolvers: {},
    });

    const update = (
      query: DocumentNode,
      updater: (data: { count: number }, variables: { amount: number }) => any
    ) => {
      return (
        _result: {},
        variables: { amount: number },
        { cache }: { cache: ApolloCache<any> }
      ): null => {
        const read = client.readQuery<{ count: number }>({
          query,
          variables,
        });
        if (read) {
          const data = updater(read, variables);
          cache.writeQuery({ query, variables, data });
        } else {
          throw new Error("readQuery returned a falsy value");
        }
        return null;
      };
    };

    const resolvers = {
      Query: {
        count: () => 0,
      },
      Mutation: {
        increment: update(query, ({ count, ...rest }, { amount }) => ({
          ...rest,
          count: count + amount,
        })),
        decrement: update(query, ({ count, ...rest }, { amount }) => ({
          ...rest,
          count: count - amount,
        })),
      },
    };

    client.addResolvers(resolvers);
    const stream = new ObservableStream(client.watchQuery({ query }));

    await expect(stream).toEmitMatchedValue({
      data: { count: 0, lastCount: 1 },
    });

    await client.mutate({ mutation: increment, variables: { amount: 2 } });

    await expect(stream).toEmitMatchedValue({
      data: { count: 2, lastCount: 1 },
    });

    await client.mutate({ mutation: decrement, variables: { amount: 1 } });

    await expect(stream).toEmitMatchedValue({
      data: { count: 1, lastCount: 1 },
    });
  });

  it("should support a simple todo app using local state", async () => {
    const query = gql`
      query GetTasks {
        todos @client {
          message
          title
        }
      }
    `;

    const mutation = gql`
      mutation AddTodo($message: String, $title: String) {
        addTodo(message: $message, title: $title) @client
      }
    `;

    const client = new ApolloClient({
      link: ApolloLink.empty(),
      cache: new InMemoryCache(),
      resolvers: {},
    });

    interface Todo {
      title: string;
      message: string;
      __typename: string;
    }

    const update = (
      query: DocumentNode,
      updater: (todos: any, variables: Todo) => any
    ) => {
      return (
        _result: {},
        variables: Todo,
        { cache }: { cache: ApolloCache<any> }
      ): null => {
        const data = updater(client.readQuery({ query, variables }), variables);
        cache.writeQuery({ query, variables, data });
        return null;
      };
    };

    const resolvers = {
      Query: {
        todos: () => [],
      },
      Mutation: {
        addTodo: update(query, ({ todos }, { title, message }: Todo) => ({
          todos: todos.concat([{ message, title, __typename: "Todo" }]),
        })),
      },
    };

    client.addResolvers(resolvers);
    const stream = new ObservableStream(client.watchQuery({ query }));

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({ todos: [] });
    }

    await client.mutate({
      mutation,
      variables: {
        title: "Apollo Client 2.0",
        message: "ship it",
      },
    });

    {
      const { data } = await stream.takeNext();

      expect(data.todos).toEqual([
        {
          title: "Apollo Client 2.0",
          message: "ship it",
          __typename: "Todo",
        },
      ]);
    }
  });
});

describe("Combining client and server state/operations", () => {
  it("should merge remote and local state", async () => {
    const query = gql`
      query list {
        list(name: "my list") {
          items {
            id
            name
            isDone
            isSelected @client
          }
        }
      }
    `;

    const data = {
      list: {
        __typename: "List",
        items: [
          { __typename: "ListItem", id: 1, name: "first", isDone: true },
          { __typename: "ListItem", id: 2, name: "second", isDone: false },
        ],
      },
    };

    const link = new ApolloLink(() => of({ data }));

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      resolvers: {
        Mutation: {
          toggleItem: async (_, { id }, { cache }) => {
            id = `ListItem:${id}`;
            const fragment = gql`
              fragment item on ListItem {
                __typename
                isSelected
              }
            `;
            const previous = cache.readFragment({ fragment, id });
            const data = {
              ...previous,
              isSelected: !previous.isSelected,
            };
            await cache.writeFragment({
              id,
              fragment,
              data,
            });

            return data;
          },
        },
        ListItem: {
          isSelected(source) {
            expect(source.name).toBeDefined();
            // List items default to an unselected state
            return false;
          },
        },
      },
    });

    const observer = client.watchQuery({ query });

    const stream = new ObservableStream(observer);

    {
      const response = await stream.takeNext();
      const initial = { ...data };
      initial.list.items = initial.list.items.map((x) => ({
        ...x,
        isSelected: false,
      }));

      expect(response.data).toMatchObject(initial);
    }

    await client.mutate({
      mutation: gql`
        mutation SelectItem($id: Int!) {
          toggleItem(id: $id) @client
        }
      `,
      variables: { id: 1 },
    });

    {
      const response = await stream.takeNext();

      expect((response.data as any).list.items[0].isSelected).toBe(true);
      expect((response.data as any).list.items[1].isSelected).toBe(false);
    }
  });

  it("query resolves with loading: false if subsequent responses contain the same data", async () => {
    const request = {
      query: gql`
        query people($id: Int) {
          people(id: $id) {
            id
            name
          }
        }
      `,
      variables: {
        id: 1,
      },
      notifyOnNetworkStatusChange: true,
    };

    const PersonType = new GraphQLObjectType({
      name: "Person",
      fields: {
        id: { type: GraphQLID },
        name: { type: GraphQLString },
      },
    });

    const peopleData = [
      { id: 1, name: "John Smith" },
      { id: 2, name: "Sara Smith" },
      { id: 3, name: "Budd Deey" },
    ];

    const QueryType = new GraphQLObjectType({
      name: "Query",
      fields: {
        people: {
          type: PersonType,
          args: {
            id: {
              type: GraphQLInt,
            },
          },
          resolve: (_, { id }) => {
            return peopleData;
          },
        },
      },
    });

    const schema = new GraphQLSchema({ query: QueryType });

    const link = new ApolloLink((operation) => {
      return defer(() => {
        const { query, operationName, variables } = operation;

        return graphql({
          schema,
          source: print(query),
          variableValues: variables,
          operationName,
        });
      });
    });

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.watchQuery(request);
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitMatchedValue({ loading: false });

    await observable.refetch({ id: 2 });

    await expect(stream).toEmitMatchedValue({ loading: true });
    await expect(stream).toEmitMatchedValue({ loading: false });
  });

  it("should correctly propagate an error from a client resolver", async () => {
    const data = {
      list: {
        __typename: "List",
        items: [
          { __typename: "ListItem", id: 1, name: "first", isDone: true },
          { __typename: "ListItem", id: 2, name: "second", isDone: false },
        ],
      },
    };

    const link = new ApolloLink(() => of({ data }));

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      resolvers: {
        Query: {
          hasBeenIllegallyTouched: (_, _v, _c) => {
            throw new Error("Illegal Query Operation Occurred");
          },
        },

        Mutation: {
          touchIllegally: (_, _v, _c) => {
            throw new Error("Illegal Mutation Operation Occurred");
          },
        },
      },
    });

    const variables = { id: 1 };
    const query = gql`
      query hasBeenIllegallyTouched($id: Int!) {
        hasBeenIllegallyTouched(id: $id) @client
      }
    `;
    const mutation = gql`
      mutation SelectItem($id: Int!) {
        touchIllegally(id: $id) @client
      }
    `;

    await expect(
      client.query({ query, variables })
    ).rejects.toThrowErrorMatchingSnapshot();

    await expect(
      client.mutate({ mutation, variables })
    ).rejects.toThrowErrorMatchingSnapshot();
  });

  it("should handle a simple query with both server and client fields", async () => {
    using _consoleSpies = spyOnConsole.takeSnapshots("error");
    const query = gql`
      query GetCount {
        count @client
        lastCount
      }
    `;
    const cache = new InMemoryCache();

    const link = new ApolloLink((operation) => {
      expect(operation.operationName).toBe("GetCount");
      return of({ data: { lastCount: 1 } });
    });

    const client = new ApolloClient({
      cache,
      link,
      resolvers: {},
    });

    cache.writeQuery({
      query,
      data: {
        count: 0,
      },
    });

    const stream = new ObservableStream(client.watchQuery({ query }));

    await expect(stream).toEmitMatchedValue({
      data: { count: 0, lastCount: 1 },
    });
  });

  it("should support nested querying of both server and client fields", async () => {
    using _consoleSpies = spyOnConsole.takeSnapshots("error");
    const query = gql`
      query GetUser {
        user {
          firstName @client
          lastName
        }
      }
    `;

    const cache = new InMemoryCache();
    const link = new ApolloLink((operation) => {
      expect(operation.operationName).toBe("GetUser");
      return of({
        data: {
          user: {
            __typename: "User",
            // We need an id (or a keyFields policy) because, if the User
            // object is not identifiable, the call to cache.writeQuery
            // below will simply replace the existing data rather than
            // merging the new data with the existing data.
            id: 123,
            lastName: "Doe",
          },
        },
      });
    });

    const client = new ApolloClient({
      cache,
      link,
      resolvers: {},
    });

    cache.writeQuery({
      query,
      data: {
        user: {
          __typename: "User",
          id: 123,
          firstName: "John",
        },
      },
    });

    const stream = new ObservableStream(client.watchQuery({ query }));

    await expect(stream).toEmitMatchedValue({
      data: {
        user: {
          firstName: "John",
          lastName: "Doe",
          __typename: "User",
        },
      },
    });
  });

  it("should combine both server and client mutations", async () => {
    const query = gql`
      query SampleQuery {
        count @client
        user {
          firstName
        }
      }
    `;

    const mutation = gql`
      mutation SampleMutation {
        incrementCount @client
        updateUser(firstName: "Harry") {
          firstName
        }
      }
    `;

    const counterQuery = gql`
      {
        count @client
      }
    `;

    const userQuery = gql`
      {
        user {
          firstName
        }
      }
    `;

    const link = new ApolloLink((operation: Operation): Observable<{}> => {
      if (operation.operationName === "SampleQuery") {
        return of({
          data: { user: { __typename: "User", firstName: "John" } },
        });
      }
      if (operation.operationName === "SampleMutation") {
        return of({
          data: { updateUser: { __typename: "User", firstName: "Harry" } },
        });
      }
      return of({
        errors: [new Error(`Unknown operation ${operation.operationName}`)],
      });
    });

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link,
      resolvers: {
        Mutation: {
          incrementCount: (_, __, { cache }) => {
            const { count } = cache.readQuery({ query: counterQuery });
            const data = { count: count + 1 };
            cache.writeQuery({
              query: counterQuery,
              data,
            });
            return null;
          },
        },
      },
    });

    cache.writeQuery({
      query: counterQuery,
      data: {
        count: 0,
      },
    });

    const stream = new ObservableStream(client.watchQuery({ query }));

    await expect(stream).toEmitMatchedValue({
      data: {
        count: 0,
        user: { __typename: "User", firstName: "John" },
      },
    });

    await client.mutate({
      mutation,
      update(proxy, { data: { updateUser } }) {
        proxy.writeQuery({
          query: userQuery,
          data: {
            user: { ...updateUser },
          },
        });
      },
    });

    await expect(stream).toEmitMatchedValue({
      data: {
        count: 1,
        user: { __typename: "User", firstName: "Harry" },
      },
    });
  });

  it("handles server errors when root data property is null", async () => {
    const query = gql`
      query GetUser {
        user {
          firstName @client
          lastName
        }
      }
    `;

    const error: GraphQLFormattedError = {
      message: "something went wrong",
      extensions: {
        code: "INTERNAL_SERVER_ERROR",
      },
      path: ["user"],
    };

    const cache = new InMemoryCache();
    const link = new ApolloLink((operation) => {
      return of({
        data: null,
        errors: [error],
      });
    });

    const client = new ApolloClient({
      cache,
      link,
      resolvers: {},
    });

    const stream = new ObservableStream(client.watchQuery({ query }));

    await expect(stream).toEmitApolloQueryResult({
      data: undefined,
      error: new CombinedGraphQLErrors([error]),
      loading: false,
      networkStatus: NetworkStatus.error,
      partial: true,
    });
  });
});
