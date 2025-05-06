import type { DocumentNode, GraphQLFormattedError } from "graphql";
import {
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
import { gql } from "graphql-tag";
import type { Observable } from "rxjs";
import { defer, delay, of } from "rxjs";

import type { TypedDocumentNode } from "@apollo/client";
import { ApolloClient, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import type { Operation } from "@apollo/client/link";
import { ApolloLink } from "@apollo/client/link";
import { LocalResolversLink } from "@apollo/client/link/local-resolvers";
import {
  ObservableStream,
  spyOnConsole,
} from "@apollo/client/testing/internal";

describe("General functionality", () => {
  it("should not impact normal non-@client use", async () => {
    const query = gql`
      {
        field
      }
    `;

    const mockLink = new ApolloLink(() => of({ data: { field: 1 } }));
    const localResolversLink = new LocalResolversLink({
      resolvers: {
        Query: {
          count: () => 0,
        },
      },
    });
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.from([localResolversLink, mockLink]),
    });

    await expect(client.query({ query })).resolves.toStrictEqualTyped({
      data: { field: 1 },
    });
  });

  it("should not interfere with server introspection queries", async () => {
    const query = gql`
      ${getIntrospectionQuery()}
    `;

    const error = new GraphQLError("no introspection result found");
    const mockLink = new ApolloLink(() => of({ errors: [error] }));
    const localResolversLink = new LocalResolversLink({
      resolvers: {
        Query: {
          count: () => 0,
        },
      },
    });

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.from([localResolversLink, mockLink]),
    });

    await expect(client.query({ query })).rejects.toThrow(/no introspection/);
  });

  it("should support returning values from resolvers in LocalResolversLink", async () => {
    const query = gql`
      {
        field @local
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new LocalResolversLink({
        resolvers: {
          Query: {
            field: () => 1,
          },
        },
      }),
    });

    await expect(client.query({ query })).resolves.toStrictEqualTyped({
      data: { field: 1 },
    });
  });

  it("should cache data for future lookups", async () => {
    const query = gql`
      {
        field @local
      }
    `;

    let count = 0;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new LocalResolversLink({
        resolvers: {
          Query: {
            field: () => {
              count += 1;
              return 1;
            },
          },
        },
      }),
    });

    await expect(client.query({ query })).resolves.toStrictEqualTyped({
      data: { field: 1 },
    });
    expect(count).toBe(1);

    await expect(client.query({ query })).resolves.toStrictEqualTyped({
      data: { field: 1 },
    });
    expect(count).toBe(1);
  });

  it("should honour `fetchPolicy` settings", async () => {
    const query = gql`
      {
        field @client
      }
    `;

    let count = 0;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new LocalResolversLink({
        resolvers: {
          Query: {
            field: () => {
              count += 1;
              return 1;
            },
          },
        },
      }),
    });

    await expect(client.query({ query })).resolves.toStrictEqualTyped({
      data: { field: 1 },
    });
    expect(count).toBe(1);

    await expect(
      client.query({ query, fetchPolicy: "network-only" })
    ).resolves.toStrictEqualTyped({
      data: { field: 1 },
    });
    expect(count).toBe(2);
  });

  it("should work with possible types", async () => {
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

    const localResolversLink = new LocalResolversLink({
      resolvers: {
        Bar: {
          bar: () => "Bar",
        },
        Baz: {
          baz: () => "Baz",
        },
      },
    });

    const client = new ApolloClient({
      cache: new InMemoryCache({
        possibleTypes: {
          Foo: ["Bar", "Baz"],
        },
      }),
      link: ApolloLink.from([localResolversLink, link]),
    });

    await expect(client.query({ query })).resolves.toStrictEqualTyped({
      data: { foo: [{ bar: "Bar" }, { baz: "Baz" }] },
    });
  });
});

describe("Cache manipulation", () => {
  it("should be able to query @client fields and the cache without defining local resolvers", async () => {
    const query = gql`
      {
        field @client
      }
    `;

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link: new LocalResolversLink(),
    });

    cache.writeQuery({ query, data: { field: "yo" } });

    await expect(client.query({ query })).resolves.toStrictEqualTyped({
      data: { field: "yo" },
    });
  });

  it("should be able to write to the cache using a local mutation", async () => {
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

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new LocalResolversLink({
        resolvers: {
          Mutation: {
            start: (_1: any, _2: any, { operation }) => {
              operation.client.cache.writeQuery({ query, data: { field: 1 } });
              return true;
            },
          },
        },
      }),
    });

    await expect(client.mutate({ mutation })).resolves.toStrictEqualTyped({
      data: { start: true },
    });

    await expect(client.query({ query })).resolves.toStrictEqualTyped({
      data: { field: 1 },
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

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new LocalResolversLink({
        resolvers: {
          Query: {
            field: () => 0,
          },
          Mutation: {
            start: (_1: any, _2: any, { operation }) => {
              operation.client.cache.writeQuery({ query, data: { field: 1 } });
              return { start: true };
            },
          },
        },
      }),
    });

    const stream = new ObservableStream(client.watchQuery({ query }));

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: { field: 0 },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
    await client.mutate({ mutation });
    await expect(stream).toEmitTypedValue({
      data: { field: 1 },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });

  it("should support writing to the cache with a local mutation using variables", async () => {
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

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new LocalResolversLink({
        resolvers: {
          Mutation: {
            start: (_1: any, variables: { field: string }, { operation }) => {
              operation.client.cache.writeQuery({
                query,
                data: { field: variables.field },
              });
              return {
                __typename: "Field",
                field: variables.field,
              };
            },
          },
        },
      }),
    });

    await expect(
      client.mutate({ mutation, variables: { id: "1234" } })
    ).resolves.toStrictEqualTyped({
      data: {
        start: { field: "1234", __typename: "Field" },
      },
    });

    await expect(client.query({ query })).resolves.toStrictEqualTyped({
      data: {
        field: "1234",
      },
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
      link: ApolloLink.from([
        new LocalResolversLink({
          resolvers: {
            Query: {
              selectedItemId() {
                return selectedItemId;
              },
            },
            Mutation: {
              select(_, { itemId }) {
                selectedItemId = itemId;
                return selectedItemId;
              },
            },
          },
        }),
        new ApolloLink(() => of({ data: { serverData } })),
      ]),
    });

    const stream = new ObservableStream(client.watchQuery({ query }));

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: {
        serverData,
        selectedItemId: -1,
      },
      loading: false,
      networkStatus: 7,
      partial: false,
    });

    await client.mutate({
      mutation,
      variables: { id: 123 },
      refetchQueries: ["FetchInitialData"],
    });

    await expect(stream).toEmitTypedValue({
      data: { serverData, selectedItemId: -1 },
      loading: true,
      networkStatus: NetworkStatus.refetch,
      partial: false,
    });

    await expect(stream).toEmitTypedValue({
      data: {
        serverData,
        selectedItemId: 123,
      },
      loading: false,
      networkStatus: 7,
      partial: false,
    });
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

    const localResolversLink = new LocalResolversLink();

    const client = new ApolloClient({
      link: ApolloLink.from([localResolversLink, link]),
      cache: new InMemoryCache(),
    });

    const update = (
      query: DocumentNode,
      updater: (data: { count: number }, variables: { amount: number }) => any
    ) => {
      return (
        _result: {},
        variables: { amount: number },
        { operation }: { operation: Operation }
      ): null => {
        const { cache } = operation.client;

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

    localResolversLink.addResolvers(resolvers);
    const stream = new ObservableStream(client.watchQuery({ query }));

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: { count: 0, lastCount: 1 },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await client.mutate({ mutation: increment, variables: { amount: 2 } });

    await expect(stream).toEmitTypedValue({
      data: { count: 2, lastCount: 1 },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await client.mutate({ mutation: decrement, variables: { amount: 1 } });

    await expect(stream).toEmitTypedValue({
      data: { count: 1, lastCount: 1 },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
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

    const link = new LocalResolversLink();

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
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
        { operation }: { operation: Operation }
      ): null => {
        const { cache } = operation.client;

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

    link.addResolvers(resolvers);
    const stream = new ObservableStream(client.watchQuery<any>({ query }));

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

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

    const link = new ApolloLink(() => of({ data }).pipe(delay(20)));
    const localResolversLink = new LocalResolversLink({
      resolvers: {
        Mutation: {
          toggleItem: async (_, { id }, { operation }) => {
            const { cache } = operation.client;

            id = `ListItem:${id}`;
            const fragment: TypedDocumentNode<{
              __typename: "ListItem";
              isSelected: boolean;
            }> = gql`
              fragment item on ListItem {
                __typename
                isSelected
              }
            `;
            const previous = cache.readFragment({ fragment, id });
            const data = {
              ...previous,
              isSelected: !previous?.isSelected,
            };
            cache.writeFragment({
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

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.from([localResolversLink, link]),
    });

    const observer = client.watchQuery({ query });

    const stream = new ObservableStream(observer);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    {
      const response = await stream.takeNext();
      const initial = { ...data };
      initial.list.items = initial.list.items.map((x) => ({
        ...x,
        isSelected: false,
      }));

      expect(response.data).toStrictEqualTyped(initial);
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
            return peopleData.find((p) => p.id === id);
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

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: { people: { __typename: "Person", id: "1", name: "John Smith" } },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await observable.refetch({ id: 2 });

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.refetch,
      partial: true,
    });
    await expect(stream).toEmitTypedValue({
      data: { people: { __typename: "Person", id: "2", name: "Sara Smith" } },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
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
    const localResolversLink = new LocalResolversLink({
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

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.from([localResolversLink, link]),
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

  // TODO: Double check this is the behavior we want. The value returned from
  // the local resolver is `null` since there is no resolver defined, so it
  // overwrites the cache value.
  it("should handle a simple query with both server and client fields", async () => {
    // The next line can be removed if a resolver is added to LocalResolversLink
    // using _ = spyOnConsole("warn");
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
    const localResolversLink = new LocalResolversLink();

    const client = new ApolloClient({
      cache,
      link: ApolloLink.from([localResolversLink, link]),
    });

    cache.writeQuery({
      query,
      data: {
        count: 0,
      },
    });

    const stream = new ObservableStream(client.watchQuery({ query }));

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: { count: 0, lastCount: 1 },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });

  it("should support nested querying of both server and client fields", async () => {
    // The next line can be removed if a resolver is added to LocalResolversLink
    using _ = spyOnConsole("warn");
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
      }).pipe(delay(20));
    });
    const localResolversLink = new LocalResolversLink();

    const client = new ApolloClient({
      cache,
      link: ApolloLink.from([localResolversLink, link]),
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

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: {
        user: {
          firstName: "John",
          lastName: "Doe",
          __typename: "User",
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });

  it("should combine both server and client mutations", async () => {
    // The next line can be removed if a resolver is added to LocalResolversLink
    using _ = spyOnConsole("warn");
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
        }).pipe(delay(20));
      }
      if (operation.operationName === "SampleMutation") {
        return of({
          data: { updateUser: { __typename: "User", firstName: "Harry" } },
        }).pipe(delay(20));
      }
      return of({
        errors: [new Error(`Unknown operation ${operation.operationName}`)],
      }).pipe(delay(20));
    });

    const localResolversLink = new LocalResolversLink({
      resolvers: {
        Mutation: {
          incrementCount: (_, __, { operation }) => {
            const { cache } = operation.client;

            const { count } = cache.readQuery<any>({ query: counterQuery });
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

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link: ApolloLink.from([localResolversLink, link]),
    });

    cache.writeQuery({
      query: counterQuery,
      data: {
        count: 0,
      },
    });

    const stream = new ObservableStream(client.watchQuery({ query }));

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: {
        count: 0,
        user: { __typename: "User", firstName: "John" },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await client.mutate<any>({
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

    await expect(stream).toEmitTypedValue({
      data: {
        count: 1,
        user: { __typename: "User", firstName: "Harry" },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
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
    const localResolversLink = new LocalResolversLink();

    const client = new ApolloClient({
      cache,
      link: ApolloLink.from([localResolversLink, link]),
    });

    const stream = new ObservableStream(client.watchQuery({ query }));

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: undefined,
      error: new CombinedGraphQLErrors({
        data: null,
        errors: [error],
      }),
      loading: false,
      networkStatus: NetworkStatus.error,
      partial: true,
    });
  });
});
