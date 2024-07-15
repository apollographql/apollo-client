import gql from "graphql-tag";
import { GraphQLError } from "graphql";
import { TypedDocumentNode } from "@graphql-typed-document-node/core";

import {
  ApolloClient,
  ApolloQueryResult,
  NetworkStatus,
  WatchQueryFetchPolicy,
} from "../../core";
import { ObservableQuery } from "../ObservableQuery";
import { QueryManager } from "../QueryManager";

import {
  DocumentTransform,
  Observable,
  removeDirectivesFromDocument,
} from "../../utilities";
import { ApolloLink, FetchResult } from "../../link/core";
import { InMemoryCache, NormalizedCacheObject } from "../../cache";
import { ApolloError } from "../../errors";

import {
  itAsync,
  MockLink,
  mockSingleLink,
  MockSubscriptionLink,
  subscribeAndCount,
  wait,
} from "../../testing";
import mockQueryManager, {
  getDefaultOptionsForQueryManagerTests,
} from "../../testing/core/mocking/mockQueryManager";
import mockWatchQuery from "../../testing/core/mocking/mockWatchQuery";
import wrap from "../../testing/core/wrap";

import { resetStore } from "./QueryManager";
import { SubscriptionObserver } from "zen-observable-ts";
import { waitFor } from "@testing-library/react";
import { ObservableStream } from "../../testing/internal";

export const mockFetchQuery = (queryManager: QueryManager<any>) => {
  const fetchConcastWithInfo = queryManager["fetchConcastWithInfo"];
  const fetchQueryByPolicy: QueryManager<any>["fetchQueryByPolicy"] = (
    queryManager as any
  ).fetchQueryByPolicy;

  const mock = <
    T extends typeof fetchConcastWithInfo | typeof fetchQueryByPolicy,
  >(
    original: T
  ) =>
    jest.fn<ReturnType<T>, Parameters<T>>(function (): ReturnType<T> {
      // @ts-expect-error
      return original.apply(queryManager, arguments);
    });

  const mocks = {
    fetchConcastWithInfo: mock(fetchConcastWithInfo),
    fetchQueryByPolicy: mock(fetchQueryByPolicy),
  };

  Object.assign(queryManager, mocks);

  return mocks;
};

describe("ObservableQuery", () => {
  // Standard data for all these tests
  const query: TypedDocumentNode<{
    people_one: {
      name: string;
    };
  }> = gql`
    query query($id: ID!) {
      people_one(id: $id) {
        name
      }
    }
  `;
  const variables = { id: 1 };
  const differentVariables = { id: 2 };
  const dataOne = {
    people_one: {
      name: "Luke Skywalker",
    },
  };
  const dataTwo = {
    people_one: {
      name: "Leia Skywalker",
    },
  };

  const error = new GraphQLError("is offline.", undefined, null, null, [
    "people_one",
  ]);
  const wrappedError = new ApolloError({
    graphQLErrors: [error],
  });

  const createQueryManager = ({ link }: { link: ApolloLink }) => {
    return new QueryManager(
      getDefaultOptionsForQueryManagerTests({
        link,
        assumeImmutableResults: true,
        cache: new InMemoryCache({
          addTypename: false,
        }),
      })
    );
  };

  describe("setOptions", () => {
    describe("to change pollInterval", () => {
      itAsync(
        "starts polling if goes from 0 -> something",
        (resolve, reject) => {
          const manager = mockQueryManager(
            {
              request: { query, variables },
              result: { data: dataOne },
            },
            {
              request: { query, variables },
              result: { data: dataTwo },
            },
            {
              request: { query, variables },
              result: { data: dataTwo },
            }
          );

          const observable = manager.watchQuery({
            query,
            variables,
            notifyOnNetworkStatusChange: false,
          });

          subscribeAndCount(reject, observable, (handleCount, result) => {
            if (handleCount === 1) {
              expect(result.data).toEqual(dataOne);
              observable.setOptions({ query, pollInterval: 10 });
            } else if (handleCount === 2) {
              expect(result.data).toEqual(dataTwo);
              observable.stopPolling();
              resolve();
            }
          });
        }
      );

      itAsync(
        "stops polling if goes from something -> 0",
        (resolve, reject) => {
          const manager = mockQueryManager(
            {
              request: { query, variables },
              result: { data: dataOne },
            },
            {
              request: { query, variables },
              result: { data: dataTwo },
            },
            {
              request: { query, variables },
              result: { data: dataTwo },
            }
          );

          const observable = manager.watchQuery({
            query,
            variables,
            pollInterval: 10,
          });

          subscribeAndCount(reject, observable, (handleCount, result) => {
            if (handleCount === 1) {
              expect(result.data).toEqual(dataOne);
              observable.setOptions({ query, pollInterval: 0 });
              setTimeout(resolve, 5);
            } else if (handleCount === 2) {
              reject(new Error("Should not get more than one result"));
            }
          });
        }
      );

      itAsync("can change from x>0 to y>0", (resolve, reject) => {
        const manager = mockQueryManager(
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables },
            result: { data: dataTwo },
          },
          {
            request: { query, variables },
            result: { data: dataTwo },
          }
        );

        const observable = manager.watchQuery({
          query,
          variables,
          pollInterval: 100,
          notifyOnNetworkStatusChange: false,
        });

        subscribeAndCount(reject, observable, (handleCount, result) => {
          if (handleCount === 1) {
            expect(result.data).toEqual(dataOne);
            observable.setOptions({ query, pollInterval: 10 });
          } else if (handleCount === 2) {
            expect(result.data).toEqual(dataTwo);
            observable.stopPolling();
            resolve();
          }
        });
      });
    });

    itAsync("does not break refetch", (resolve, reject) => {
      // This query and variables are copied from react-apollo
      const queryWithVars = gql`
        query people($first: Int) {
          allPeople(first: $first) {
            people {
              name
            }
          }
        }
      `;

      const data = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
      const variables1 = { first: 0 };

      const data2 = { allPeople: { people: [{ name: "Leia Skywalker" }] } };
      const variables2 = { first: 1 };

      const queryManager = mockQueryManager(
        {
          request: {
            query: queryWithVars,
            variables: variables1,
          },
          result: { data },
        },
        {
          request: {
            query: queryWithVars,
            variables: variables2,
          },
          result: { data: data2 },
        }
      );

      const observable = queryManager.watchQuery({
        query: queryWithVars,
        variables: variables1,
        notifyOnNetworkStatusChange: true,
      });

      subscribeAndCount(reject, observable, (handleCount, result) => {
        if (handleCount === 1) {
          expect(result.data).toEqual(data);
          expect(result.loading).toBe(false);
          return observable.refetch(variables2);
        } else if (handleCount === 2) {
          expect(result.loading).toBe(true);
          expect(result.networkStatus).toBe(NetworkStatus.setVariables);
        } else if (handleCount === 3) {
          expect(result.loading).toBe(false);
          expect(result.data).toEqual(data2);
          resolve();
        }
      });
    });

    itAsync("rerenders when refetch is called", (resolve, reject) => {
      // This query and variables are copied from react-apollo
      const query = gql`
        query people($first: Int) {
          allPeople(first: $first) {
            people {
              name
            }
          }
        }
      `;

      const data = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
      const variables = { first: 0 };

      const data2 = { allPeople: { people: [{ name: "Leia Skywalker" }] } };

      const queryManager = mockQueryManager(
        {
          request: {
            query,
            variables,
          },
          result: { data },
        },
        {
          request: {
            query,
            variables,
          },
          result: { data: data2 },
        }
      );

      const observable = queryManager.watchQuery({
        query,
        variables,
        notifyOnNetworkStatusChange: true,
      });

      subscribeAndCount(reject, observable, (handleCount, result) => {
        if (handleCount === 1) {
          expect(result.loading).toEqual(false);
          expect(result.data).toEqual(data);
          return observable.refetch();
        } else if (handleCount === 2) {
          expect(result.loading).toEqual(true);
          expect(result.networkStatus).toEqual(NetworkStatus.refetch);
        } else if (handleCount === 3) {
          expect(result.loading).toEqual(false);
          expect(result.data).toEqual(data2);
          resolve();
        }
      });
    });

    itAsync(
      "rerenders with new variables then shows correct data for previous variables",
      (resolve, reject) => {
        // This query and variables are copied from react-apollo
        const query = gql`
          query people($first: Int) {
            allPeople(first: $first) {
              people {
                name
              }
            }
          }
        `;

        const data = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
        const variables = { first: 0 };

        const data2 = { allPeople: { people: [{ name: "Leia Skywalker" }] } };
        const variables2 = { first: 1 };

        const observable: ObservableQuery<any> = mockWatchQuery(
          {
            request: {
              query,
              variables,
            },
            result: { data },
          },
          {
            request: {
              query,
              variables: variables2,
            },
            result: { data: data2 },
          }
        );

        subscribeAndCount(reject, observable, async (handleCount, result) => {
          if (handleCount === 1) {
            expect(result.data).toEqual(data);
            expect(result.loading).toBe(false);
            await observable.setOptions({
              variables: variables2,
              notifyOnNetworkStatusChange: true,
            });
          } else if (handleCount === 2) {
            expect(result.loading).toBe(true);
            expect(result.networkStatus).toBe(NetworkStatus.setVariables);
          } else if (handleCount === 3) {
            expect(result.loading).toBe(false);
            expect(result.data).toEqual(data2);
            // go back to first set of variables
            const current = await observable.reobserve({ variables });
            expect(current.data).toEqual(data);
            resolve();
          }
        });
      }
    );

    // TODO: Something isn't quite right with this test. It's failing but not
    // for the right reasons.
    itAsync.skip(
      "if query is refetched, and an error is returned, no other observer callbacks will be called",
      (resolve) => {
        const observable: ObservableQuery<any> = mockWatchQuery(
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables },
            result: { errors: [error] },
          },
          {
            request: { query, variables },
            result: { data: dataOne },
          }
        );

        let handleCount = 0;
        observable.subscribe({
          next: (result) => {
            handleCount++;
            if (handleCount === 1) {
              expect(result.data).toEqual(dataOne);
              observable.refetch();
            } else if (handleCount === 3) {
              throw new Error("next shouldn't fire after an error");
            }
          },
          error: () => {
            handleCount++;
            expect(handleCount).toBe(2);
            observable.refetch();
            setTimeout(resolve, 25);
          },
        });
      }
    );

    itAsync(
      "does a network request if fetchPolicy becomes networkOnly",
      (resolve, reject) => {
        const observable: ObservableQuery<any> = mockWatchQuery(
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables },
            result: { data: dataTwo },
          }
        );

        subscribeAndCount(reject, observable, (handleCount, result) => {
          if (handleCount === 1) {
            expect(result.loading).toBe(false);
            expect(result.data).toEqual(dataOne);
            return observable.setOptions({ fetchPolicy: "network-only" });
          } else if (handleCount === 2) {
            expect(result.loading).toBe(false);
            expect(result.data).toEqual(dataTwo);
            resolve();
          }
        });
      }
    );

    itAsync(
      "does a network request if fetchPolicy is cache-only then store is reset then fetchPolicy becomes not cache-only",
      (resolve, reject) => {
        const testQuery = gql`
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
              observer.complete();
            }),
        ]);

        const queryManager = createQueryManager({ link });
        // fetch first data from server
        const observable = queryManager.watchQuery({
          query: testQuery,
        });

        subscribeAndCount(reject, observable, async (handleCount, result) => {
          if (handleCount === 1) {
            expect(result.data).toEqual(data);
            expect(timesFired).toBe(1);
            // set policy to be cache-only but data is found
            await observable.setOptions({ fetchPolicy: "cache-only" });
            await resetStore(queryManager);
          } else if (handleCount === 2) {
            expect(result.data).toEqual({});
            expect(result.loading).toBe(false);
            expect(result.networkStatus).toBe(NetworkStatus.ready);
            expect(timesFired).toBe(1);
            resolve();
          }
        });
      }
    );

    itAsync(
      "does a network request if fetchPolicy changes from cache-only",
      (resolve, reject) => {
        const testQuery = gql`
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
          () => {
            return new Observable((observer) => {
              timesFired += 1;
              observer.next({ data });
              observer.complete();
            });
          },
        ]);

        const queryManager = createQueryManager({ link });

        const observable = queryManager.watchQuery({
          query: testQuery,
          fetchPolicy: "cache-only",
          notifyOnNetworkStatusChange: false,
        });

        subscribeAndCount(reject, observable, (handleCount, result) => {
          if (handleCount === 1) {
            expect(result.loading).toBe(false);
            expect(result.data).toEqual({});
            expect(timesFired).toBe(0);
            observable.setOptions({ fetchPolicy: "cache-first" });
          } else if (handleCount === 2) {
            expect(result.loading).toBe(false);
            expect(result.data).toEqual(data);
            expect(timesFired).toBe(1);
            resolve();
          }
        });
      }
    );

    itAsync(
      "can set queries to standby and will not fetch when doing so",
      (resolve, reject) => {
        let queryManager: QueryManager<NormalizedCacheObject>;
        let observable: ObservableQuery<any>;
        const testQuery = gql`
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
          () => {
            return new Observable((observer) => {
              timesFired += 1;
              observer.next({ data });
              observer.complete();
              return;
            });
          },
        ]);
        queryManager = createQueryManager({ link });
        observable = queryManager.watchQuery({
          query: testQuery,
          fetchPolicy: "cache-first",
          notifyOnNetworkStatusChange: false,
        });

        subscribeAndCount(reject, observable, async (handleCount, result) => {
          if (handleCount === 1) {
            expect(result.data).toEqual(data);
            expect(timesFired).toBe(1);
            await observable.setOptions({ query, fetchPolicy: "standby" });
            // make sure the query didn't get fired again.
            expect(timesFired).toBe(1);
            resolve();
          } else if (handleCount === 2) {
            throw new Error("Handle should not be triggered on standby query");
          }
        });
      }
    );

    itAsync(
      "will not fetch when setting a cache-only query to standby",
      (resolve, reject) => {
        let queryManager: QueryManager<NormalizedCacheObject>;
        let observable: ObservableQuery<any>;
        const testQuery = gql`
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
          () => {
            return new Observable((observer) => {
              timesFired += 1;
              observer.next({ data });
              observer.complete();
              return;
            });
          },
        ]);
        queryManager = createQueryManager({ link });

        queryManager.query({ query: testQuery }).then(() => {
          observable = queryManager.watchQuery({
            query: testQuery,
            fetchPolicy: "cache-first",
            notifyOnNetworkStatusChange: false,
          });

          subscribeAndCount(reject, observable, async (handleCount, result) => {
            if (handleCount === 1) {
              expect(result.data).toEqual(data);
              expect(timesFired).toBe(1);
              await observable.setOptions({ query, fetchPolicy: "standby" });
              // make sure the query didn't get fired again.
              expect(timesFired).toBe(1);
              resolve();
            } else if (handleCount === 2) {
              throw new Error(
                "Handle should not be triggered on standby query"
              );
            }
          });
        });
      }
    );

    itAsync(
      "returns a promise which eventually returns data",
      (resolve, reject) => {
        const observable: ObservableQuery<any> = mockWatchQuery(
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables },
            result: { data: dataTwo },
          }
        );

        subscribeAndCount(reject, observable, (handleCount, result) => {
          if (handleCount === 1) {
            expect(result.data).toEqual(dataOne);
            observable
              .setOptions({
                fetchPolicy: "cache-and-network",
              })
              .then((res) => {
                expect(res.data).toEqual(dataTwo);
              })
              .then(resolve, reject);
          }
        });
      }
    );
  });

  describe("setVariables", () => {
    itAsync("reruns query if the variables change", (resolve, reject) => {
      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables: differentVariables },
          result: { data: dataTwo },
        }
      );

      const observable = queryManager.watchQuery({
        query,
        variables,
        notifyOnNetworkStatusChange: true,
      });

      subscribeAndCount(reject, observable, (handleCount, result) => {
        if (handleCount === 1) {
          expect(result.loading).toBe(false);
          expect(result.data).toEqual(dataOne);
          return observable.setVariables(differentVariables);
        } else if (handleCount === 2) {
          expect(result.loading).toBe(true);
          expect(result.networkStatus).toBe(NetworkStatus.setVariables);
        } else if (handleCount === 3) {
          expect(result.loading).toBe(false);
          expect(result.data).toEqual(dataTwo);
          resolve();
        }
      });
    });

    itAsync(
      "does invalidate the currentResult data if the variables change",
      (resolve, reject) => {
        const observable: ObservableQuery<any> = mockWatchQuery(
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables: differentVariables },
            result: { data: dataTwo },
            delay: 25,
          }
        );

        subscribeAndCount(reject, observable, async (handleCount, result) => {
          if (handleCount === 1) {
            expect(result.data).toEqual(dataOne);
            expect(observable.getCurrentResult().data).toEqual(dataOne);
            await observable.setVariables(differentVariables);
          }
          expect(observable.getCurrentResult().data).toEqual(dataTwo);
          expect(observable.getCurrentResult().loading).toBe(false);
          resolve();
        });
      }
    );

    itAsync(
      "does invalidate the currentResult data if the variables change",
      (resolve, reject) => {
        // Standard data for all these tests
        const query = gql`
          query UsersQuery($page: Int) {
            users {
              id
              name
              posts(page: $page) {
                title
              }
            }
          }
        `;
        const variables = { page: 1 };
        const differentVariables = { page: 2 };
        const dataOne = {
          users: [
            {
              id: 1,
              name: "James",
              posts: [{ title: "GraphQL Summit" }, { title: "Awesome" }],
            },
          ],
        };
        const dataTwo = {
          users: [
            {
              id: 1,
              name: "James",
              posts: [{ title: "Old post" }],
            },
          ],
        };

        const observable: ObservableQuery<any> = mockWatchQuery(
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables: differentVariables },
            result: { data: dataTwo },
            delay: 25,
          }
        );

        subscribeAndCount(reject, observable, async (handleCount, result) => {
          if (handleCount === 1) {
            expect(result.data).toEqual(dataOne);
            expect(observable.getCurrentResult().data).toEqual(dataOne);
            await observable.setVariables(differentVariables);
          }
          expect(observable.getCurrentResult().data).toEqual(dataTwo);
          expect(observable.getCurrentResult().loading).toBe(false);
          resolve();
        });
      }
    );

    itAsync(
      "does not invalidate the currentResult errors if the variables change",
      (resolve, reject) => {
        const queryManager = mockQueryManager(
          {
            request: { query, variables },
            result: { errors: [error] },
          },
          {
            request: { query, variables: differentVariables },
            result: { data: dataTwo },
          }
        );

        const observable = queryManager.watchQuery({
          query,
          variables,
          errorPolicy: "all",
        });

        subscribeAndCount(reject, observable, (handleCount, result) => {
          if (handleCount === 1) {
            expect(result.errors).toEqual([error]);
            expect(observable.getCurrentResult().errors).toEqual([error]);
            observable.setVariables(differentVariables);
            expect(observable.getCurrentResult().errors).toBeUndefined();
          } else if (handleCount === 2) {
            expect(result.data).toEqual(dataTwo);
            expect(observable.getCurrentResult().data).toEqual(dataTwo);
            expect(observable.getCurrentResult().loading).toBe(false);
            resolve();
          }
        });
      }
    );

    itAsync(
      "does not perform a query when unsubscribed if variables change",
      (resolve, reject) => {
        // Note: no responses, will throw if a query is made
        const queryManager = mockQueryManager();
        const observable = queryManager.watchQuery({ query, variables });
        return observable
          .setVariables(differentVariables)
          .then(resolve, reject);
      }
    );

    itAsync(
      "sets networkStatus to `setVariables` when fetching",
      (resolve, reject) => {
        const mockedResponses = [
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables: differentVariables },
            result: { data: dataTwo },
          },
        ];

        const queryManager = mockQueryManager(...mockedResponses);
        const firstRequest = mockedResponses[0].request;
        const observable = queryManager.watchQuery({
          query: firstRequest.query,
          variables: firstRequest.variables,
          notifyOnNetworkStatusChange: true,
        });

        subscribeAndCount(reject, observable, (handleCount, result) => {
          if (handleCount === 1) {
            expect(result.loading).toBe(false);
            expect(result.data).toEqual(dataOne);
            expect(result.networkStatus).toBe(NetworkStatus.ready);
            observable.setVariables(differentVariables);
          } else if (handleCount === 2) {
            expect(result.loading).toBe(true);
            expect(result.networkStatus).toBe(NetworkStatus.setVariables);
          } else if (handleCount === 3) {
            expect(result.loading).toBe(false);
            expect(result.networkStatus).toBe(NetworkStatus.ready);
            expect(result.data).toEqual(dataTwo);
            resolve();
          }
        });
      }
    );

    itAsync(
      "sets networkStatus to `setVariables` when calling refetch with new variables",
      (resolve, reject) => {
        const mockedResponses = [
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables: differentVariables },
            result: { data: dataTwo },
          },
        ];

        const queryManager = mockQueryManager(...mockedResponses);
        const firstRequest = mockedResponses[0].request;
        const observable = queryManager.watchQuery({
          query: firstRequest.query,
          variables: firstRequest.variables,
          notifyOnNetworkStatusChange: true,
        });

        subscribeAndCount(reject, observable, (handleCount, result) => {
          if (handleCount === 1) {
            expect(result.loading).toBe(false);
            expect(result.data).toEqual(dataOne);
            expect(result.networkStatus).toBe(NetworkStatus.ready);
            observable.refetch(differentVariables);
          } else if (handleCount === 2) {
            expect(result.loading).toBe(true);
            expect(result.networkStatus).toBe(NetworkStatus.setVariables);
          } else if (handleCount === 3) {
            expect(result.loading).toBe(false);
            expect(result.networkStatus).toBe(NetworkStatus.ready);
            expect(result.data).toEqual(dataTwo);
            resolve();
          }
        });
      }
    );

    itAsync(
      "does not rerun query if variables do not change",
      (resolve, reject) => {
        const observable: ObservableQuery<any> = mockWatchQuery(
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables },
            result: { data: dataTwo },
          }
        );

        let errored = false;
        subscribeAndCount(reject, observable, (handleCount, result) => {
          if (handleCount === 1) {
            expect(result.data).toEqual(dataOne);
            observable.setVariables(variables);

            // Nothing should happen, so we'll wait a moment to check that
            setTimeout(() => !errored && resolve(), 10);
          } else if (handleCount === 2) {
            errored = true;
            throw new Error("Observable callback should not fire twice");
          }
        });
      }
    );

    itAsync(
      "handles variables changing while a query is in-flight",
      (resolve, reject) => {
        // The expected behavior is that the original variables are forgotten
        // and the query stays in loading state until the result for the new variables
        // has returned.
        const observable: ObservableQuery<any> = mockWatchQuery(
          {
            request: { query, variables },
            result: { data: dataOne },
            delay: 20,
          },
          {
            request: { query, variables: differentVariables },
            result: { data: dataTwo },
            delay: 20,
          }
        );

        observable.setVariables(differentVariables);

        subscribeAndCount(reject, observable, (handleCount, result) => {
          if (handleCount === 1) {
            expect(result.networkStatus).toBe(NetworkStatus.ready);
            expect(result.loading).toBe(false);
            expect(result.data).toEqual(dataTwo);
            resolve();
          } else {
            reject(new Error("should not deliver more than one result"));
          }
        });
      }
    );
  });

  describe("refetch", () => {
    itAsync(
      "calls fetchRequest with fetchPolicy `network-only` when using a non-networked fetch policy",
      (resolve, reject) => {
        const mockedResponses = [
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables: differentVariables },
            result: { data: dataTwo },
          },
        ];

        const queryManager = mockQueryManager(...mockedResponses);
        const firstRequest = mockedResponses[0].request;
        const observable = queryManager.watchQuery({
          query: firstRequest.query,
          variables: firstRequest.variables,
          fetchPolicy: "cache-first",
        });

        const mocks = mockFetchQuery(queryManager);

        subscribeAndCount(reject, observable, (count, result) => {
          if (count === 1) {
            expect(result).toEqual({
              loading: false,
              networkStatus: NetworkStatus.ready,
              data: dataOne,
            });

            observable.refetch(differentVariables);
          } else if (count === 2) {
            expect(result).toEqual({
              loading: false,
              networkStatus: NetworkStatus.ready,
              data: dataTwo,
            });

            const fqbpCalls = mocks.fetchQueryByPolicy.mock.calls;
            expect(fqbpCalls.length).toBe(2);
            expect(fqbpCalls[0][1].fetchPolicy).toEqual("cache-first");
            expect(fqbpCalls[1][1].fetchPolicy).toEqual("network-only");

            const fqoCalls = mocks.fetchConcastWithInfo.mock.calls;
            expect(fqoCalls.length).toBe(2);
            expect(fqoCalls[0][1].fetchPolicy).toEqual("cache-first");
            expect(fqoCalls[1][1].fetchPolicy).toEqual("network-only");

            // Although the options.fetchPolicy we passed just now to
            // fetchQueryByPolicy should have been network-only,
            // observable.options.fetchPolicy should now be updated to
            // cache-first, thanks to options.nextFetchPolicy.
            expect(observable.options.fetchPolicy).toBe("cache-first");

            // Give the test time to fail if more results are delivered.
            setTimeout(resolve, 50);
          } else {
            reject(new Error(`too many results (${count}, ${result})`));
          }
        });
      }
    );

    it("calling refetch with different variables before the query itself resolved will only yield the result for the new variables", async () => {
      const observers: SubscriptionObserver<FetchResult<typeof dataOne>>[] = [];
      const queryManager = new QueryManager(
        getDefaultOptionsForQueryManagerTests({
          cache: new InMemoryCache(),
          link: new ApolloLink((operation, forward) => {
            return new Observable((observer) => {
              observers.push(observer);
            });
          }),
        })
      );
      const observableQuery = queryManager.watchQuery({
        query,
        variables: { id: 1 },
      });
      const stream = new ObservableStream(observableQuery);

      observableQuery.refetch({ id: 2 });

      observers[0].next({ data: dataOne });
      observers[0].complete();

      observers[1].next({ data: dataTwo });
      observers[1].complete();

      {
        const result = await stream.takeNext();
        expect(result).toEqual({
          loading: false,
          networkStatus: NetworkStatus.ready,
          data: dataTwo,
        });
      }
      expect(stream.take()).rejects.toThrow(/Timeout/i);
    });

    it("calling refetch multiple times with different variables will return only results for the most recent variables", async () => {
      const observers: SubscriptionObserver<FetchResult<typeof dataOne>>[] = [];
      const queryManager = new QueryManager(
        getDefaultOptionsForQueryManagerTests({
          cache: new InMemoryCache(),
          link: new ApolloLink((operation, forward) => {
            return new Observable((observer) => {
              observers.push(observer);
            });
          }),
        })
      );
      const observableQuery = queryManager.watchQuery({
        query,
        variables: { id: 1 },
      });
      const stream = new ObservableStream(observableQuery);

      observers[0].next({ data: dataOne });
      observers[0].complete();

      {
        const result = await stream.takeNext();
        expect(result).toEqual({
          loading: false,
          networkStatus: NetworkStatus.ready,
          data: dataOne,
        });
      }

      observableQuery.refetch({ id: 2 });
      observableQuery.refetch({ id: 3 });

      observers[1].next({ data: dataTwo });
      observers[1].complete();

      observers[2].next({
        data: {
          people_one: {
            name: "SomeOneElse",
          },
        },
      });
      observers[2].complete();

      {
        const result = await stream.takeNext();
        expect(result).toEqual({
          loading: false,
          networkStatus: NetworkStatus.ready,
          data: {
            people_one: {
              name: "SomeOneElse",
            },
          },
        });
      }
    });

    itAsync(
      "calls fetchRequest with fetchPolicy `no-cache` when using `no-cache` fetch policy",
      (resolve, reject) => {
        const mockedResponses = [
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables: differentVariables },
            result: { data: dataTwo },
          },
        ];

        const queryManager = mockQueryManager(...mockedResponses);
        const firstRequest = mockedResponses[0].request;
        const observable = queryManager.watchQuery({
          query: firstRequest.query,
          variables: firstRequest.variables,
          fetchPolicy: "no-cache",
        });

        const mocks = mockFetchQuery(queryManager);

        subscribeAndCount(reject, observable, (handleCount) => {
          if (handleCount === 1) {
            observable.refetch(differentVariables);
          } else if (handleCount === 2) {
            const fqbpCalls = mocks.fetchQueryByPolicy.mock.calls;
            expect(fqbpCalls.length).toBe(2);
            expect(fqbpCalls[1][1].fetchPolicy).toBe("no-cache");

            // Unlike network-only or cache-and-network, the no-cache
            // FetchPolicy does not switch to cache-first after the first
            // network request.
            expect(observable.options.fetchPolicy).toBe("no-cache");
            const fqoCalls = mocks.fetchConcastWithInfo.mock.calls;
            expect(fqoCalls.length).toBe(2);
            expect(fqoCalls[1][1].fetchPolicy).toBe("no-cache");

            resolve();
          }
        });
      }
    );

    itAsync(
      "calls ObservableQuery.next even after hitting cache",
      (resolve, reject) => {
        // This query and variables are copied from react-apollo
        const queryWithVars = gql`
          query people($first: Int) {
            allPeople(first: $first) {
              people {
                name
              }
            }
          }
        `;

        const data = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
        const variables1 = { first: 0 };

        const data2 = { allPeople: { people: [{ name: "Leia Skywalker" }] } };
        const variables2 = { first: 1 };

        const queryManager = mockQueryManager(
          {
            request: {
              query: queryWithVars,
              variables: variables1,
            },
            result: { data },
          },
          {
            request: {
              query: queryWithVars,
              variables: variables2,
            },
            result: { data: data2 },
          },
          {
            request: {
              query: queryWithVars,
              variables: variables1,
            },
            result: { data },
          }
        );

        const observable = queryManager.watchQuery({
          query: queryWithVars,
          variables: variables1,
          fetchPolicy: "cache-and-network",
          notifyOnNetworkStatusChange: true,
        });

        subscribeAndCount(reject, observable, (handleCount, result) => {
          if (handleCount === 1) {
            expect(result.data).toEqual(data);
            expect(result.loading).toBe(false);
            observable.refetch(variables2);
          } else if (handleCount === 2) {
            expect(result.loading).toBe(true);
            expect(result.networkStatus).toBe(NetworkStatus.setVariables);
          } else if (handleCount === 3) {
            expect(result.data).toEqual(data2);
            expect(result.loading).toBe(false);
            observable.refetch(variables1);
          } else if (handleCount === 4) {
            expect(result.loading).toBe(true);
            expect(result.networkStatus).toBe(NetworkStatus.setVariables);
          } else if (handleCount === 5) {
            expect(result.data).toEqual(data);
            expect(result.loading).toBe(false);
            resolve();
          }
        });
      }
    );

    itAsync(
      "resets fetchPolicy when variables change when using nextFetchPolicy",
      (resolve, reject) => {
        // This query and variables are copied from react-apollo
        const queryWithVars = gql`
          query people($first: Int) {
            allPeople(first: $first) {
              people {
                name
              }
            }
          }
        `;

        const data = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
        const variables1 = { first: 0 };

        const data2 = { allPeople: { people: [{ name: "Leia Skywalker" }] } };
        const variables2 = { first: 1 };

        const queryManager = mockQueryManager(
          {
            request: {
              query: queryWithVars,
              variables: variables1,
            },
            result: { data },
          },
          {
            request: {
              query: queryWithVars,
              variables: variables2,
            },
            result: { data: data2 },
          },
          {
            request: {
              query: queryWithVars,
              variables: variables1,
            },
            result: { data },
          },
          {
            request: {
              query: queryWithVars,
              variables: variables2,
            },
            result: { data: data2 },
          }
        );

        const usedFetchPolicies: WatchQueryFetchPolicy[] = [];
        const observable = queryManager.watchQuery({
          query: queryWithVars,
          variables: variables1,
          fetchPolicy: "cache-and-network",
          nextFetchPolicy(currentFetchPolicy, info) {
            if (info.reason === "variables-changed") {
              return info.initialFetchPolicy;
            }
            usedFetchPolicies.push(currentFetchPolicy);
            if (info.reason === "after-fetch") {
              return "cache-first";
            }
            return currentFetchPolicy;
          },
          notifyOnNetworkStatusChange: true,
        });

        expect(observable.options.fetchPolicy).toBe("cache-and-network");
        expect(observable.options.initialFetchPolicy).toBe("cache-and-network");

        subscribeAndCount(reject, observable, (handleCount, result) => {
          expect(result.error).toBeUndefined();

          if (handleCount === 1) {
            expect(result.data).toEqual(data);
            expect(result.loading).toBe(false);
            expect(observable.options.fetchPolicy).toBe("cache-first");
            observable.refetch(variables2);
          } else if (handleCount === 2) {
            expect(result.loading).toBe(true);
            expect(result.networkStatus).toBe(NetworkStatus.setVariables);
            expect(observable.options.fetchPolicy).toBe("cache-first");
          } else if (handleCount === 3) {
            expect(result.data).toEqual(data2);
            expect(result.loading).toBe(false);
            expect(observable.options.fetchPolicy).toBe("cache-first");
            observable
              .setOptions({
                variables: variables1,
              })
              .then((result) => {
                expect(result.data).toEqual(data);
              })
              .catch(reject);
            expect(observable.options.fetchPolicy).toBe("cache-first");
          } else if (handleCount === 4) {
            expect(result.loading).toBe(true);
            expect(result.networkStatus).toBe(NetworkStatus.setVariables);
            expect(observable.options.fetchPolicy).toBe("cache-first");
          } else if (handleCount === 5) {
            expect(result.data).toEqual(data);
            expect(result.loading).toBe(false);
            expect(observable.options.fetchPolicy).toBe("cache-first");
            observable
              .reobserve({
                variables: variables2,
              })
              .then((result) => {
                expect(result.data).toEqual(data2);
              })
              .catch(reject);
            expect(observable.options.fetchPolicy).toBe("cache-first");
          } else if (handleCount === 6) {
            expect(result.data).toEqual(data2);
            expect(result.loading).toBe(true);
            expect(observable.options.fetchPolicy).toBe("cache-first");
          } else if (handleCount === 7) {
            expect(result.data).toEqual(data2);
            expect(result.loading).toBe(false);
            expect(observable.options.fetchPolicy).toBe("cache-first");

            expect(usedFetchPolicies).toEqual([
              "cache-and-network",
              "network-only",
              "cache-and-network",
              "cache-and-network",
            ]);

            setTimeout(resolve, 10);
          } else {
            reject(`too many renders (${handleCount})`);
          }
        });
      }
    );

    itAsync(
      "cache-and-network refetch should run @client(always: true) resolvers when network request fails",
      (resolve, reject) => {
        const query = gql`
          query MixedQuery {
            counter @client(always: true)
            name
          }
        `;

        let count = 0;

        let linkObservable = Observable.of({
          data: {
            name: "Ben",
          },
        });

        const intentionalNetworkFailure = new ApolloError({
          networkError: new Error("intentional network failure"),
        });

        const errorObservable: typeof linkObservable = new Observable(
          (observer) => {
            observer.error(intentionalNetworkFailure);
          }
        );

        const client = new ApolloClient({
          link: new ApolloLink((request) => linkObservable),
          cache: new InMemoryCache(),
          resolvers: {
            Query: {
              counter() {
                return ++count;
              },
            },
          },
        });

        const observable = client.watchQuery({
          query,
          fetchPolicy: "cache-and-network",
          returnPartialData: true,
        });

        let handleCount = 0;
        observable.subscribe({
          error(error) {
            expect(error).toBe(intentionalNetworkFailure);
          },

          next(result) {
            ++handleCount;

            if (handleCount === 1) {
              expect(result).toEqual({
                data: {
                  counter: 1,
                },
                loading: true,
                networkStatus: NetworkStatus.loading,
                partial: true,
              });
            } else if (handleCount === 2) {
              expect(result).toEqual({
                data: {
                  counter: 2,
                  name: "Ben",
                },
                loading: false,
                networkStatus: NetworkStatus.ready,
              });

              const oldLinkObs = linkObservable;
              // Make the next network request fail.
              linkObservable = errorObservable;

              observable.refetch().then(
                () => {
                  reject(new Error("should have gotten an error"));
                },

                (error) => {
                  expect(error).toBe(intentionalNetworkFailure);

                  // Switch back from errorObservable.
                  linkObservable = oldLinkObs;

                  observable.refetch().then((result) => {
                    expect(result).toEqual({
                      data: {
                        counter: 5,
                        name: "Ben",
                      },
                      loading: false,
                      networkStatus: NetworkStatus.ready,
                    });
                    setTimeout(resolve, 50);
                  }, reject);
                }
              );
            } else if (handleCount === 3) {
              expect(result).toEqual({
                data: {
                  counter: 3,
                  name: "Ben",
                },
                loading: true,
                networkStatus: NetworkStatus.refetch,
              });
            } else if (handleCount > 3) {
              reject(new Error("should not get here"));
            }
          },
        });
      }
    );

    describe("warnings about refetch({ variables })", () => {
      itAsync(
        "should warn if passed { variables } and query does not declare any variables",
        (resolve, reject) => {
          const consoleWarnSpy = jest.spyOn(console, "warn");
          consoleWarnSpy.mockImplementation(() => {});

          const queryWithoutVariables = gql`
            query QueryWithoutVariables {
              getVars {
                __typename
                name
              }
            }
          `;

          function makeMock(...vars: string[]) {
            const requestWithoutVariables = {
              query: queryWithoutVariables,
              variables: {
                variables: vars,
              },
            };

            const resultWithVariables = {
              data: {
                getVars: vars.map((name) => ({
                  __typename: "Var",
                  name,
                })),
              },
            };

            return {
              request: requestWithoutVariables,
              result: resultWithVariables,
            };
          }

          const observableWithoutVariables: ObservableQuery<any> =
            mockWatchQuery(makeMock("a", "b", "c"), makeMock("d", "e"));

          subscribeAndCount(
            reject,
            observableWithoutVariables,
            (count, result) => {
              expect(result.error).toBeUndefined();

              if (count === 1) {
                expect(result.loading).toBe(false);
                expect(result.data).toEqual({
                  getVars: [
                    { __typename: "Var", name: "a" },
                    { __typename: "Var", name: "b" },
                    { __typename: "Var", name: "c" },
                  ],
                });

                // It's a common mistake to call refetch({ variables }) when you meant
                // to call refetch(variables).
                observableWithoutVariables
                  .refetch({
                    variables: ["d", "e"],
                  })
                  .catch(reject);
              } else if (count === 2) {
                expect(result.loading).toBe(false);
                expect(result.data).toEqual({
                  getVars: [
                    { __typename: "Var", name: "d" },
                    { __typename: "Var", name: "e" },
                  ],
                });

                expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
                expect(consoleWarnSpy).toHaveBeenCalledWith(
                  [
                    "Called refetch(%o) for query %o, which does not declare a $variables variable.",
                    "Did you mean to call refetch(variables) instead of refetch({ variables })?",
                  ].join("\n"),
                  { variables: ["d", "e"] },
                  "QueryWithoutVariables"
                );
                consoleWarnSpy.mockRestore();

                setTimeout(resolve, 10);
              } else {
                reject(`too many results (${count})`);
              }
            }
          );
        }
      );

      itAsync(
        "should warn if passed { variables } and query does not declare $variables",
        (resolve, reject) => {
          const consoleWarnSpy = jest.spyOn(console, "warn");
          consoleWarnSpy.mockImplementation(() => {});

          const queryWithVarsVar = gql`
            query QueryWithVarsVar($vars: [String!]) {
              getVars(variables: $vars) {
                __typename
                name
              }
            }
          `;

          function makeMock(...vars: string[]) {
            const requestWithVarsVar = {
              query: queryWithVarsVar,
              variables: { vars },
            };

            const resultWithVarsVar = {
              data: {
                getVars: vars.map((name) => ({
                  __typename: "Var",
                  name,
                })),
              },
            };

            return {
              request: requestWithVarsVar,
              result: resultWithVarsVar,
            };
          }

          // We construct the queryManager manually here rather than using
          // `mockWatchQuery` because we need to silence console warnings for
          // unmatched variables since. This test checks for calls to
          // `console.warn` and unfortunately `mockSingleLink` (used by
          // `mockWatchQuery`) does not support the ability to disable warnings
          // without introducing a breaking change. Instead we construct this
          // manually to be able to turn off warnings for this test.
          const mocks = [makeMock("a", "b", "c"), makeMock("d", "e")];
          const firstRequest = mocks[0].request;
          const queryManager = new QueryManager(
            getDefaultOptionsForQueryManagerTests({
              cache: new InMemoryCache({ addTypename: false }),
              link: new MockLink(mocks, true, { showWarnings: false }),
            })
          );

          const observableWithVarsVar = queryManager.watchQuery({
            query: firstRequest.query,
            variables: firstRequest.variables,
            notifyOnNetworkStatusChange: false,
          });

          subscribeAndCount(
            (error) => {
              expect(error.message).toMatch(
                "No more mocked responses for the query: query QueryWithVarsVar($vars: [String!])"
              );
            },
            observableWithVarsVar,
            (count, result) => {
              expect(result.error).toBeUndefined();

              if (count === 1) {
                expect(result.loading).toBe(false);
                expect(result.data).toEqual({
                  getVars: [
                    { __typename: "Var", name: "a" },
                    { __typename: "Var", name: "b" },
                    { __typename: "Var", name: "c" },
                  ],
                });

                // It's a common mistake to call refetch({ variables }) when you meant
                // to call refetch(variables).
                observableWithVarsVar
                  .refetch({
                    variables: { vars: ["d", "e"] },
                  } as any)
                  .then(
                    (result) => {
                      reject(
                        `unexpected result ${JSON.stringify(
                          result
                        )}; should have thrown`
                      );
                    },
                    (error) => {
                      expect(error.message).toMatch(
                        "No more mocked responses for the query: query QueryWithVarsVar($vars: [String!])"
                      );
                      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
                      expect(consoleWarnSpy).toHaveBeenCalledWith(
                        [
                          "Called refetch(%o) for query %o, which does not declare a $variables variable.",
                          "Did you mean to call refetch(variables) instead of refetch({ variables })?",
                        ].join("\n"),
                        { variables: { vars: ["d", "e"] } },
                        "QueryWithVarsVar"
                      );
                      consoleWarnSpy.mockRestore();

                      setTimeout(resolve, 10);
                    }
                  );
              } else {
                reject(
                  `one too many (${count}) results: ${JSON.stringify(result)}`
                );
              }
            }
          );
        }
      );

      itAsync(
        "should not warn if passed { variables } and query declares $variables",
        (resolve, reject) => {
          const consoleWarnSpy = jest.spyOn(console, "warn");
          consoleWarnSpy.mockImplementation(() => {});

          const queryWithVariablesVar = gql`
            query QueryWithVariablesVar($variables: [String!]) {
              getVars(variables: $variables) {
                __typename
                name
              }
            }
          `;

          function makeMock(...variables: string[]) {
            const requestWithVariablesVar = {
              query: queryWithVariablesVar,
              variables: {
                variables,
              },
            };

            const resultWithVariablesVar = {
              data: {
                getVars: variables.map((name) => ({
                  __typename: "Var",
                  name,
                })),
              },
            };

            return {
              request: requestWithVariablesVar,
              result: resultWithVariablesVar,
            };
          }

          const observableWithVariablesVar: ObservableQuery<any> =
            mockWatchQuery(makeMock("a", "b", "c"), makeMock("d", "e"));

          subscribeAndCount(
            reject,
            observableWithVariablesVar,
            (count, result) => {
              expect(result.error).toBeUndefined();
              if (count === 1) {
                expect(result.loading).toBe(false);
                expect(result.data).toEqual({
                  getVars: [
                    { __typename: "Var", name: "a" },
                    { __typename: "Var", name: "b" },
                    { __typename: "Var", name: "c" },
                  ],
                });

                observableWithVariablesVar
                  .refetch({
                    variables: ["d", "e"],
                  })
                  .catch(reject);
              } else if (count === 2) {
                expect(result.loading).toBe(false);
                expect(result.data).toEqual({
                  getVars: [
                    { __typename: "Var", name: "d" },
                    { __typename: "Var", name: "e" },
                  ],
                });

                expect(consoleWarnSpy).not.toHaveBeenCalled();
                consoleWarnSpy.mockRestore();

                setTimeout(resolve, 10);
              } else {
                reject(`too many results (${count})`);
              }
            }
          );
        }
      );
    });
  });

  describe("currentResult", () => {
    itAsync(
      "returns the same value as observableQuery.next got",
      (resolve, reject) => {
        const queryWithFragment = gql`
          fragment CatInfo on Cat {
            isTabby
            __typename
          }

          fragment DogInfo on Dog {
            hasBrindleCoat
            __typename
          }

          fragment PetInfo on Pet {
            id
            name
            age
            ... on Cat {
              ...CatInfo
              __typename
            }
            ... on Dog {
              ...DogInfo
              __typename
            }
            __typename
          }

          {
            pets {
              ...PetInfo
              __typename
            }
          }
        `;

        const petData = [
          {
            id: 1,
            name: "Phoenix",
            age: 6,
            isTabby: true,
            __typename: "Cat",
          },
          {
            id: 2,
            name: "Tempe",
            age: 3,
            isTabby: false,
            __typename: "Cat",
          },
          {
            id: 3,
            name: "Robin",
            age: 10,
            hasBrindleCoat: true,
            __typename: "Dog",
          },
        ];

        const dataOneWithTypename = {
          pets: petData.slice(0, 2),
        };

        const dataTwoWithTypename = {
          pets: petData.slice(0, 3),
        };

        const ni = mockSingleLink(
          {
            request: { query: queryWithFragment, variables },
            result: { data: dataOneWithTypename },
          },
          {
            request: { query: queryWithFragment, variables },
            result: { data: dataTwoWithTypename },
          }
        ).setOnError(reject);

        const client = new ApolloClient({
          link: ni,
          cache: new InMemoryCache({
            possibleTypes: {
              Creature: ["Pet"],
              Pet: ["Dog", "Cat"],
            },
          }),
        });

        const observable = client.watchQuery({
          query: queryWithFragment,
          variables,
          notifyOnNetworkStatusChange: true,
        });

        subscribeAndCount(reject, observable, (count, result) => {
          const { data, loading, networkStatus } =
            observable.getCurrentResult();
          expect(result.loading).toEqual(loading);
          expect(result.networkStatus).toEqual(networkStatus);
          expect(result.data).toEqual(data);

          if (count === 1) {
            expect(result.loading).toBe(false);
            expect(result.networkStatus).toEqual(NetworkStatus.ready);
            expect(result.data).toEqual(dataOneWithTypename);
            observable.refetch();
          } else if (count === 2) {
            expect(result.loading).toBe(true);
            expect(result.networkStatus).toEqual(NetworkStatus.refetch);
          } else if (count === 3) {
            expect(result.loading).toBe(false);
            expect(result.networkStatus).toEqual(NetworkStatus.ready);
            expect(result.data).toEqual(dataTwoWithTypename);
            setTimeout(resolve, 5);
          } else {
            reject(new Error("Observable.next called too many times"));
          }
        });
      }
    );

    itAsync(
      "returns the current query status immediately",
      (resolve, reject) => {
        const observable: ObservableQuery<any> = mockWatchQuery({
          request: { query, variables },
          result: { data: dataOne },
          delay: 100,
        });

        subscribeAndCount(reject, observable, () => {
          expect(observable.getCurrentResult()).toEqual({
            data: dataOne,
            loading: false,
            networkStatus: 7,
          });
          resolve();
        });

        expect(observable.getCurrentResult()).toEqual({
          loading: true,
          data: undefined,
          networkStatus: 1,
          partial: true,
        });

        setTimeout(
          wrap(reject, () => {
            expect(observable.getCurrentResult()).toEqual({
              loading: true,
              data: undefined,
              networkStatus: 1,
              partial: true,
            });
          }),
          0
        );
      }
    );

    itAsync("returns results from the store immediately", (resolve, reject) => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { data: dataOne },
      });

      return queryManager
        .query({ query, variables })
        .then((result: any) => {
          expect(result).toEqual({
            data: dataOne,
            loading: false,
            networkStatus: 7,
          });
          const observable = queryManager.watchQuery({
            query,
            variables,
          });
          expect(observable.getCurrentResult()).toEqual({
            data: dataOne,
            loading: false,
            networkStatus: NetworkStatus.ready,
          });
        })
        .then(resolve, reject);
    });

    itAsync("returns errors from the store immediately", (resolve) => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { errors: [error] },
      });

      const observable = queryManager.watchQuery({
        query,
        variables,
      });

      observable.subscribe({
        error: (theError) => {
          expect(theError.graphQLErrors).toEqual([error]);

          const currentResult = observable.getCurrentResult();
          expect(currentResult.loading).toBe(false);
          expect(currentResult.error!.graphQLErrors).toEqual([error]);
          resolve();
        },
      });
    });

    itAsync("returns referentially equal errors", (resolve, reject) => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { errors: [error] },
      });

      const observable = queryManager.watchQuery({
        query,
        variables,
      });

      return observable
        .result()
        .catch((theError: any) => {
          expect(theError.graphQLErrors).toEqual([error]);

          const currentResult = observable.getCurrentResult();
          expect(currentResult.loading).toBe(false);
          expect(currentResult.error!.graphQLErrors).toEqual([error]);
          const currentResult2 = observable.getCurrentResult();
          expect(currentResult.error === currentResult2.error).toBe(true);
        })
        .then(resolve, reject);
    });

    itAsync(
      "returns errors with data if errorPolicy is all",
      (resolve, reject) => {
        const queryManager = mockQueryManager({
          request: { query, variables },
          result: { data: dataOne, errors: [error] },
        });

        const observable = queryManager.watchQuery({
          query,
          variables,
          errorPolicy: "all",
        });

        return observable
          .result()
          .then((result) => {
            expect(result.data).toEqual(dataOne);
            expect(result.errors).toEqual([error]);
            const currentResult = observable.getCurrentResult();
            expect(currentResult.loading).toBe(false);
            expect(currentResult.errors).toEqual([error]);
            expect(currentResult.error).toBeUndefined();
          })
          .then(resolve, reject);
      }
    );

    itAsync("errors out if errorPolicy is none", (resolve, reject) => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { data: dataOne, errors: [error] },
      });

      const observable = queryManager.watchQuery({
        query,
        variables,
        errorPolicy: "none",
      });

      return observable
        .result()
        .then(() => reject("Observable did not error when it should have"))
        .catch((currentError) => {
          expect(currentError).toEqual(wrappedError);
          const lastError = observable.getLastError();
          expect(lastError).toEqual(wrappedError);
          resolve();
        })
        .catch(reject);
    });

    itAsync(
      "errors out if errorPolicy is none and the observable has completed",
      (resolve, reject) => {
        const queryManager = mockQueryManager(
          {
            request: { query, variables },
            result: { data: dataOne, errors: [error] },
          },
          // FIXME: We shouldn't need a second mock, there should only be one network request
          {
            request: { query, variables },
            result: { data: dataOne, errors: [error] },
          }
        );

        const observable = queryManager.watchQuery({
          query,
          variables,
          errorPolicy: "none",
        });

        return (
          observable
            .result()
            .then(() => reject("Observable did not error when it should have"))
            // We wait for the observable to error out and reobtain a promise
            .catch(() => observable.result())
            .then((result) =>
              reject(
                "Observable did not error the second time we fetched results when it should have"
              )
            )
            .catch((currentError) => {
              expect(currentError).toEqual(wrappedError);
              const lastError = observable.getLastError();
              expect(lastError).toEqual(wrappedError);
              resolve();
            })
            .catch(reject)
        );
      }
    );

    itAsync(
      "ignores errors with data if errorPolicy is ignore",
      (resolve, reject) => {
        const queryManager = mockQueryManager({
          request: { query, variables },
          result: { errors: [error], data: dataOne },
        });

        const observable = queryManager.watchQuery({
          query,
          variables,
          errorPolicy: "ignore",
        });

        return observable
          .result()
          .then((result) => {
            expect(result.data).toEqual(dataOne);
            expect(result.errors).toBeUndefined();
            const currentResult = observable.getCurrentResult();
            expect(currentResult.loading).toBe(false);
            expect(currentResult.errors).toBeUndefined();
            expect(currentResult.error).toBeUndefined();
          })
          .then(resolve, reject);
      }
    );

    itAsync(
      "returns partial data from the store immediately",
      (resolve, reject) => {
        const superQuery = gql`
          query superQuery($id: ID!) {
            people_one(id: $id) {
              name
              age
            }
          }
        `;

        const superDataOne = {
          people_one: {
            name: "Luke Skywalker",
            age: 21,
          },
        };

        const queryManager = mockQueryManager(
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query: superQuery, variables },
            result: { data: superDataOne },
          }
        );

        queryManager.query({ query, variables }).then((result) => {
          const observable = queryManager.watchQuery({
            query: superQuery,
            variables,
            returnPartialData: true,
          });

          expect(observable.getCurrentResult()).toEqual({
            data: dataOne,
            loading: true,
            networkStatus: 1,
            partial: true,
          });

          // we can use this to trigger the query
          subscribeAndCount(reject, observable, (handleCount, subResult) => {
            const { data, loading, networkStatus } =
              observable.getCurrentResult();

            expect(subResult.data).toEqual(data);
            expect(subResult.loading).toEqual(loading);
            expect(subResult.networkStatus).toEqual(networkStatus);

            if (handleCount === 1) {
              expect(subResult).toEqual({
                data: dataOne,
                loading: true,
                networkStatus: 1,
                partial: true,
              });
            } else if (handleCount === 2) {
              expect(subResult).toEqual({
                data: superDataOne,
                loading: false,
                networkStatus: 7,
              });
              resolve();
            }
          });
        });
      }
    );

    itAsync(
      "returns loading even if full data is available when using network-only fetchPolicy",
      (resolve, reject) => {
        const queryManager = mockQueryManager(
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables },
            result: { data: dataTwo },
          }
        );

        queryManager.query({ query, variables }).then((result) => {
          expect(result).toEqual({
            data: dataOne,
            loading: false,
            networkStatus: NetworkStatus.ready,
          });

          const observable = queryManager.watchQuery({
            query,
            variables,
            fetchPolicy: "network-only",
          });

          expect(observable.getCurrentResult()).toEqual({
            data: undefined,
            loading: true,
            networkStatus: NetworkStatus.loading,
          });

          subscribeAndCount(reject, observable, (handleCount, subResult) => {
            if (handleCount === 1) {
              expect(subResult).toEqual({
                loading: true,
                data: undefined,
                networkStatus: NetworkStatus.loading,
              });
            } else if (handleCount === 2) {
              expect(subResult).toEqual({
                data: dataTwo,
                loading: false,
                networkStatus: NetworkStatus.ready,
              });
              resolve();
            }
          });
        });
      }
    );

    itAsync(
      "returns loading on no-cache fetchPolicy queries when calling getCurrentResult",
      (resolve, reject) => {
        const queryManager = mockQueryManager(
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables },
            result: { data: dataTwo },
          }
        );

        queryManager.query({ query, variables }).then(() => {
          const observable = queryManager.watchQuery({
            query,
            variables,
            fetchPolicy: "no-cache",
          });
          expect(observable.getCurrentResult()).toEqual({
            data: undefined,
            loading: true,
            networkStatus: 1,
          });

          subscribeAndCount(reject, observable, (handleCount, subResult) => {
            const { data, loading, networkStatus } =
              observable.getCurrentResult();

            if (handleCount === 1) {
              expect(subResult).toEqual({
                data,
                loading,
                networkStatus,
              });
            } else if (handleCount === 2) {
              expect(subResult).toEqual({
                data: dataTwo,
                loading: false,
                networkStatus: 7,
              });
              resolve();
            }
          });
        });
      }
    );

    it("handles multiple calls to getCurrentResult without losing data", async () => {
      const query = gql`
        {
          greeting {
            message
            ... on Greeting @defer {
              recipient {
                name
              }
            }
          }
        }
      `;

      const link = new MockSubscriptionLink();

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const obs = client.watchQuery({ query });
      const stream = new ObservableStream(obs);

      link.simulateResult({
        result: {
          data: {
            greeting: {
              message: "Hello world",
              __typename: "Greeting",
            },
          },
          hasNext: true,
        },
      });

      {
        const result = await stream.takeNext();
        expect(result.data).toEqual({
          greeting: {
            message: "Hello world",
            __typename: "Greeting",
          },
        });
      }

      expect(obs.getCurrentResult().data).toEqual({
        greeting: {
          message: "Hello world",
          __typename: "Greeting",
        },
      });

      expect(obs.getCurrentResult().data).toEqual({
        greeting: {
          message: "Hello world",
          __typename: "Greeting",
        },
      });

      link.simulateResult(
        {
          result: {
            incremental: [
              {
                data: {
                  recipient: {
                    name: "Alice",
                    __typename: "Person",
                  },
                  __typename: "Greeting",
                },
                path: ["greeting"],
              },
            ],
            hasNext: false,
          },
        },
        true
      );

      {
        const result = await stream.takeNext();
        expect(result.data).toEqual({
          greeting: {
            message: "Hello world",
            recipient: {
              name: "Alice",
              __typename: "Person",
            },
            __typename: "Greeting",
          },
        });
      }

      expect(obs.getCurrentResult().data).toEqual({
        greeting: {
          message: "Hello world",
          recipient: {
            name: "Alice",
            __typename: "Person",
          },
          __typename: "Greeting",
        },
      });

      expect(obs.getCurrentResult().data).toEqual({
        greeting: {
          message: "Hello world",
          recipient: {
            name: "Alice",
            __typename: "Person",
          },
          __typename: "Greeting",
        },
      });
    });

    {
      type Result = Partial<ApolloQueryResult<{ hello: string }>>;

      const cacheValues = {
        initial: { hello: "world (initial)" },
        link: { hello: "world (from link)" },
        refetch: { hello: "world (from link again)" },
        update1: { hello: "world (from cache again, 1)" },
        update2: { hello: "world (from cache again, 2)" },
        update3: { hello: "world (from cache again, 3)" },
        update4: { hello: "world (from cache again, 4)" },
      } as const;

      const loadingStates = {
        loading: {
          loading: true,
          networkStatus: NetworkStatus.loading,
        },
        done: {
          loading: false,
          networkStatus: NetworkStatus.ready,
        },
        refetching: {
          loading: true,
          networkStatus: NetworkStatus.refetch,
        },
      } as const;

      type TestDetails = {
        // writeCache: cacheValues.initial
        resultBeforeSubscribe: Result;
        // observableQuery.subscribe
        resultAfterSubscribe: Result;
        // writeCache:  cacheValues.update1
        resultAfterCacheUpdate1: Result;
        // incoming result: cacheValues.link
        resultAfterLinkNext: Result;
        // writeCache:  cacheValues.update2
        resultAfterCacheUpdate2: Result;
        // observableQuery.refetch
        // writeCache:  cacheValues.update3
        resultAfterCacheUpdate3: Result;
        // incoming result:  cacheValues.refetch
        resultAfterRefetchNext: Result;
        // writeCache:  cacheValues.update4
        resultAfterCacheUpdate4: Result;
      };

      const cacheAndLink: TestDetails = {
        resultBeforeSubscribe: {
          ...loadingStates.loading,
          data: cacheValues.initial,
        },
        resultAfterSubscribe: {
          ...loadingStates.loading,
          data: cacheValues.initial,
        },
        resultAfterCacheUpdate1: {
          ...loadingStates.loading,
          data: cacheValues.update1,
        },
        resultAfterLinkNext: {
          ...loadingStates.done,
          data: cacheValues.link,
        },
        resultAfterCacheUpdate2: {
          ...loadingStates.done,
          data: cacheValues.update2,
        },
        resultAfterCacheUpdate3: {
          ...loadingStates.refetching,
          data: cacheValues.update3,
        },
        resultAfterRefetchNext: {
          ...loadingStates.done,
          data: cacheValues.refetch,
        },
        resultAfterCacheUpdate4: {
          ...loadingStates.done,
          data: cacheValues.update4,
        },
      };

      const linkOnly: TestDetails = {
        resultBeforeSubscribe: {
          ...loadingStates.loading,
        },
        resultAfterSubscribe: {
          ...loadingStates.loading,
        },
        resultAfterCacheUpdate1: {
          ...loadingStates.loading,
        },
        resultAfterLinkNext: {
          ...loadingStates.done,
          data: cacheValues.link,
        },
        resultAfterCacheUpdate2: {
          ...loadingStates.done,
          data: cacheValues.link,
        },
        resultAfterCacheUpdate3: {
          ...loadingStates.refetching,
          data: cacheValues.link,
        },
        resultAfterRefetchNext: {
          ...loadingStates.done,
          data: cacheValues.refetch,
        },
        resultAfterCacheUpdate4: {
          ...loadingStates.done,
          data: cacheValues.refetch,
        },
      };

      const standbyOnly: TestDetails = {
        ...linkOnly,
        resultBeforeSubscribe: {
          ...loadingStates.loading,
        },
        resultAfterSubscribe: {
          ...loadingStates.loading,
        },
        resultAfterCacheUpdate1: {
          ...loadingStates.loading,
        },
        resultAfterLinkNext: {
          ...loadingStates.loading,
        },
        resultAfterCacheUpdate2: {
          ...loadingStates.loading,
        },
        resultAfterCacheUpdate3: {
          ...loadingStates.refetching,
        },
        // like linkOnly:
        // resultAfterRefetchNext
        // resultAfterCacheUpdate4
      };

      const linkOnlyThenCacheAndLink: TestDetails = {
        ...cacheAndLink,
        resultBeforeSubscribe: {
          ...loadingStates.loading,
        },
        resultAfterSubscribe: {
          ...loadingStates.loading,
        },
        resultAfterCacheUpdate1: {
          ...loadingStates.loading,
        },
        // like cacheAndLink:
        // resultAfterLinkNext
        // resultAfterCacheUpdate2
        // resultAfterCacheUpdate3
        // resultAfterRefetchNext
        // resultAfterCacheUpdate4
      };

      const cacheOnlyThenCacheAndLink: TestDetails = {
        ...cacheAndLink,
        resultBeforeSubscribe: {
          ...loadingStates.done,
          data: cacheValues.initial,
        },
        resultAfterSubscribe: {
          ...loadingStates.done,
          data: cacheValues.initial,
        },
        resultAfterCacheUpdate1: {
          ...loadingStates.done,
          data: cacheValues.update1,
        },
        resultAfterLinkNext: {
          ...loadingStates.done,
          data: cacheValues.update1,
        },
        // like cacheAndLink:
        // resultAfterCacheUpdate2
        // resultAfterCacheUpdate3
        // resultAfterRefetchNext
        // resultAfterCacheUpdate4
      };

      it.each<
        [
          initialFetchPolicy: WatchQueryFetchPolicy,
          nextFetchPolicy: WatchQueryFetchPolicy,
          testDetails: TestDetails,
        ]
      >([
        ["cache-and-network", "cache-and-network", cacheAndLink],
        ["cache-first", "cache-first", cacheOnlyThenCacheAndLink],
        ["cache-first", "cache-and-network", cacheOnlyThenCacheAndLink],
        ["no-cache", "no-cache", linkOnly],
        ["no-cache", "cache-and-network", linkOnlyThenCacheAndLink],
        ["standby", "standby", standbyOnly],
        ["standby", "cache-and-network", standbyOnly],
        ["cache-only", "cache-only", cacheOnlyThenCacheAndLink],
        ["cache-only", "cache-and-network", cacheOnlyThenCacheAndLink],
      ])(
        "fetchPolicy %s -> %s",
        async (
          fetchPolicy,
          nextFetchPolicy,
          {
            resultBeforeSubscribe,
            resultAfterSubscribe,
            resultAfterCacheUpdate1,
            resultAfterLinkNext,
            resultAfterCacheUpdate2,
            resultAfterCacheUpdate3,
            resultAfterRefetchNext,
            resultAfterCacheUpdate4,
          }
        ) => {
          const query = gql`
            {
              hello
            }
          `;
          let observer!: SubscriptionObserver<FetchResult>;
          const link = new ApolloLink(() => {
            return new Observable((o) => {
              observer = o;
            });
          });
          const cache = new InMemoryCache({});
          cache.writeQuery({ query, data: cacheValues.initial });

          const queryManager = new QueryManager(
            getDefaultOptionsForQueryManagerTests({ link, cache })
          );
          const observableQuery = queryManager.watchQuery({
            query,
            fetchPolicy,
            nextFetchPolicy,
          });

          expect(observableQuery.getCurrentResult()).toStrictEqual(
            resultBeforeSubscribe
          );

          observableQuery.subscribe({});
          expect(observableQuery.getCurrentResult()).toStrictEqual(
            resultAfterSubscribe
          );

          cache.writeQuery({ query, data: cacheValues.update1 });
          expect(observableQuery.getCurrentResult()).toStrictEqual(
            resultAfterCacheUpdate1
          );

          if (observer) {
            observer.next({ data: cacheValues.link });
            observer.complete();
          }
          await waitFor(
            () =>
              void expect(observableQuery.getCurrentResult()).toStrictEqual(
                resultAfterLinkNext
              ),
            { interval: 1 }
          );

          cache.writeQuery({ query, data: cacheValues.update2 });
          expect(observableQuery.getCurrentResult()).toStrictEqual(
            resultAfterCacheUpdate2
          );

          observableQuery.refetch();

          cache.writeQuery({ query, data: cacheValues.update3 });
          expect(observableQuery.getCurrentResult()).toStrictEqual(
            resultAfterCacheUpdate3
          );

          if (observer) {
            observer.next({ data: cacheValues.refetch });
            observer.complete();
          }
          await waitFor(
            () =>
              void expect(observableQuery.getCurrentResult()).toStrictEqual(
                resultAfterRefetchNext
              ),
            { interval: 1 }
          );

          cache.writeQuery({ query, data: cacheValues.update4 });
          expect(observableQuery.getCurrentResult()).toStrictEqual(
            resultAfterCacheUpdate4
          );
        }
      );
    }

    describe("mutations", () => {
      const mutation = gql`
        mutation setName {
          name
        }
      `;

      const mutationData = {
        name: "Leia Skywalker",
      };

      const optimisticResponse = {
        name: "Leia Skywalker (optimistic)",
      };

      const updateQueries = {
        query: (_: any, { mutationResult }: any) => {
          return {
            people_one: { name: mutationResult.data.name },
          };
        },
      };

      itAsync(
        "returns optimistic mutation results from the store",
        (resolve, reject) => {
          const queryManager = mockQueryManager(
            {
              request: { query, variables },
              result: { data: dataOne },
            },
            {
              request: { query: mutation },
              result: { data: mutationData },
            }
          );

          const observable = queryManager.watchQuery({
            query,
            variables,
          });

          subscribeAndCount(reject, observable, (count, result) => {
            const { data, loading, networkStatus } =
              observable.getCurrentResult();
            expect(result).toEqual({
              data,
              loading,
              networkStatus,
            });

            if (count === 1) {
              expect(result).toEqual({
                data: dataOne,
                loading: false,
                networkStatus: 7,
              });
              queryManager.mutate({
                mutation,
                optimisticResponse,
                updateQueries,
              });
            } else if (count === 2) {
              expect(result.data.people_one).toEqual(optimisticResponse);
            } else if (count === 3) {
              expect(result.data.people_one).toEqual(mutationData);
              resolve();
            }
          });
        }
      );
    });
  });

  describe("assumeImmutableResults", () => {
    itAsync(
      "should prevent costly (but safe) cloneDeep calls",
      async (resolve) => {
        const queryOptions = {
          query: gql`
            query {
              value
            }
          `,
          pollInterval: 20,
        };

        function check({
          assumeImmutableResults = true,
          assertFrozenResults = false,
        }) {
          const cache = new InMemoryCache();
          const client = new ApolloClient({
            link: mockSingleLink(
              { request: queryOptions, result: { data: { value: 1 } } },
              { request: queryOptions, result: { data: { value: 2 } } },
              { request: queryOptions, result: { data: { value: 3 } } }
            ).setOnError((error) => {
              throw error;
            }),
            assumeImmutableResults,
            cache,
          });

          const observable = client.watchQuery(queryOptions);
          const values: any[] = [];

          return new Promise<any[]>((resolve, reject) => {
            observable.subscribe({
              next({ data }) {
                values.push(data.value);
                if (assertFrozenResults) {
                  try {
                    data.value = "oyez";
                  } catch (error) {
                    reject(error);
                  }
                } else {
                  data = {
                    ...data,
                    value: "oyez",
                  };
                }
                client.writeQuery({
                  query: queryOptions.query,
                  data,
                });
              },
              error(err) {
                expect(err.message).toMatch(/No more mocked responses/);
                resolve(values);
              },
            });
          });
        }

        async function checkThrows(assumeImmutableResults: boolean) {
          try {
            await check({
              assumeImmutableResults,
              // No matter what value we provide for assumeImmutableResults, if we
              // tell the InMemoryCache to deep-freeze its results, destructive
              // modifications of the result objects will become fatal. Once you
              // start enforcing immutability in this way, you might as well pass
              // assumeImmutableResults: true, to prevent calling cloneDeep.
              assertFrozenResults: true,
            });
            throw new Error("not reached");
          } catch (error) {
            expect(error).toBeInstanceOf(TypeError);
            expect((error as Error).message).toMatch(
              /Cannot assign to read only property 'value'/
            );
          }
        }
        await checkThrows(true);
        await checkThrows(false);

        resolve();
      }
    );
  });

  describe("resetQueryStoreErrors", () => {
    itAsync(
      "should remove any GraphQLError's stored in the query store",
      (resolve) => {
        const graphQLError = new GraphQLError("oh no!");

        const observable: ObservableQuery<any> = mockWatchQuery({
          request: { query, variables },
          result: { errors: [graphQLError] },
        });

        observable.subscribe({
          error() {
            const { queryManager } = observable as any;
            const queryInfo = queryManager["queries"].get(observable.queryId);
            expect(queryInfo.graphQLErrors).toEqual([graphQLError]);

            observable.resetQueryStoreErrors();
            expect(queryInfo.graphQLErrors).toEqual([]);

            resolve();
          },
        });
      }
    );

    itAsync(
      "should remove network error's stored in the query store",
      (resolve) => {
        const networkError = new Error("oh no!");

        const observable: ObservableQuery<any> = mockWatchQuery({
          request: { query, variables },
          result: { data: dataOne },
        });

        observable.subscribe({
          next() {
            const { queryManager } = observable as any;
            const queryInfo = queryManager["queries"].get(observable.queryId);
            queryInfo.networkError = networkError;
            observable.resetQueryStoreErrors();
            expect(queryInfo.networkError).toBeUndefined();
            resolve();
          },
        });
      }
    );
  });

  describe(".query computed property", () => {
    it("is equal to transformed query when instantiating via `watchQuery`", () => {
      const query = gql`
        query {
          currentUser {
            id
          }
        }
      `;

      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });

      const observable = client.watchQuery({ query });

      expect(observable.query).toMatchDocument(gql`
        query {
          currentUser {
            id
            __typename
          }
        }
      `);
    });

    it("is referentially stable", () => {
      const query = gql`
        query {
          currentUser {
            id
          }
        }
      `;

      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });

      const observable = client.watchQuery({ query });
      const result = observable.query;

      expect(observable.query).toBe(result);
    });

    it("is updated with transformed query when `setOptions` changes the query", () => {
      const query = gql`
        query {
          currentUser {
            id
          }
        }
      `;

      const updatedQuery = gql`
        query {
          product {
            id
          }
        }
      `;

      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });

      const observable = client.watchQuery({ query });

      expect(observable.query).toMatchDocument(gql`
        query {
          currentUser {
            id
            __typename
          }
        }
      `);

      observable.setOptions({ query: updatedQuery });

      expect(observable.query).toMatchDocument(gql`
        query {
          product {
            id
            __typename
          }
        }
      `);
    });

    it("reflects query run through custom transforms", () => {
      const query = gql`
        query {
          currentUser {
            id
            name @client
          }
        }
      `;

      const documentTransform = new DocumentTransform((document) => {
        return removeDirectivesFromDocument([{ name: "client" }], document)!;
      });

      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
        documentTransform,
      });

      const observable = client.watchQuery({ query });

      expect(observable.query).toMatchDocument(gql`
        query {
          currentUser {
            id
            name
            __typename
          }
        }
      `);
    });
  });

  itAsync(
    "QueryInfo does not notify for !== but deep-equal results",
    (resolve, reject) => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { data: dataOne },
      });

      const observable = queryManager.watchQuery({
        query,
        variables,
        // If we let the cache return canonical results, it will be harder to
        // write this test, because any two results that are deeply equal will
        // also be !==, making the choice of equality test in queryInfo.setDiff
        // less visible/important.
        canonizeResults: false,
      });

      const queryInfo = observable["queryInfo"];
      const cache = queryInfo["cache"];
      const setDiffSpy = jest.spyOn(queryInfo, "setDiff");
      const notifySpy = jest.spyOn(queryInfo, "notify");

      subscribeAndCount(reject, observable, (count, result) => {
        if (count === 1) {
          expect(result).toEqual({
            loading: false,
            networkStatus: NetworkStatus.ready,
            data: dataOne,
          });

          let invalidateCount = 0;
          let onWatchUpdatedCount = 0;

          cache.batch({
            optimistic: true,
            update(cache) {
              cache.modify({
                fields: {
                  people_one(value, { INVALIDATE }) {
                    expect(value).toEqual(dataOne.people_one);
                    ++invalidateCount;
                    return INVALIDATE;
                  },
                },
              });
            },
            // Verify that the cache.modify operation did trigger a cache broadcast.
            onWatchUpdated(watch, diff) {
              expect(watch.watcher).toBe(queryInfo);
              expect(diff).toEqual({
                complete: true,
                result: {
                  people_one: {
                    name: "Luke Skywalker",
                  },
                },
              });
              ++onWatchUpdatedCount;
            },
          });

          new Promise((resolve) => setTimeout(resolve, 100))
            .then(() => {
              expect(setDiffSpy).toHaveBeenCalledTimes(1);
              expect(notifySpy).not.toHaveBeenCalled();
              expect(invalidateCount).toBe(1);
              expect(onWatchUpdatedCount).toBe(1);
              queryManager.stop();
            })
            .then(resolve, reject);
        } else {
          reject("too many results");
        }
      });
    }
  );

  itAsync("ObservableQuery#map respects Symbol.species", (resolve, reject) => {
    const observable = mockWatchQuery({
      request: { query, variables },
      result: { data: dataOne },
    });
    expect(observable).toBeInstanceOf(Observable);
    expect(observable).toBeInstanceOf(ObservableQuery);

    const mapped = observable.map((result) => {
      expect(result).toEqual({
        loading: false,
        networkStatus: NetworkStatus.ready,
        data: dataOne,
      });
      return {
        ...result,
        data: { mapped: true },
      };
    });
    expect(mapped).toBeInstanceOf(Observable);
    expect(mapped).not.toBeInstanceOf(ObservableQuery);

    const sub = mapped.subscribe({
      next(result) {
        sub.unsubscribe();
        try {
          expect(result).toEqual({
            loading: false,
            networkStatus: NetworkStatus.ready,
            data: { mapped: true },
          });
        } catch (error) {
          reject(error);
          return;
        }
        resolve();
      },
      error: reject,
    });
  });
});

test("regression test for #10587", async () => {
  let observers: Record<string, SubscriptionObserver<FetchResult>> = {};
  const link = new ApolloLink((operation) => {
    return new Observable((observer) => {
      observers[operation.operationName] = observer;
    });
  });

  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        SchemaType: {
          merge: true,
        },
      },
    }).restore({
      ROOT_QUERY: {
        __typename: "Query",
        schemaType: { __typename: "SchemaType", a: "", b: "" },
      },
    }),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: "cache-and-network",
        nextFetchPolicy: "cache-and-network",
      },
    },
    link,
  });

  const query1 = client.watchQuery({
    query: gql`
      query query1 {
        schemaType {
          a
        }
      }
    `,
  });
  const query2 = client.watchQuery({
    query: gql`
      query query2 {
        schemaType {
          a
          b
        }
      }
    `,
  });
  const query1Spy = jest.fn();
  const query2Spy = jest.fn();

  query1.subscribe(query1Spy);
  query2.subscribe(query2Spy);

  const finalExpectedCalls = {
    query1: [
      [
        {
          data: {
            schemaType: {
              __typename: "SchemaType",
              a: "",
            },
          },
          loading: true,
          networkStatus: 1,
        },
      ],
      [
        {
          data: {
            schemaType: {
              __typename: "SchemaType",
              a: "a",
            },
          },
          loading: false,
          networkStatus: 7,
        },
      ],
    ],
    query2: [
      [
        {
          data: {
            schemaType: {
              __typename: "SchemaType",
              a: "",
              b: "",
            },
          },
          loading: true,
          networkStatus: 1,
        },
      ],
      [
        {
          data: {
            schemaType: {
              __typename: "SchemaType",
              a: "a",
              b: "",
            },
          },
          // TODO: this should be `true`, but that seems to be a separate bug!
          loading: false,
          networkStatus: 7,
        },
      ],
      [
        {
          data: {
            schemaType: {
              __typename: "SchemaType",
              a: "a",
              b: "b",
            },
          },
          loading: false,
          networkStatus: 7,
        },
      ],
    ],
  } as const;

  await waitFor(() =>
    expect(query1Spy.mock.calls).toEqual(finalExpectedCalls.query1.slice(0, 1))
  );
  expect(query2Spy.mock.calls).toEqual(finalExpectedCalls.query2.slice(0, 1));

  observers.query1.next({
    data: { schemaType: { __typename: "SchemaType", a: "a" } },
  });
  observers.query1.complete();

  await waitFor(() =>
    expect(query1Spy.mock.calls).toEqual(finalExpectedCalls.query1)
  );
  expect(query2Spy.mock.calls).toEqual(finalExpectedCalls.query2.slice(0, 2));

  observers.query2.next({
    data: { schemaType: { __typename: "SchemaType", a: "a", b: "b" } },
  });
  observers.query2.complete();

  await waitFor(() =>
    expect(query2Spy.mock.calls).toEqual(finalExpectedCalls.query2)
  );
  expect(query1Spy.mock.calls).toEqual(finalExpectedCalls.query1);
});

// https://github.com/apollographql/apollo-client/issues/11184
test("handles changing variables in rapid succession before other request is completed", async () => {
  interface UserCountQuery {
    userCount: number;
  }
  interface UserCountVariables {
    department: "HR" | null;
  }

  const query: TypedDocumentNode<UserCountQuery, UserCountVariables> = gql`
    query UserCountQuery($department: Department) {
      userCount(department: $department)
    }
  `;
  const mocks = [
    {
      request: { query, variables: { department: null } },
      result: { data: { userCount: 10 } },
    },
    {
      request: { query, variables: { department: "HR" } },
      result: { data: { userCount: 5 } },
      delay: 50,
    },
  ];

  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache: new InMemoryCache(),
  });

  const observable = client.watchQuery<UserCountQuery, UserCountVariables>({
    query,
    variables: { department: null },
  });

  observable.subscribe(jest.fn());

  await waitFor(() => {
    expect(observable.getCurrentResult(false)).toEqual({
      data: { userCount: 10 },
      loading: false,
      networkStatus: NetworkStatus.ready,
    });
  });

  observable.reobserve({ variables: { department: "HR" } });
  await wait(10);
  observable.reobserve({ variables: { department: null } });

  // Wait for request to finish
  await wait(50);

  expect(observable.options.variables).toEqual({ department: null });
  expect(observable.getCurrentResult(false)).toEqual({
    data: { userCount: 10 },
    loading: false,
    networkStatus: NetworkStatus.ready,
  });
});
