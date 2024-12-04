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
  MockLink,
  mockSingleLink,
  MockSubscriptionLink,
  tick,
  wait,
} from "../../testing";
import mockQueryManager, {
  getDefaultOptionsForQueryManagerTests,
} from "../../testing/core/mocking/mockQueryManager";
import mockWatchQuery from "../../testing/core/mocking/mockWatchQuery";

import { resetStore } from "./QueryManager";
import { SubscriptionObserver } from "zen-observable-ts";
import { waitFor } from "@testing-library/react";
import { ObservableStream, spyOnConsole } from "../../testing/internal";

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
      it("starts polling if goes from 0 -> something", async () => {
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

        const stream = new ObservableStream(observable);

        {
          const { data } = await stream.takeNext();

          expect(data).toEqual(dataOne);
        }

        observable.setOptions({ query, pollInterval: 10 });

        {
          const { data } = await stream.takeNext();

          expect(data).toEqual(dataTwo);
        }

        observable.stopPolling();

        await expect(stream).not.toEmitValue();
      });

      it("stops polling if goes from something -> 0", async () => {
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

        const stream = new ObservableStream(observable);

        {
          const { data } = await stream.takeNext();

          expect(data).toEqual(dataOne);
        }

        observable.setOptions({ query, pollInterval: 0 });

        await expect(stream).not.toEmitValue();
      });

      it("can change from x>0 to y>0", async () => {
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

        const stream = new ObservableStream(observable);

        {
          const { data } = await stream.takeNext();

          expect(data).toEqual(dataOne);
        }

        observable.setOptions({ query, pollInterval: 10 });

        {
          const { data } = await stream.takeNext();

          expect(data).toEqual(dataTwo);
        }

        observable.stopPolling();

        await expect(stream).not.toEmitValue();
      });
    });

    it("does not break refetch", async () => {
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

      const stream = new ObservableStream(observable);

      {
        const { data, loading } = await stream.takeNext();

        expect(data).toEqual(data);
        expect(loading).toBe(false);
      }

      observable.refetch(variables2);

      {
        const { loading, networkStatus } = await stream.takeNext();

        expect(loading).toBe(true);
        expect(networkStatus).toBe(NetworkStatus.setVariables);
      }

      {
        const { data, loading } = await stream.takeNext();

        expect(loading).toBe(false);
        expect(data).toEqual(data2);
      }

      await expect(stream).not.toEmitValue();
    });

    it("rerenders when refetch is called", async () => {
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

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result.loading).toEqual(false);
        expect(result.data).toEqual(data);
      }

      observable.refetch();

      {
        const { loading, networkStatus } = await stream.takeNext();

        expect(loading).toEqual(true);
        expect(networkStatus).toEqual(NetworkStatus.refetch);
      }

      {
        const result = await stream.takeNext();

        expect(result.loading).toEqual(false);
        expect(result.data).toEqual(data2);
      }

      await expect(stream).not.toEmitValue();
    });

    it("rerenders with new variables then shows correct data for previous variables", async () => {
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

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result.data).toEqual(data);
        expect(result.loading).toBe(false);
      }

      await observable.setOptions({
        variables: variables2,
        notifyOnNetworkStatusChange: true,
      });

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(true);
        expect(result.networkStatus).toBe(NetworkStatus.setVariables);
      }

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(false);
        expect(result.data).toEqual(data2);
      }

      // go back to first set of variables
      const current = await observable.reobserve({ variables });
      expect(current.data).toEqual(data);
    });

    it("if query is refetched, and an error is returned, no other observer callbacks will be called", async () => {
      const observable = mockWatchQuery(
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

      const stream = new ObservableStream(observable);

      {
        const { data } = await stream.takeNext();

        expect(data).toEqual(dataOne);
      }

      observable.refetch();

      await stream.takeError();

      observable.refetch();

      await expect(stream).not.toEmitValue();
    });

    it("does a network request if fetchPolicy becomes networkOnly", async () => {
      const observable = mockWatchQuery(
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables },
          result: { data: dataTwo },
        }
      );

      const stream = new ObservableStream(observable);

      {
        const { data, loading } = await stream.takeNext();

        expect(loading).toEqual(false);
        expect(data).toEqual(dataOne);
      }

      observable.setOptions({ fetchPolicy: "network-only" });

      {
        const { data, loading } = await stream.takeNext();

        expect(loading).toEqual(false);
        expect(data).toEqual(dataTwo);
      }

      await expect(stream).not.toEmitValue();
    });

    it("does a network request if fetchPolicy is cache-only then store is reset then fetchPolicy becomes not cache-only", async () => {
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

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result.data).toEqual(data);
        expect(timesFired).toBe(1);
      }

      await observable.setOptions({ fetchPolicy: "cache-only" });
      await resetStore(queryManager);

      {
        const result = await stream.takeNext();

        expect(result.data).toEqual({});
        expect(result.loading).toBe(false);
        expect(result.networkStatus).toBe(NetworkStatus.ready);
        expect(timesFired).toBe(1);
      }

      await expect(stream).not.toEmitValue();
    });

    it("does a network request if fetchPolicy changes from cache-only", async () => {
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

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(false);
        expect(result.data).toEqual({});
        expect(timesFired).toBe(0);
      }

      observable.setOptions({ fetchPolicy: "cache-first" });

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(false);
        expect(result.data).toEqual(data);
        expect(timesFired).toBe(1);
      }

      await expect(stream).not.toEmitValue();
    });

    it("can set queries to standby and will not fetch when doing so", async () => {
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

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result.data).toEqual(data);
        expect(timesFired).toBe(1);
      }

      await observable.setOptions({ query, fetchPolicy: "standby" });
      // make sure the query didn't get fired again.
      expect(timesFired).toBe(1);

      await expect(stream).not.toEmitValue();
    });

    it("will not fetch when setting a cache-only query to standby", async () => {
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

      await queryManager.query({ query: testQuery });

      observable = queryManager.watchQuery({
        query: testQuery,
        fetchPolicy: "cache-first",
        notifyOnNetworkStatusChange: false,
      });

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result.data).toEqual(data);
        expect(timesFired).toBe(1);
      }

      await observable.setOptions({ query, fetchPolicy: "standby" });
      // make sure the query didn't get fired again.
      expect(timesFired).toBe(1);

      await expect(stream).not.toEmitValue();
    });

    it("returns a promise which eventually returns data", async () => {
      const observable = mockWatchQuery(
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables },
          result: { data: dataTwo },
        }
      );

      const stream = new ObservableStream(observable);

      const { data } = await stream.takeNext();

      expect(data).toEqual(dataOne);

      const res = await observable.setOptions({
        fetchPolicy: "cache-and-network",
      });

      expect(res.data).toEqual(dataTwo);
    });
  });

  describe("setVariables", () => {
    it("reruns query if the variables change", async () => {
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

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(false);
        expect(result.data).toEqual(dataOne);
      }

      observable.setVariables(differentVariables);

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(true);
        expect(result.networkStatus).toBe(NetworkStatus.setVariables);
      }

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(false);
        expect(result.data).toEqual(dataTwo);
      }

      await expect(stream).not.toEmitValue();
    });

    it("does invalidate the currentResult data if the variables change", async () => {
      const observable = mockWatchQuery(
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

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result.data).toEqual(dataOne);
        expect(observable.getCurrentResult().data).toEqual(dataOne);
      }

      await observable.setVariables(differentVariables);

      {
        const result = await stream.takeNext();

        expect(result.loading).toEqual(false);
        expect(result.data).toEqual(dataTwo);
        expect(observable.getCurrentResult().data).toEqual(dataTwo);
        expect(observable.getCurrentResult().loading).toBe(false);
      }

      await expect(stream).not.toEmitValue();
    });

    it("does invalidate the currentResult data if the variables change", async () => {
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

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result.data).toEqual(dataOne);
        expect(observable.getCurrentResult().data).toEqual(dataOne);
      }

      await observable.setVariables(differentVariables);

      {
        const result = await stream.takeNext();

        expect(result.data).toEqual(dataTwo);
        expect(observable.getCurrentResult().data).toEqual(dataTwo);
        expect(observable.getCurrentResult().loading).toBe(false);
      }

      await expect(stream).not.toEmitValue();
    });

    it("does not invalidate the currentResult errors if the variables change", async () => {
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

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result.errors).toEqual([error]);
        expect(observable.getCurrentResult().errors).toEqual([error]);
      }

      observable.setVariables(differentVariables);
      expect(observable.getCurrentResult().errors).toBeUndefined();

      {
        const result = await stream.takeNext();

        expect(result.data).toEqual(dataTwo);
        expect(observable.getCurrentResult().data).toEqual(dataTwo);
        expect(observable.getCurrentResult().loading).toBe(false);
      }

      await expect(stream).not.toEmitValue();
    });

    it("does not perform a query when unsubscribed if variables change", async () => {
      // Note: no responses, will throw if a query is made
      const queryManager = mockQueryManager();
      const observable = queryManager.watchQuery({ query, variables });

      await observable.setVariables(differentVariables);
    });

    it("sets networkStatus to `setVariables` when fetching", async () => {
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

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(false);
        expect(result.data).toEqual(dataOne);
        expect(result.networkStatus).toBe(NetworkStatus.ready);
      }

      observable.setVariables(differentVariables);

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(true);
        expect(result.networkStatus).toBe(NetworkStatus.setVariables);
      }

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(false);
        expect(result.networkStatus).toBe(NetworkStatus.ready);
        expect(result.data).toEqual(dataTwo);
      }

      await expect(stream).not.toEmitValue();
    });

    it("sets networkStatus to `setVariables` when calling refetch with new variables", async () => {
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

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(false);
        expect(result.data).toEqual(dataOne);
        expect(result.networkStatus).toBe(NetworkStatus.ready);
      }

      observable.refetch(differentVariables);

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(true);
        expect(result.networkStatus).toBe(NetworkStatus.setVariables);
      }

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(false);
        expect(result.networkStatus).toBe(NetworkStatus.ready);
        expect(result.data).toEqual(dataTwo);
      }

      await expect(stream).not.toEmitValue();
    });

    it("does not rerun query if variables do not change", async () => {
      const observable = mockWatchQuery(
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables },
          result: { data: dataTwo },
        }
      );

      const stream = new ObservableStream(observable);

      const result = await stream.takeNext();

      expect(result.data).toEqual(dataOne);

      observable.setVariables(variables);

      await expect(stream).not.toEmitValue();
    });

    it("handles variables changing while a query is in-flight", async () => {
      // The expected behavior is that the original variables are forgotten
      // and the query stays in loading state until the result for the new variables
      // has returned.
      const observable = mockWatchQuery(
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

      const stream = new ObservableStream(observable);

      observable.setVariables(differentVariables);

      const result = await stream.takeNext();

      expect(result.networkStatus).toBe(NetworkStatus.ready);
      expect(result.loading).toBe(false);
      expect(result.data).toEqual(dataTwo);

      await expect(stream).not.toEmitValue();
    });
  });

  describe("refetch", () => {
    it("calls fetchRequest with fetchPolicy `network-only` when using a non-networked fetch policy", async () => {
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
      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result).toEqual({
          loading: false,
          networkStatus: NetworkStatus.ready,
          data: dataOne,
        });
      }

      observable.refetch(differentVariables);

      {
        const result = await stream.takeNext();

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
      }

      await expect(stream).not.toEmitValue();
    });

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

      const result = await stream.takeNext();

      expect(result).toEqual({
        loading: false,
        networkStatus: NetworkStatus.ready,
        data: dataTwo,
      });

      await expect(stream).not.toEmitValue();
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

    it("calls fetchRequest with fetchPolicy `no-cache` when using `no-cache` fetch policy", async () => {
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
      const stream = new ObservableStream(observable);

      await stream.takeNext();
      observable.refetch(differentVariables);

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
    });

    it("calls ObservableQuery.next even after hitting cache", async () => {
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

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result.data).toEqual(data);
        expect(result.loading).toBe(false);
        observable.refetch(variables2);
      }

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(true);
        expect(result.networkStatus).toBe(NetworkStatus.setVariables);
      }

      {
        const result = await stream.takeNext();

        expect(result.data).toEqual(data2);
        expect(result.loading).toBe(false);
        observable.refetch(variables1);
      }

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(true);
        expect(result.networkStatus).toBe(NetworkStatus.setVariables);
      }

      {
        const result = await stream.takeNext();

        expect(result.data).toEqual(data);
        expect(result.loading).toBe(false);
      }
    });

    it("resets fetchPolicy when variables change when using nextFetchPolicy", async () => {
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

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result.data).toEqual(data);
        expect(result.loading).toBe(false);
        expect(result.error).toBeUndefined();
        expect(observable.options.fetchPolicy).toBe("cache-first");
      }

      observable.refetch(variables2);

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(true);
        expect(result.networkStatus).toBe(NetworkStatus.setVariables);
        expect(result.error).toBeUndefined();
        expect(observable.options.fetchPolicy).toBe("cache-first");
      }

      {
        const result = await stream.takeNext();

        expect(result.data).toEqual(data2);
        expect(result.loading).toBe(false);
        expect(result.error).toBeUndefined();
        expect(observable.options.fetchPolicy).toBe("cache-first");
      }

      {
        const result = await observable.setOptions({ variables: variables1 });

        expect(result.data).toEqual(data);
        expect(observable.options.fetchPolicy).toBe("cache-first");
      }

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(true);
        expect(result.networkStatus).toBe(NetworkStatus.setVariables);
        expect(result.error).toBeUndefined();
        expect(observable.options.fetchPolicy).toBe("cache-first");
      }

      {
        const result = await stream.takeNext();

        expect(result.data).toEqual(data);
        expect(result.loading).toBe(false);
        expect(result.error).toBeUndefined();
        expect(observable.options.fetchPolicy).toBe("cache-first");
      }

      {
        const result = await observable.reobserve({ variables: variables2 });

        expect(result.data).toEqual(data2);
        expect(observable.options.fetchPolicy).toBe("cache-first");
      }

      {
        const result = await stream.takeNext();

        expect(result.data).toEqual(data2);
        expect(result.loading).toBe(true);
        expect(result.error).toBeUndefined();
        expect(observable.options.fetchPolicy).toBe("cache-first");
      }

      {
        const result = await stream.takeNext();

        expect(result.data).toEqual(data2);
        expect(result.loading).toBe(false);
        expect(result.error).toBeUndefined();
        expect(observable.options.fetchPolicy).toBe("cache-first");
      }

      expect(usedFetchPolicies).toEqual([
        "cache-and-network",
        "network-only",
        "cache-and-network",
        "cache-and-network",
      ]);

      await expect(stream).not.toEmitValue();
    });

    it("cache-and-network refetch should run @client(always: true) resolvers when network request fails", async () => {
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
        link: new ApolloLink(() => linkObservable),
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

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result).toEqual({
          data: {
            counter: 1,
          },
          loading: true,
          networkStatus: NetworkStatus.loading,
          partial: true,
        });
      }

      {
        const result = await stream.takeNext();

        expect(result).toEqual({
          data: {
            counter: 2,
            name: "Ben",
          },
          loading: false,
          networkStatus: NetworkStatus.ready,
        });
      }

      const oldLinkObs = linkObservable;
      // Make the next network request fail.
      linkObservable = errorObservable;

      try {
        await observable.refetch();
        throw new Error("Refetch should have errored");
      } catch (error) {
        expect(error).toBe(intentionalNetworkFailure);
      }

      {
        const result = await stream.takeNext();

        expect(result).toEqual({
          data: {
            counter: 3,
            name: "Ben",
          },
          loading: true,
          networkStatus: NetworkStatus.refetch,
        });
      }

      {
        const error = await stream.takeError();

        expect(error).toBe(intentionalNetworkFailure);
      }

      // Switch back from errorObservable.
      linkObservable = oldLinkObs;

      {
        const result = await observable.refetch();

        expect(result).toEqual({
          data: {
            counter: 5,
            name: "Ben",
          },
          loading: false,
          networkStatus: NetworkStatus.ready,
        });
      }

      await expect(stream).not.toEmitValue();
    });

    describe("warnings about refetch({ variables })", () => {
      it("should warn if passed { variables } and query does not declare any variables", async () => {
        using _ = spyOnConsole("warn");

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

        const observableWithoutVariables = mockWatchQuery(
          makeMock("a", "b", "c"),
          makeMock("d", "e")
        );

        const stream = new ObservableStream(observableWithoutVariables);

        {
          const result = await stream.takeNext();

          expect(result.error).toBeUndefined();
          expect(result.loading).toBe(false);
          expect(result.data).toEqual({
            getVars: [
              { __typename: "Var", name: "a" },
              { __typename: "Var", name: "b" },
              { __typename: "Var", name: "c" },
            ],
          });
        }

        await observableWithoutVariables.refetch({
          variables: ["d", "e"],
        });

        {
          const result = await stream.takeNext();

          expect(result.error).toBeUndefined();
          expect(result.loading).toBe(false);
          expect(result.data).toEqual({
            getVars: [
              { __typename: "Var", name: "d" },
              { __typename: "Var", name: "e" },
            ],
          });

          expect(console.warn).toHaveBeenCalledTimes(1);
          expect(console.warn).toHaveBeenCalledWith(
            [
              "Called refetch(%o) for query %o, which does not declare a $variables variable.",
              "Did you mean to call refetch(variables) instead of refetch({ variables })?",
            ].join("\n"),
            { variables: ["d", "e"] },
            "QueryWithoutVariables"
          );
        }

        await expect(stream).not.toEmitValue();
      });

      it("should warn if passed { variables } and query does not declare $variables", async () => {
        using _ = spyOnConsole("warn");

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

        const stream = new ObservableStream(observableWithVarsVar);

        {
          const result = await stream.takeNext();

          expect(result.loading).toBe(false);
          expect(result.error).toBeUndefined();
          expect(result.data).toEqual({
            getVars: [
              { __typename: "Var", name: "a" },
              { __typename: "Var", name: "b" },
              { __typename: "Var", name: "c" },
            ],
          });
        }

        // It's a common mistake to call refetch({ variables }) when you meant
        // to call refetch(variables).
        const promise = observableWithVarsVar.refetch({
          // @ts-expect-error
          variables: { vars: ["d", "e"] },
        });

        {
          const error = await stream.takeError();

          expect(error.message).toMatch(
            "No more mocked responses for the query: query QueryWithVarsVar($vars: [String!])"
          );
        }

        await promise.then(
          (result) => {
            throw new Error(
              `unexpected result ${JSON.stringify(result)}; should have thrown`
            );
          },
          (error) => {
            expect((error as Error).message).toMatch(
              "No more mocked responses for the query: query QueryWithVarsVar($vars: [String!])"
            );
            expect(console.warn).toHaveBeenCalledTimes(1);
            expect(console.warn).toHaveBeenCalledWith(
              [
                "Called refetch(%o) for query %o, which does not declare a $variables variable.",
                "Did you mean to call refetch(variables) instead of refetch({ variables })?",
              ].join("\n"),
              { variables: { vars: ["d", "e"] } },
              "QueryWithVarsVar"
            );
          }
        );

        await expect(stream).not.toEmitValue();
      });

      it("should not warn if passed { variables } and query declares $variables", async () => {
        using _ = spyOnConsole("warn");

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

        const observableWithVariablesVar = mockWatchQuery(
          makeMock("a", "b", "c"),
          makeMock("d", "e")
        );

        const stream = new ObservableStream(observableWithVariablesVar);

        {
          const result = await stream.takeNext();

          expect(result.loading).toBe(false);
          expect(result.error).toBeUndefined();
          expect(result.data).toEqual({
            getVars: [
              { __typename: "Var", name: "a" },
              { __typename: "Var", name: "b" },
              { __typename: "Var", name: "c" },
            ],
          });
        }

        observableWithVariablesVar.refetch({ variables: ["d", "e"] });

        {
          const result = await stream.takeNext();

          expect(result.loading).toBe(false);
          expect(result.error).toBeUndefined();
          expect(result.data).toEqual({
            getVars: [
              { __typename: "Var", name: "d" },
              { __typename: "Var", name: "e" },
            ],
          });

          expect(console.warn).not.toHaveBeenCalled();
        }

        await expect(stream).not.toEmitValue();
      });
    });
  });

  describe("currentResult", () => {
    it("returns the same value as observableQuery.next got", async () => {
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
      );

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

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(false);
        expect(result.networkStatus).toEqual(NetworkStatus.ready);
        expect(result.data).toEqual(dataOneWithTypename);
        expect(observable.getCurrentResult()).toEqual(result);
      }

      observable.refetch();

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(true);
        expect(result.networkStatus).toEqual(NetworkStatus.refetch);
        expect(observable.getCurrentResult()).toEqual(result);
      }

      {
        const result = await stream.takeNext();

        expect(result.loading).toBe(false);
        expect(result.networkStatus).toEqual(NetworkStatus.ready);
        expect(result.data).toEqual(dataTwoWithTypename);
        expect(observable.getCurrentResult()).toEqual(result);
      }

      await expect(stream).not.toEmitValue();
    });

    it("returns the current query status immediately", async () => {
      const observable = mockWatchQuery({
        request: { query, variables },
        result: { data: dataOne },
        delay: 100,
      });

      const stream = new ObservableStream(observable);

      expect(observable.getCurrentResult()).toEqual({
        loading: true,
        data: undefined,
        networkStatus: 1,
        partial: true,
      });

      await tick();

      expect(observable.getCurrentResult()).toEqual({
        loading: true,
        data: undefined,
        networkStatus: 1,
        partial: true,
      });

      await stream.takeNext();

      expect(observable.getCurrentResult()).toEqual({
        data: dataOne,
        loading: false,
        networkStatus: 7,
      });
    });

    it("returns results from the store immediately", async () => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { data: dataOne },
      });

      const result = await queryManager.query({ query, variables });

      expect(result).toEqual({
        data: dataOne,
        loading: false,
        networkStatus: 7,
      });

      const observable = queryManager.watchQuery({ query, variables });

      expect(observable.getCurrentResult()).toEqual({
        data: dataOne,
        loading: false,
        networkStatus: NetworkStatus.ready,
      });
    });

    it("returns errors from the store immediately", async () => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { errors: [error] },
      });

      const observable = queryManager.watchQuery({ query, variables });
      const stream = new ObservableStream(observable);

      const theError = await stream.takeError();
      const currentResult = observable.getCurrentResult();

      expect(theError.graphQLErrors).toEqual([error]);
      expect(currentResult.loading).toBe(false);
      expect(currentResult.error!.graphQLErrors).toEqual([error]);
    });

    it("returns referentially equal errors", async () => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { errors: [error] },
      });

      const observable = queryManager.watchQuery({ query, variables });

      await observable.result().catch((theError: any) => {
        expect(theError.graphQLErrors).toEqual([error]);
      });

      const currentResult = observable.getCurrentResult();
      const currentResult2 = observable.getCurrentResult();

      expect(currentResult.loading).toBe(false);
      expect(currentResult.error!.graphQLErrors).toEqual([error]);
      expect(currentResult.error === currentResult2.error).toBe(true);
    });

    it("returns errors with data if errorPolicy is all", async () => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { data: dataOne, errors: [error] },
      });

      const observable = queryManager.watchQuery({
        query,
        variables,
        errorPolicy: "all",
      });

      const result = await observable.result();
      const currentResult = observable.getCurrentResult();

      expect(result.data).toEqual(dataOne);
      expect(result.errors).toEqual([error]);
      expect(currentResult.loading).toBe(false);
      expect(currentResult.errors).toEqual([error]);
      expect(currentResult.error).toBeUndefined();
    });

    it("errors out if errorPolicy is none", async () => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { data: dataOne, errors: [error] },
      });

      const observable = queryManager.watchQuery({
        query,
        variables,
        errorPolicy: "none",
      });

      await expect(observable.result()).rejects.toEqual(wrappedError);

      expect(observable.getLastError()).toEqual(wrappedError);
    });

    it("errors out if errorPolicy is none and the observable has completed", async () => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { data: dataOne, errors: [error] },
      });

      const observable = queryManager.watchQuery({
        query,
        variables,
        errorPolicy: "none",
      });

      await expect(observable.result()).rejects.toEqual(wrappedError);
      await expect(observable.result()).rejects.toEqual(wrappedError);

      expect(observable.getLastError()).toEqual(wrappedError);
    });

    it("ignores errors with data if errorPolicy is ignore", async () => {
      const queryManager = mockQueryManager({
        request: { query, variables },
        result: { errors: [error], data: dataOne },
      });

      const observable = queryManager.watchQuery({
        query,
        variables,
        errorPolicy: "ignore",
      });

      const result = await observable.result();
      const currentResult = observable.getCurrentResult();

      expect(result.data).toEqual(dataOne);
      expect(result.errors).toBeUndefined();
      expect(currentResult.loading).toBe(false);
      expect(currentResult.errors).toBeUndefined();
      expect(currentResult.error).toBeUndefined();
    });

    it("returns partial data from the store immediately", async () => {
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

      await queryManager.query({ query, variables });

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

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();
        const current = observable.getCurrentResult();

        expect(result).toEqual({
          data: dataOne,
          loading: true,
          networkStatus: 1,
          partial: true,
        });
        expect(current.data).toEqual(dataOne);
        expect(current.loading).toEqual(true);
        expect(current.networkStatus).toEqual(1);
      }

      {
        const result = await stream.takeNext();
        const current = observable.getCurrentResult();

        expect(result).toEqual({
          data: superDataOne,
          loading: false,
          networkStatus: 7,
        });
        expect(current.data).toEqual(superDataOne);
        expect(current.loading).toEqual(false);
        expect(current.networkStatus).toEqual(7);
      }

      await expect(stream).not.toEmitValue();
    });

    it("returns loading even if full data is available when using network-only fetchPolicy", async () => {
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

      const result = await queryManager.query({ query, variables });

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

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();

        expect(result).toEqual({
          loading: true,
          data: undefined,
          networkStatus: NetworkStatus.loading,
        });
      }

      {
        const result = await stream.takeNext();

        expect(result).toEqual({
          data: dataTwo,
          loading: false,
          networkStatus: NetworkStatus.ready,
        });
      }

      await expect(stream).not.toEmitValue();
    });

    it("returns loading on no-cache fetchPolicy queries when calling getCurrentResult", async () => {
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

      await queryManager.query({ query, variables });

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

      const stream = new ObservableStream(observable);

      {
        const result = await stream.takeNext();
        const current = observable.getCurrentResult();

        expect(result).toEqual({
          data: undefined,
          loading: true,
          networkStatus: NetworkStatus.loading,
        });
        expect(current.data).toBeUndefined();
        expect(current.loading).toBe(true);
        expect(current.networkStatus).toBe(NetworkStatus.loading);
      }

      {
        const result = await stream.takeNext();
        const current = observable.getCurrentResult();

        expect(result).toEqual({
          data: dataTwo,
          loading: false,
          networkStatus: NetworkStatus.ready,
        });
        expect(current.data).toEqual(dataTwo);
        expect(current.loading).toBe(false);
        expect(current.networkStatus).toBe(NetworkStatus.ready);
      }
    });

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

      it("returns optimistic mutation results from the store", async () => {
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

        const stream = new ObservableStream(observable);

        {
          const result = await stream.takeNext();

          expect(result).toEqual({
            data: dataOne,
            loading: false,
            networkStatus: 7,
          });
          expect(observable.getCurrentResult()).toEqual(result);
        }

        queryManager.mutate({
          mutation,
          optimisticResponse,
          updateQueries,
        });

        {
          const result = await stream.takeNext();

          expect(observable.getCurrentResult()).toEqual(result);
          expect(result.data.people_one).toEqual(optimisticResponse);
        }

        {
          const result = await stream.takeNext();

          expect(observable.getCurrentResult()).toEqual(result);
          expect(result.data.people_one).toEqual(mutationData);
        }

        await expect(stream).not.toEmitValue();
      });
    });
  });

  describe("assumeImmutableResults", () => {
    it("should prevent costly (but safe) cloneDeep calls", async () => {
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
    });
  });

  describe("resetQueryStoreErrors", () => {
    it("should remove any GraphQLError's stored in the query store", async () => {
      const graphQLError = new GraphQLError("oh no!");

      const observable = mockWatchQuery({
        request: { query, variables },
        result: { errors: [graphQLError] },
      });

      await new Promise<void>((resolve) => {
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
      });
    });

    it("should remove network error's stored in the query store", async () => {
      const networkError = new Error("oh no!");

      const observable = mockWatchQuery({
        request: { query, variables },
        result: { data: dataOne },
      });

      const stream = new ObservableStream(observable);

      await stream.takeNext();

      const { queryManager } = observable as any;
      const queryInfo = queryManager["queries"].get(observable.queryId);
      queryInfo.networkError = networkError;
      observable.resetQueryStoreErrors();
      expect(queryInfo.networkError).toBeUndefined();
    });
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

  it("QueryInfo does not notify for !== but deep-equal results", async () => {
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

    const stream = new ObservableStream(observable);

    const result = await stream.takeNext();

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

    await wait(100);

    expect(setDiffSpy).toHaveBeenCalledTimes(1);
    expect(notifySpy).not.toHaveBeenCalled();
    expect(invalidateCount).toBe(1);
    expect(onWatchUpdatedCount).toBe(1);
    queryManager.stop();

    await expect(stream).not.toEmitValue();
  });

  it("ObservableQuery#map respects Symbol.species", async () => {
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

    await new Promise<void>((resolve, reject) => {
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
