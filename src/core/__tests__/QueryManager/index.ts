// externals
import { from } from "rxjs";
import { map } from "rxjs/operators";
import { assign } from "lodash";
import gql from "graphql-tag";
import { DocumentNode, GraphQLError } from "graphql";
import { InvariantError, setVerbosity } from "ts-invariant";

import {
  Observable,
  Observer,
} from "../../../utilities/observables/Observable";
import { ApolloLink, GraphQLRequest, FetchResult } from "../../../link/core";
import { InMemoryCache, InMemoryCacheConfig } from "../../../cache";
import {
  ApolloReducerConfig,
  NormalizedCacheObject,
} from "../../../cache/inmemory/types";

// mocks
import mockQueryManager, {
  getDefaultOptionsForQueryManagerTests,
} from "../../../testing/core/mocking/mockQueryManager";
import mockWatchQuery from "../../../testing/core/mocking/mockWatchQuery";
import {
  MockApolloLink,
  mockSingleLink,
} from "../../../testing/core/mocking/mockLink";

// core
import { NetworkStatus } from "../../networkStatus";
import { ObservableQuery } from "../../ObservableQuery";
import { WatchQueryOptions } from "../../watchQueryOptions";
import { QueryManager } from "../../QueryManager";

import { ApolloError } from "../../../errors";

// testing utils
import { waitFor } from "@testing-library/react";
import { wait } from "../../../testing/core";
import { ApolloClient } from "../../../core";
import { mockFetchQuery } from "../ObservableQuery";
import { Concast, print } from "../../../utilities";
import { ObservableStream, spyOnConsole } from "../../../testing/internal";

interface MockedMutation {
  mutation: DocumentNode;
  data?: Object;
  errors?: GraphQLError[];
  variables?: Object;
  config?: ApolloReducerConfig;
}

export function resetStore(qm: QueryManager<any>) {
  return qm
    .clearStore({
      discardWatches: false,
    })
    .then(() => qm.reFetchObservableQueries());
}

describe("QueryManager", () => {
  // Standard "get id from object" method.
  const dataIdFromObject = (object: any) => {
    if (object.__typename && object.id) {
      return object.__typename + "__" + object.id;
    }
    return undefined;
  };

  // Helper method that serves as the constructor method for
  // QueryManager but has defaults that make sense for these
  // tests.
  const createQueryManager = ({
    link,
    config = {},
    clientAwareness = {},
    queryDeduplication = false,
  }: {
    link: ApolloLink;
    config?: Partial<InMemoryCacheConfig>;
    clientAwareness?: { [key: string]: string };
    queryDeduplication?: boolean;
  }) => {
    return new QueryManager(
      getDefaultOptionsForQueryManagerTests({
        link,
        cache: new InMemoryCache({ addTypename: false, ...config }),
        clientAwareness,
        queryDeduplication,
        // Enable client.queryManager.mutationStore tracking.
        onBroadcast() {},
      })
    );
  };

  // Helper method that sets up a mockQueryManager and then passes on the
  // results to an observer.
  const getObservableStream = ({
    query,
    variables = {},
    queryOptions = {},
    result,
    error,
    delay,
  }: {
    query: DocumentNode;
    variables?: Object;
    queryOptions?: Object;
    error?: Error;
    result?: FetchResult;
    delay?: number;
  }) => {
    const queryManager = mockQueryManager({
      request: { query, variables },
      result,
      error,
      delay,
    });

    return new ObservableStream(
      queryManager.watchQuery<any>(assign({ query, variables }, queryOptions))
    );
  };

  const mockMutation = ({
    mutation,
    data,
    errors,
    variables = {},
    config = {},
  }: MockedMutation) => {
    const link = mockSingleLink({
      request: { query: mutation, variables },
      result: { data, errors },
    });

    const queryManager = createQueryManager({
      link,
      config,
    });

    return new Promise<{
      result: FetchResult;
      queryManager: QueryManager<NormalizedCacheObject>;
    }>((resolve, reject) => {
      queryManager
        .mutate({ mutation, variables })
        .then((result: any) => {
          resolve({ result, queryManager });
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  // Helper method that takes a query with a first response and a second response.
  // Used to assert stuff about refetches.
  const mockRefetch = ({
    request,
    firstResult,
    secondResult,
    thirdResult,
  }: {
    request: GraphQLRequest;
    firstResult: FetchResult;
    secondResult: FetchResult;
    thirdResult?: FetchResult;
  }) => {
    const args = [
      {
        request,
        result: firstResult,
      },
      {
        request,
        result: secondResult,
      },
    ];

    if (thirdResult) {
      args.push({ request, result: thirdResult });
    }

    return mockQueryManager(...args);
  };

  function getCurrentQueryResult<TData, TVars extends object>(
    observableQuery: ObservableQuery<TData, TVars>
  ): {
    data?: TData;
    partial: boolean;
  } {
    const result = observableQuery.getCurrentResult();
    return {
      data: result.data as TData,
      partial: !!result.partial,
    };
  }

  it("handles GraphQL errors", async () => {
    const stream = getObservableStream({
      query: gql`
        query people {
          allPeople(first: 1) {
            people {
              name
            }
          }
        }
      `,
      variables: {},
      result: {
        errors: [new GraphQLError("This is an error message.")],
      },
    });

    await expect(stream).toEmitError(
      new ApolloError({
        graphQLErrors: [{ message: "This is an error message." }],
      })
    );
  });

  it("handles GraphQL errors as data", async () => {
    const stream = getObservableStream({
      query: gql`
        query people {
          allPeople(first: 1) {
            people {
              name
            }
          }
        }
      `,
      variables: {},
      queryOptions: {
        errorPolicy: "all",
      },
      result: {
        errors: [new GraphQLError("This is an error message.")],
      },
    });

    await expect(stream).toEmitValue({
      data: undefined,
      loading: false,
      networkStatus: 8,
      errors: [{ message: "This is an error message." }],
    });
  });

  it("handles GraphQL errors with data returned", async () => {
    const stream = getObservableStream({
      query: gql`
        query people {
          allPeople(first: 1) {
            people {
              name
            }
          }
        }
      `,
      result: {
        data: {
          allPeople: {
            people: {
              name: "Ada Lovelace",
            },
          },
        },
        errors: [new GraphQLError("This is an error message.")],
      },
    });

    await expect(stream).toEmitError(
      new ApolloError({
        graphQLErrors: [{ message: "This is an error message." }],
      })
    );
  });

  it("empty error array (handle non-spec-compliant server) #156", async () => {
    const stream = getObservableStream({
      query: gql`
        query people {
          allPeople(first: 1) {
            people {
              name
            }
          }
        }
      `,
      result: {
        data: {
          allPeople: {
            people: {
              name: "Ada Lovelace",
            },
          },
        },
        errors: [],
      },
    });

    await expect(stream).toEmitValue({
      errors: undefined,
      data: {
        allPeople: {
          people: {
            name: "Ada Lovelace",
          },
        },
      },
      networkStatus: 7,
      loading: false,
    });
  });

  // Easy to get into this state if you write an incorrect `formatError`
  // function with graphql-server or express-graphql
  it("error array with nulls (handle non-spec-compliant server) #1185", async () => {
    const stream = getObservableStream({
      query: gql`
        query people {
          allPeople(first: 1) {
            people {
              name
            }
          }
        }
      `,
      result: {
        errors: [null as any],
      },
    });

    await expect(stream).toEmitError(
      new ApolloError({
        graphQLErrors: [null as any],
      })
    );
  });

  it("handles network errors", async () => {
    const stream = getObservableStream({
      query: gql`
        query people {
          allPeople(first: 1) {
            people {
              name
            }
          }
        }
      `,
      error: new Error("Network error"),
    });

    await expect(stream).toEmitError(
      new ApolloError({
        networkError: new Error("Network error"),
      })
    );
  });

  it("uses console.error to log unhandled errors", async () => {
    using _ = spyOnConsole("error");
    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;
    const error = new Error("Network error");

    const queryManager = mockQueryManager({
      request: { query },
      error,
    });

    const observable = queryManager.watchQuery<any>({ query });
    observable.subscribe({
      next: () => {
        throw new Error("Should not have been called");
      },
    });

    await wait(10);

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      "Unhandled error",
      "Network error",
      expect.anything()
    );
  });

  // XXX this looks like a bug in zen-observable but we should figure
  // out a solution for it
  it.skip("handles an unsubscribe action that happens before data returns", async () => {
    const stream = getObservableStream({
      query: gql`
        query people {
          allPeople(first: 1) {
            people {
              name
            }
          }
        }
      `,
      delay: 1000,
    });

    expect(stream.unsubscribe).not.toThrow();
  });

  // Query should be aborted on last .unsubscribe()
  it("causes link unsubscription if unsubscribed", async () => {
    const expResult = {
      data: {
        allPeople: {
          people: [
            {
              name: "Luke Skywalker",
            },
          ],
        },
      },
    };

    const request = {
      query: gql`
        query people {
          allPeople(first: 1) {
            people {
              name
            }
          }
        }
      `,
      variables: undefined,
    };

    const mockedResponse = {
      request,
      result: expResult,
    };

    const onRequestSubscribe = jest.fn();
    const onRequestUnsubscribe = jest.fn();

    const mockedSingleLink = new ApolloLink(() => {
      return new Observable((observer) => {
        onRequestSubscribe();

        // Delay (100ms) must be bigger than unsubscribe await (5ms)
        // to show clearly that the connection was aborted before completing
        const timer = setTimeout(() => {
          observer.next(mockedResponse.result);
          observer.complete();
        }, 100);

        return () => {
          onRequestUnsubscribe();
          clearTimeout(timer);
        };
      });
    });

    const mockedQueryManger = new QueryManager(
      getDefaultOptionsForQueryManagerTests({
        link: mockedSingleLink,
        cache: new InMemoryCache({ addTypename: false }),
      })
    );

    const observableQuery = mockedQueryManger.watchQuery({
      query: request.query,
      variables: request.variables,
      notifyOnNetworkStatusChange: false,
    });

    const stream = new ObservableStream(observableQuery);

    stream.unsubscribe();

    await wait(10);

    expect(onRequestUnsubscribe).toHaveBeenCalledTimes(1);
    expect(onRequestSubscribe).toHaveBeenCalledTimes(1);
  });

  it("causes link unsubscription after reobserve", async () => {
    const expResult = {
      data: {
        allPeople: {
          people: [
            {
              name: "Luke Skywalker",
            },
          ],
        },
      },
    };

    const request = {
      query: gql`
        query people($offset: Int) {
          allPeople(first: $offset) {
            people {
              name
            }
          }
        }
      `,
      variables: undefined,
    };

    const mockedResponse = {
      request,
      result: expResult,
    };

    const onRequestSubscribe = jest.fn();
    const onRequestUnsubscribe = jest.fn();

    const mockedSingleLink = new ApolloLink(() => {
      return new Observable((observer) => {
        onRequestSubscribe();

        // Delay (100ms) must be bigger than sum of reobserve and unsubscribe awaits (5ms each)
        // to show clearly that the connection was aborted before completing
        const timer = setTimeout(() => {
          observer.next(mockedResponse.result);
          observer.complete();
        }, 100);

        return () => {
          onRequestUnsubscribe();
          clearTimeout(timer);
        };
      });
    });

    const mockedQueryManger = new QueryManager(
      getDefaultOptionsForQueryManagerTests({
        link: mockedSingleLink,
        cache: new InMemoryCache({ addTypename: false }),
        defaultOptions: {
          watchQuery: {
            fetchPolicy: "cache-and-network",
            returnPartialData: false,
            notifyOnNetworkStatusChange: true,
          },
          query: {
            fetchPolicy: "network-only",
          },
        },
        queryDeduplication: false,
      })
    );

    const observableQuery = mockedQueryManger.watchQuery<
      (typeof expResult)["data"],
      { offset?: number | undefined }
    >({
      query: request.query,
      variables: request.variables,
    });

    const stream = new ObservableStream(observableQuery);

    expect(onRequestSubscribe).toHaveBeenCalledTimes(1);

    // This is the most important part of this test
    // Check that reobserve cancels the previous connection while watchQuery remains active
    void observableQuery.reobserve({ variables: { offset: 20 } });

    await waitFor(() => {
      // Verify that previous connection was aborted by reobserve
      expect(onRequestUnsubscribe).toHaveBeenCalledTimes(1);
    });

    stream.unsubscribe();

    await wait(10);

    expect(onRequestSubscribe).toHaveBeenCalledTimes(2);
    expect(onRequestUnsubscribe).toHaveBeenCalledTimes(2);
  });

  it("supports interoperability with other Observable implementations like RxJS", async () => {
    const expResult = {
      data: {
        allPeople: {
          people: [
            {
              name: "Luke Skywalker",
            },
          ],
        },
      },
    };

    const handle = mockWatchQuery({
      request: {
        query: gql`
          query people {
            allPeople(first: 1) {
              people {
                name
              }
            }
          }
        `,
      },
      result: expResult,
    });

    const observable = from(handle as any);

    const stream = new ObservableStream(
      observable.pipe(
        map((result) => assign({ fromRx: true }, result))
      ) as unknown as Observable<any>
    );

    await expect(stream).toEmitValue({
      fromRx: true,
      loading: false,
      networkStatus: 7,
      ...expResult,
    });
  });

  it("allows you to subscribe twice to one query", async () => {
    const request = {
      query: gql`
        query fetchLuke($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `,
      variables: {
        id: "1",
      },
    };
    const data1 = {
      people_one: {
        name: "Luke Skywalker",
      },
    };

    const data2 = {
      people_one: {
        name: "Luke Skywalker has a new name",
      },
    };

    const data3 = {
      people_one: {
        name: "Luke Skywalker has another name",
      },
    };

    const queryManager = mockQueryManager(
      {
        request,
        result: { data: data1 },
      },
      {
        request,
        result: { data: data2 },

        // Wait for both to subscribe
        delay: 100,
      },
      {
        request,
        result: { data: data3 },
      }
    );

    // pre populate data to avoid contention
    await queryManager.query<any>(request);

    const handle = queryManager.watchQuery<any>(request);

    const stream1 = new ObservableStream(handle);
    const stream2 = new ObservableStream(handle);

    await expect(stream1).toEmitMatchedValue({ data: data1 });
    await expect(stream2).toEmitMatchedValue({ data: data1 });

    void handle.refetch();

    await expect(stream1).toEmitMatchedValue({ data: data2 });
    await expect(stream2).toEmitMatchedValue({ data: data2 });

    stream1.unsubscribe();
    void handle.refetch();

    await expect(stream2).toEmitMatchedValue({ data: data3 });
  });

  it("resolves all queries when one finishes after another", async () => {
    const request = {
      query: gql`
        query fetchLuke($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `,
      variables: {
        id: "1",
      },
      notifyOnNetworkStatusChange: true,
    };
    const request2 = {
      query: gql`
        query fetchLeia($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `,
      variables: {
        id: "2",
      },
      notifyOnNetworkStatusChange: true,
    };
    const request3 = {
      query: gql`
        query fetchHan($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `,
      variables: {
        id: "3",
      },
      notifyOnNetworkStatusChange: true,
    };

    const data1 = {
      people_one: {
        name: "Luke Skywalker",
      },
    };
    const data2 = {
      people_one: {
        name: "Leia Skywalker",
      },
    };
    const data3 = {
      people_one: {
        name: "Han Solo",
      },
    };

    const queryManager = mockQueryManager(
      {
        request,
        result: { data: data1 },
        delay: 10,
      },
      {
        request: request2,
        result: { data: data2 },
        // make the second request the slower one
        delay: 100,
      },
      {
        request: request3,
        result: { data: data3 },
        delay: 10,
      }
    );

    const ob1 = queryManager.watchQuery(request);
    const ob2 = queryManager.watchQuery(request2);
    const ob3 = queryManager.watchQuery(request3);

    const stream1 = new ObservableStream(ob1);
    const stream2 = new ObservableStream(ob2);
    const stream3 = new ObservableStream(ob3);

    await expect(stream1).toEmitMatchedValue({ data: data1 });
    await expect(stream2).toEmitMatchedValue({ data: data2 });
    await expect(stream3).toEmitMatchedValue({ data: data3 });
  });

  it("allows you to refetch queries", async () => {
    const request = {
      query: gql`
        query fetchLuke($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `,
      variables: {
        id: "1",
      },
      notifyOnNetworkStatusChange: false,
    };
    const data1 = {
      people_one: {
        name: "Luke Skywalker",
      },
    };

    const data2 = {
      people_one: {
        name: "Luke Skywalker has a new name",
      },
    };

    const queryManager = mockRefetch({
      request,
      firstResult: { data: data1 },
      secondResult: { data: data2 },
    });

    const observable = queryManager.watchQuery<any>(request);
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitMatchedValue({ data: data1 });
    void observable.refetch();
    await expect(stream).toEmitMatchedValue({ data: data2 });
  });

  it("will return referentially equivalent data if nothing changed in a refetch", async () => {
    const request: WatchQueryOptions = {
      query: gql`
        {
          a
          b {
            c
          }
          d {
            e
            f {
              g
            }
          }
        }
      `,
      notifyOnNetworkStatusChange: false,
      canonizeResults: true,
    };

    const data1 = {
      a: 1,
      b: { c: 2 },
      d: { e: 3, f: { g: 4 } },
    };

    const data2 = {
      a: 1,
      b: { c: 2 },
      d: { e: 30, f: { g: 4 } },
    };

    const data3 = {
      a: 1,
      b: { c: 2 },
      d: { e: 3, f: { g: 4 } },
    };

    const queryManager = mockRefetch({
      request,
      firstResult: { data: data1 },
      secondResult: { data: data2 },
      thirdResult: { data: data3 },
    });

    const observable = queryManager.watchQuery<any>(request);
    const stream = new ObservableStream(observable);

    const { data: firstResultData } = await stream.takeNext();
    expect(firstResultData).toEqual(data1);

    void observable.refetch();

    {
      const result = await stream.takeNext();

      expect(result.data).toEqual(data2);
      expect(result.data).not.toEqual(firstResultData);
      expect(result.data.b).toEqual(firstResultData.b);
      expect(result.data.d).not.toEqual(firstResultData.d);
      expect(result.data.d.f).toEqual(firstResultData.d.f);
    }

    void observable.refetch();

    {
      const result = await stream.takeNext();

      expect(result.data).toEqual(data3);
      expect(result.data).toBe(firstResultData);
    }
  });

  it("will return referentially equivalent data in getCurrentResult if nothing changed", async () => {
    const request = {
      query: gql`
        {
          a
          b {
            c
          }
          d {
            e
            f {
              g
            }
          }
        }
      `,
      notifyOnNetworkStatusChange: false,
    };

    const data1 = {
      a: 1,
      b: { c: 2 },
      d: { e: 3, f: { g: 4 } },
    };

    const queryManager = mockQueryManager({
      request,
      result: { data: data1 },
    });

    const observable = queryManager.watchQuery<any>(request);
    const stream = new ObservableStream(observable);

    const { data } = await stream.takeNext();

    expect(data).toEqual(data1);
    expect(data).toBe(observable.getCurrentResult().data);
  });

  it("sets networkStatus to `refetch` when refetching", async () => {
    const request: WatchQueryOptions = {
      query: gql`
        query fetchLuke($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `,
      variables: {
        id: "1",
      },
      notifyOnNetworkStatusChange: true,
      // This causes a loading:true result to be delivered from the cache
      // before the final data2 result is delivered.
      fetchPolicy: "cache-and-network",
    };
    const data1 = {
      people_one: {
        name: "Luke Skywalker",
      },
    };

    const data2 = {
      people_one: {
        name: "Luke Skywalker has a new name",
      },
    };

    const queryManager = mockRefetch({
      request,
      firstResult: { data: data1 },
      secondResult: { data: data2 },
    });

    const observable = queryManager.watchQuery<any>(request);
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitValue({
      data: data1,
      loading: false,
      networkStatus: NetworkStatus.ready,
    });

    void observable.refetch();

    await expect(stream).toEmitValue({
      data: data1,
      loading: true,
      networkStatus: NetworkStatus.refetch,
    });
    await expect(stream).toEmitValue({
      data: data2,
      loading: false,
      networkStatus: NetworkStatus.ready,
    });
  });

  it("allows you to refetch queries with promises", async () => {
    const request = {
      query: gql`
        {
          people_one(id: 1) {
            name
          }
        }
      `,
    };
    const data1 = {
      people_one: {
        name: "Luke Skywalker",
      },
    };

    const data2 = {
      people_one: {
        name: "Luke Skywalker has a new name",
      },
    };

    const queryManager = mockRefetch({
      request,
      firstResult: { data: data1 },
      secondResult: { data: data2 },
    });

    const handle = queryManager.watchQuery<any>(request);
    handle.subscribe({});

    const result = await handle.refetch();

    expect(result.data).toEqual(data2);
  });

  it("allows you to refetch queries with new variables", async () => {
    const query = gql`
      {
        people_one(id: 1) {
          name
        }
      }
    `;

    const data1 = {
      people_one: {
        name: "Luke Skywalker",
      },
    };

    const data2 = {
      people_one: {
        name: "Luke Skywalker has a new name",
      },
    };

    const data3 = {
      people_one: {
        name: "Luke Skywalker has a new name and age",
      },
    };

    const data4 = {
      people_one: {
        name: "Luke Skywalker has a whole new bag",
      },
    };

    const variables1 = {
      test: "I am your father",
    };

    const variables2 = {
      test: "No. No! That's not true! That's impossible!",
    };

    const queryManager = mockQueryManager(
      {
        request: { query: query },
        result: { data: data1 },
      },
      {
        request: { query: query },
        result: { data: data2 },
      },
      {
        request: { query: query, variables: variables1 },
        result: { data: data3 },
      },
      {
        request: { query: query, variables: variables2 },
        result: { data: data4 },
      }
    );

    const observable = queryManager.watchQuery<any>({
      query,
      notifyOnNetworkStatusChange: false,
    });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitValue({
      data: data1,
      loading: false,
      networkStatus: NetworkStatus.ready,
    });

    void observable.refetch();

    await expect(stream).toEmitValue({
      data: data2,
      loading: false,
      networkStatus: NetworkStatus.ready,
    });

    void observable.refetch(variables1);

    await expect(stream).toEmitValue({
      data: data3,
      loading: false,
      networkStatus: NetworkStatus.ready,
    });

    void observable.refetch(variables2);

    await expect(stream).toEmitValue({
      data: data4,
      loading: false,
      networkStatus: NetworkStatus.ready,
    });
  });

  it("only modifies varaibles when refetching", async () => {
    const query = gql`
      {
        people_one(id: 1) {
          name
        }
      }
    `;

    const data1 = {
      people_one: {
        name: "Luke Skywalker",
      },
    };

    const data2 = {
      people_one: {
        name: "Luke Skywalker has a new name",
      },
    };

    const queryManager = mockQueryManager(
      {
        request: { query: query },
        result: { data: data1 },
      },
      {
        request: { query: query },
        result: { data: data2 },
      }
    );

    const observable = queryManager.watchQuery<any>({
      query,
      notifyOnNetworkStatusChange: false,
    });
    const stream = new ObservableStream(observable);
    const originalOptions = assign({}, observable.options);

    await expect(stream).toEmitValue({
      data: data1,
      loading: false,
      networkStatus: NetworkStatus.ready,
    });

    void observable.refetch();

    await expect(stream).toEmitValue({
      data: data2,
      loading: false,
      networkStatus: NetworkStatus.ready,
    });

    const updatedOptions = assign({}, observable.options);
    delete originalOptions.variables;
    delete updatedOptions.variables;
    expect(updatedOptions).toEqual(originalOptions);
  });

  it("continues to poll after refetch", async () => {
    const query = gql`
      {
        people_one(id: 1) {
          name
        }
      }
    `;

    const data1 = {
      people_one: {
        name: "Luke Skywalker",
      },
    };

    const data2 = {
      people_one: {
        name: "Luke Skywalker has a new name",
      },
    };

    const data3 = {
      people_one: {
        name: "Patsy",
      },
    };

    const queryManager = mockQueryManager(
      {
        request: { query },
        result: { data: data1 },
      },
      {
        request: { query },
        result: { data: data2 },
      },
      {
        request: { query },
        result: { data: data3 },
      }
    );

    const observable = queryManager.watchQuery<any>({
      query,
      pollInterval: 200,
      notifyOnNetworkStatusChange: false,
    });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitValue({
      data: data1,
      loading: false,
      networkStatus: NetworkStatus.ready,
    });

    void observable.refetch();

    await expect(stream).toEmitValue({
      data: data2,
      loading: false,
      networkStatus: NetworkStatus.ready,
    });

    await expect(stream).toEmitValue(
      {
        data: data3,
        loading: false,
        networkStatus: NetworkStatus.ready,
      },
      { timeout: 250 }
    );

    observable.stopPolling();
  });

  it("sets networkStatus to `poll` if a polling query is in flight", async () => {
    const query = gql`
      {
        people_one(id: 1) {
          name
        }
      }
    `;

    const data1 = {
      people_one: {
        name: "Luke Skywalker",
      },
    };

    const data2 = {
      people_one: {
        name: "Luke Skywalker has a new name",
      },
    };

    const data3 = {
      people_one: {
        name: "Patsy",
      },
    };

    const queryManager = mockQueryManager(
      {
        request: { query },
        result: { data: data1 },
      },
      {
        request: { query },
        result: { data: data2 },
      },
      {
        request: { query },
        result: { data: data3 },
      }
    );

    const observable = queryManager.watchQuery<any>({
      query,
      pollInterval: 30,
      notifyOnNetworkStatusChange: true,
    });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitValue({
      data: data1,
      loading: false,
      networkStatus: NetworkStatus.ready,
    });

    await expect(stream).toEmitValue({
      data: data1,
      loading: true,
      networkStatus: NetworkStatus.poll,
    });

    stream.unsubscribe();
  });

  it("can handle null values in arrays (#1551)", async () => {
    const query = gql`
      {
        list {
          value
        }
      }
    `;
    const data = { list: [null, { value: 1 }] };
    const queryManager = mockQueryManager({
      request: { query },
      result: { data },
    });
    const observable = queryManager.watchQuery({ query });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitMatchedValue({ data });
    expect(observable.getCurrentResult().data).toEqual(data);
  });

  it("supports cache-only fetchPolicy fetching only cached data", async () => {
    const primeQuery = gql`
      query primeQuery {
        luke: people_one(id: 1) {
          name
        }
      }
    `;

    const complexQuery = gql`
      query complexQuery {
        luke: people_one(id: 1) {
          name
        }
        vader: people_one(id: 4) {
          name
        }
      }
    `;

    const data1 = {
      luke: {
        name: "Luke Skywalker",
      },
    };

    const queryManager = mockQueryManager({
      request: { query: primeQuery },
      result: { data: data1 },
    });

    // First, prime the cache
    await queryManager.query<any>({
      query: primeQuery,
    });

    const handle = queryManager.watchQuery<any>({
      query: complexQuery,
      fetchPolicy: "cache-only",
    });

    const result = await handle.result();

    expect(result.data["luke"].name).toBe("Luke Skywalker");
    expect(result.data).not.toHaveProperty("vader");
  });

  it("runs a mutation", async () => {
    const { result } = await mockMutation({
      mutation: gql`
        mutation makeListPrivate {
          makeListPrivate(id: "5")
        }
      `,
      data: { makeListPrivate: true },
    });

    expect(result.data).toEqual({ makeListPrivate: true });
  });

  it("runs a mutation even when errors is empty array #2912", async () => {
    const { result } = await mockMutation({
      mutation: gql`
        mutation makeListPrivate {
          makeListPrivate(id: "5")
        }
      `,
      errors: [],
      data: { makeListPrivate: true },
    });

    expect(result.data).toEqual({ makeListPrivate: true });
  });

  it('runs a mutation with default errorPolicy equal to "none"', async () => {
    const errors = [new GraphQLError("foo")];

    await expect(
      mockMutation({
        mutation: gql`
          mutation makeListPrivate {
            makeListPrivate(id: "5")
          }
        `,
        errors,
      })
    ).rejects.toThrow(
      expect.objectContaining({
        graphQLErrors: errors,
      })
    );
  });

  it("runs a mutation with variables", async () => {
    const { result } = await mockMutation({
      mutation: gql`
        mutation makeListPrivate($listId: ID!) {
          makeListPrivate(id: $listId)
        }
      `,
      variables: { listId: "1" },
      data: { makeListPrivate: true },
    });

    expect(result.data).toEqual({ makeListPrivate: true });
  });

  const getIdField = (obj: any) => obj.id;

  it("runs a mutation with object parameters and puts the result in the store", async () => {
    const data = {
      makeListPrivate: {
        id: "5",
        isPrivate: true,
      },
    };
    const { result, queryManager } = await mockMutation({
      mutation: gql`
        mutation makeListPrivate {
          makeListPrivate(input: { id: "5" }) {
            id
            isPrivate
          }
        }
      `,
      data,
      config: { dataIdFromObject: getIdField },
    });

    expect(result.data).toEqual(data);

    // Make sure we updated the store with the new data
    expect(queryManager.cache.extract()["5"]).toEqual({
      id: "5",
      isPrivate: true,
    });
  });

  it("runs a mutation and puts the result in the store", async () => {
    const data = {
      makeListPrivate: {
        id: "5",
        isPrivate: true,
      },
    };

    const { result, queryManager } = await mockMutation({
      mutation: gql`
        mutation makeListPrivate {
          makeListPrivate(id: "5") {
            id
            isPrivate
          }
        }
      `,
      data,
      config: { dataIdFromObject: getIdField },
    });

    expect(result.data).toEqual(data);

    // Make sure we updated the store with the new data
    expect(queryManager.cache.extract()["5"]).toEqual({
      id: "5",
      isPrivate: true,
    });
  });

  it("runs a mutation and puts the result in the store with root key", async () => {
    const mutation = gql`
      mutation makeListPrivate {
        makeListPrivate(id: "5") {
          id
          isPrivate
        }
      }
    `;

    const data = {
      makeListPrivate: {
        id: "5",
        isPrivate: true,
      },
    };

    const queryManager = createQueryManager({
      link: mockSingleLink({
        request: { query: mutation },
        result: { data },
      }),
      config: { dataIdFromObject: getIdField },
    });

    const result = await queryManager.mutate({ mutation });

    expect(result.data).toEqual(data);

    // Make sure we updated the store with the new data
    expect(queryManager.cache.extract()["5"]).toEqual({
      id: "5",
      isPrivate: true,
    });
  });

  it(`doesn't return data while query is loading`, async () => {
    const query1 = gql`
      {
        people_one(id: 1) {
          name
        }
      }
    `;

    const data1 = {
      people_one: {
        name: "Luke Skywalker",
      },
    };

    const query2 = gql`
      {
        people_one(id: 5) {
          name
        }
      }
    `;

    const data2 = {
      people_one: {
        name: "Darth Vader",
      },
    };

    const queryManager = mockQueryManager(
      {
        request: { query: query1 },
        result: { data: data1 },
        delay: 10,
      },
      {
        request: { query: query2 },
        result: { data: data2 },
      }
    );

    const observable1 = queryManager.watchQuery<any>({ query: query1 });
    const observable2 = queryManager.watchQuery<any>({ query: query2 });

    const stream1 = new ObservableStream(observable1);
    const stream2 = new ObservableStream(observable2);

    await expect(stream1).toEmitMatchedValue({ data: data1 });
    await expect(stream2).toEmitMatchedValue({ data: data2 });
  });

  it("updates result of previous query if the result of a new query overlaps", async () => {
    const query1 = gql`
      {
        people_one(id: 1) {
          __typename
          id
          name
          age
        }
      }
    `;

    const data1 = {
      people_one: {
        // Correctly identifying this entity is necessary so that fields
        // from query1 and query2 can be safely merged in the cache.
        __typename: "Human",
        id: 1,
        name: "Luke Skywalker",
        age: 50,
      },
    };

    const query2 = gql`
      {
        people_one(id: 1) {
          __typename
          id
          name
          username
        }
      }
    `;

    const data2 = {
      people_one: {
        __typename: "Human",
        id: 1,
        name: "Luke Skywalker has a new name",
        username: "luke",
      },
    };

    const queryManager = mockQueryManager(
      {
        request: { query: query1 },
        result: { data: data1 },
      },
      {
        request: { query: query2 },
        result: { data: data2 },
        delay: 10,
      }
    );

    const observable = queryManager.watchQuery<any>({ query: query1 });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitMatchedValue({ data: data1 });

    await queryManager.query<any>({ query: query2 });

    await expect(stream).toEmitMatchedValue({
      data: {
        people_one: {
          __typename: "Human",
          id: 1,
          name: "Luke Skywalker has a new name",
          age: 50,
        },
      },
    });

    await expect(stream).not.toEmitAnything();
  });

  it("warns if you forget the template literal tag", async () => {
    const queryManager = mockQueryManager();
    expect(() => {
      void queryManager.query<any>({
        // Bamboozle TypeScript into letting us do this
        query: "string" as any as DocumentNode,
      });
    }).toThrowError(/wrap the query string in a "gql" tag/);

    await expect(
      queryManager.mutate({
        // Bamboozle TypeScript into letting us do this
        mutation: "string" as any as DocumentNode,
      })
    ).rejects.toThrow(/wrap the query string in a "gql" tag/);

    expect(() => {
      queryManager.watchQuery<any>({
        // Bamboozle TypeScript into letting us do this
        query: "string" as any as DocumentNode,
      });
    }).toThrowError(/wrap the query string in a "gql" tag/);
  });

  it("should transform queries correctly when given a QueryTransformer", async () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
    const transformedQuery = gql`
      query {
        author {
          firstName
          lastName
          __typename
        }
      }
    `;

    const transformedQueryResult = {
      author: {
        firstName: "John",
        lastName: "Smith",
        __typename: "Author",
      },
    };

    //make sure that the query is transformed within the query
    //manager
    const result = await createQueryManager({
      link: mockSingleLink({
        request: { query: transformedQuery },
        result: { data: transformedQueryResult },
      }),
      config: { addTypename: true },
    }).query({ query: query });

    expect(result.data).toEqual(transformedQueryResult);
  });

  it("should transform mutations correctly", async () => {
    const mutation = gql`
      mutation {
        createAuthor(firstName: "John", lastName: "Smith") {
          firstName
          lastName
        }
      }
    `;
    const transformedMutation = gql`
      mutation {
        createAuthor(firstName: "John", lastName: "Smith") {
          firstName
          lastName
          __typename
        }
      }
    `;

    const transformedMutationResult = {
      createAuthor: {
        firstName: "It works!",
        lastName: "It works!",
        __typename: "Author",
      },
    };

    const result = await createQueryManager({
      link: mockSingleLink({
        request: { query: transformedMutation },
        result: { data: transformedMutationResult },
      }),
      config: { addTypename: true },
    }).mutate({ mutation: mutation });

    expect(result.data).toEqual(transformedMutationResult);
  });

  it("should reject a query promise given a network error", async () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
    const networkError = new Error("Network error");

    await expect(
      mockQueryManager({
        request: { query },
        error: networkError,
      }).query({ query })
    ).rejects.toEqual(new ApolloError({ networkError }));
  });

  it("should reject a query promise given a GraphQL error", async () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
    const graphQLErrors = [new GraphQLError("GraphQL error")];
    await expect(
      mockQueryManager({
        request: { query },
        result: { errors: graphQLErrors },
      }).query({ query })
    ).rejects.toEqual(new ApolloError({ graphQLErrors }));
  });

  it("should not empty the store when a non-polling query fails due to a network error", async () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
    const data = {
      author: {
        firstName: "Dhaivat",
        lastName: "Pandya",
      },
    };
    const queryManager = mockQueryManager(
      {
        request: { query },
        result: { data },
      },
      {
        request: { query },
        error: new Error("Network error ocurred"),
      }
    );
    const result = await queryManager.query<any>({ query });

    expect(result.data).toEqual(data);

    await expect(
      queryManager.query<any>({ query, fetchPolicy: "network-only" })
    ).rejects.toThrow();

    expect(queryManager.cache.extract().ROOT_QUERY!.author).toEqual(
      data.author
    );
  });

  it("should be able to unsubscribe from a polling query subscription", async () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
    const data = {
      author: {
        firstName: "John",
        lastName: "Smith",
      },
    };

    const observable = mockQueryManager(
      {
        request: { query },
        result: { data },
      },
      {
        request: { query },
        result: () => {
          throw new Error("Should not again");
        },
      }
    ).watchQuery({ query, pollInterval: 20 });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitMatchedValue({ data });

    stream.unsubscribe();

    // Ensure polling has stopped by ensuring the error is not thrown from the mocks
    await wait(30);
  });

  it("should not empty the store when a polling query fails due to a network error", async () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
    const data = {
      author: {
        firstName: "John",
        lastName: "Smith",
      },
    };
    const queryManager = mockQueryManager(
      {
        request: { query },
        result: { data },
      },
      {
        request: { query },
        error: new Error("Network error occurred."),
      }
    );
    const observable = queryManager.watchQuery<any>({
      query,
      pollInterval: 20,
      notifyOnNetworkStatusChange: false,
    });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitMatchedValue({ data });
    expect(queryManager.cache.extract().ROOT_QUERY!.author).toEqual(
      data.author
    );

    await expect(stream).toEmitError(
      new ApolloError({ networkError: new Error("Network error occurred.") })
    );
    expect(queryManager.cache.extract().ROOT_QUERY!.author).toEqual(
      data.author
    );
  });

  it("should not fire next on an observer if there is no change in the result", async () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;

    const data = {
      author: {
        firstName: "John",
        lastName: "Smith",
      },
    };
    const queryManager = mockQueryManager(
      {
        request: { query },
        result: { data },
      },
      {
        request: { query },
        result: { data },
      }
    );

    const observable = queryManager.watchQuery<any>({ query });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitMatchedValue({ data });

    const result = await queryManager.query<any>({ query });
    expect(result.data).toEqual(data);

    await expect(stream).not.toEmitAnything();
  });

  it("should not return stale data when we orphan a real-id node in the store with a real-id node", async () => {
    const query1 = gql`
      query {
        author {
          name {
            firstName
            lastName
          }
          age
          id
          __typename
        }
      }
    `;
    const query2 = gql`
      query {
        author {
          name {
            firstName
          }
          id
          __typename
        }
      }
    `;
    const data1 = {
      author: {
        name: {
          firstName: "John",
          lastName: "Smith",
        },
        age: 18,
        id: "187",
        __typename: "Author",
      },
    };
    const data2 = {
      author: {
        name: {
          firstName: "John",
        },
        id: "197",
        __typename: "Author",
      },
    };
    const reducerConfig = { dataIdFromObject };
    const queryManager = createQueryManager({
      link: mockSingleLink(
        {
          request: { query: query1 },
          result: { data: data1 },
        },
        {
          request: { query: query2 },
          result: { data: data2 },
        },
        {
          request: { query: query1 },
          result: { data: data1 },
        }
      ),
      config: reducerConfig,
    });

    const observable1 = queryManager.watchQuery<any>({ query: query1 });
    const observable2 = queryManager.watchQuery<any>({ query: query2 });

    const stream1 = new ObservableStream(observable1);
    const stream2 = new ObservableStream(observable2);

    await expect(stream1).toEmitValue({
      data: data1,
      loading: false,
      networkStatus: NetworkStatus.ready,
    });
    await expect(stream2).toEmitValue({
      data: data2,
      loading: false,
      networkStatus: NetworkStatus.ready,
    });
  });

  it("should return partial data when configured when we orphan a real-id node in the store with a real-id node", async () => {
    const query1 = gql`
      query {
        author {
          name {
            firstName
            lastName
          }
          age
          id
          __typename
        }
      }
    `;
    const query2 = gql`
      query {
        author {
          name {
            firstName
          }
          id
          __typename
        }
      }
    `;
    const data1 = {
      author: {
        name: {
          firstName: "John",
          lastName: "Smith",
        },
        age: 18,
        id: "187",
        __typename: "Author",
      },
    };
    const data2 = {
      author: {
        name: {
          firstName: "John",
        },
        id: "197",
        __typename: "Author",
      },
    };

    const queryManager = createQueryManager({
      link: mockSingleLink(
        {
          request: { query: query1 },
          result: { data: data1 },
        },
        {
          request: { query: query2 },
          result: { data: data2 },
        }
      ),
    });

    const observable1 = queryManager.watchQuery<any>({
      query: query1,
      returnPartialData: true,
    });
    const observable2 = queryManager.watchQuery<any>({ query: query2 });

    const stream1 = new ObservableStream(observable1);
    const stream2 = new ObservableStream(observable2);

    await expect(stream1).toEmitValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });
    await expect(stream2).toEmitValue({
      data: data2,
      loading: false,
      networkStatus: NetworkStatus.ready,
    });
    await expect(stream1).toEmitValue({
      data: data1,
      loading: false,
      networkStatus: NetworkStatus.ready,
    });
  });

  it("should not write unchanged network results to cache", async () => {
    const cache = new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            info: {
              merge: false,
            },
          },
        },
      },
    });

    const client = new ApolloClient({
      cache,
      link: new ApolloLink(
        (operation) =>
          new Observable((observer: Observer<FetchResult>) => {
            switch (operation.operationName) {
              case "A":
                observer.next!({ data: { info: { a: "ay" } } });
                break;
              case "B":
                observer.next!({ data: { info: { b: "bee" } } });
                break;
            }
            observer.complete!();
          })
      ),
    });

    const queryA = gql`
      query A {
        info {
          a
        }
      }
    `;
    const queryB = gql`
      query B {
        info {
          b
        }
      }
    `;

    const obsA = client.watchQuery({
      query: queryA,
      returnPartialData: true,
    });

    const obsB = client.watchQuery({
      query: queryB,
      returnPartialData: true,
    });

    const aStream = new ObservableStream(obsA);
    const bStream = new ObservableStream(obsB);

    await expect(aStream).toEmitValue({
      loading: true,
      networkStatus: NetworkStatus.loading,
      data: undefined,
      partial: true,
    });

    await expect(bStream).toEmitValue({
      loading: true,
      networkStatus: NetworkStatus.loading,
      data: undefined,
      partial: true,
    });

    await expect(aStream).toEmitValue({
      loading: false,
      networkStatus: NetworkStatus.ready,
      data: {
        info: {
          a: "ay",
        },
      },
    });

    await expect(bStream).toEmitValue({
      loading: false,
      networkStatus: NetworkStatus.ready,
      data: {
        info: {
          b: "bee",
        },
      },
    });

    await expect(aStream).toEmitValue({
      loading: true,
      networkStatus: NetworkStatus.loading,
      data: {
        info: {},
      },
      partial: true,
    });

    await expect(aStream).toEmitValue({
      loading: false,
      networkStatus: NetworkStatus.ready,
      data: {
        info: {
          a: "ay",
        },
      },
    });

    await expect(aStream).not.toEmitAnything();
    await expect(bStream).not.toEmitAnything();
  });

  it("should disable feud-stopping logic after evict or modify", async () => {
    const cache = new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            info: {
              merge: false,
            },
          },
        },
      },
    });

    const client = new ApolloClient({
      cache,
      link: new ApolloLink(
        () =>
          new Observable((observer: Observer<FetchResult>) => {
            observer.next!({ data: { info: { c: "see" } } });
            observer.complete!();
          })
      ),
    });

    const query = gql`
      query {
        info {
          c
        }
      }
    `;

    const obs = client.watchQuery({
      query,
      returnPartialData: true,
    });

    const stream = new ObservableStream(obs);

    await expect(stream).toEmitValue({
      loading: true,
      networkStatus: NetworkStatus.loading,
      data: undefined,
      partial: true,
    });

    await expect(stream).toEmitValue({
      loading: false,
      networkStatus: NetworkStatus.ready,
      data: {
        info: {
          c: "see",
        },
      },
    });

    cache.evict({ fieldName: "info" });

    await expect(stream).toEmitValue({
      loading: true,
      networkStatus: NetworkStatus.loading,
      data: undefined,
      partial: true,
    });

    await expect(stream).toEmitValue({
      loading: false,
      networkStatus: NetworkStatus.ready,
      data: {
        info: {
          c: "see",
        },
      },
    });

    cache.modify({
      fields: {
        info(_, { DELETE }) {
          return DELETE;
        },
      },
    });

    await expect(stream).toEmitValue({
      loading: true,
      networkStatus: NetworkStatus.loading,
      data: undefined,
      partial: true,
    });

    await expect(stream).toEmitValue({
      loading: false,
      networkStatus: NetworkStatus.ready,
      data: {
        info: {
          c: "see",
        },
      },
    });

    await expect(stream).not.toEmitAnything();
  });

  it("should not error when replacing unidentified data with a normalized ID", async () => {
    const queryWithoutId = gql`
      query {
        author {
          name {
            firstName
            lastName
          }
          age
          __typename
        }
      }
    `;

    const queryWithId = gql`
      query {
        author {
          name {
            firstName
          }
          id
          __typename
        }
      }
    `;

    const dataWithoutId = {
      author: {
        name: {
          firstName: "John",
          lastName: "Smith",
        },
        age: "124",
        __typename: "Author",
      },
    };

    const dataWithId = {
      author: {
        name: {
          firstName: "Jane",
        },
        id: "129",
        __typename: "Author",
      },
    };

    let mergeCount = 0;
    const queryManager = createQueryManager({
      link: mockSingleLink(
        {
          request: { query: queryWithoutId },
          result: { data: dataWithoutId },
        },
        {
          request: { query: queryWithId },
          result: { data: dataWithId },
        }
      ),
      config: {
        typePolicies: {
          Query: {
            fields: {
              author: {
                merge(existing, incoming, { isReference, readField }) {
                  switch (++mergeCount) {
                    case 1:
                      expect(existing).toBeUndefined();
                      expect(isReference(incoming)).toBe(false);
                      expect(incoming).toEqual(dataWithoutId.author);
                      break;
                    case 2:
                      expect(existing).toEqual(dataWithoutId.author);
                      expect(isReference(incoming)).toBe(true);
                      expect(readField("id", incoming)).toBe("129");
                      expect(readField("name", incoming)).toEqual(
                        dataWithId.author.name
                      );
                      break;
                    default:
                      fail("unreached");
                  }
                  return incoming;
                },
              },
            },
          },
        },
      },
    });

    const observableWithId = queryManager.watchQuery<any>({
      query: queryWithId,
    });

    const observableWithoutId = queryManager.watchQuery<any>({
      query: queryWithoutId,
    });

    const stream1 = new ObservableStream(observableWithoutId);
    const stream2 = new ObservableStream(observableWithId);

    await expect(stream1).toEmitMatchedValue({ data: dataWithoutId });
    await expect(stream2).toEmitMatchedValue({ data: dataWithId });
  });

  it("exposes errors on a refetch as a rejection", async () => {
    const request = {
      query: gql`
        {
          people_one(id: 1) {
            name
          }
        }
      `,
    };
    const firstResult = {
      data: {
        people_one: {
          name: "Luke Skywalker",
        },
      },
    };
    const secondResult = {
      errors: [new GraphQLError("This is not the person you are looking for.")],
    };

    const queryManager = mockRefetch({
      request,
      firstResult,
      secondResult,
    });

    const handle = queryManager.watchQuery<any>(request);
    const stream = new ObservableStream(handle);

    await expect(stream).toEmitValue({
      data: firstResult.data,
      loading: false,
      networkStatus: NetworkStatus.ready,
    });

    const expectedError = new ApolloError({
      graphQLErrors: secondResult.errors,
    });

    await expect(handle.refetch()).rejects.toThrow(expectedError);
    await expect(stream).toEmitError(expectedError);
  });

  it("does not return incomplete data when two queries for the same item are executed", async () => {
    const queryA = gql`
      query queryA {
        person(id: "abc") {
          __typename
          id
          firstName
          lastName
        }
      }
    `;
    const queryB = gql`
      query queryB {
        person(id: "abc") {
          __typename
          id
          lastName
          age
        }
      }
    `;
    const dataA = {
      person: {
        __typename: "Person",
        id: "abc",
        firstName: "Luke",
        lastName: "Skywalker",
      },
    };
    const dataB = {
      person: {
        __typename: "Person",
        id: "abc",
        lastName: "Skywalker",
        age: "32",
      },
    };
    const queryManager = new QueryManager<NormalizedCacheObject>(
      getDefaultOptionsForQueryManagerTests({
        link: mockSingleLink(
          { request: { query: queryA }, result: { data: dataA } },
          { request: { query: queryB }, result: { data: dataB }, delay: 20 }
        ),
        cache: new InMemoryCache({}),
        ssrMode: true,
      })
    );

    const observableA = queryManager.watchQuery({
      query: queryA,
    });
    const observableB = queryManager.watchQuery({
      query: queryB,
    });
    const streamA = new ObservableStream(observableA);
    const streamB = new ObservableStream(observableB);

    await expect(streamA).toEmitNext();
    expect(getCurrentQueryResult(observableA)).toEqual({
      data: dataA,
      partial: false,
    });
    expect(getCurrentQueryResult(observableB)).toEqual({
      data: undefined,
      partial: true,
    });

    await expect(streamB).toEmitNext();
    expect(getCurrentQueryResult(observableA)).toEqual({
      data: dataA,
      partial: false,
    });
    expect(getCurrentQueryResult(observableB)).toEqual({
      data: dataB,
      partial: false,
    });
  });

  it('only increments "queryInfo.lastRequestId" when fetching data from network', async () => {
    const query = gql`
      query query($id: ID!) {
        people_one(id: $id) {
          name
        }
      }
    `;
    const variables = { id: 1 };
    const dataOne = {
      people_one: {
        name: "Luke Skywalker",
      },
    };
    const mockedResponses = [
      {
        request: { query, variables },
        result: { data: dataOne },
      },
    ];

    const queryManager = mockQueryManager(...mockedResponses);
    const queryOptions: WatchQueryOptions<any> = {
      query,
      variables,
      fetchPolicy: "cache-and-network",
    };
    const observable = queryManager.watchQuery(queryOptions);

    const mocks = mockFetchQuery(queryManager);
    const queryId = "1";
    const getQuery: QueryManager<any>["getQuery"] = (
      queryManager as any
    ).getQuery.bind(queryManager);

    const stream = new ObservableStream(observable);

    await expect(stream).toEmitNext();

    {
      const query = getQuery(queryId);
      const fqbpCalls = mocks.fetchQueryByPolicy.mock.calls;

      expect(query.lastRequestId).toEqual(1);
      expect(fqbpCalls.length).toBe(1);

      // Simulate updating the options of the query, which will trigger
      // fetchQueryByPolicy, but it should just read from cache and not
      // update "queryInfo.lastRequestId". For more information, see
      // https://github.com/apollographql/apollo-client/pull/7956#issue-610298427
      await observable.setOptions({
        ...queryOptions,
        fetchPolicy: "cache-first",
      });

      expect(query.lastRequestId).toEqual(1);
      expect(fqbpCalls.length).toBe(2);
    }
  });

  describe("polling queries", () => {
    it("allows you to poll queries", async () => {
      const query = gql`
        query fetchLuke($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `;

      const variables = {
        id: "1",
      };

      const data1 = {
        people_one: {
          name: "Luke Skywalker",
        },
      };

      const data2 = {
        people_one: {
          name: "Luke Skywalker has a new name",
        },
      };

      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data: data1 },
        },
        {
          request: { query, variables },
          result: { data: data2 },
        }
      );
      const observable = queryManager.watchQuery<any>({
        query,
        variables,
        pollInterval: 50,
        notifyOnNetworkStatusChange: false,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data: data1 });
      await expect(stream).toEmitMatchedValue({ data: data2 });
    });

    it("does not poll during SSR", async () => {
      const query = gql`
        query fetchLuke($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `;

      const variables = {
        id: "1",
      };

      const data1 = {
        people_one: {
          name: "Luke Skywalker",
        },
      };

      const data2 = {
        people_one: {
          name: "Luke Skywalker has a new name",
        },
      };

      const queryManager = new QueryManager<NormalizedCacheObject>(
        getDefaultOptionsForQueryManagerTests({
          link: mockSingleLink(
            {
              request: { query, variables },
              result: { data: data1 },
            },
            {
              request: { query, variables },
              result: { data: data2 },
            },
            {
              request: { query, variables },
              result: { data: data2 },
            }
          ),
          cache: new InMemoryCache({ addTypename: false }),
          ssrMode: true,
        })
      );

      const observable = queryManager.watchQuery<any>({
        query,
        variables,
        pollInterval: 10,
        notifyOnNetworkStatusChange: false,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data: data1 });
      await expect(stream).not.toEmitAnything();
    });

    it("should let you handle multiple polled queries and unsubscribe from one of them", async () => {
      const query1 = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const query2 = gql`
        query {
          person {
            name
          }
        }
      `;
      const data11 = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };
      const data12 = {
        author: {
          firstName: "Jack",
          lastName: "Smith",
        },
      };
      const data13 = {
        author: {
          firstName: "Jolly",
          lastName: "Smith",
        },
      };
      const data14 = {
        author: {
          firstName: "Jared",
          lastName: "Smith",
        },
      };
      const data21 = {
        person: {
          name: "Jane Smith",
        },
      };
      const data22 = {
        person: {
          name: "Josey Smith",
        },
      };
      const queryManager = mockQueryManager(
        {
          request: { query: query1 },
          result: { data: data11 },
        },
        {
          request: { query: query1 },
          result: { data: data12 },
        },
        {
          request: { query: query1 },
          result: { data: data13 },
        },
        {
          request: { query: query1 },
          result: { data: data14 },
        },
        {
          request: { query: query2 },
          result: { data: data21 },
        },
        {
          request: { query: query2 },
          result: { data: data22 },
        }
      );
      let handle1Count = 0;
      let handleCount = 0;
      let setMilestone = false;

      const subscription1 = queryManager
        .watchQuery({
          query: query1,
          pollInterval: 150,
        })
        .subscribe({
          next() {
            handle1Count++;
            handleCount++;
            if (handle1Count > 1 && !setMilestone) {
              subscription1.unsubscribe();
              setMilestone = true;
            }
          },
        });

      const subscription2 = queryManager
        .watchQuery({
          query: query2,
          pollInterval: 2000,
        })
        .subscribe({
          next() {
            handleCount++;
          },
        });

      await wait(400);

      expect(handleCount).toBe(3);
      subscription1.unsubscribe();
      subscription2.unsubscribe();
    });

    it("allows you to unsubscribe from polled queries", async () => {
      const query = gql`
        query fetchLuke($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `;

      const variables = {
        id: "1",
      };

      const data1 = {
        people_one: {
          name: "Luke Skywalker",
        },
      };

      const data2 = {
        people_one: {
          name: "Luke Skywalker has a new name",
        },
      };

      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data: data1 },
        },
        {
          request: { query, variables },
          result: { data: data2 },
        },
        {
          request: { query, variables },
          result: () => {
            throw new Error("Should not fetch again");
          },
        }
      );
      const observable = queryManager.watchQuery({
        query,
        variables,
        pollInterval: 50,
        notifyOnNetworkStatusChange: false,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data: data1 });
      await expect(stream).toEmitMatchedValue({ data: data2 });

      stream.unsubscribe();

      // Ensure polling has stopped by ensuring the error is not thrown from the mocks
      await wait(60);
    });

    it("allows you to unsubscribe from polled query errors", async () => {
      const query = gql`
        query fetchLuke($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `;

      const variables = {
        id: "1",
      };

      const data1 = {
        people_one: {
          name: "Luke Skywalker",
        },
      };

      const data2 = {
        people_one: {
          name: "Luke Skywalker has a new name",
        },
      };

      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data: data1 },
        },
        {
          request: { query, variables },
          error: new Error("Network error"),
        },
        {
          request: { query, variables },
          result: { data: data2 },
        },
        {
          request: { query, variables },
          result: () => {
            throw new Error("Should not fetch again");
          },
        }
      );

      const observable = queryManager.watchQuery<any>({
        query,
        variables,
        pollInterval: 50,
        notifyOnNetworkStatusChange: false,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data: data1 });
      await expect(stream).toEmitError(
        new ApolloError({ networkError: new Error("Network error") })
      );

      stream.unsubscribe();

      // Ensure polling has stopped by ensuring the error is not thrown from the mocks
      await wait(60);
    });

    it("exposes a way to start a polling query", async () => {
      const query = gql`
        query fetchLuke($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `;

      const variables = {
        id: "1",
      };

      const data1 = {
        people_one: {
          name: "Luke Skywalker",
        },
      };

      const data2 = {
        people_one: {
          name: "Luke Skywalker has a new name",
        },
      };

      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data: data1 },
        },
        {
          request: { query, variables },
          result: { data: data2 },
        }
      );

      const observable = queryManager.watchQuery<any>({
        query,
        variables,
        notifyOnNetworkStatusChange: false,
      });
      observable.startPolling(50);
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data: data1 });
      await expect(stream).toEmitMatchedValue({ data: data2 });
    });

    it("exposes a way to stop a polling query", async () => {
      const query = gql`
        query fetchLeia($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `;

      const variables = {
        id: "2",
      };

      const data1 = {
        people_one: {
          name: "Leia Skywalker",
        },
      };

      const data2 = {
        people_one: {
          name: "Leia Skywalker has a new name",
        },
      };

      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data: data1 },
        },
        {
          request: { query, variables },
          result: { data: data2 },
        }
      );
      const observable = queryManager.watchQuery<any>({
        query,
        variables,
        pollInterval: 50,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data: data1 });

      observable.stopPolling();

      await expect(stream).not.toEmitAnything();
    });

    it("stopped polling queries still get updates", async () => {
      const query = gql`
        query fetchLeia($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `;

      const variables = {
        id: "2",
      };

      const data1 = {
        people_one: {
          name: "Leia Skywalker",
        },
      };

      const data2 = {
        people_one: {
          name: "Leia Skywalker has a new name",
        },
      };

      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data: data1 },
        },
        {
          request: { query, variables },
          result: { data: data2 },
        }
      );

      const observable = queryManager.watchQuery({
        query,
        variables,
        pollInterval: 50,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data: data1 });

      const result = await queryManager.query({
        query,
        variables,
        fetchPolicy: "network-only",
      });

      expect(result.data).toEqual(data2);
      await expect(stream).toEmitMatchedValue({ data: data2 });
    });
  });

  describe("store resets", () => {
    it("returns a promise resolving when all queries have been refetched", async () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };

      const dataChanged = {
        author: {
          firstName: "John changed",
          lastName: "Smith",
        },
      };

      const query2 = gql`
        query {
          author2 {
            firstName
            lastName
          }
        }
      `;

      const data2 = {
        author2: {
          firstName: "John",
          lastName: "Smith",
        },
      };

      const data2Changed = {
        author2: {
          firstName: "John changed",
          lastName: "Smith",
        },
      };

      const queryManager = createQueryManager({
        link: mockSingleLink(
          {
            request: { query },
            result: { data },
          },
          {
            request: { query: query2 },
            result: { data: data2 },
          },
          {
            request: { query },
            result: { data: dataChanged },
          },
          {
            request: { query: query2 },
            result: { data: data2Changed },
          }
        ),
      });

      const observable = queryManager.watchQuery<any>({ query });
      const observable2 = queryManager.watchQuery<any>({ query: query2 });

      const stream = new ObservableStream(observable);
      const stream2 = new ObservableStream(observable2);

      await expect(stream).toEmitMatchedValue({ data });
      await expect(stream2).toEmitMatchedValue({ data: data2 });

      await resetStore(queryManager);

      const result = getCurrentQueryResult(observable);
      expect(result.partial).toBe(false);
      expect(result.data).toEqual(dataChanged);

      const result2 = getCurrentQueryResult(observable2);
      expect(result2.partial).toBe(false);
      expect(result2.data).toEqual(data2Changed);
    });

    it("should change the store state to an empty state", () => {
      const queryManager = createQueryManager({
        link: mockSingleLink(),
      });

      void resetStore(queryManager);

      expect(queryManager.cache.extract()).toEqual({});
      expect(queryManager.getQueryStore()).toEqual({});
      expect(queryManager.mutationStore).toEqual({});
    });

    it.skip("should only refetch once when we store reset", async () => {
      let queryManager: QueryManager<NormalizedCacheObject>;
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };

      const data2 = {
        author: {
          firstName: "Johnny",
          lastName: "Smith",
        },
      };

      let timesFired = 0;
      const link: ApolloLink = new ApolloLink(
        (op) =>
          new Observable((observer) => {
            timesFired += 1;
            if (timesFired > 1) {
              observer.next({ data: data2 });
            } else {
              observer.next({ data });
            }
            observer.complete();
            return;
          })
      );
      queryManager = createQueryManager({ link });
      const observable = queryManager.watchQuery<any>({ query });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data });
      expect(timesFired).toBe(1);

      // reset the store after data has returned
      void resetStore(queryManager);

      // only refetch once and make sure data has changed
      await expect(stream).toEmitMatchedValue({ data: data2 });
      expect(timesFired).toBe(2);

      await expect(stream).not.toEmitAnything();
    });

    it("should not refetch torn-down queries", async () => {
      let queryManager: QueryManager<NormalizedCacheObject>;
      let observable: ObservableQuery<any>;
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };

      let timesFired = 0;
      const link: ApolloLink = ApolloLink.from([
        () =>
          new Observable((observer) => {
            timesFired += 1;
            observer.next({ data });
          }),
      ]);

      queryManager = createQueryManager({ link });
      observable = queryManager.watchQuery({ query });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data });

      stream.unsubscribe();

      expect(timesFired).toBe(1);

      void resetStore(queryManager);
      await wait(50);

      expect(timesFired).toBe(1);
    });

    it("should not error when resetStore called", async () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };

      let timesFired = 0;
      const link = ApolloLink.from([
        new ApolloLink(
          () =>
            new Observable((observer) => {
              timesFired += 1;
              observer.next({ data });
              observer.complete();
              return;
            })
        ),
      ]);

      const queryManager = createQueryManager({ link });

      const observable = queryManager.watchQuery<any>({
        query,
        notifyOnNetworkStatusChange: false,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data });
      expect(timesFired).toBe(1);

      void resetStore(queryManager);

      await expect(stream).toEmitMatchedValue({ data });
      expect(timesFired).toBe(2);
    });

    it("should not error on a stopped query()", async () => {
      let queryManager: QueryManager<NormalizedCacheObject>;
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };

      const link = new ApolloLink(
        () =>
          new Observable((observer) => {
            observer.next({ data });
          })
      );

      queryManager = createQueryManager({ link });

      const queryId = "1";
      const promise = queryManager.fetchQuery(queryId, { query });

      queryManager.removeQuery(queryId);

      await resetStore(queryManager);
      // Ensure the promise doesn't reject
      await Promise.race([wait(50), promise]);
    });

    it("should throw an error on an inflight fetch query if the store is reset", async () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };
      const queryManager = mockQueryManager({
        request: { query },
        result: { data },
        delay: 10000, //i.e. forever
      });
      const promise = queryManager.fetchQuery("made up id", { query });

      // Need to delay the reset at least until the fetchRequest method
      // has had a chance to enter this request into fetchQueryRejectFns.
      await wait(100);
      void resetStore(queryManager);

      await expect(promise).rejects.toThrow(
        new InvariantError(
          "Store reset while query was in flight (not completed in link chain)"
        )
      );
    });

    it("should call refetch on a mocked Observable if the store is reset", async () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };
      const queryManager = mockQueryManager({
        request: { query },
        result: { data },
      });
      const obs = queryManager.watchQuery<any>({ query });
      obs.subscribe({});
      obs.refetch = jest.fn();

      void resetStore(queryManager);

      await wait(0);

      expect(obs.refetch).toHaveBeenCalledTimes(1);
    });

    it("should not call refetch on a cache-only Observable if the store is reset", async () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      const queryManager = createQueryManager({
        link: mockSingleLink(),
      });

      const options = {
        query,
        fetchPolicy: "cache-only",
      } as WatchQueryOptions;

      let refetchCount = 0;

      const obs = queryManager.watchQuery(options);
      obs.subscribe({});
      obs.refetch = () => {
        ++refetchCount;
        return null as never;
      };

      void resetStore(queryManager);

      await wait(50);

      expect(refetchCount).toEqual(0);
    });

    it("should not call refetch on a standby Observable if the store is reset", async () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      const queryManager = createQueryManager({
        link: mockSingleLink(),
      });

      const options = {
        query,
        fetchPolicy: "standby",
      } as WatchQueryOptions;

      let refetchCount = 0;

      const obs = queryManager.watchQuery(options);
      obs.subscribe({});
      obs.refetch = () => {
        ++refetchCount;
        return null as never;
      };

      void resetStore(queryManager);

      await wait(50);

      expect(refetchCount).toEqual(0);
    });

    it("should not call refetch on a non-subscribed Observable if the store is reset", async () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      const queryManager = createQueryManager({
        link: mockSingleLink(),
      });

      const options = {
        query,
      } as WatchQueryOptions;

      let refetchCount = 0;

      const obs = queryManager.watchQuery(options);
      obs.refetch = () => {
        ++refetchCount;
        return null as never;
      };

      void resetStore(queryManager);

      await wait(50);

      expect(refetchCount).toEqual(0);
    });

    it("should throw an error on an inflight query() if the store is reset", async () => {
      let queryManager: QueryManager<NormalizedCacheObject>;
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };
      const link = new ApolloLink(
        () =>
          new Observable((observer) => {
            // reset the store as soon as we hear about the query
            void resetStore(queryManager);
            observer.next({ data });
            return;
          })
      );

      queryManager = createQueryManager({ link });

      await expect(queryManager.query<any>({ query })).rejects.toBeTruthy();
    });
  });

  describe("refetching observed queries", () => {
    it("returns a promise resolving when all queries have been refetched", async () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };

      const dataChanged = {
        author: {
          firstName: "John changed",
          lastName: "Smith",
        },
      };

      const query2 = gql`
        query {
          author2 {
            firstName
            lastName
          }
        }
      `;

      const data2 = {
        author2: {
          firstName: "John",
          lastName: "Smith",
        },
      };

      const data2Changed = {
        author2: {
          firstName: "John changed",
          lastName: "Smith",
        },
      };

      const queryManager = createQueryManager({
        link: mockSingleLink(
          {
            request: { query },
            result: { data },
          },
          {
            request: { query: query2 },
            result: { data: data2 },
          },
          {
            request: { query },
            result: { data: dataChanged },
          },
          {
            request: { query: query2 },
            result: { data: data2Changed },
          }
        ),
      });

      const observable = queryManager.watchQuery<any>({ query });
      const observable2 = queryManager.watchQuery<any>({ query: query2 });

      const stream = new ObservableStream(observable);
      const stream2 = new ObservableStream(observable2);

      await expect(stream).toEmitMatchedValue({ data });
      await expect(stream2).toEmitMatchedValue({ data: data2 });

      await queryManager.reFetchObservableQueries();

      const result = getCurrentQueryResult(observable);
      expect(result.partial).toBe(false);
      expect(result.data).toEqual(dataChanged);

      const result2 = getCurrentQueryResult(observable2);
      expect(result2.partial).toBe(false);
      expect(result2.data).toEqual(data2Changed);
    });

    it("should only refetch once when we refetch observable queries", async () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };

      const data2 = {
        author: {
          firstName: "Johnny",
          lastName: "Smith",
        },
      };

      let timesFired = 0;
      const link: ApolloLink = new ApolloLink(
        (op) =>
          new Observable((observer) => {
            timesFired += 1;
            if (timesFired > 1) {
              observer.next({ data: data2 });
            } else {
              observer.next({ data });
            }
            observer.complete();
            return;
          })
      );
      const queryManager = createQueryManager({ link });
      const observable = queryManager.watchQuery<any>({ query });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data });
      expect(timesFired).toBe(1);

      // refetch the observed queries after data has returned
      void queryManager.reFetchObservableQueries();

      await expect(stream).toEmitMatchedValue({ data: data2 });
      expect(timesFired).toBe(2);
    });

    it("should not refetch torn-down queries", async () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };

      let timesFired = 0;
      const link: ApolloLink = ApolloLink.from([
        () =>
          new Observable((observer) => {
            timesFired += 1;
            observer.next({ data });
            return;
          }),
      ]);

      const queryManager = createQueryManager({ link });
      const observable = queryManager.watchQuery({ query });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data });
      expect(timesFired).toBe(1);

      stream.unsubscribe();
      void queryManager.reFetchObservableQueries();

      await wait(50);

      expect(timesFired).toBe(1);
    });

    it("should not error after reFetchObservableQueries", async () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };

      let timesFired = 0;
      const link = ApolloLink.from([
        () =>
          new Observable((observer) => {
            timesFired += 1;
            observer.next({ data });
            observer.complete();
          }),
      ]);

      const queryManager = createQueryManager({ link });

      const observable = queryManager.watchQuery<any>({
        query,
        notifyOnNetworkStatusChange: false,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data });
      expect(timesFired).toBe(1);

      void queryManager.reFetchObservableQueries();

      await expect(stream).toEmitMatchedValue({ data });
      expect(timesFired).toBe(2);

      await expect(stream).not.toEmitAnything();
    });

    it("should NOT throw an error on an inflight fetch query if the observable queries are refetched", async () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };
      const queryManager = mockQueryManager({
        request: { query },
        result: { data },
        delay: 100,
      });
      const promise = queryManager.fetchQuery("made up id", { query });
      void queryManager.reFetchObservableQueries();

      await expect(promise).resolves.toBeTruthy();
    });

    it("should call refetch on a mocked Observable if the observed queries are refetched", async () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };
      const queryManager = mockQueryManager({
        request: { query },
        result: { data },
      });

      const obs = queryManager.watchQuery({ query });
      obs.subscribe({});
      obs.refetch = jest.fn();

      void queryManager.reFetchObservableQueries();

      await wait(0);

      expect(obs.refetch).toHaveBeenCalledTimes(1);
    });

    it("should not call refetch on a cache-only Observable if the observed queries are refetched", async () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      const queryManager = createQueryManager({
        link: mockSingleLink(),
      });

      const options = {
        query,
        fetchPolicy: "cache-only",
      } as WatchQueryOptions;

      let refetchCount = 0;

      const obs = queryManager.watchQuery(options);
      obs.subscribe({});
      obs.refetch = () => {
        ++refetchCount;
        return null as never;
      };

      void queryManager.reFetchObservableQueries();

      await wait(50);

      expect(refetchCount).toEqual(0);
    });

    it("should not call refetch on a standby Observable if the observed queries are refetched", async () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      const queryManager = createQueryManager({
        link: mockSingleLink(),
      });

      const options = {
        query,
        fetchPolicy: "standby",
      } as WatchQueryOptions;

      let refetchCount = 0;

      const obs = queryManager.watchQuery(options);
      obs.subscribe({});
      obs.refetch = () => {
        ++refetchCount;
        return null as never;
      };

      void queryManager.reFetchObservableQueries();

      await wait(50);

      expect(refetchCount).toEqual(0);
    });

    it("should refetch on a standby Observable if the observed queries are refetched and the includeStandby parameter is set to true", async () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      const queryManager = createQueryManager({
        link: mockSingleLink(),
      });

      const options = {
        query,
        fetchPolicy: "standby",
      } as WatchQueryOptions;

      let refetchCount = 0;

      const obs = queryManager.watchQuery(options);
      obs.subscribe({});
      obs.refetch = () => {
        ++refetchCount;
        return null as never;
      };

      const includeStandBy = true;
      void queryManager.reFetchObservableQueries(includeStandBy);

      await wait(50);

      expect(refetchCount).toEqual(1);
    });

    it("should not call refetch on a non-subscribed Observable", async () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      const queryManager = createQueryManager({
        link: mockSingleLink(),
      });

      const options = {
        query,
      } as WatchQueryOptions;

      let refetchCount = 0;

      const obs = queryManager.watchQuery(options);
      obs.refetch = () => {
        ++refetchCount;
        return null as never;
      };

      void queryManager.reFetchObservableQueries();

      await wait(50);

      expect(refetchCount).toEqual(0);
    });

    it("should NOT throw an error on an inflight query() if the observed queries are refetched", async () => {
      let queryManager: QueryManager<NormalizedCacheObject>;
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };
      const link = new ApolloLink(
        () =>
          new Observable((observer) => {
            // refetch observed queries as soon as we hear about the query
            void queryManager.reFetchObservableQueries();
            observer.next({ data });
            observer.complete();
          })
      );

      queryManager = createQueryManager({ link });

      await expect(queryManager.query<any>({ query })).resolves.toBeTruthy();
    });
  });

  describe("refetching specified queries", () => {
    it("returns a promise resolving when all queries have been refetched", async () => {
      const query = gql`
        query GetAuthor {
          author {
            firstName
            lastName
          }
        }
      `;

      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };

      const dataChanged = {
        author: {
          firstName: "John changed",
          lastName: "Smith",
        },
      };

      const query2 = gql`
        query GetAuthor2 {
          author2 {
            firstName
            lastName
          }
        }
      `;

      const data2 = {
        author2: {
          firstName: "John",
          lastName: "Smith",
        },
      };

      const data2Changed = {
        author2: {
          firstName: "John changed",
          lastName: "Smith",
        },
      };

      const queryManager = createQueryManager({
        link: mockSingleLink(
          {
            request: { query },
            result: { data },
          },
          {
            request: { query: query2 },
            result: { data: data2 },
          },
          {
            request: { query },
            result: { data: dataChanged },
          },
          {
            request: { query: query2 },
            result: { data: data2Changed },
          }
        ),
      });

      const observable = queryManager.watchQuery<any>({ query });
      const observable2 = queryManager.watchQuery<any>({ query: query2 });

      const stream = new ObservableStream(observable);
      const stream2 = new ObservableStream(observable2);

      await expect(stream).toEmitMatchedValue({ data });
      await expect(stream2).toEmitMatchedValue({ data: data2 });

      const results: any[] = [];
      queryManager
        .refetchQueries({
          include: ["GetAuthor", "GetAuthor2"],
        })
        .forEach((result) => results.push(result));

      await Promise.all(results);

      const result = getCurrentQueryResult(observable);
      expect(result.partial).toBe(false);
      expect(result.data).toEqual(dataChanged);

      const result2 = getCurrentQueryResult(observable2);
      expect(result2.partial).toBe(false);
      expect(result2.data).toEqual(data2Changed);
    });
  });

  describe("loading state", () => {
    it("should be passed as false if we are not watching a query", async () => {
      const query = gql`
        query {
          fortuneCookie
        }
      `;
      const data = {
        fortuneCookie: "Buy it",
      };
      const result = await mockQueryManager({
        request: { query },
        result: { data },
      }).query({ query });

      expect(result.loading).toBe(false);
      expect(result.data).toEqual(data);
    });

    it("should be passed to the observer as true if we are returning partial data", async () => {
      const fortuneCookie =
        "You must stick to your goal but rethink your approach";
      const primeQuery = gql`
        query {
          fortuneCookie
        }
      `;
      const primeData = { fortuneCookie };

      const author = { name: "John" };
      const query = gql`
        query {
          fortuneCookie
          author {
            name
          }
        }
      `;
      const fullData = { fortuneCookie, author };

      const queryManager = mockQueryManager(
        {
          request: { query },
          result: { data: fullData },
          delay: 5,
        },
        {
          request: { query: primeQuery },
          result: { data: primeData },
        }
      );

      await queryManager.query<any>({ query: primeQuery });

      const observable = queryManager.watchQuery<any>({
        query,
        returnPartialData: true,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitValue({
        data: primeData,
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });
      await expect(stream).toEmitValue({
        data: fullData,
        loading: false,
        networkStatus: NetworkStatus.ready,
      });
    });

    it("should be passed to the observer as false if we are returning all the data", async () => {
      const stream = getObservableStream({
        query: gql`
          query {
            author {
              firstName
              lastName
            }
          }
        `,
        result: {
          data: {
            author: {
              firstName: "John",
              lastName: "Smith",
            },
          },
        },
      });

      await expect(stream).toEmitValue({
        data: { author: { firstName: "John", lastName: "Smith" } },
        loading: false,
        networkStatus: NetworkStatus.ready,
      });
    });

    it("will update on `resetStore`", async () => {
      const testQuery = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data1 = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };
      const data2 = {
        author: {
          firstName: "John",
          lastName: "Smith 2",
        },
      };
      const queryManager = mockQueryManager(
        {
          request: { query: testQuery },
          result: { data: data1 },
        },
        {
          request: { query: testQuery },
          result: { data: data2 },
        }
      );

      const stream = new ObservableStream(
        queryManager.watchQuery({
          query: testQuery,
          notifyOnNetworkStatusChange: false,
        })
      );

      await expect(stream).toEmitValue({
        data: data1,
        loading: false,
        networkStatus: NetworkStatus.ready,
      });

      await wait(0);
      void resetStore(queryManager);

      await expect(stream).toEmitValue({
        data: data2,
        loading: false,
        networkStatus: NetworkStatus.ready,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("will be true when partial data may be returned", async () => {
      const query1 = gql`
        {
          a {
            x1
            y1
            z1
          }
        }
      `;
      const query2 = gql`
        {
          a {
            x1
            y1
            z1
          }
          b {
            x2
            y2
            z2
          }
        }
      `;
      const data1 = {
        a: { x1: 1, y1: 2, z1: 3 },
      };
      const data2 = {
        a: { x1: 1, y1: 2, z1: 3 },
        b: { x2: 3, y2: 2, z2: 1 },
      };
      const queryManager = mockQueryManager(
        {
          request: { query: query1 },
          result: { data: data1 },
        },
        {
          request: { query: query2 },
          result: { data: data2 },
          delay: 5,
        }
      );

      const result1 = await queryManager.query({ query: query1 });
      expect(result1.loading).toBe(false);
      expect(result1.data).toEqual(data1);

      const observable = queryManager.watchQuery({
        query: query2,
        returnPartialData: true,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitValue({
        data: data1,
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });
      await expect(stream).toEmitValue({
        data: data2,
        loading: false,
        networkStatus: NetworkStatus.ready,
      });

      await expect(stream).not.toEmitAnything();
    });
  });

  describe("refetchQueries", () => {
    let consoleWarnSpy: jest.SpyInstance;
    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    });
    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it("should refetch the right query when a result is successfully returned", async () => {
      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }
      `;
      const mutationData = {
        changeAuthorName: {
          firstName: "Jack",
          lastName: "Smith",
        },
      };
      const query = gql`
        query getAuthors($id: ID!) {
          author(id: $id) {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };
      const secondReqData = {
        author: {
          firstName: "Jane",
          lastName: "Johnson",
        },
      };
      const variables = { id: "1234" };
      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data },
        },
        {
          request: { query, variables },
          result: { data: secondReqData },
        },
        {
          request: { query: mutation },
          result: { data: mutationData },
        }
      );
      const observable = queryManager.watchQuery<any>({
        query,
        variables,
        notifyOnNetworkStatusChange: false,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data });

      void queryManager.mutate({ mutation, refetchQueries: ["getAuthors"] });

      await expect(stream).toEmitMatchedValue({ data: secondReqData });
      expect(observable.getCurrentResult().data).toEqual(secondReqData);
    });

    it("should not warn and continue when an unknown query name is asked to refetch", async () => {
      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }
      `;
      const mutationData = {
        changeAuthorName: {
          firstName: "Jack",
          lastName: "Smith",
        },
      };
      const query = gql`
        query getAuthors {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };
      const secondReqData = {
        author: {
          firstName: "Jane",
          lastName: "Johnson",
        },
      };
      const queryManager = mockQueryManager(
        {
          request: { query },
          result: { data },
        },
        {
          request: { query },
          result: { data: secondReqData },
        },
        {
          request: { query: mutation },
          result: { data: mutationData },
        }
      );
      const observable = queryManager.watchQuery<any>({
        query,
        notifyOnNetworkStatusChange: false,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data });

      void queryManager.mutate({
        mutation,
        refetchQueries: ["fakeQuery", "getAuthors"],
      });

      await expect(stream).toEmitMatchedValue({ data: secondReqData });
      expect(consoleWarnSpy).toHaveBeenLastCalledWith(
        'Unknown query named "%s" requested in refetchQueries options.include array',
        "fakeQuery"
      );
    });

    it("should ignore (with warning) a query named in refetchQueries that has no active subscriptions", async () => {
      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }
      `;
      const mutationData = {
        changeAuthorName: {
          firstName: "Jack",
          lastName: "Smith",
        },
      };
      const query = gql`
        query getAuthors {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };
      const secondReqData = {
        author: {
          firstName: "Jane",
          lastName: "Johnson",
        },
      };
      const queryManager = mockQueryManager(
        {
          request: { query },
          result: { data },
        },
        {
          request: { query },
          result: { data: secondReqData },
        },
        {
          request: { query: mutation },
          result: { data: mutationData },
        }
      );

      const observable = queryManager.watchQuery<any>({ query });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data });

      stream.unsubscribe();
      await queryManager.mutate({
        mutation,
        refetchQueries: ["getAuthors"],
      });

      expect(consoleWarnSpy).toHaveBeenLastCalledWith(
        'Unknown query named "%s" requested in refetchQueries options.include array',
        "getAuthors"
      );
    });

    it("should ignore (with warning) a document node in refetchQueries that has no active subscriptions", async () => {
      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }
      `;
      const mutationData = {
        changeAuthorName: {
          firstName: "Jack",
          lastName: "Smith",
        },
      };
      const query = gql`
        query getAuthors {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };
      const secondReqData = {
        author: {
          firstName: "Jane",
          lastName: "Johnson",
        },
      };
      const queryManager = mockQueryManager(
        {
          request: { query },
          result: { data },
        },
        {
          request: { query },
          result: { data: secondReqData },
        },
        {
          request: { query: mutation },
          result: { data: mutationData },
        }
      );

      const observable = queryManager.watchQuery<any>({ query });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data });
      stream.unsubscribe();

      // The subscription has been stopped already
      await queryManager.mutate({
        mutation,
        refetchQueries: [query],
      });

      expect(consoleWarnSpy).toHaveBeenLastCalledWith(
        'Unknown query named "%s" requested in refetchQueries options.include array',
        "getAuthors"
      );
    });

    it("should ignore (with warning) a document node containing an anonymous query in refetchQueries that has no active subscriptions", async () => {
      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }
      `;
      const mutationData = {
        changeAuthorName: {
          firstName: "Jack",
          lastName: "Smith",
        },
      };
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };
      const secondReqData = {
        author: {
          firstName: "Jane",
          lastName: "Johnson",
        },
      };
      const queryManager = mockQueryManager(
        {
          request: { query },
          result: { data },
        },
        {
          request: { query },
          result: { data: secondReqData },
        },
        {
          request: { query: mutation },
          result: { data: mutationData },
        }
      );

      const observable = queryManager.watchQuery<any>({ query });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data });
      stream.unsubscribe();

      // The subscription has been stopped already
      await queryManager.mutate({
        mutation,
        refetchQueries: [query],
      });

      expect(consoleWarnSpy).toHaveBeenLastCalledWith(
        "Unknown anonymous query requested in refetchQueries options.include array"
      );
    });

    it("also works with a query document and variables", async () => {
      const mutation = gql`
        mutation changeAuthorName($id: ID!) {
          changeAuthorName(newName: "Jack Smith", id: $id) {
            firstName
            lastName
          }
        }
      `;
      const mutationData = {
        changeAuthorName: {
          firstName: "Jack",
          lastName: "Smith",
        },
      };
      const query = gql`
        query getAuthors($id: ID!) {
          author(id: $id) {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };
      const secondReqData = {
        author: {
          firstName: "Jane",
          lastName: "Johnson",
        },
      };

      const variables = { id: "1234" };
      const mutationVariables = { id: "2345" };
      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data },
          delay: 10,
        },
        {
          request: { query, variables },
          result: { data: secondReqData },
          delay: 100,
        },
        {
          request: { query: mutation, variables: mutationVariables },
          result: { data: mutationData },
          delay: 10,
        }
      );
      const observable = queryManager.watchQuery<any>({ query, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data });

      await queryManager.mutate({
        mutation,
        variables: mutationVariables,
        refetchQueries: [{ query, variables }],
      });

      await expect(stream).toEmitMatchedValue(
        { data: secondReqData },
        { timeout: 150 }
      );
      expect(observable.getCurrentResult().data).toEqual(secondReqData);

      await expect(stream).not.toEmitAnything();
    });

    it("also works with a query document node", async () => {
      const mutation = gql`
        mutation changeAuthorName($id: ID!) {
          changeAuthorName(newName: "Jack Smith", id: $id) {
            firstName
            lastName
          }
        }
      `;
      const mutationData = {
        changeAuthorName: {
          firstName: "Jack",
          lastName: "Smith",
        },
      };
      const query = gql`
        query getAuthors($id: ID!) {
          author(id: $id) {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };
      const secondReqData = {
        author: {
          firstName: "Jane",
          lastName: "Johnson",
        },
      };

      const variables = { id: "1234" };
      const mutationVariables = { id: "2345" };
      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data },
          delay: 10,
        },
        {
          request: { query, variables },
          result: { data: secondReqData },
          delay: 100,
        },
        {
          request: { query: mutation, variables: mutationVariables },
          result: { data: mutationData },
          delay: 10,
        }
      );
      const observable = queryManager.watchQuery<any>({ query, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data });

      await queryManager.mutate({
        mutation,
        variables: mutationVariables,
        refetchQueries: [query],
      });

      await expect(stream).toEmitMatchedValue(
        { data: secondReqData },
        { timeout: 150 }
      );
      expect(observable.getCurrentResult().data).toEqual(secondReqData);

      await expect(stream).not.toEmitAnything();
    });

    it("also works with different references of a same query document node", async () => {
      const mutation = gql`
        mutation changeAuthorName($id: ID!) {
          changeAuthorName(newName: "Jack Smith", id: $id) {
            firstName
            lastName
          }
        }
      `;
      const mutationData = {
        changeAuthorName: {
          firstName: "Jack",
          lastName: "Smith",
        },
      };
      const query = gql`
        query getAuthors($id: ID!) {
          author(id: $id) {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };
      const secondReqData = {
        author: {
          firstName: "Jane",
          lastName: "Johnson",
        },
      };

      const variables = { id: "1234" };
      const mutationVariables = { id: "2345" };
      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data },
          delay: 10,
        },
        {
          request: { query, variables },
          result: { data: secondReqData },
          delay: 100,
        },
        {
          request: { query: mutation, variables: mutationVariables },
          result: { data: mutationData },
          delay: 10,
        }
      );
      const observable = queryManager.watchQuery<any>({ query, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data });

      await queryManager.mutate({
        mutation,
        variables: mutationVariables,
        // spread the query into a new object to simulate multiple instances
        refetchQueries: [{ ...query }],
      });

      await expect(stream).toEmitMatchedValue(
        { data: secondReqData },
        { timeout: 150 }
      );
      expect(observable.getCurrentResult().data).toEqual(secondReqData);

      await expect(stream).not.toEmitAnything();
    });

    it("also works with a conditional function that returns false", async () => {
      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }
      `;
      const mutationData = {
        changeAuthorName: {
          firstName: "Jack",
          lastName: "Smith",
        },
      };
      const query = gql`
        query getAuthors {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };
      const secondReqData = {
        author: {
          firstName: "Jane",
          lastName: "Johnson",
        },
      };
      const queryManager = mockQueryManager(
        {
          request: { query },
          result: { data },
        },
        {
          request: { query },
          result: { data: secondReqData },
        },
        {
          request: { query: mutation },
          result: { data: mutationData },
        }
      );
      const observable = queryManager.watchQuery<any>({ query });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data });

      const conditional = jest.fn(() => []);
      await queryManager.mutate({ mutation, refetchQueries: conditional });

      expect(conditional).toHaveBeenCalledTimes(1);
      expect(conditional).toHaveBeenCalledWith(
        expect.objectContaining({ data: mutationData })
      );
    });

    it("also works with a conditional function that returns an array of refetches", async () => {
      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }
      `;
      const mutationData = {
        changeAuthorName: {
          firstName: "Jack",
          lastName: "Smith",
        },
      };
      const query = gql`
        query getAuthors {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };
      const secondReqData = {
        author: {
          firstName: "Jane",
          lastName: "Johnson",
        },
      };
      const queryManager = mockQueryManager(
        {
          request: { query },
          result: { data },
        },
        {
          request: { query },
          result: { data: secondReqData },
        },
        {
          request: { query: mutation },
          result: { data: mutationData },
        }
      );
      const observable = queryManager.watchQuery<any>({ query });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data });

      const conditional = jest.fn(() => [{ query }]);
      await queryManager.mutate({ mutation, refetchQueries: conditional });

      expect(conditional).toHaveBeenCalledTimes(1);
      expect(conditional).toHaveBeenCalledWith(
        expect.objectContaining({ data: mutationData })
      );

      await expect(stream).toEmitMatchedValue({ data: secondReqData });
    });

    it("should refetch using the original query context (if any)", async () => {
      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }
      `;
      const mutationData = {
        changeAuthorName: {
          firstName: "Jack",
          lastName: "Smith",
        },
      };
      const query = gql`
        query getAuthors($id: ID!) {
          author(id: $id) {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };
      const secondReqData = {
        author: {
          firstName: "Jane",
          lastName: "Johnson",
        },
      };
      const variables = { id: "1234" };
      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data },
        },
        {
          request: { query, variables },
          result: { data: secondReqData },
        },
        {
          request: { query: mutation },
          result: { data: mutationData },
        }
      );

      const headers = {
        someHeader: "some value",
      };
      const observable = queryManager.watchQuery<any>({
        query,
        variables,
        context: {
          headers,
        },
        notifyOnNetworkStatusChange: false,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitNext();

      void queryManager.mutate({
        mutation,
        refetchQueries: ["getAuthors"],
      });

      await expect(stream).toEmitNext();

      const context = (
        queryManager.link as MockApolloLink
      ).operation!.getContext();
      expect(context.headers).not.toBeUndefined();
      expect(context.headers.someHeader).toEqual(headers.someHeader);
    });

    it("should refetch using the specified context, if provided", async () => {
      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }
      `;
      const mutationData = {
        changeAuthorName: {
          firstName: "Jack",
          lastName: "Smith",
        },
      };
      const query = gql`
        query getAuthors($id: ID!) {
          author(id: $id) {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };
      const secondReqData = {
        author: {
          firstName: "Jane",
          lastName: "Johnson",
        },
      };
      const variables = { id: "1234" };
      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data },
        },
        {
          request: { query, variables },
          result: { data: secondReqData },
        },
        {
          request: { query: mutation },
          result: { data: mutationData },
        }
      );

      const observable = queryManager.watchQuery<any>({
        query,
        variables,
        notifyOnNetworkStatusChange: false,
      });
      const stream = new ObservableStream(observable);

      const headers = {
        someHeader: "some value",
      };

      await expect(stream).toEmitNext();

      void queryManager.mutate({
        mutation,
        refetchQueries: [
          {
            query,
            variables,
            context: {
              headers,
            },
          },
        ],
      });

      await expect(stream).toEmitNext();

      const context = (
        queryManager.link as MockApolloLink
      ).operation!.getContext();
      expect(context.headers).not.toBeUndefined();
      expect(context.headers.someHeader).toEqual(headers.someHeader);
    });
  });

  describe("onQueryUpdated", () => {
    const mutation = gql`
      mutation changeAuthorName {
        changeAuthorName(newName: "Jack Smith") {
          firstName
          lastName
        }
      }
    `;

    const mutationData = {
      changeAuthorName: {
        firstName: "Jack",
        lastName: "Smith",
      },
    };

    const query = gql`
      query getAuthors($id: ID!) {
        author(id: $id) {
          firstName
          lastName
        }
      }
    `;

    const data = {
      author: {
        firstName: "John",
        lastName: "Smith",
      },
    };

    const secondReqData = {
      author: {
        firstName: "Jane",
        lastName: "Johnson",
      },
    };

    const variables = { id: "1234" };

    function makeQueryManager() {
      return mockQueryManager(
        {
          request: { query, variables },
          result: { data },
        },
        {
          request: { query, variables },
          result: { data: secondReqData },
        },
        {
          request: { query: mutation },
          result: { data: mutationData },
        }
      );
    }

    it("should refetch the right query when a result is successfully returned", async () => {
      const queryManager = makeQueryManager();

      const observable = queryManager.watchQuery<any>({
        query,
        variables,
        notifyOnNetworkStatusChange: false,
      });
      const stream = new ObservableStream(observable);

      let finishedRefetch = false;

      await expect(stream).toEmitMatchedValue({ data });

      await queryManager.mutate({
        mutation,

        update(cache) {
          cache.modify({
            fields: {
              author(_, { INVALIDATE }) {
                return INVALIDATE;
              },
            },
          });
        },

        async onQueryUpdated(obsQuery) {
          expect(obsQuery.options.query).toBe(query);
          const result = await obsQuery.refetch();

          // Wait a bit to make sure the mutation really awaited the
          // refetching of the query.
          await wait(100);
          finishedRefetch = true;
          return result;
        },
      });

      expect(finishedRefetch).toBe(true);
      await expect(stream).toEmitMatchedValue({ data: secondReqData });
      expect(observable.getCurrentResult().data).toEqual(secondReqData);
    });

    it("should refetch using the original query context (if any)", async () => {
      const queryManager = makeQueryManager();

      const headers = {
        someHeader: "some value",
      };

      const observable = queryManager.watchQuery<any>({
        query,
        variables,
        context: {
          headers,
        },
        notifyOnNetworkStatusChange: false,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data });

      void queryManager.mutate({
        mutation,

        update(cache) {
          cache.modify({
            fields: {
              author(_, { INVALIDATE }) {
                return INVALIDATE;
              },
            },
          });
        },

        onQueryUpdated(obsQuery) {
          expect(obsQuery.options.query).toBe(query);
          return obsQuery.refetch();
        },
      });

      await expect(stream).toEmitMatchedValue({ data: secondReqData });

      const context = (
        queryManager.link as MockApolloLink
      ).operation!.getContext();
      expect(context.headers).not.toBeUndefined();
      expect(context.headers.someHeader).toEqual(headers.someHeader);
    });

    it("should refetch using the specified context, if provided", async () => {
      const queryManager = makeQueryManager();

      const observable = queryManager.watchQuery<any>({
        query,
        variables,
        notifyOnNetworkStatusChange: false,
      });
      const stream = new ObservableStream(observable);

      const headers = {
        someHeader: "some value",
      };

      await expect(stream).toEmitMatchedValue({ data });

      void queryManager.mutate({
        mutation,

        update(cache) {
          cache.evict({ fieldName: "author" });
        },

        onQueryUpdated(obsQuery) {
          expect(obsQuery.options.query).toBe(query);
          return obsQuery.reobserve({
            fetchPolicy: "network-only",
            context: {
              ...obsQuery.options.context,
              headers,
            },
          });
        },
      });

      await expect(stream).toEmitMatchedValue({ data: secondReqData });

      const context = (
        queryManager.link as MockApolloLink
      ).operation!.getContext();
      expect(context.headers).not.toBeUndefined();
      expect(context.headers.someHeader).toEqual(headers.someHeader);
    });
  });

  describe("awaitRefetchQueries", () => {
    it("should not wait for `refetchQueries` to complete before resolving the mutation, when `awaitRefetchQueries` is undefined", async () => {
      const query = gql`
        query getAuthors($id: ID!) {
          author(id: $id) {
            firstName
            lastName
          }
        }
      `;

      const queryData = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };

      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }
      `;

      const mutationData = {
        changeAuthorName: {
          firstName: "Jack",
          lastName: "Smith",
        },
      };

      const secondReqData = {
        author: {
          firstName: "Jane",
          lastName: "Johnson",
        },
      };

      const variables = { id: "1234" };

      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data: queryData },
        },
        {
          request: { query: mutation },
          result: { data: mutationData },
        },
        {
          request: { query, variables },
          result: { data: secondReqData },
        }
      );

      const observable = queryManager.watchQuery({
        query,
        variables,
        notifyOnNetworkStatusChange: false,
      });
      const stream = new ObservableStream(observable);
      let mutationComplete = false;

      await expect(stream).toEmitMatchedValue({ data: queryData });

      void queryManager
        .mutate({
          mutation,
          refetchQueries: ["getAuthors"],
          awaitRefetchQueries: false,
        })
        .then(() => {
          mutationComplete = true;
        });

      await expect(stream).toEmitMatchedValue({ data: secondReqData });
      expect(observable.getCurrentResult().data).toEqual(secondReqData);
      expect(mutationComplete).toBe(true);
    });

    it("should not wait for `refetchQueries` to complete before resolving the mutation, when `awaitRefetchQueries` is false", async () => {
      const query = gql`
        query getAuthors($id: ID!) {
          author(id: $id) {
            firstName
            lastName
          }
        }
      `;

      const queryData = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };

      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }
      `;

      const mutationData = {
        changeAuthorName: {
          firstName: "Jack",
          lastName: "Smith",
        },
      };

      const secondReqData = {
        author: {
          firstName: "Jane",
          lastName: "Johnson",
        },
      };

      const variables = { id: "1234" };

      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data: queryData },
        },
        {
          request: { query: mutation },
          result: { data: mutationData },
        },
        {
          request: { query, variables },
          result: { data: secondReqData },
        }
      );

      const observable = queryManager.watchQuery({
        query,
        variables,
        notifyOnNetworkStatusChange: false,
      });
      const stream = new ObservableStream(observable);
      let mutationComplete = false;

      await expect(stream).toEmitMatchedValue({ data: queryData });

      void queryManager
        .mutate({ mutation, refetchQueries: ["getAuthors"] })
        .then(() => {
          mutationComplete = true;
        });

      await expect(stream).toEmitMatchedValue({ data: secondReqData });
      expect(observable.getCurrentResult().data).toEqual(secondReqData);
      expect(mutationComplete).toBe(true);
    });

    it("should wait for `refetchQueries` to complete before resolving the mutation, when `awaitRefetchQueries` is `true`", async () => {
      const query = gql`
        query getAuthors($id: ID!) {
          author(id: $id) {
            firstName
            lastName
          }
        }
      `;

      const queryData = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };

      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }
      `;

      const mutationData = {
        changeAuthorName: {
          firstName: "Jack",
          lastName: "Smith",
        },
      };

      const secondReqData = {
        author: {
          firstName: "Jane",
          lastName: "Johnson",
        },
      };

      const variables = { id: "1234" };

      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data: queryData },
        },
        {
          request: { query: mutation },
          result: { data: mutationData },
        },
        {
          request: { query, variables },
          result: { data: secondReqData },
        }
      );

      const observable = queryManager.watchQuery<any>({
        query,
        variables,
        notifyOnNetworkStatusChange: false,
      });
      const stream = new ObservableStream(observable);
      let mutationComplete = false;

      await expect(stream).toEmitMatchedValue({ data: queryData });

      void queryManager
        .mutate({
          mutation,
          refetchQueries: ["getAuthors"],
          awaitRefetchQueries: true,
        })
        .then(() => {
          mutationComplete = true;
        });

      await expect(stream).toEmitMatchedValue({ data: secondReqData });
      expect(observable.getCurrentResult().data).toEqual(secondReqData);
      expect(mutationComplete).toBe(false);
    });

    it("should allow catching errors from `refetchQueries` when `awaitRefetchQueries` is `true`", async () => {
      const query = gql`
        query getAuthors($id: ID!) {
          author(id: $id) {
            firstName
            lastName
          }
        }
      `;

      const queryData = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };

      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }
      `;

      const mutationData = {
        changeAuthorName: {
          firstName: "Jack",
          lastName: "Smith",
        },
      };

      const secondReqData = {
        author: {
          firstName: "Jane",
          lastName: "Johnson",
        },
      };

      const variables = { id: "1234" };
      const refetchError = new Error("Refetch failed");

      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data: queryData },
        },
        {
          request: { query: mutation },
          result: { data: mutationData },
        },
        {
          request: { query, variables },
          result: { data: secondReqData },
          error: refetchError,
        }
      );

      const observable = queryManager.watchQuery<any>({
        query,
        variables,
        notifyOnNetworkStatusChange: false,
      });
      const stream = new ObservableStream(observable);
      let isRefetchErrorCaught = false;

      await expect(stream).toEmitMatchedValue({ data: queryData });

      void queryManager
        .mutate({
          mutation,
          refetchQueries: ["getAuthors"],
          awaitRefetchQueries: true,
        })
        .catch((error) => {
          expect(error).toBeDefined();
          isRefetchErrorCaught = true;
        });

      await expect(stream).toEmitError(
        new ApolloError({ networkError: refetchError })
      );
      expect(isRefetchErrorCaught).toBe(true);
    });
  });

  describe("store watchers", () => {
    it("does not fill up the store on resolved queries", async () => {
      const query1 = gql`
        query One {
          one
        }
      `;
      const query2 = gql`
        query Two {
          two
        }
      `;
      const query3 = gql`
        query Three {
          three
        }
      `;
      const query4 = gql`
        query Four {
          four
        }
      `;

      const link = mockSingleLink(
        { request: { query: query1 }, result: { data: { one: 1 } } },
        { request: { query: query2 }, result: { data: { two: 2 } } },
        { request: { query: query3 }, result: { data: { three: 3 } } },
        { request: { query: query4 }, result: { data: { four: 4 } } }
      );
      const cache = new InMemoryCache();

      const queryManager = new QueryManager<NormalizedCacheObject>(
        getDefaultOptionsForQueryManagerTests({
          link,
          cache,
        })
      );

      await queryManager.query({ query: query1 });
      await queryManager.query({ query: query2 });
      await queryManager.query({ query: query3 });
      await queryManager.query({ query: query4 });
      await wait(10);

      expect(cache["watches"].size).toBe(0);
    });
  });

  describe("`no-cache` handling", () => {
    it("should return a query result (if one exists) when a `no-cache` fetch policy is used", async () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };

      const queryManager = createQueryManager({
        link: mockSingleLink({
          request: { query },
          result: { data },
        }),
      });

      const observable = queryManager.watchQuery<any>({
        query,
        fetchPolicy: "no-cache",
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitMatchedValue({ data });

      const currentResult = getCurrentQueryResult(observable);
      expect(currentResult.data).toEqual(data);
    });
  });

  describe("client awareness", () => {
    it("should pass client awareness settings into the link chain via context", async () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      const data = {
        author: {
          firstName: "John",
          lastName: "Smith",
        },
      };

      const link = mockSingleLink({
        request: { query },
        result: { data },
      });

      const clientAwareness = {
        name: "Test",
        version: "1.0.0",
      };

      const queryManager = createQueryManager({
        link,
        clientAwareness,
      });

      const observable = queryManager.watchQuery<any>({
        query,
        fetchPolicy: "no-cache",
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitNext();

      const context = link.operation!.getContext();
      expect(context.clientAwareness).toBeDefined();
      expect(context.clientAwareness).toEqual(clientAwareness);
    });
  });

  describe("queryDeduplication", () => {
    it("should be true when context is true, default is false and argument not provided", () => {
      const query = gql`
        query {
          author {
            firstName
          }
        }
      `;
      const queryManager = createQueryManager({
        link: mockSingleLink({
          request: { query },
          result: {
            data: {
              author: { firstName: "John" },
            },
          },
        }),
      });

      void queryManager.query({ query, context: { queryDeduplication: true } });

      expect(
        queryManager["inFlightLinkObservables"].peek(print(query), "{}")
      ).toEqual({
        observable: expect.any(Concast),
      });
    });

    it("should allow overriding global queryDeduplication: true to false", () => {
      const query = gql`
        query {
          author {
            firstName
          }
        }
      `;

      const queryManager = createQueryManager({
        link: mockSingleLink({
          request: { query },
          result: {
            data: {
              author: { firstName: "John" },
            },
          },
        }),
        queryDeduplication: true,
      });

      queryManager.query({ query, context: { queryDeduplication: false } });

      expect(
        queryManager["inFlightLinkObservables"].peek(print(query), "{}")
      ).toBeUndefined();
    });
  });

  describe("missing cache field warnings", () => {
    let verbosity: ReturnType<typeof setVerbosity>;
    let spy: any;
    beforeEach(() => {
      verbosity = setVerbosity("debug");
      spy = jest.spyOn(console, "debug").mockImplementation();
    });

    afterEach(() => {
      setVerbosity(verbosity);
      spy.mockRestore();
    });

    async function validateWarnings(
      returnPartialData: boolean,
      expectedWarnCount: number
    ) {
      const query1 = gql`
        query {
          car {
            make
            model
            id
            __typename
          }
        }
      `;

      const query2 = gql`
        query {
          car {
            make
            model
            vin
            id
            __typename
          }
        }
      `;

      const data1 = {
        car: {
          make: "Ford",
          model: "Pinto",
          id: 123,
          __typename: "Car",
        },
      };

      const queryManager = mockQueryManager({
        request: { query: query1 },
        result: { data: data1 },
      });

      const observable1 = queryManager.watchQuery<any>({ query: query1 });
      const observable2 = queryManager.watchQuery<any>({
        query: query2,
        fetchPolicy: "cache-only",
        returnPartialData,
      });

      const stream1 = new ObservableStream(observable1);

      await expect(stream1).toEmitValue({
        data: data1,
        loading: false,
        networkStatus: NetworkStatus.ready,
      });

      stream1.unsubscribe();

      const stream2 = new ObservableStream(observable2);

      await expect(stream2).toEmitMatchedValue({
        data: data1,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: true,
      });
      expect(spy).toHaveBeenCalledTimes(expectedWarnCount);
    }

    it("should show missing cache result fields warning when returnPartialData is false", async () => {
      await validateWarnings(false, 1);
    });

    it("should not show missing cache result fields warning when returnPartialData is true", async () => {
      await validateWarnings(true, 0);
    });
  });

  describe("defaultContext", () => {
    let _: any; // trash variable to throw away values when destructuring
    _ = _; // omit "'_' is declared but its value is never read." compiler warning

    it("ApolloClient and QueryManager share a `defaultContext` instance (default empty object)", () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: ApolloLink.empty(),
      });

      expect(client.defaultContext).toBe(client["queryManager"].defaultContext);
    });

    it("ApolloClient and QueryManager share a `defaultContext` instance (provided option)", () => {
      const defaultContext = {};
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: ApolloLink.empty(),
        defaultContext,
      });

      expect(client.defaultContext).toBe(defaultContext);
      expect(client["queryManager"].defaultContext).toBe(defaultContext);
    });

    it("`defaultContext` cannot be reassigned on the user-facing `ApolloClient`", () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: ApolloLink.empty(),
      });

      expect(() => {
        // @ts-ignore
        client.defaultContext = { query: { fetchPolicy: "cache-only" } };
      }).toThrowError(/Cannot set property defaultContext/);
    });

    it.each([
      ["query", { method: "query", option: "query" }],
      ["mutation", { method: "mutate", option: "mutation" }],
      ["subscription", { method: "subscribe", option: "query" }],
    ] as const)(
      "`defaultContext` will be applied to the context of a %s",
      async (_, { method, option }) => {
        let context: any;
        const client = new ApolloClient({
          cache: new InMemoryCache(),
          link: new ApolloLink(
            (operation) =>
              new Observable((observer) => {
                ({ cache: _, ...context } = operation.getContext());
                observer.complete();
              })
          ),
          defaultContext: {
            foo: "bar",
          },
        });

        // @ts-ignore a bit too generic for TS
        client[method]({
          [option]: gql`
            query {
              foo
            }
          `,
        });

        expect(context.foo).toBe("bar");
      }
    );

    it("`ApolloClient.defaultContext` can be modified and changes will show up in future queries", async () => {
      let context: any;
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new ApolloLink(
          (operation) =>
            new Observable((observer) => {
              ({ cache: _, ...context } = operation.getContext());
              observer.complete();
            })
        ),
        defaultContext: {
          foo: "bar",
        },
      });

      // one query to "warm up" with an old value to make sure the value
      // isn't locked in at the first query or something
      await client.query({
        query: gql`
          query {
            foo
          }
        `,
      });

      expect(context.foo).toBe("bar");

      client.defaultContext.foo = "changed";

      await client.query({
        query: gql`
          query {
            foo
          }
        `,
      });

      expect(context.foo).toBe("changed");
    });

    it("`defaultContext` will be shallowly merged with explicit context", async () => {
      let context: any;
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new ApolloLink(
          (operation) =>
            new Observable((observer) => {
              ({ cache: _, ...context } = operation.getContext());
              observer.complete();
            })
        ),
        defaultContext: {
          foo: { bar: "baz" },
          a: { b: "c" },
        },
      });

      await client.query({
        query: gql`
          query {
            foo
          }
        `,
        context: {
          a: { x: "y" },
        },
      });

      expect(context).toEqual(
        expect.objectContaining({
          foo: { bar: "baz" },
          a: { b: undefined, x: "y" },
        })
      );
    });

    it("`defaultContext` will be shallowly merged with context from `defaultOptions.query.context", async () => {
      let context: any;
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new ApolloLink(
          (operation) =>
            new Observable((observer) => {
              ({ cache: _, ...context } = operation.getContext());
              observer.complete();
            })
        ),
        defaultContext: {
          foo: { bar: "baz" },
          a: { b: "c" },
        },
        defaultOptions: {
          query: {
            context: {
              a: { x: "y" },
            },
          },
        },
      });

      await client.query({
        query: gql`
          query {
            foo
          }
        `,
      });

      expect(context.foo).toStrictEqual({ bar: "baz" });
      expect(context.a).toStrictEqual({ x: "y" });
    });

    it(
      "document existing behavior: `defaultOptions.query.context` will be " +
        "completely overwritten by, not merged with, explicit context",
      async () => {
        let context: any;
        const client = new ApolloClient({
          cache: new InMemoryCache(),
          link: new ApolloLink(
            (operation) =>
              new Observable((observer) => {
                ({ cache: _, ...context } = operation.getContext());
                observer.complete();
              })
          ),
          defaultOptions: {
            query: {
              context: {
                foo: { bar: "baz" },
              },
            },
          },
        });

        await client.query({
          query: gql`
            query {
              foo
            }
          `,
          context: {
            a: { x: "y" },
          },
        });

        expect(context.a).toStrictEqual({ x: "y" });
        expect(context.foo).toBeUndefined();
      }
    );
  });
});
