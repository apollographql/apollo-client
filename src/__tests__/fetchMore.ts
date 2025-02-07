import { assign, cloneDeep } from "lodash";
import gql from "graphql-tag";

import {
  ApolloClient,
  ApolloLink,
  NetworkStatus,
  TypedDocumentNode,
} from "../core";

import {
  Observable,
  offsetLimitPagination,
  concatPagination,
} from "../utilities";

import {
  ApolloCache,
  InMemoryCache,
  InMemoryCacheConfig,
  FieldMergeFunction,
} from "../cache";

import { MockedResponse, mockSingleLink } from "../testing";
import { ObservableStream, setupPaginatedCase } from "../testing/internal";

describe("updateQuery on a simple query", () => {
  const query = gql`
    query thing {
      entry {
        value
        __typename
      }
      __typename
    }
  `;
  const result = {
    data: {
      __typename: "Query",
      entry: {
        __typename: "Entry",
        value: 1,
      },
    },
  };

  it("triggers new result from updateQuery", async () => {
    const link = mockSingleLink({
      request: { query },
      result,
    });

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const observable = client.watchQuery({ query });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitMatchedValue({
      data: { entry: { value: 1 } },
    });

    observable.updateQuery((prevResult: any) => {
      const res = cloneDeep(prevResult);
      res.entry.value = 2;
      return res;
    });

    await expect(stream).toEmitMatchedValue({
      data: { entry: { value: 2 } },
    });
  });
});

describe("updateQuery on a query with required and optional variables", () => {
  const query = gql`
    query thing($requiredVar: String!, $optionalVar: String) {
      entry(requiredVar: $requiredVar, optionalVar: $optionalVar) {
        value
        __typename
      }
      __typename
    }
  `;
  // the test will pass if optionalVar is uncommented
  const variables = {
    requiredVar: "x",
    // optionalVar: 'y',
  };
  const result = {
    data: {
      __typename: "Query",
      entry: {
        __typename: "Entry",
        value: 1,
      },
    },
  };

  it("triggers new result from updateQuery", async () => {
    const link = mockSingleLink({
      request: {
        query,
        variables,
      },
      result,
    });

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const observable = client.watchQuery({
      query,
      variables,
    });

    const stream = new ObservableStream(observable);

    await expect(stream).toEmitMatchedValue({
      data: { entry: { value: 1 } },
    });

    observable.updateQuery((prevResult: any) => {
      const res = cloneDeep(prevResult);
      res.entry.value = 2;
      return res;
    });

    await expect(stream).toEmitMatchedValue({
      data: { entry: { value: 2 } },
    });
  });
});

describe("fetchMore on an observable query", () => {
  type TCommentData = {
    entry: {
      __typename: string;
      comments: Array<{
        __typename: string;
        text: string;
      }>;
    };
  };

  type TCommentVars = {
    repoName: string;
    start: number;
    limit: number;
  };

  const query: TypedDocumentNode<TCommentData, TCommentVars> = gql`
    query Comment($repoName: String!, $start: Int!, $limit: Int!) {
      entry(repoFullName: $repoName) {
        comments(start: $start, limit: $limit) {
          text
          __typename
        }
        __typename
      }
    }
  `;
  const query2: TypedDocumentNode<
    TCommentData["entry"],
    Omit<TCommentVars, "repoName">
  > = gql`
    query NewComments($start: Int!, $limit: Int!) {
      comments(start: $start, limit: $limit) {
        text
        __typename
      }
      __typename
    }
  `;
  const variables = {
    repoName: "org/repo",
    start: 0,
    limit: 10,
  };
  const variablesMore = assign({}, variables, { start: 10, limit: 10 });
  const variables2 = {
    start: 10,
    limit: 20,
  };

  const result: any = {
    data: {
      __typename: "Query",
      entry: {
        __typename: "Entry",
        comments: [],
      },
    },
  };
  const resultMore = cloneDeep(result);
  const result2: any = {
    data: {
      __typename: "Query",
      comments: [],
    },
  };
  for (let i = 1; i <= 10; i++) {
    result.data.entry.comments.push({
      text: `comment ${i}`,
      __typename: "Comment",
    });
  }
  for (let i = 11; i <= 20; i++) {
    resultMore.data.entry.comments.push({
      text: `comment ${i}`,
      __typename: "Comment",
    });
    result2.data.comments.push({
      text: `new comment ${i}`,
      __typename: "Comment",
    });
  }

  function setup(...mockedResponses: MockedResponse[]) {
    const link = mockSingleLink(
      {
        request: {
          query,
          variables,
        },
        result,
      },
      ...mockedResponses
    );

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              entry: {
                merge: false,
              },
            },
          },
        },
      }),
    });

    return client.watchQuery({
      query,
      variables,
    });
  }

  function setupWithCacheConfig(
    cacheConfig: InMemoryCacheConfig,
    ...mockedResponses: any[]
  ) {
    const client = new ApolloClient({
      link: mockSingleLink(
        {
          request: {
            query,
            variables,
          },
          result,
        },
        ...mockedResponses
      ),
      cache: new InMemoryCache(cacheConfig),
    });

    return client.watchQuery({
      query,
      variables,
    });
  }

  describe("triggers new result with async new variables", () => {
    it("updateQuery", async () => {
      const observable = setup({
        request: {
          query,
          variables: variablesMore,
        },
        result: resultMore,
      });

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(false);
        expect(result.data!.entry.comments).toHaveLength(10);
      }

      {
        const fetchMoreResult = await observable.fetchMore({
          // Rely on the fact that the original variables had limit: 10
          variables: { start: 10 },
          updateQuery: (prev, options) => {
            expect(options.variables).toEqual(variablesMore);

            const state = cloneDeep(prev) as any;
            state.entry.comments = [
              ...state.entry.comments,
              ...options.fetchMoreResult.entry.comments,
            ];
            return state;
          },
        });

        // This is the server result
        expect(fetchMoreResult.loading).toBe(false);
        expect(fetchMoreResult.data!.entry.comments).toHaveLength(10);
      }

      {
        const result = await stream.takeNext();
        const combinedComments = result.data!.entry.comments;

        expect(combinedComments).toHaveLength(20);

        for (let i = 1; i <= 20; i++) {
          expect(combinedComments[i - 1].text).toEqual(`comment ${i}`);
        }
      }

      await expect(stream).not.toEmitAnything();
    });

    it("field policy", async () => {
      const observable = setupWithCacheConfig(
        {
          typePolicies: {
            Entry: {
              fields: {
                comments: concatPagination(),
              },
            },
          },
        },
        {
          request: { query, variables: variablesMore },
          result: resultMore,
        }
      );

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(false);
        expect(result.data!.entry.comments).toHaveLength(10);
      }

      {
        const fetchMoreResult = await observable.fetchMore({
          // Rely on the fact that the original variables had limit: 10
          variables: { start: 10 },
        });

        // This is the server result
        expect(fetchMoreResult.loading).toBe(false);
        expect(fetchMoreResult.data!.entry.comments).toHaveLength(10);
      }

      {
        const result = await stream.takeNext();
        const combinedComments = result.data!.entry.comments;

        expect(result.loading).toBe(false);
        expect(combinedComments).toHaveLength(20);

        combinedComments.forEach((comment, i) => {
          expect(comment.text).toEqual(`comment ${i + 1}`);
        });
      }

      await expect(stream).not.toEmitAnything();
    });
  });

  describe("basic fetchMore results merging", () => {
    it("updateQuery", async () => {
      const observable = setup({
        request: {
          query,
          variables: variablesMore,
        },
        result: resultMore,
      });

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(false);
        expect(result.data!.entry.comments).toHaveLength(10);
      }

      {
        const fetchMoreResult = await observable.fetchMore({
          variables: { start: 10 }, // rely on the fact that the original variables had limit: 10
          updateQuery: (prev, options) => {
            expect(options.variables).toEqual(variablesMore);
            const state = cloneDeep(prev) as any;
            state.entry.comments = [
              ...state.entry.comments,
              ...options.fetchMoreResult.entry.comments,
            ];
            return state;
          },
        });

        const fetchMoreComments = fetchMoreResult.data!.entry.comments;

        expect(fetchMoreResult.loading).toBe(false);
        expect(fetchMoreComments).toHaveLength(10);
        fetchMoreComments.forEach((comment, i) => {
          expect(comment.text).toEqual(`comment ${i + 11}`);
        });
      }

      {
        const result = await stream.takeNext();
        const combinedComments = result.data!.entry.comments;

        expect(result.loading).toBe(false);
        expect(combinedComments).toHaveLength(20);

        combinedComments.forEach((comment, i) => {
          expect(comment.text).toEqual(`comment ${i + 1}`);
        });
      }

      await expect(stream).not.toEmitAnything();
    });

    it("field policy", async () => {
      const observable = setupWithCacheConfig(
        {
          typePolicies: {
            Entry: {
              fields: {
                comments: concatPagination(),
              },
            },
          },
        },
        {
          request: {
            query,
            variables: variablesMore,
          },
          result: resultMore,
        }
      );

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(false);
        expect(result.data!.entry.comments).toHaveLength(10);
      }

      {
        const fetchMoreResult = await observable.fetchMore({
          // rely on the fact that the original variables had limit: 10
          variables: { start: 10 },
        });

        expect(fetchMoreResult.loading).toBe(false);
        expect(fetchMoreResult.data!.entry.comments).toHaveLength(10); // this is the server result
      }

      {
        const result = await stream.takeNext();
        const combinedComments = result.data!.entry.comments;

        expect(result.loading).toBe(false);
        expect(combinedComments).toHaveLength(20);

        combinedComments.forEach((comment, i) => {
          expect(comment.text).toEqual(`comment ${i + 1}`);
        });
      }

      await expect(stream).not.toEmitAnything();
    });
  });

  describe("fetchMore interaction with network fetch policies", () => {
    const tasks = [
      { __typename: "Task", id: 1, text: "first task" },
      { __typename: "Task", id: 2, text: "second task" },
      { __typename: "Task", id: 3, text: "third task" },
      { __typename: "Task", id: 4, text: "fourth task" },
      { __typename: "Task", id: 5, text: "fifth task" },
      { __typename: "Task", id: 6, text: "sixth task" },
      { __typename: "Task", id: 7, text: "seventh task" },
      { __typename: "Task", id: 8, text: "eighth task" },
    ];

    const query = gql`
      query GetTODOs {
        TODO {
          id
          text
        }
      }
    `;

    function makeClient(): {
      client: ApolloClient<any>;
      linkRequests: Array<{
        operationName: string;
        offset: number;
        limit: number;
      }>;
    } {
      const linkRequests: Array<{
        operationName: string;
        offset: number;
        limit: number;
      }> = [];

      const client = new ApolloClient({
        link: new ApolloLink(
          (operation) =>
            new Observable((observer) => {
              const {
                variables: { offset = 0, limit = 2 },
              } = operation;

              linkRequests.push({
                operationName: operation.operationName,
                offset,
                limit,
              });

              observer.next({
                data: {
                  TODO: tasks.slice(offset, offset + limit),
                },
              });

              observer.complete();
            })
        ),

        cache: new InMemoryCache({
          typePolicies: {
            Query: {
              fields: {
                TODO: concatPagination(),
              },
            },
          },
        }),
      });

      return {
        client,
        linkRequests,
      };
    }

    function checkCacheExtract1234678(cache: ApolloCache<any>) {
      expect(cache.extract()).toEqual({
        ROOT_QUERY: {
          __typename: "Query",
          TODO: [
            { __ref: "Task:1" },
            { __ref: "Task:2" },
            { __ref: "Task:3" },
            { __ref: "Task:4" },
            { __ref: "Task:6" },
            { __ref: "Task:7" },
            { __ref: "Task:8" },
          ],
        },
        "Task:1": tasks[0],
        "Task:2": tasks[1],
        "Task:3": tasks[2],
        "Task:4": tasks[3],
        "Task:6": tasks[5],
        "Task:7": tasks[6],
        "Task:8": tasks[7],
      });
    }

    it("cache-and-network", async () => {
      const { client, linkRequests } = makeClient();

      const observable = client.watchQuery({
        query,
        fetchPolicy: "cache-and-network",
        variables: {
          offset: 0,
          limit: 2,
        },
      });

      expect(linkRequests.length).toBe(0);

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        loading: false,
        networkStatus: NetworkStatus.ready,
        data: {
          TODO: tasks.slice(0, 2),
        },
        partial: false,
      });

      expect(linkRequests).toEqual([
        { operationName: "GetTODOs", offset: 0, limit: 2 },
      ]);

      {
        const fetchMoreResult = await observable.fetchMore({
          variables: {
            offset: 2,
          },
        });

        expect(fetchMoreResult).toEqualApolloQueryResult({
          loading: false,
          networkStatus: NetworkStatus.ready,
          data: {
            TODO: tasks.slice(2, 4),
          },
          partial: false,
        });
      }

      await expect(stream).toEmitApolloQueryResult({
        loading: false,
        networkStatus: NetworkStatus.ready,
        data: {
          TODO: tasks.slice(0, 4),
        },
        partial: false,
      });

      expect(linkRequests).toEqual([
        { operationName: "GetTODOs", offset: 0, limit: 2 },
        { operationName: "GetTODOs", offset: 2, limit: 2 },
      ]);

      {
        const fetchMoreResult = await observable.fetchMore({
          variables: {
            offset: 5,
            limit: 3,
          },
        });

        expect(fetchMoreResult).toEqualApolloQueryResult({
          loading: false,
          networkStatus: NetworkStatus.ready,
          data: {
            TODO: tasks.slice(5, 8),
          },
          partial: false,
        });
      }

      await expect(stream).toEmitApolloQueryResult({
        loading: false,
        networkStatus: NetworkStatus.ready,
        data: {
          TODO: [...tasks.slice(0, 4), ...tasks.slice(5, 8)],
        },
        partial: false,
      });

      expect(linkRequests).toEqual([
        { operationName: "GetTODOs", offset: 0, limit: 2 },
        { operationName: "GetTODOs", offset: 2, limit: 2 },
        { operationName: "GetTODOs", offset: 5, limit: 3 },
      ]);

      checkCacheExtract1234678(client.cache);

      await expect(stream).not.toEmitAnything();
    });

    it("cache-and-network with notifyOnNetworkStatusChange: true", async () => {
      const { client, linkRequests } = makeClient();

      const observable = client.watchQuery({
        query,
        fetchPolicy: "cache-and-network",
        notifyOnNetworkStatusChange: true,
        variables: {
          offset: 0,
          limit: 2,
        },
      });

      expect(linkRequests.length).toBe(0);

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        loading: false,
        networkStatus: NetworkStatus.ready,
        data: {
          TODO: tasks.slice(0, 2),
        },
        partial: false,
      });

      expect(linkRequests).toEqual([
        { operationName: "GetTODOs", offset: 0, limit: 2 },
      ]);

      {
        const fetchMoreResult = await observable.fetchMore({
          variables: {
            offset: 2,
          },
        });

        expect(fetchMoreResult).toEqualApolloQueryResult({
          loading: false,
          networkStatus: NetworkStatus.ready,
          data: {
            TODO: tasks.slice(2, 4),
          },
          partial: false,
        });
      }

      await expect(stream).toEmitApolloQueryResult({
        loading: true,
        networkStatus: NetworkStatus.fetchMore,
        data: {
          TODO: tasks.slice(0, 2),
        },
        partial: false,
      });

      await expect(stream).toEmitApolloQueryResult({
        loading: false,
        networkStatus: NetworkStatus.ready,
        data: {
          TODO: tasks.slice(0, 4),
        },
        partial: false,
      });

      expect(linkRequests).toEqual([
        { operationName: "GetTODOs", offset: 0, limit: 2 },
        { operationName: "GetTODOs", offset: 2, limit: 2 },
      ]);

      {
        const fetchMoreResult = await observable.fetchMore({
          variables: {
            offset: 5,
            limit: 3,
          },
        });

        expect(fetchMoreResult).toEqualApolloQueryResult({
          loading: false,
          networkStatus: NetworkStatus.ready,
          data: {
            TODO: tasks.slice(5, 8),
          },
          partial: false,
        });
      }

      await expect(stream).toEmitApolloQueryResult({
        loading: true,
        networkStatus: NetworkStatus.fetchMore,
        data: {
          TODO: tasks.slice(0, 4),
        },
        partial: false,
      });

      await expect(stream).toEmitApolloQueryResult({
        loading: false,
        networkStatus: NetworkStatus.ready,
        data: {
          TODO: [...tasks.slice(0, 4), ...tasks.slice(5, 8)],
        },
        partial: false,
      });

      expect(linkRequests).toEqual([
        { operationName: "GetTODOs", offset: 0, limit: 2 },
        { operationName: "GetTODOs", offset: 2, limit: 2 },
        { operationName: "GetTODOs", offset: 5, limit: 3 },
      ]);

      checkCacheExtract1234678(client.cache);

      await expect(stream).not.toEmitAnything();
    });

    it("network-only", async () => {
      const { client, linkRequests } = makeClient();

      const observable = client.watchQuery({
        query,
        fetchPolicy: "network-only",
        variables: {
          offset: 0,
          limit: 2,
        },
      });

      expect(linkRequests.length).toBe(0);

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        loading: false,
        networkStatus: NetworkStatus.ready,
        data: {
          TODO: tasks.slice(0, 2),
        },
        partial: false,
      });

      expect(linkRequests).toEqual([
        { operationName: "GetTODOs", offset: 0, limit: 2 },
      ]);

      {
        const fetchMoreResult = await observable.fetchMore({
          variables: {
            offset: 2,
          },
        });

        expect(fetchMoreResult).toEqualApolloQueryResult({
          loading: false,
          networkStatus: NetworkStatus.ready,
          data: {
            TODO: tasks.slice(2, 4),
          },
          partial: false,
        });
      }

      await expect(stream).toEmitApolloQueryResult({
        loading: false,
        networkStatus: NetworkStatus.ready,
        data: {
          TODO: tasks.slice(0, 4),
        },
        partial: false,
      });

      expect(linkRequests).toEqual([
        { operationName: "GetTODOs", offset: 0, limit: 2 },
        { operationName: "GetTODOs", offset: 2, limit: 2 },
      ]);

      {
        const fetchMoreResult = await observable.fetchMore({
          variables: {
            offset: 5,
            limit: 3,
          },
        });

        expect(fetchMoreResult).toEqualApolloQueryResult({
          loading: false,
          networkStatus: NetworkStatus.ready,
          data: {
            TODO: tasks.slice(5, 8),
          },
          partial: false,
        });
      }

      await expect(stream).toEmitApolloQueryResult({
        loading: false,
        networkStatus: NetworkStatus.ready,
        data: {
          TODO: [...tasks.slice(0, 4), ...tasks.slice(5, 8)],
        },
        partial: false,
      });

      expect(linkRequests).toEqual([
        { operationName: "GetTODOs", offset: 0, limit: 2 },
        { operationName: "GetTODOs", offset: 2, limit: 2 },
        { operationName: "GetTODOs", offset: 5, limit: 3 },
      ]);
      checkCacheExtract1234678(client.cache);

      await expect(stream).not.toEmitAnything();
    });

    it("network-only with notifyOnNetworkStatusChange: true", async () => {
      const { client, linkRequests } = makeClient();

      const observable = client.watchQuery({
        query,
        fetchPolicy: "network-only",
        notifyOnNetworkStatusChange: true,
        variables: {
          offset: 0,
          limit: 2,
        },
      });

      expect(linkRequests.length).toBe(0);

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        loading: false,
        networkStatus: NetworkStatus.ready,
        data: {
          TODO: tasks.slice(0, 2),
        },
        partial: false,
      });

      expect(linkRequests).toEqual([
        { operationName: "GetTODOs", offset: 0, limit: 2 },
      ]);

      {
        const fetchMoreResult = await observable.fetchMore({
          variables: {
            offset: 2,
          },
        });

        expect(fetchMoreResult).toEqualApolloQueryResult({
          loading: false,
          networkStatus: NetworkStatus.ready,
          data: {
            TODO: tasks.slice(2, 4),
          },
          partial: false,
        });
      }

      await expect(stream).toEmitApolloQueryResult({
        loading: true,
        networkStatus: NetworkStatus.fetchMore,
        data: {
          TODO: tasks.slice(0, 2),
        },
        partial: false,
      });

      await expect(stream).toEmitApolloQueryResult({
        loading: false,
        networkStatus: NetworkStatus.ready,
        data: {
          TODO: tasks.slice(0, 4),
        },
        partial: false,
      });

      expect(linkRequests).toEqual([
        { operationName: "GetTODOs", offset: 0, limit: 2 },
        { operationName: "GetTODOs", offset: 2, limit: 2 },
      ]);

      {
        const fetchMoreResult = await observable.fetchMore({
          variables: {
            offset: 5,
            limit: 3,
          },
        });

        expect(fetchMoreResult).toEqualApolloQueryResult({
          loading: false,
          networkStatus: NetworkStatus.ready,
          data: {
            TODO: tasks.slice(5, 8),
          },
          partial: false,
        });
      }

      await expect(stream).toEmitApolloQueryResult({
        loading: true,
        networkStatus: NetworkStatus.fetchMore,
        data: {
          TODO: tasks.slice(0, 4),
        },
        partial: false,
      });

      await expect(stream).toEmitApolloQueryResult({
        loading: false,
        networkStatus: NetworkStatus.ready,
        data: {
          TODO: [...tasks.slice(0, 4), ...tasks.slice(5, 8)],
        },
        partial: false,
      });

      expect(linkRequests).toEqual([
        { operationName: "GetTODOs", offset: 0, limit: 2 },
        { operationName: "GetTODOs", offset: 2, limit: 2 },
        { operationName: "GetTODOs", offset: 5, limit: 3 },
      ]);
      checkCacheExtract1234678(client.cache);

      await expect(stream).not.toEmitAnything();
    });
  });

  it("fetchMore passes new args to field merge function", async () => {
    const mergeArgsHistory: (Record<string, any> | null)[] = [];
    const groceriesFieldPolicy = offsetLimitPagination();
    const { merge } = groceriesFieldPolicy;
    groceriesFieldPolicy.merge = function (existing, incoming, options) {
      mergeArgsHistory.push(options.args);
      return (merge as FieldMergeFunction<any>).call(
        this,
        existing,
        incoming,
        options
      );
    };

    const cache = new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            groceries: groceriesFieldPolicy,
          },
        },
      },
    });

    const query = gql`
      query GroceryList($offset: Int!, $limit: Int!) {
        groceries(offset: $offset, limit: $limit) {
          id
          item
          found
        }
      }
    `;

    const initialVars = {
      offset: 0,
      limit: 2,
    };

    const initialGroceries = [
      {
        __typename: "GroceryItem",
        id: 1,
        item: "organic whole milk",
        found: false,
      },
      {
        __typename: "GroceryItem",
        id: 2,
        item: "beer that we both like",
        found: false,
      },
    ];

    const additionalVars = {
      offset: 2,
      limit: 3,
    };

    const additionalGroceries = [
      {
        __typename: "GroceryItem",
        id: 3,
        item: "gluten-free pasta",
        found: false,
      },
      {
        __typename: "GroceryItem",
        id: 4,
        item: "goat cheese",
        found: false,
      },
      {
        __typename: "GroceryItem",
        id: 5,
        item: "paper towels",
        found: false,
      },
    ];

    const finalGroceries = [...initialGroceries, ...additionalGroceries];

    const client = new ApolloClient({
      cache,
      link: mockSingleLink(
        {
          request: {
            query,
            variables: initialVars,
          },
          result: {
            data: {
              groceries: initialGroceries,
            },
          },
        },
        {
          request: {
            query,
            variables: additionalVars,
          },
          result: {
            data: {
              groceries: additionalGroceries,
            },
          },
        }
      ),
    });

    const observable = client.watchQuery({
      query,
      variables: initialVars,
    });

    const stream = new ObservableStream(observable);

    await expect(stream).toEmitApolloQueryResult({
      loading: false,
      networkStatus: NetworkStatus.ready,
      data: {
        groceries: initialGroceries,
      },
      partial: false,
    });

    expect(mergeArgsHistory).toEqual([{ offset: 0, limit: 2 }]);

    {
      const fetchMoreResult = await observable.fetchMore({
        variables: {
          offset: 2,
          limit: 3,
        },
      });

      expect(fetchMoreResult).toEqualApolloQueryResult({
        loading: false,
        networkStatus: NetworkStatus.ready,
        data: {
          groceries: additionalGroceries,
        },
        partial: false,
      });

      expect(observable.options.fetchPolicy).toBe("cache-first");
    }

    // This result comes entirely from the cache, without updating the
    // original variables for the ObservableQuery, because the
    // offsetLimitPagination field policy has keyArgs:false.
    await expect(stream).toEmitApolloQueryResult({
      loading: false,
      networkStatus: NetworkStatus.ready,
      data: {
        groceries: finalGroceries,
      },
      partial: false,
    });

    expect(mergeArgsHistory).toEqual([
      { offset: 0, limit: 2 },
      { offset: 2, limit: 3 },
    ]);

    await expect(stream).not.toEmitAnything();
  });

  it("fetching more with a different query", async () => {
    const observable = setup({
      request: {
        query: query2,
        variables: variables2,
      },
      result: result2,
    });

    const stream = new ObservableStream(observable);

    {
      const result = await stream.takeNext();

      expect(result.loading).toBe(false);
      expect(result.data!.entry.comments).toHaveLength(10);
    }

    {
      const fetchMoreResult = await observable.fetchMore({
        query: query2,
        variables: variables2,
        updateQuery: (prev, options) => {
          const state = cloneDeep(prev) as any;
          state.entry.comments = [
            ...state.entry.comments,
            ...options.fetchMoreResult.comments,
          ];
          return state;
        },
      });

      expect(fetchMoreResult.loading).toBe(false);
      expect(fetchMoreResult.data!.comments).toHaveLength(10);
    }

    {
      const result = await stream.takeNext();
      const combinedComments = result.data!.entry.comments;

      expect(result.loading).toBe(false);
      expect(combinedComments).toHaveLength(20);

      for (let i = 1; i <= 10; i++) {
        expect(combinedComments[i - 1].text).toEqual(`comment ${i}`);
      }
      for (let i = 11; i <= 20; i++) {
        expect(combinedComments[i - 1].text).toEqual(`new comment ${i}`);
      }
    }

    await expect(stream).not.toEmitAnything();
  });

  describe("will not get an error from `fetchMore` if thrown", () => {
    it("updateQuery", async () => {
      const fetchMoreError = new Error("Uh, oh!");
      const link = mockSingleLink(
        {
          request: { query, variables },
          result,
          delay: 5,
        },
        {
          request: { query, variables: variablesMore },
          error: fetchMoreError,
          delay: 5,
        }
      );

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const observable = client.watchQuery({
        query,
        variables,
        notifyOnNetworkStatusChange: true,
      });

      const stream = new ObservableStream(observable);

      const { data, networkStatus } = await stream.takeNext();

      expect(networkStatus).toBe(NetworkStatus.ready);
      expect(data!.entry.comments.length).toBe(10);

      const error = await observable
        .fetchMore({
          variables: { start: 10 },
          updateQuery: () => {
            throw new Error("should not have called updateQuery");
          },
        })
        .catch((error) => error);

      expect(error.networkError).toBe(fetchMoreError);
    });

    it("field policy", async () => {
      const fetchMoreError = new Error("Uh, oh!");
      const link = mockSingleLink(
        {
          request: { query, variables },
          result,
          delay: 5,
        },
        {
          request: { query, variables: variablesMore },
          error: fetchMoreError,
          delay: 5,
        }
      );

      let calledFetchMore = false;

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({
          typePolicies: {
            Entry: {
              fields: {
                comments: {
                  keyArgs: false,
                  merge(_, incoming) {
                    if (calledFetchMore) {
                      throw new Error("should not have called merge");
                    }
                    return incoming;
                  },
                },
              },
            },
          },
        }),
      });

      const observable = client.watchQuery({
        query,
        variables,
        notifyOnNetworkStatusChange: true,
      });

      const stream = new ObservableStream(observable);

      const { data, networkStatus } = await stream.takeNext();

      expect(networkStatus).toBe(NetworkStatus.ready);
      expect(data!.entry.comments.length).toBe(10);

      const error = await observable
        .fetchMore({
          variables: { start: 10 },
        })
        .catch((error) => error);

      expect(error.networkError).toBe(fetchMoreError);
    });
  });

  it("will not leak fetchMore query", async () => {
    const observable = setup({
      request: {
        query,
        variables: variablesMore,
      },
      result: resultMore,
    });

    function count(): number {
      return (observable as any).queryManager.queries.size;
    }

    const beforeQueryCount = count();

    await observable.fetchMore({
      variables: { start: 10 }, // rely on the fact that the original variables had limit: 10
    });

    expect(count()).toBe(beforeQueryCount);
  });

  it("delivers all loading states even if data unchanged", async () => {
    type TEmptyItems = {
      emptyItems: Array<{
        text: string;
      }>;
    };

    const query: TypedDocumentNode<TEmptyItems> = gql`
      query GetNothing {
        emptyItems {
          text
        }
      }
    `;

    const variables = {};

    const emptyItemsMock = {
      request: {
        query,
        variables,
      },
      result: {
        data: {
          emptyItems: [],
        },
      },
    };

    const link = mockSingleLink(emptyItemsMock, emptyItemsMock, emptyItemsMock);

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const observable = client.watchQuery({
      query,
      variables,
      notifyOnNetworkStatusChange: true,
    });

    const stream = new ObservableStream(observable);

    await expect(stream).toEmitApolloQueryResult({
      loading: false,
      networkStatus: NetworkStatus.ready,
      data: {
        emptyItems: [],
      },
      partial: false,
    });

    const fetchMoreResult = await observable.fetchMore({
      variables,
    });

    expect(fetchMoreResult).toEqualApolloQueryResult({
      loading: false,
      networkStatus: NetworkStatus.ready,
      data: { emptyItems: [] },
      partial: false,
    });

    await expect(stream).toEmitApolloQueryResult({
      loading: true,
      networkStatus: NetworkStatus.fetchMore,
      data: {
        emptyItems: [],
      },
      partial: false,
    });

    await expect(stream).toEmitApolloQueryResult({
      loading: false,
      networkStatus: NetworkStatus.ready,
      data: {
        emptyItems: [],
      },
      partial: false,
    });

    await expect(stream).not.toEmitAnything();
  });
});

describe("fetchMore on an observable query with connection", () => {
  type TEntryComments = {
    entry: {
      comments: Array<{
        text: string;
        __typename?: string;
      }>;
      __typename?: string;
    };
  };

  type TEntryVars = {
    repoName: string;
    start: number;
    limit: number;
  };

  const query: TypedDocumentNode<TEntryComments, TEntryVars> = gql`
    query Comment($repoName: String!, $start: Int!, $limit: Int!) {
      entry(repoFullName: $repoName, start: $start, limit: $limit)
        @connection(key: "repoName") {
        comments {
          text
        }
      }
    }
  `;
  const transformedQuery: TypedDocumentNode<TEntryComments, TEntryVars> = gql`
    query Comment($repoName: String!, $start: Int!, $limit: Int!) {
      entry(repoFullName: $repoName, start: $start, limit: $limit) {
        comments {
          text
          __typename
        }
        __typename
      }
    }
  `;

  const variables = {
    repoName: "org/repo",
    start: 0,
    limit: 10,
  };
  const variablesMore = assign({}, variables, { start: 10, limit: 10 });

  const result: any = {
    data: {
      __typename: "Query",
      entry: {
        __typename: "Entry",
        comments: [],
      },
    },
  };
  const resultMore = cloneDeep(result);

  for (let i = 1; i <= 10; i++) {
    result.data.entry.comments.push({
      text: `comment ${i}`,
      __typename: "Comment",
    });
  }
  for (let i = 11; i <= 20; i++) {
    resultMore.data.entry.comments.push({
      text: `comment ${i}`,
      __typename: "Comment",
    });
  }

  function setup(...mockedResponses: MockedResponse[]) {
    const link = mockSingleLink(
      {
        request: {
          query: transformedQuery,
          variables,
        },
        result,
      },
      ...mockedResponses
    );

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              entry: {
                merge: false,
              },
            },
          },
        },
      }),
    });

    return client.watchQuery({
      query,
      variables,
    });
  }

  function setupWithCacheConfig(
    cacheConfig: InMemoryCacheConfig,
    ...mockedResponses: any[]
  ) {
    const client = new ApolloClient({
      link: mockSingleLink(
        {
          request: {
            query: transformedQuery,
            variables,
          },
          result,
        },
        ...mockedResponses
      ),
      cache: new InMemoryCache(cacheConfig),
    });

    return client.watchQuery({
      query,
      variables,
    });
  }

  describe("fetchMore with connection results merging", () => {
    it("updateQuery", async () => {
      const observable = setup({
        request: {
          query: transformedQuery,
          variables: variablesMore,
        },
        result: resultMore,
      });

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(false);
        expect(result.data!.entry.comments).toHaveLength(10);
      }

      {
        const fetchMoreResult = await observable.fetchMore({
          variables: { start: 10 }, // rely on the fact that the original variables had limit: 10
          updateQuery: (prev, options) => {
            const state = cloneDeep(prev) as any;
            state.entry.comments = [
              ...state.entry.comments,
              ...options.fetchMoreResult.entry.comments,
            ];
            return state;
          },
        });

        expect(fetchMoreResult.data!.entry.comments).toHaveLength(10);
        expect(fetchMoreResult.loading).toBe(false);
      }

      {
        const result = await stream.takeNext();
        const combinedComments = result.data!.entry.comments;

        expect(combinedComments).toHaveLength(20);
        combinedComments.forEach((comment, i) => {
          expect(comment.text).toBe(`comment ${i + 1}`);
        });
      }

      await expect(stream).not.toEmitAnything();
    });

    it("field policy", async () => {
      const observable = setupWithCacheConfig(
        {
          typePolicies: {
            Entry: {
              fields: {
                comments: concatPagination(),
              },
            },
          },
        },
        {
          request: {
            query: transformedQuery,
            variables: variablesMore,
          },
          result: resultMore,
        }
      );

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(false);
        expect(result.data!.entry.comments).toHaveLength(10);
      }

      {
        const fetchMoreResult = await observable.fetchMore({
          // rely on the fact that the original variables had limit: 10
          variables: { start: 10 },
        });

        // this is the server result
        expect(fetchMoreResult.loading).toBe(false);
        expect(fetchMoreResult.data!.entry.comments).toHaveLength(10);
      }

      {
        const result = await stream.takeNext();

        const combinedComments = result.data!.entry.comments;
        expect(combinedComments).toHaveLength(20);
        combinedComments.forEach((comment, i) => {
          expect(comment.text).toBe(`comment ${i + 1}`);
        });
      }

      await expect(stream).not.toEmitAnything();
    });
  });

  describe("will set the network status to `fetchMore`", () => {
    it("updateQuery", async () => {
      const link = mockSingleLink(
        {
          request: { query: transformedQuery, variables },
          result,
          delay: 5,
        },
        {
          request: { query: transformedQuery, variables: variablesMore },
          result: resultMore,
          delay: 5,
        }
      );

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const observable = client.watchQuery({
        query,
        variables,
        notifyOnNetworkStatusChange: true,
      });

      const stream = new ObservableStream(observable);

      {
        const { data, networkStatus } = await stream.takeNext();

        expect(networkStatus).toBe(NetworkStatus.ready);
        expect(data!.entry.comments.length).toBe(10);
      }

      void observable.fetchMore({
        variables: { start: 10 },
        updateQuery: (prev: any, options: any) => {
          const state = cloneDeep(prev) as any;
          state.entry.comments = [
            ...state.entry.comments,
            ...options.fetchMoreResult.entry.comments,
          ];
          return state;
        },
      });

      {
        const { data, networkStatus } = await stream.takeNext();

        expect(networkStatus).toBe(NetworkStatus.fetchMore);
        expect(data!.entry.comments.length).toBe(10);
      }

      {
        const { data, networkStatus } = await stream.takeNext();

        expect(networkStatus).toBe(NetworkStatus.ready);
        expect((data as any).entry.comments.length).toBe(20);
      }

      await expect(stream).not.toEmitAnything();
    });

    it("field policy", async () => {
      const link = mockSingleLink(
        {
          request: { query: transformedQuery, variables },
          result,
          delay: 5,
        },
        {
          request: { query: transformedQuery, variables: variablesMore },
          result: resultMore,
          delay: 5,
        }
      );

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({
          typePolicies: {
            Entry: {
              fields: {
                comments: concatPagination(),
              },
            },
          },
        }),
      });

      const observable = client.watchQuery({
        query,
        variables,
        notifyOnNetworkStatusChange: true,
      });

      const stream = new ObservableStream(observable);

      {
        const { data, networkStatus } = await stream.takeNext();

        expect(networkStatus).toBe(NetworkStatus.ready);
        expect((data as any).entry.comments.length).toBe(10);
      }

      void observable.fetchMore({
        variables: { start: 10 },
      });

      {
        const { data, networkStatus } = await stream.takeNext();

        expect(networkStatus).toBe(NetworkStatus.fetchMore);
        expect(data!.entry.comments.length).toBe(10);
      }

      {
        const { data, networkStatus } = await stream.takeNext();

        expect(networkStatus).toBe(NetworkStatus.ready);
        expect(data!.entry.comments.length).toBe(20);
      }

      await expect(stream).not.toEmitAnything();
    });
  });
});

test("uses updateQuery to update the result of the query with no-cache queries", async () => {
  const { query, link } = setupPaginatedCase();

  const client = new ApolloClient({ cache: new InMemoryCache(), link });

  const observable = client.watchQuery({
    query,
    fetchPolicy: "no-cache",
    notifyOnNetworkStatusChange: true,
    variables: { limit: 2 },
  });

  const stream = new ObservableStream(observable);

  await expect(stream).toEmitApolloQueryResult({
    data: {
      letters: [
        { __typename: "Letter", letter: "A", position: 1 },
        { __typename: "Letter", letter: "B", position: 2 },
      ],
    },
    loading: false,
    networkStatus: NetworkStatus.ready,
  });

  let fetchMoreResult = await observable.fetchMore({
    variables: { offset: 2 },
    updateQuery: (prev, { fetchMoreResult }) => ({
      letters: prev.letters.concat(fetchMoreResult.letters),
    }),
  });

  expect(fetchMoreResult).toEqualApolloQueryResult({
    data: {
      letters: [
        { __typename: "Letter", letter: "C", position: 3 },
        { __typename: "Letter", letter: "D", position: 4 },
      ],
    },
    loading: false,
    networkStatus: NetworkStatus.ready,
  });

  await expect(stream).toEmitApolloQueryResult({
    data: {
      letters: [
        { __typename: "Letter", letter: "A", position: 1 },
        { __typename: "Letter", letter: "B", position: 2 },
      ],
    },
    loading: true,
    networkStatus: NetworkStatus.fetchMore,
  });

  await expect(stream).toEmitApolloQueryResult({
    data: {
      letters: [
        { __typename: "Letter", letter: "A", position: 1 },
        { __typename: "Letter", letter: "B", position: 2 },
        { __typename: "Letter", letter: "C", position: 3 },
        { __typename: "Letter", letter: "D", position: 4 },
      ],
    },
    loading: false,
    networkStatus: NetworkStatus.ready,
  });

  // Ensure we store the merged result as the last result
  expect(observable.getCurrentResult(false)).toEqualApolloQueryResult({
    data: {
      letters: [
        { __typename: "Letter", letter: "A", position: 1 },
        { __typename: "Letter", letter: "B", position: 2 },
        { __typename: "Letter", letter: "C", position: 3 },
        { __typename: "Letter", letter: "D", position: 4 },
      ],
    },
    loading: false,
    networkStatus: NetworkStatus.ready,
  });

  await expect(stream).not.toEmitAnything();

  fetchMoreResult = await observable.fetchMore({
    variables: { offset: 4 },
    updateQuery: (_, { fetchMoreResult }) => fetchMoreResult,
  });

  expect(fetchMoreResult).toEqualApolloQueryResult({
    data: {
      letters: [
        { __typename: "Letter", letter: "E", position: 5 },
        { __typename: "Letter", letter: "F", position: 6 },
      ],
    },
    loading: false,
    networkStatus: NetworkStatus.ready,
  });

  await expect(stream).toEmitApolloQueryResult({
    data: {
      letters: [
        { __typename: "Letter", letter: "A", position: 1 },
        { __typename: "Letter", letter: "B", position: 2 },
        { __typename: "Letter", letter: "C", position: 3 },
        { __typename: "Letter", letter: "D", position: 4 },
      ],
    },
    loading: true,
    networkStatus: NetworkStatus.fetchMore,
  });

  await expect(stream).toEmitApolloQueryResult({
    data: {
      letters: [
        { __typename: "Letter", letter: "E", position: 5 },
        { __typename: "Letter", letter: "F", position: 6 },
      ],
    },
    loading: false,
    networkStatus: NetworkStatus.ready,
  });

  expect(observable.getCurrentResult(false)).toEqualApolloQueryResult({
    data: {
      letters: [
        { __typename: "Letter", letter: "E", position: 5 },
        { __typename: "Letter", letter: "F", position: 6 },
      ],
    },
    loading: false,
    networkStatus: NetworkStatus.ready,
  });

  await expect(stream).not.toEmitAnything();
});
