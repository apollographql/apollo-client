import { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { gql } from "graphql-tag";
import { map, Observable } from "rxjs";

import { InMemoryCache } from "@apollo/client/cache";
import { ApolloClient, NetworkStatus } from "@apollo/client/core";
import { ApolloLink } from "@apollo/client/link/core";
import { mockSingleLink } from "@apollo/client/testing";

import {
  ObservableStream,
  spyOnConsole,
} from "../../testing/internal/index.js";
import { ObservableQuery } from "../ObservableQuery.js";
import { ApolloQueryResult } from "../types.js";
import {
  WatchQueryFetchPolicy,
  WatchQueryOptions,
} from "../watchQueryOptions.js";

const query = gql`
  query {
    author {
      __typename
      id
      firstName
      lastName
    }
  }
`;

const result = {
  author: {
    __typename: "Author",
    id: 1,
    firstName: "John",
    lastName: "Smith",
  },
};

const mutation = gql`
  mutation updateName($id: ID!, $firstName: String!) {
    updateName(id: $id, firstName: $firstName) {
      __typename
      id
      firstName
    }
  }
`;

const variables = {
  id: 1,
  firstName: "James",
};

const mutationResult = {
  updateName: {
    id: 1,
    __typename: "Author",
    firstName: "James",
  },
};

const merged = { author: { ...result.author, firstName: "James" } };

const createLink = () =>
  mockSingleLink(
    {
      request: { query },
      result: { data: result },
    },
    {
      request: { query },
      result: { data: result },
    }
  );

const createFailureLink = () =>
  mockSingleLink(
    {
      request: { query },
      error: new Error("query failed"),
    },
    {
      request: { query },
      result: { data: result },
    }
  );

const createMutationLink = () =>
  // fetch the data
  mockSingleLink(
    {
      request: { query },
      result: { data: result },
    }, // update the data
    {
      request: { query: mutation, variables },
      result: { data: mutationResult },
    }, // get the new results
    {
      request: { query },
      result: { data: merged },
    }
  );

describe("network-only", () => {
  it("requests from the network even if already in cache", async () => {
    let called = 0;
    const inspector = new ApolloLink((operation, forward) => {
      called++;
      return forward(operation).pipe(
        map((result) => {
          called++;
          return result;
        })
      );
    });

    const client = new ApolloClient({
      link: inspector.concat(createLink()),
      cache: new InMemoryCache(),
    });

    await client.query({ query });
    const actualResult = await client.query({
      fetchPolicy: "network-only",
      query,
    });

    expect(actualResult.data).toEqual(result);
    expect(called).toBe(4);
  });

  it("saves data to the cache on success", async () => {
    let called = 0;
    const inspector = new ApolloLink((operation, forward) => {
      called++;
      return forward(operation).pipe(
        map((result) => {
          called++;
          return result;
        })
      );
    });

    const client = new ApolloClient({
      link: inspector.concat(createLink()),
      cache: new InMemoryCache(),
    });

    await client.query({ query, fetchPolicy: "network-only" });
    const actualResult = await client.query({ query });

    expect(actualResult.data).toEqual(result);
    expect(called).toBe(2);
  });

  it("does not save data to the cache on failure", async () => {
    let called = 0;
    const inspector = new ApolloLink((operation, forward) => {
      called++;
      return forward(operation).pipe(
        map((result) => {
          called++;
          return result;
        })
      );
    });

    const client = new ApolloClient({
      link: inspector.concat(createFailureLink()),
      cache: new InMemoryCache(),
    });

    let didFail = false;
    await client.query({ query, fetchPolicy: "network-only" }).catch((e) => {
      expect(e.message).toMatch("query failed");
      didFail = true;
    });

    const actualResult = await client.query({ query });

    expect(actualResult.data).toEqual(result);
    // the first error doesn't call .map on the inspector
    expect(called).toBe(3);
    expect(didFail).toBe(true);
  });

  it("updates the cache on a mutation", async () => {
    const inspector = new ApolloLink((operation, forward) => {
      return forward(operation).pipe(
        map((result) => {
          return result;
        })
      );
    });

    const client = new ApolloClient({
      link: inspector.concat(createMutationLink()),
      cache: new InMemoryCache(),
    });

    await client.query({ query });
    // XXX currently only no-cache is supported as a fetchPolicy
    // this mainly serves to ensure the cache is updated correctly
    await client.mutate({ mutation, variables });

    const actualResult = await client.query({ query });

    expect(actualResult.data).toEqual(merged);
  });
});

describe("no-cache", () => {
  it("requests from the network when not in cache", async () => {
    let called = 0;
    const inspector = new ApolloLink((operation, forward) => {
      called++;
      return forward(operation).pipe(
        map((result) => {
          called++;
          return result;
        })
      );
    });

    const client = new ApolloClient({
      link: inspector.concat(createLink()),
      cache: new InMemoryCache(),
    });

    const actualResult = await client.query({ fetchPolicy: "no-cache", query });

    expect(actualResult.data).toEqual(result);
    expect(called).toBe(2);
  });

  it("requests from the network even if already in cache", async () => {
    let called = 0;
    const inspector = new ApolloLink((operation, forward) => {
      called++;
      return forward(operation).pipe(
        map((result) => {
          called++;
          return result;
        })
      );
    });

    const client = new ApolloClient({
      link: inspector.concat(createLink()),
      cache: new InMemoryCache(),
    });

    await client.query({ query });
    const actualResult = await client.query({ fetchPolicy: "no-cache", query });

    expect(actualResult.data).toEqual(result);
    expect(called).toBe(4);
  });

  it("does not save the data to the cache on success", async () => {
    let called = 0;
    const inspector = new ApolloLink((operation, forward) => {
      called++;
      return forward(operation).pipe(
        map((result) => {
          called++;
          return result;
        })
      );
    });

    const client = new ApolloClient({
      link: inspector.concat(createLink()),
      cache: new InMemoryCache(),
    });

    await client.query({ query, fetchPolicy: "no-cache" });
    const actualResult = await client.query({ query });

    expect(actualResult.data).toEqual(result);
    // the second query couldn't read anything from the cache
    expect(called).toBe(4);
  });

  it("does not save data to the cache on failure", async () => {
    let called = 0;
    const inspector = new ApolloLink((operation, forward) => {
      called++;
      return forward(operation).pipe(
        map((result) => {
          called++;
          return result;
        })
      );
    });

    const client = new ApolloClient({
      link: inspector.concat(createFailureLink()),
      cache: new InMemoryCache(),
    });

    let didFail = false;
    await client.query({ query, fetchPolicy: "no-cache" }).catch((e) => {
      expect(e.message).toMatch("query failed");
      didFail = true;
    });

    const actualResult = await client.query({ query });

    expect(actualResult.data).toEqual(result);
    // the first error doesn't call .map on the inspector
    expect(called).toBe(3);
    expect(didFail).toBe(true);
  });

  it("does not update the cache on a mutation", async () => {
    const inspector = new ApolloLink((operation, forward) => {
      return forward(operation).pipe(
        map((result) => {
          return result;
        })
      );
    });

    const client = new ApolloClient({
      link: inspector.concat(createMutationLink()),
      cache: new InMemoryCache(),
    });

    await client.query({ query });
    await client.mutate({ mutation, variables, fetchPolicy: "no-cache" });
    const actualResult = await client.query({ query });

    expect(actualResult.data).toEqual(result);
  });

  describe("when notifyOnNetworkStatusChange is set", () => {
    it("does not save the data to the cache on success", async () => {
      let called = 0;
      const inspector = new ApolloLink((operation, forward) => {
        called++;
        return forward(operation).pipe(
          map((result) => {
            called++;
            return result;
          })
        );
      });

      const client = new ApolloClient({
        link: inspector.concat(createLink()),
        cache: new InMemoryCache(),
      });

      await client.query({
        query,
        fetchPolicy: "no-cache",
        notifyOnNetworkStatusChange: true,
      });
      const actualResult = await client.query({ query });

      expect(actualResult.data).toEqual(result);
      // the second query couldn't read anything from the cache
      expect(called).toBe(4);
    });

    it("does not save data to the cache on failure", async () => {
      let called = 0;
      const inspector = new ApolloLink((operation, forward) => {
        called++;
        return forward(operation).pipe(
          map((result) => {
            called++;
            return result;
          })
        );
      });

      const client = new ApolloClient({
        link: inspector.concat(createFailureLink()),
        cache: new InMemoryCache(),
      });

      let didFail = false;
      await client
        .query({
          query,
          fetchPolicy: "no-cache",
          notifyOnNetworkStatusChange: true,
        })
        .catch((e) => {
          expect(e.message).toMatch("query failed");
          didFail = true;
        });

      const actualResult = await client.query({ query });

      expect(actualResult.data).toEqual(result);
      // the first error doesn't call .map on the inspector
      expect(called).toBe(3);
      expect(didFail).toBe(true);
    });

    it("gives appropriate networkStatus for watched queries", async () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
        resolvers: {
          Query: {
            hero(_data, args) {
              return {
                __typename: "Hero",
                ...args,
                name: "Luke Skywalker",
              };
            },
          },
        },
      });

      const observable = client.watchQuery({
        query: gql`
          query FetchLuke($id: String) {
            hero(id: $id) @client {
              id
              name
            }
          }
        `,
        fetchPolicy: "no-cache",
        variables: { id: "1" },
        notifyOnNetworkStatusChange: true,
      });

      const stream = new ObservableStream(observable);

      function dataWithId(id: number | string) {
        return {
          hero: {
            __typename: "Hero",
            id: String(id),
            name: "Luke Skywalker",
          },
        };
      }

      await expect(stream).toEmitApolloQueryResult({
        data: undefined,
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitApolloQueryResult({
        data: dataWithId(1),
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(client.cache.extract(true)).toEqual({});

      await observable.setVariables({ id: "2" });

      await expect(stream).toEmitApolloQueryResult({
        data: undefined,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        partial: true,
      });

      await expect(stream).toEmitApolloQueryResult({
        data: dataWithId(2),
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(client.cache.extract(true)).toEqual({});

      await observable.refetch();

      await expect(stream).toEmitApolloQueryResult({
        data: dataWithId(2),
        loading: true,
        networkStatus: NetworkStatus.refetch,
        partial: false,
      });
      expect(client.cache.extract(true)).toEqual({});

      await expect(stream).toEmitApolloQueryResult({
        data: dataWithId(2),
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(client.cache.extract(true)).toEqual({});

      await observable.refetch({ id: "3" });

      await expect(stream).toEmitApolloQueryResult({
        data: undefined,
        loading: true,
        networkStatus: NetworkStatus.refetch,
        partial: true,
      });
      expect(client.cache.extract(true)).toEqual({});

      await expect(stream).toEmitApolloQueryResult({
        data: dataWithId(3),
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(client.cache.extract(true)).toEqual({});

      await expect(stream).not.toEmitAnything();
    });
  });
});

describe("cache-first", () => {
  it("does not trigger network request during optimistic update", async () => {
    const results: any[] = [];
    const client = new ApolloClient({
      link: new ApolloLink((operation, forward) => {
        return forward(operation).pipe(
          map((result) => {
            results.push(result);
            return result;
          })
        );
      }).concat(createMutationLink()),
      cache: new InMemoryCache(),
    });

    let inOptimisticTransaction = false;

    const stream = new ObservableStream(
      client.watchQuery({
        query,
        fetchPolicy: "cache-and-network",
        returnPartialData: true,
      })
    );

    await expect(stream).toEmitApolloQueryResult({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });
    expect(results).toHaveLength(0);

    await expect(stream).toEmitApolloQueryResult({
      data: {
        author: {
          __typename: "Author",
          id: 1,
          firstName: "John",
          lastName: "Smith",
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
    expect(results).toHaveLength(1);

    inOptimisticTransaction = true;
    client.cache.recordOptimisticTransaction((cache) => {
      // Silence partial data write error
      using _ = spyOnConsole("error");
      cache.writeQuery({
        query,
        data: {
          author: {
            __typename: "Bogus",
          },
        },
      });
    }, "bogus");

    await expect(stream).toEmitApolloQueryResult({
      data: {
        author: {
          __typename: "Bogus",
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: true,
    });
    expect(results).toHaveLength(1);

    setTimeout(() => {
      inOptimisticTransaction = false;
      client.cache.removeOptimistic("bogus");
    }, 50);

    await expect(stream).toEmitApolloQueryResult({
      data: {
        author: {
          __typename: "Author",
          id: 1,
          firstName: "John",
          lastName: "Smith",
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
    // A network request should not be triggered until after the bogus
    // optimistic transaction has been removed.
    expect(inOptimisticTransaction).toBe(false);
    expect(results).toHaveLength(1);

    client.cache.writeQuery({
      query,
      data: {
        author: {
          __typename: "Author",
          id: 2,
          firstName: "Chinua",
          lastName: "Achebe",
        },
      },
    });

    await expect(stream).toEmitApolloQueryResult({
      data: {
        author: {
          __typename: "Author",
          id: 2,
          firstName: "Chinua",
          lastName: "Achebe",
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
    expect(inOptimisticTransaction).toBe(false);
    expect(results).toHaveLength(1);

    await expect(stream).not.toEmitAnything();
  });
});

describe("cache-only", () => {
  it("allows explicit refetch to happen", async () => {
    let counter = 0;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new ApolloLink(
        () =>
          new Observable((observer) => {
            observer.next({
              data: {
                count: ++counter,
              },
            });
            observer.complete();
          })
      ),
    });

    const query = gql`
      query {
        count
      }
    `;

    const observable = client.watchQuery({
      query,
      nextFetchPolicy: "cache-only",
    });

    const stream = new ObservableStream(observable);

    await expect(stream).toEmitApolloQueryResult({
      loading: false,
      networkStatus: NetworkStatus.ready,
      data: {
        count: 1,
      },
      partial: false,
    });
    expect(observable.options.fetchPolicy).toBe("cache-only");

    await observable.refetch();

    await expect(stream).toEmitApolloQueryResult({
      loading: false,
      networkStatus: NetworkStatus.ready,
      data: {
        count: 2,
      },
      partial: false,
    });

    expect(observable.options.fetchPolicy).toBe("cache-only");

    await expect(stream).not.toEmitAnything();
  });
});

describe("cache-and-network", function () {
  it("gives appropriate networkStatus for refetched queries", async () => {
    const client = new ApolloClient({
      link: ApolloLink.empty(),
      cache: new InMemoryCache(),
      resolvers: {
        Query: {
          hero(_data, args) {
            return {
              __typename: "Hero",
              ...args,
              name: "Luke Skywalker",
            };
          },
        },
      },
    });

    const observable = client.watchQuery({
      query: gql`
        query FetchLuke($id: String) {
          hero(id: $id) @client {
            id
            name
          }
        }
      `,
      fetchPolicy: "cache-and-network",
      variables: { id: "1" },
      notifyOnNetworkStatusChange: true,
    });

    const stream = new ObservableStream(observable);

    function dataWithId(id: number | string) {
      return {
        hero: {
          __typename: "Hero",
          id: String(id),
          name: "Luke Skywalker",
        },
      };
    }

    await expect(stream).toEmitApolloQueryResult({
      data: dataWithId(1),
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await observable.setVariables({ id: "2" });

    await expect(stream).toEmitApolloQueryResult({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.setVariables,
      partial: true,
    });

    await expect(stream).toEmitApolloQueryResult({
      data: dataWithId(2),
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await observable.refetch();

    await expect(stream).toEmitApolloQueryResult({
      data: dataWithId(2),
      loading: true,
      networkStatus: NetworkStatus.refetch,
      partial: false,
    });

    await expect(stream).toEmitApolloQueryResult({
      data: dataWithId(2),
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await observable.refetch({ id: "3" });

    await expect(stream).toEmitApolloQueryResult({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.refetch,
      partial: true,
    });

    await expect(stream).toEmitApolloQueryResult({
      data: dataWithId(3),
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await expect(stream).not.toEmitAnything();
  });
});

describe("nextFetchPolicy", () => {
  type TData = {
    echo: {
      __typename: "Echo";
      linkCounter: number;
      opName: string;
      opVars: Record<string, any>;
    };
  };

  type TVars = {
    refetching?: boolean;
  };

  const EchoQuery: TypedDocumentNode<TData> = gql`
    query EchoQuery {
      echo {
        linkCounter
        opName
        opVars
      }
    }
  `;

  function makeLink() {
    let linkCounter = 0;
    return new ApolloLink(
      (request) =>
        new Observable((observer) => {
          setTimeout(() => {
            observer.next({
              data: {
                echo: {
                  __typename: "Echo",
                  linkCounter: ++linkCounter,
                  opName: request.operationName,
                  opVars: request.variables,
                },
              },
            });
            observer.complete();
          }, 10);
        })
    );
  }

  const checkNextFetchPolicy = (args: {
    fetchPolicy: WatchQueryFetchPolicy;
    nextFetchPolicy: WatchQueryOptions<{}, TData>["nextFetchPolicy"];
    useDefaultOptions: boolean;
    checkResult: (info: {
      stream: ObservableStream<ApolloQueryResult<TData>>;
      observable: ObservableQuery<TData, TVars>;
    }) => Promise<void>;
  }) =>
    it(`transitions ${args.fetchPolicy} to ${
      typeof args.nextFetchPolicy === "function" ?
        args.nextFetchPolicy.name
      : args.nextFetchPolicy
    } (${args.useDefaultOptions ? "" : "not "}using defaults)`, async () => {
      const client = new ApolloClient({
        link: makeLink(),
        cache: new InMemoryCache(),
        defaultOptions: {
          watchQuery:
            args.useDefaultOptions ?
              {
                nextFetchPolicy: args.nextFetchPolicy,
              }
            : {},
        },
      });

      const watchQueryOptions: WatchQueryOptions<TVars, TData> = {
        query: EchoQuery,
        fetchPolicy: args.fetchPolicy,
      };

      if (!args.useDefaultOptions) {
        watchQueryOptions.nextFetchPolicy = args.nextFetchPolicy;
      }

      const observable = client.watchQuery(watchQueryOptions);

      expect(observable.options.fetchPolicy).toBe(args.fetchPolicy);

      await args.checkResult({
        observable,
        stream: new ObservableStream(observable),
      });
    });

  type CheckOptions = Parameters<typeof checkNextFetchPolicy>[0];
  type NextFetchPolicy = CheckOptions["nextFetchPolicy"];
  type CheckResultCallback = CheckOptions["checkResult"];

  // We'll use this same OnResultCallback for multiple tests, to make it easier
  // to tell that the behavior of the tests is the same.
  const onResultNetworkOnlyToCacheFirst: CheckResultCallback = async ({
    observable,
    stream,
  }) => {
    await expect(stream).toEmitMatchedValue({
      loading: false,
      data: {
        echo: {
          __typename: "Echo",
          linkCounter: 1,
          opName: "EchoQuery",
          opVars: {},
        },
      },
    });

    expect(observable.options.fetchPolicy).toBe("cache-first");

    {
      const result = await observable.refetch({ refetching: true });

      expect(result).toEqualStrictTyped({
        data: {
          echo: {
            __typename: "Echo",
            linkCounter: 2,
            opName: "EchoQuery",
            opVars: {
              refetching: true,
            },
          },
        },
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
    }

    await expect(stream).toEmitApolloQueryResult({
      data: {
        echo: {
          __typename: "Echo",
          linkCounter: 2,
          opName: "EchoQuery",
          opVars: {
            refetching: true,
          },
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    expect(observable.options.fetchPolicy).toBe("cache-first");

    {
      const result = await observable.reobserve({
        variables: {
          refetching: false,
        },
      });

      expect(result).toEqualStrictTyped({
        data: {
          echo: {
            __typename: "Echo",
            linkCounter: 3,
            opName: "EchoQuery",
            opVars: {
              refetching: false,
            },
          },
        },
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      // Changing variables resets the fetchPolicy to its initial value.
      expect(observable.options.fetchPolicy).toBe("cache-first");
    }

    await expect(stream).toEmitApolloQueryResult({
      data: {
        echo: {
          __typename: "Echo",
          linkCounter: 3,
          opName: "EchoQuery",
          opVars: {
            refetching: false,
          },
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    // But nextFetchPolicy is applied again after the first request.
    expect(observable.options.fetchPolicy).toBe("cache-first");

    await expect(stream).not.toEmitAnything();
  };

  checkNextFetchPolicy({
    useDefaultOptions: false,
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
    checkResult: onResultNetworkOnlyToCacheFirst,
  });

  checkNextFetchPolicy({
    useDefaultOptions: true,
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
    checkResult: onResultNetworkOnlyToCacheFirst,
  });

  const nextFetchPolicyNetworkOnlyToCacheFirst: NextFetchPolicy = function (
    currentFetchPolicy,
    context
  ): WatchQueryFetchPolicy {
    expect(currentFetchPolicy).toBe(context.options.fetchPolicy);
    switch (context.reason) {
      case "variables-changed":
        expect(context.initialFetchPolicy).toBe(
          context.options.initialFetchPolicy
        );
        return context.initialFetchPolicy;
      default:
      case "after-fetch":
        return "cache-first";
    }
  };

  checkNextFetchPolicy({
    useDefaultOptions: false,
    fetchPolicy: "network-only",
    nextFetchPolicy: nextFetchPolicyNetworkOnlyToCacheFirst,
    checkResult: onResultNetworkOnlyToCacheFirst,
  });

  checkNextFetchPolicy({
    useDefaultOptions: true,
    fetchPolicy: "network-only",
    nextFetchPolicy: nextFetchPolicyNetworkOnlyToCacheFirst,
    checkResult: onResultNetworkOnlyToCacheFirst,
  });

  const onResultCacheAndNetworkToCacheFirst: CheckResultCallback = async ({
    observable,
    stream,
  }) => {
    await expect(stream).toEmitMatchedValue({
      loading: false,
      data: {
        echo: {
          __typename: "Echo",
          linkCounter: 1,
          opName: "EchoQuery",
          opVars: {},
        },
      },
    });
    expect(observable.options.fetchPolicy).toBe("cache-first");

    {
      const result = await observable.refetch({ refetching: true });

      expect(result).toEqualStrictTyped({
        data: {
          echo: {
            __typename: "Echo",
            linkCounter: 2,
            opName: "EchoQuery",
            opVars: {
              refetching: true,
            },
          },
        },
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
    }

    await expect(stream).toEmitApolloQueryResult({
      data: {
        echo: {
          __typename: "Echo",
          linkCounter: 2,
          opName: "EchoQuery",
          opVars: {
            refetching: true,
          },
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
    // Changing variables resets the fetchPolicy to its initial value.
    // expect(observable.options.fetchPolicy).toBe("cache-and-network");
    expect(observable.options.fetchPolicy).toBe("cache-first");

    {
      const result = await observable.reobserve({
        variables: {
          refetching: false,
        },
      });

      expect(result).toEqualStrictTyped({
        data: {
          echo: {
            __typename: "Echo",
            linkCounter: 3,
            opName: "EchoQuery",
            opVars: {
              refetching: false,
            },
          },
        },
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
    }

    await expect(stream).toEmitApolloQueryResult({
      data: {
        echo: {
          __typename: "Echo",
          linkCounter: 2,
          opName: "EchoQuery",
          opVars: {
            refetching: true,
          },
        },
      },
      loading: true,
      networkStatus: NetworkStatus.setVariables,
      partial: false,
    });
    // But nextFetchPolicy is applied again after the first request.
    expect(observable.options.fetchPolicy).toBe("cache-first");

    await expect(stream).toEmitApolloQueryResult({
      data: {
        echo: {
          __typename: "Echo",
          linkCounter: 3,
          opName: "EchoQuery",
          opVars: {
            refetching: false,
          },
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
    expect(observable.options.fetchPolicy).toBe("cache-first");

    await expect(stream).not.toEmitAnything();
  };

  checkNextFetchPolicy({
    useDefaultOptions: false,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    checkResult: onResultCacheAndNetworkToCacheFirst,
  });

  checkNextFetchPolicy({
    useDefaultOptions: true,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    checkResult: onResultCacheAndNetworkToCacheFirst,
  });

  const nextFetchPolicyCacheAndNetworkToCacheFirst: NextFetchPolicy = function (
    currentFetchPolicy,
    context
  ): WatchQueryFetchPolicy {
    expect(currentFetchPolicy).toBe(context.options.fetchPolicy);
    switch (context.reason) {
      case "variables-changed":
        expect(context.initialFetchPolicy).toBe(
          context.options.initialFetchPolicy
        );
        return context.initialFetchPolicy;
      default:
      case "after-fetch":
        return "cache-first";
    }
  };

  checkNextFetchPolicy({
    useDefaultOptions: false,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: nextFetchPolicyCacheAndNetworkToCacheFirst,
    checkResult: onResultCacheAndNetworkToCacheFirst,
  });

  checkNextFetchPolicy({
    useDefaultOptions: true,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: nextFetchPolicyCacheAndNetworkToCacheFirst,
    checkResult: onResultCacheAndNetworkToCacheFirst,
  });

  const nextFetchPolicyAlwaysCacheFirst: NextFetchPolicy = function (
    currentFetchPolicy,
    context
  ): WatchQueryFetchPolicy {
    expect(currentFetchPolicy).toBe(context.options.fetchPolicy);
    // Return cache-first no matter what context.reason was.
    return "cache-first";
  };

  const onResultCacheAndNetworkAlwaysCacheFirst: CheckResultCallback = async ({
    observable,
    stream,
  }) => {
    await expect(stream).toEmitMatchedValue({
      loading: false,
      data: {
        echo: {
          __typename: "Echo",
          linkCounter: 1,
          opName: "EchoQuery",
          opVars: {},
        },
      },
    });
    expect(observable.options.fetchPolicy).toBe("cache-first");

    {
      const result = await observable.refetch({ refetching: true });

      expect(result).toEqualStrictTyped({
        data: {
          echo: {
            __typename: "Echo",
            linkCounter: 2,
            opName: "EchoQuery",
            opVars: {
              refetching: true,
            },
          },
        },
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
    }

    await expect(stream).toEmitApolloQueryResult({
      data: {
        echo: {
          __typename: "Echo",
          linkCounter: 2,
          opName: "EchoQuery",
          opVars: {
            refetching: true,
          },
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
    expect(observable.options.fetchPolicy).toBe("cache-first");

    {
      const result = await observable.reobserve({
        variables: {
          refetching: false,
        },
      });

      expect(result).toEqualStrictTyped({
        data: {
          echo: {
            __typename: "Echo",
            linkCounter: 2,
            opName: "EchoQuery",
            opVars: {
              refetching: true,
            },
          },
        },
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      // The nextFetchPolicy function we provided always returnes cache-first,
      // even when context.reason is variables-changed (which by default
      // resets the fetchPolicy to context.initialFetchPolicy), so cache-first is
      // still what we see here.
      expect(observable.options.fetchPolicy).toBe("cache-first");
    }

    await expect(stream).toEmitApolloQueryResult({
      data: {
        echo: {
          __typename: "Echo",
          linkCounter: 2,
          opName: "EchoQuery",
          opVars: {
            refetching: true,
          },
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
    expect(observable.options.fetchPolicy).toBe("cache-first");

    await expect(stream).not.toEmitAnything();
  };

  checkNextFetchPolicy({
    useDefaultOptions: false,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: nextFetchPolicyAlwaysCacheFirst,
    checkResult: onResultCacheAndNetworkAlwaysCacheFirst,
  });

  checkNextFetchPolicy({
    useDefaultOptions: true,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: nextFetchPolicyAlwaysCacheFirst,
    checkResult: onResultCacheAndNetworkAlwaysCacheFirst,
  });
});
