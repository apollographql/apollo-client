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

import { ApolloClient, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { ApolloLink } from "@apollo/client/link";
import { LocalState } from "@apollo/client/local-state";
import { MockSubscriptionLink } from "@apollo/client/testing";
import {
  ObservableStream,
  spyOnConsole,
} from "@apollo/client/testing/internal";
import { InvariantError } from "@apollo/client/utilities/invariant";

describe("General functionality", () => {
  test("should not impact normal non-@client use", async () => {
    const query = gql`
      {
        field
      }
    `;

    const link = new ApolloLink(() => of({ data: { field: 1 } }));
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      localState: new LocalState({
        resolvers: {
          Query: {
            count: () => 0,
          },
        },
      }),
    });

    await expect(client.query({ query })).resolves.toStrictEqualTyped({
      data: { field: 1 },
    });
  });

  test("should not interfere with server introspection queries", async () => {
    const query = gql`
      ${getIntrospectionQuery()}
    `;

    const error = new GraphQLError("no introspection result found");
    const link = new ApolloLink(() => of({ errors: [error] }));

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      localState: new LocalState({
        resolvers: {
          Query: {
            count: () => 0,
          },
        },
      }),
    });

    await expect(client.query({ query })).rejects.toThrow(/no introspection/);
  });

  test("should support returning default values from resolvers", async () => {
    const query = gql`
      {
        field @client
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      localState: new LocalState({
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

  test("should cache data for future lookups", async () => {
    const query = gql`
      {
        field @client
      }
    `;

    let count = 0;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      localState: new LocalState({
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

  test("should honour `fetchPolicy` settings", async () => {
    const query = gql`
      {
        field @client
      }
    `;

    let count = 0;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      localState: new LocalState({
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

  test("can configure local state after client is initialized", async () => {
    const query = gql`
      query {
        count @client
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });

    const localState = new LocalState({
      resolvers: {
        Query: {
          count: () => 0,
        },
      },
    });

    client.localState = localState;

    await expect(client.query({ query })).resolves.toStrictEqualTyped({
      data: { count: 0 },
    });
  });
});

describe("Cache manipulation", () => {
  test("should be able to query @client fields and the cache without defining resolvers in local state", async () => {
    const query = gql`
      {
        field @client
      }
    `;

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link: ApolloLink.empty(),
      localState: new LocalState(),
    });

    cache.writeQuery({ query, data: { field: "yo" } });

    await expect(client.query({ query })).resolves.toStrictEqualTyped({
      data: { field: "yo" },
    });
  });

  test("should be able to write to the cache using a local mutation", async () => {
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

    const localState = new LocalState({
      resolvers: {
        Mutation: {
          start: (_, __, { client }) => {
            client.cache.writeQuery({ query, data: { field: 1 } });
            return true;
          },
        },
      },
    });

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      localState,
    });

    await expect(client.mutate({ mutation })).resolves.toStrictEqualTyped({
      data: { start: true },
    });

    await expect(client.query({ query })).resolves.toStrictEqualTyped({
      data: { field: 1 },
    });
  });

  test("should be able to write to the cache with a local mutation and have things rerender automatically", async () => {
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

    const localState = new LocalState({
      resolvers: {
        Query: {
          field: () => 0,
        },
        Mutation: {
          start: (_1: any, _2: any, { client }) => {
            client.cache.writeQuery({ query, data: { field: 1 } });
            return true;
          },
        },
      },
    });

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      localState,
    });

    const stream = new ObservableStream(client.watchQuery({ query }));

    await expect(stream).toEmitTypedValue({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: { field: 0 },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await expect(client.mutate({ mutation })).resolves.toStrictEqualTyped({
      data: { start: true },
    });

    await expect(stream).toEmitTypedValue({
      data: { field: 1 },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });

  test("should support writing to the cache with a local mutation using variables", async () => {
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

    const localState = new LocalState({
      resolvers: {
        Mutation: {
          start: (_, variables: { field: string }, { client }) => {
            client.cache.writeQuery({
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
    });

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      localState,
    });

    await expect(
      client.mutate({ mutation, variables: { id: "1234" } })
    ).resolves.toStrictEqualTyped({
      data: { start: { field: "1234", __typename: "Field" } },
    });

    await expect(client.query({ query })).resolves.toStrictEqualTyped({
      data: { field: "1234" },
    });
  });

  test("should read @client fields from cache on refetch (#4741)", async () => {
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
      localState: new LocalState({
        resolvers: {
          Query: {
            selectedItemId() {
              return selectedItemId;
            },
          },
          Mutation: {
            select(_, { itemId }) {
              selectedItemId = itemId;
              return itemId;
            },
          },
        },
      }),
    });

    const stream = new ObservableStream(client.watchQuery({ query }));

    await expect(stream).toEmitTypedValue({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: {
        serverData,
        selectedItemId: -1,
      },
      dataState: "complete",
      loading: false,
      networkStatus: 7,
      partial: false,
    });

    await expect(
      client.mutate({
        mutation,
        variables: { id: 123 },
        refetchQueries: ["FetchInitialData"],
      })
    ).resolves.toStrictEqualTyped({ data: { select: 123 } });

    await expect(stream).toEmitTypedValue({
      data: { serverData, selectedItemId: -1 },
      dataState: "complete",
      loading: true,
      networkStatus: NetworkStatus.refetch,
      partial: false,
    });

    await expect(stream).toEmitTypedValue({
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

  test("should rerun @client(always: true) fields on entity update", async () => {
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
      localState: new LocalState({
        resolvers: {
          ClientData: {
            titleLength(data) {
              return data.title.length;
            },
          },
          Query: {
            clientEntity(_root, { id }, { client }) {
              const { cache } = client;

              return cache.readFragment({
                id: cache.identify({ id, __typename: "ClientData" }),
                fragment,
              });
            },
          },
          Mutation: {
            addOrUpdate(_root, { id, title }, { client }) {
              const { cache } = client;

              return cache.writeFragment({
                id: cache.identify({ id, __typename: "ClientData" }),
                fragment,
                data: { id, title, __typename: "ClientData" },
              });
            },
          },
        },
      }),
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
      client.watchQuery<any>({ query, variables: { id: entityId } })
    );

    await expect(stream).toEmitTypedValue({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

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

  test("runs read functions for nested @client fields without resolver warnings", async () => {
    using _ = spyOnConsole("warn");
    const query = gql`
      query {
        color {
          hex
          saved @client
        }
      }
    `;

    const link = new ApolloLink(() => {
      return of({ data: { color: { __typename: "Color", hex: "#000" } } }).pipe(
        delay(20)
      );
    });

    const read = jest.fn(() => false);

    const cache = new InMemoryCache({
      typePolicies: {
        Color: {
          keyFields: ["hex"],
          fields: {
            saved: { read },
          },
        },
      },
    });

    const client = new ApolloClient({
      link,
      cache,
      localState: new LocalState(),
    });

    const stream = new ObservableStream(client.watchQuery({ query }));

    await expect(stream).toEmitTypedValue({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: { color: { __typename: "Color", hex: "#000", saved: false } },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith(null, expect.anything());
    expect(console.warn).not.toHaveBeenCalled();
  });
});

describe("Sample apps", () => {
  test("should support a simple counter app using local state", async () => {
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

    const localState = new LocalState();

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
      localState,
    });

    const update = (
      query: DocumentNode,
      updater: (data: { count: number }, variables: { amount: number }) => any
    ): LocalState.Resolver<any, any, any, any> => {
      return (_result: {}, variables: { amount: number }, { client }): null => {
        const { cache } = client;

        const read = client.readQuery<{ count: number }>({
          query,
          variables,
        });
        if (read) {
          const data = updater(read, variables);
          cache.writeQuery({ query, variables, data });
          return data.count;
        }

        throw new Error("readQuery returned a falsy value");
      };
    };

    localState.addResolvers({
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
    });
    const stream = new ObservableStream(client.watchQuery({ query }));

    await expect(stream).toEmitTypedValue({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: { count: 0, lastCount: 1 },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await expect(
      client.mutate({ mutation: increment, variables: { amount: 2 } })
    ).resolves.toStrictEqualTyped({ data: { increment: 2 } });

    await expect(stream).toEmitTypedValue({
      data: { count: 2, lastCount: 1 },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await client.mutate({ mutation: decrement, variables: { amount: 1 } });

    await expect(stream).toEmitTypedValue({
      data: { count: 1, lastCount: 1 },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });

  test("should support a simple todo app using local state", async () => {
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

    const localState = new LocalState();

    const client = new ApolloClient({
      link: ApolloLink.empty(),
      cache: new InMemoryCache(),
      localState,
    });

    interface Todo {
      title: string;
      message: string;
      __typename: string;
    }

    const update = (
      query: DocumentNode,
      updater: (todos: any, variables: Todo) => any
    ): LocalState.Resolver<any, any, any, any> => {
      return (_result, variables: Todo, { client }): null => {
        const { cache } = client;

        const data = updater(client.readQuery({ query, variables }), variables);
        cache.writeQuery({ query, variables, data });
        return null;
      };
    };

    localState.addResolvers({
      Query: {
        todos: () => [],
      },
      Mutation: {
        addTodo: update(query, ({ todos }, { title, message }: Todo) => ({
          todos: todos.concat([{ message, title, __typename: "Todo" }]),
        })),
      },
    });

    const stream = new ObservableStream(client.watchQuery<any>({ query }));

    await expect(stream).toEmitTypedValue({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    {
      const { data } = await stream.takeNext();

      expect(data).toEqual({ todos: [] });
    }

    await expect(
      client.mutate({
        mutation,
        variables: {
          title: "Apollo Client 2.0",
          message: "ship it",
        },
      })
    ).resolves.toStrictEqualTyped({ data: { addTodo: null } });

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
  test("should merge remote and local state", async () => {
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

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      localState: new LocalState({
        resolvers: {
          Mutation: {
            toggleItem: async (_, { id }, { client }) => {
              const { cache } = client;

              id = `ListItem:${id}`;
              const fragment = gql`
                fragment item on ListItem {
                  __typename
                  isSelected
                }
              `;
              const previous = cache.readFragment<any>({ fragment, id });
              const data = {
                ...previous,
                isSelected: !previous.isSelected,
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
      }),
    });

    const observer = client.watchQuery({ query });

    const stream = new ObservableStream(observer);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      dataState: "empty",
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

  test("query resolves with loading: false if subsequent responses contain the same data", async () => {
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
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: { people: { __typename: "Person", id: "1", name: "John Smith" } },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await observable.refetch({ id: 2 });

    await expect(stream).toEmitTypedValue({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.refetch,
      partial: true,
    });
    await expect(stream).toEmitTypedValue({
      data: { people: { __typename: "Person", id: "2", name: "Sara Smith" } },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });

  test("should correctly propagate an error from a client resolver", async () => {
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
      localState: new LocalState({
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
      }),
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

    await expect(client.query({ query, variables })).rejects.toStrictEqualTyped(
      new CombinedGraphQLErrors({
        data: { hasBeenIllegallyTouched: null },
        errors: [
          {
            message: "Illegal Query Operation Occurred",
            path: ["hasBeenIllegallyTouched"],
            extensions: {
              localState: {
                resolver: "Query.hasBeenIllegallyTouched",
                cause: new Error("Illegal Query Operation Occurred"),
              },
            },
          },
        ],
      })
    );

    await expect(
      client.mutate({ mutation, variables })
    ).rejects.toStrictEqualTyped(
      new CombinedGraphQLErrors({
        data: { touchIllegally: null },
        errors: [
          {
            message: "Illegal Mutation Operation Occurred",
            path: ["touchIllegally"],
            extensions: {
              localState: {
                resolver: "Mutation.touchIllegally",
                cause: new Error("Illegal Mutation Operation Occurred"),
              },
            },
          },
        ],
      })
    );
  });

  test("should handle a simple query with both server and client fields", async () => {
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
      localState: new LocalState(),
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
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: { count: 0, lastCount: 1 },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });

  test("should support nested querying of both server and client fields", async () => {
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

    const client = new ApolloClient({
      cache,
      link,
      localState: new LocalState(),
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
      dataState: "empty",
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
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });

  test("should combine both server and client mutations", async () => {
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

    const link = new ApolloLink((operation): Observable<{}> => {
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

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link,
      localState: new LocalState({
        resolvers: {
          Mutation: {
            incrementCount: (_, __, { client }) => {
              const { cache } = client;

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
      }),
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
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: {
        count: 0,
        user: { __typename: "User", firstName: "John" },
      },
      dataState: "complete",
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
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });

  test("handles server errors when root data property is null", async () => {
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
      localState: new LocalState(),
    });

    const stream = new ObservableStream(client.watchQuery({ query }));

    await expect(stream).toEmitTypedValue({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: undefined,
      dataState: "empty",
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

test("throws when executing queries with client fields when local state is not configured", async () => {
  const query = gql`
    query GetUser {
      user {
        firstName @client
        lastName
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(() => {
      return of({ data: { user: { __typename: "User", lastName: "Smith" } } });
    }),
  });

  await expect(client.query({ query })).rejects.toEqual(
    new InvariantError(
      "Query 'GetUser' contains `@client` fields but local state has not been configured."
    )
  );
});

test("throws when executing mutations with client fields when local state is not configured", async () => {
  const mutation = gql`
    mutation UpdateUser {
      updateUser {
        firstName @client
        lastName
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(() => {
      return of({
        data: { updateUser: { __typename: "User", lastName: "Smith" } },
      });
    }),
  });

  await expect(client.mutate({ mutation })).rejects.toEqual(
    new InvariantError(
      "Mutation 'UpdateUser' contains `@client` fields but local state has not been configured."
    )
  );
});

test("throws when executing subscriptions with client fields when local state is not configured", async () => {
  const subscription = gql`
    subscription OnUserUpdate {
      onUpdateUser {
        firstName @client
        lastName
      }
    }
  `;

  const link = new MockSubscriptionLink();
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link,
  });
  const stream = new ObservableStream(
    client.subscribe({ query: subscription })
  );

  await expect(stream).toEmitError(
    new InvariantError(
      "Subscription 'OnUserUpdate' contains `@client` fields but local state has not been configured."
    )
  );
});
