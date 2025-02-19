import { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { waitFor } from "@testing-library/react";
import { expectTypeOf } from "expect-type";
import { GraphQLError } from "graphql";
import { gql } from "graphql-tag";
import { map, Observable, of, Subject } from "rxjs";
import { Observer } from "rxjs";

import { InMemoryCache } from "@apollo/client/cache";
import {
  ApolloClient,
  ApolloQueryResult,
  NetworkStatus,
  WatchQueryFetchPolicy,
} from "@apollo/client/core";
import { ApolloError } from "@apollo/client/errors";
import { ApolloLink, FetchResult } from "@apollo/client/link/core";
import {
  MockLink,
  MockSubscriptionLink,
  tick,
  wait,
} from "@apollo/client/testing";
import {
  DeepPartial,
  DocumentTransform,
  removeDirectivesFromDocument,
} from "@apollo/client/utilities";

import {
  ObservableStream,
  spyOnConsole,
} from "../../testing/internal/index.js";
import { ObservableQuery } from "../ObservableQuery.js";
import type { ConcastAndInfo, SourcesAndInfo } from "../QueryManager.js";
import { QueryManager } from "../QueryManager.js";

export const mockFetchQuery = (queryManager: QueryManager<any>) => {
  const mocks = {
    fetchConcastWithInfo: jest.fn<
      ConcastAndInfo<unknown>,
      Parameters<QueryManager<any>["fetchConcastWithInfo"]>
    >(queryManager["fetchConcastWithInfo"].bind(queryManager)),
    fetchQueryByPolicy: jest.fn<
      SourcesAndInfo<unknown>,
      Parameters<QueryManager<any>["fetchQueryByPolicy"]>
    >(queryManager["fetchQueryByPolicy"].bind(queryManager)),
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

  describe("setOptions", () => {
    describe("to change pollInterval", () => {
      it("starts polling if goes from 0 -> something", async () => {
        const client = new ApolloClient({
          cache: new InMemoryCache(),
          link: new MockLink([
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
            },
          ]),
        });

        const observable = client.watchQuery({
          query,
          variables,
          notifyOnNetworkStatusChange: false,
        });

        const stream = new ObservableStream(observable);

        await expect(stream).toEmitApolloQueryResult({
          data: dataOne,
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await observable.setOptions({ query, pollInterval: 10 });

        await expect(stream).toEmitApolloQueryResult({
          data: dataTwo,
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        observable.stopPolling();

        await expect(stream).not.toEmitAnything();
      });

      it("stops polling if goes from something -> 0", async () => {
        const client = new ApolloClient({
          cache: new InMemoryCache(),
          link: new MockLink([
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
            },
          ]),
        });

        const observable = client.watchQuery({
          query,
          variables,
          pollInterval: 10,
        });

        const stream = new ObservableStream(observable);

        await expect(stream).toEmitApolloQueryResult({
          data: dataOne,
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await observable.setOptions({ query, pollInterval: 0 });

        await expect(stream).not.toEmitAnything();
      });

      it("can change from x>0 to y>0", async () => {
        const client = new ApolloClient({
          cache: new InMemoryCache(),
          link: new MockLink([
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
            },
          ]),
        });

        const observable = client.watchQuery({
          query,
          variables,
          pollInterval: 100,
          notifyOnNetworkStatusChange: false,
        });

        const stream = new ObservableStream(observable);

        await expect(stream).toEmitApolloQueryResult({
          data: dataOne,
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await observable.setOptions({ query, pollInterval: 10 });

        await expect(stream).toEmitApolloQueryResult({
          data: dataTwo,
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        observable.stopPolling();

        await expect(stream).not.toEmitAnything();
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

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
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
        ]),
      });

      const observable = client.watchQuery({
        query: queryWithVars,
        variables: variables1,
        notifyOnNetworkStatusChange: true,
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await observable.refetch(variables2);

      await expect(stream).toEmitApolloQueryResult({
        data: undefined,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        partial: true,
      });

      await expect(stream).toEmitApolloQueryResult({
        data: data2,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
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

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
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
          },
        ]),
      });

      const observable = client.watchQuery({
        query,
        variables,
        notifyOnNetworkStatusChange: true,
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await observable.refetch();

      await expect(stream).toEmitApolloQueryResult({
        data,
        loading: true,
        networkStatus: NetworkStatus.refetch,
        partial: false,
      });

      await expect(stream).toEmitApolloQueryResult({
        data: data2,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
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

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { data },
          },
          {
            request: { query, variables: variables2 },
            result: { data: data2 },
          },
        ]),
      });
      const observable = client.watchQuery({ query, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await observable.setOptions({
        variables: variables2,
        notifyOnNetworkStatusChange: true,
      });

      await expect(stream).toEmitApolloQueryResult({
        data: undefined,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        partial: true,
      });

      await expect(stream).toEmitApolloQueryResult({
        data: data2,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      // go back to first set of variables
      const current = await observable.reobserve({ variables });
      expect(current).toEqualApolloQueryResult({
        data,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).toEmitApolloQueryResult({
        data,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("if query is refetched, and an error is returned, can refetch again with successful result", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
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
          },
        ]),
      });
      const observable = client.watchQuery({ query, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data: dataOne,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(observable.refetch()).rejects.toThrow(
        new ApolloError({ graphQLErrors: [error] })
      );

      await expect(stream).toEmitApolloQueryResult({
        data: dataOne,
        error: new ApolloError({ graphQLErrors: [error] }),
        errors: [error],
        loading: false,
        networkStatus: NetworkStatus.error,
        partial: false,
      });

      await expect(observable.refetch()).resolves.toEqualApolloQueryResult({
        data: dataOne,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).toEmitApolloQueryResult({
        data: dataOne,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("does a network request if fetchPolicy becomes networkOnly", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables },
            result: { data: dataTwo },
          },
        ]),
      });

      const observable = client.watchQuery({ query, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data: dataOne,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await observable.setOptions({ fetchPolicy: "network-only" });

      await expect(stream).toEmitApolloQueryResult({
        data: dataTwo,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
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

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link,
      });
      // fetch first data from server
      const observable = client.watchQuery({
        query: testQuery,
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      expect(timesFired).toBe(1);

      await observable.setOptions({ fetchPolicy: "cache-only" });
      await client.resetStore();

      await expect(stream).toEmitApolloQueryResult({
        data: undefined,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: true,
      });

      expect(timesFired).toBe(1);

      await expect(stream).not.toEmitAnything();
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

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link,
      });

      const observable = client.watchQuery({
        query: testQuery,
        fetchPolicy: "cache-only",
        notifyOnNetworkStatusChange: false,
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data: undefined,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: true,
      });
      expect(timesFired).toBe(0);

      await observable.setOptions({ fetchPolicy: "cache-first" });

      await expect(stream).toEmitApolloQueryResult({
        data,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(timesFired).toBe(1);
      await expect(stream).not.toEmitAnything();
    });

    it("can set queries to standby and will not fetch when doing so", async () => {
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
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link,
      });
      const observable = client.watchQuery({
        query: testQuery,
        fetchPolicy: "cache-first",
        notifyOnNetworkStatusChange: false,
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(timesFired).toBe(1);

      await observable.setOptions({ query, fetchPolicy: "standby" });

      // make sure the query didn't get fired again.
      await expect(stream).not.toEmitAnything();
      expect(timesFired).toBe(1);
    });

    it("will not fetch when setting a cache-only query to standby", async () => {
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
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link,
      });

      await client.query({ query: testQuery });

      const observable = client.watchQuery({
        query: testQuery,
        fetchPolicy: "cache-only",
        notifyOnNetworkStatusChange: false,
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      expect(timesFired).toBe(1);

      await observable.setOptions({ query, fetchPolicy: "standby" });

      // make sure the query didn't get fired again.
      await expect(stream).not.toEmitAnything();
      expect(timesFired).toBe(1);
    });

    it("returns a promise which eventually returns data", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables },
            result: { data: dataTwo },
          },
        ]),
      });
      const observable = client.watchQuery({ query, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data: dataOne,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      const res = await observable.setOptions({
        fetchPolicy: "cache-and-network",
      });

      expect(res).toEqualApolloQueryResult({
        data: dataTwo,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).toEmitApolloQueryResult({
        data: dataOne,
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: false,
      });

      await expect(stream).toEmitApolloQueryResult({
        data: dataTwo,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });
  });

  describe("setVariables", () => {
    it("reruns query if the variables change", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables: differentVariables },
            result: { data: dataTwo },
          },
        ]),
      });

      const observable = client.watchQuery({
        query,
        variables,
        notifyOnNetworkStatusChange: true,
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data: dataOne,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await observable.setVariables(differentVariables);

      await expect(stream).toEmitApolloQueryResult({
        data: undefined,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        partial: true,
      });

      await expect(stream).toEmitApolloQueryResult({
        data: dataTwo,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("does invalidate the currentResult data if the variables change", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables: differentVariables },
            result: { data: dataTwo },
            delay: 25,
          },
        ]),
      });
      const observable = client.watchQuery({ query, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data: dataOne,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.getCurrentResult()).toEqualApolloQueryResult({
        data: dataOne,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await observable.setVariables(differentVariables);

      await expect(stream).toEmitApolloQueryResult({
        data: dataTwo,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.getCurrentResult()).toEqualApolloQueryResult({
        data: dataTwo,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    // TODO: Determine how this test differs from the previous one
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

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables: differentVariables },
            result: { data: dataTwo },
            delay: 25,
          },
        ]),
      });
      const observable = client.watchQuery({ query, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data: dataOne,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.getCurrentResult()).toEqualApolloQueryResult({
        data: dataOne,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await observable.setVariables(differentVariables);

      await expect(stream).toEmitApolloQueryResult({
        data: dataTwo,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.getCurrentResult()).toEqualApolloQueryResult({
        data: dataTwo,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("does not invalidate the currentResult errors if the variables change", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { errors: [error] },
          },
          {
            request: { query, variables: differentVariables },
            result: { data: dataTwo },
          },
        ]),
      });

      const observable = client.watchQuery({
        query,
        variables,
        errorPolicy: "all",
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data: undefined,
        errors: [error],
        loading: false,
        networkStatus: NetworkStatus.error,
        partial: true,
      });
      expect(observable.getCurrentResult()).toEqualApolloQueryResult({
        data: undefined,
        errors: [error],
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: true,
      });

      await observable.setVariables(differentVariables);

      await expect(stream).toEmitApolloQueryResult({
        data: dataTwo,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.getCurrentResult()).toEqualApolloQueryResult({
        data: dataTwo,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("does not perform a query when unsubscribed if variables change", async () => {
      // Note: no responses, will throw if a query is made
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([]),
      });
      const observable = client.watchQuery({ query, variables });

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

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink(mockedResponses),
      });
      const firstRequest = mockedResponses[0].request;
      const observable = client.watchQuery({
        query: firstRequest.query,
        variables: firstRequest.variables,
        notifyOnNetworkStatusChange: true,
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data: dataOne,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await observable.setVariables(differentVariables);

      await expect(stream).toEmitApolloQueryResult({
        data: undefined,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        partial: true,
      });

      await expect(stream).toEmitApolloQueryResult({
        data: dataTwo,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
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

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink(mockedResponses),
      });
      const firstRequest = mockedResponses[0].request;
      const observable = client.watchQuery({
        query: firstRequest.query,
        variables: firstRequest.variables,
        notifyOnNetworkStatusChange: true,
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data: dataOne,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await observable.refetch(differentVariables);

      await expect(stream).toEmitApolloQueryResult({
        data: undefined,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        partial: true,
      });

      await expect(stream).toEmitApolloQueryResult({
        data: dataTwo,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("does not rerun query if variables do not change", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables },
            result: { data: dataTwo },
          },
        ]),
      });
      const observable = client.watchQuery({ query, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data: dataOne,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await observable.setVariables(variables);

      await expect(stream).not.toEmitAnything();
    });

    it("handles variables changing while a query is in-flight", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { data: dataOne },
            delay: 20,
          },
          {
            request: { query, variables: differentVariables },
            result: { data: dataTwo },
            delay: 20,
          },
        ]),
      });
      // The expected behavior is that the original variables are forgotten
      // and the query stays in loading state until the result for the new variables
      // has returned.
      const observable = client.watchQuery({ query, variables });
      const stream = new ObservableStream(observable);

      await observable.setVariables(differentVariables);

      await expect(stream).toEmitApolloQueryResult({
        data: dataTwo,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
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

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink(mockedResponses),
      });
      const firstRequest = mockedResponses[0].request;
      const observable = client.watchQuery({
        query: firstRequest.query,
        variables: firstRequest.variables,
        fetchPolicy: "cache-first",
      });

      // TODO: Determine if we can test this without reaching into internal
      // implementation details
      const mocks = mockFetchQuery(client["queryManager"]);
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data: dataOne,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await observable.refetch(differentVariables);

      await expect(stream).toEmitApolloQueryResult({
        data: dataTwo,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
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

      await expect(stream).not.toEmitAnything();
    });

    it("calling refetch with different variables before the query itself resolved will only yield the result for the new variables", async () => {
      const observers: Observer<FetchResult<typeof dataOne>>[] = [];
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new ApolloLink((operation, forward) => {
          return new Observable((observer) => {
            observers.push(observer);
          });
        }),
      });
      const observableQuery = client.watchQuery({
        query,
        variables: { id: 1 },
      });
      const stream = new ObservableStream(observableQuery);

      void observableQuery.refetch({ id: 2 });

      observers[0].next({ data: dataOne });
      observers[0].complete();

      observers[1].next({ data: dataTwo });
      observers[1].complete();

      await expect(stream).toEmitApolloQueryResult({
        data: dataTwo,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("calling refetch multiple times with different variables will return only results for the most recent variables", async () => {
      const observers: Observer<FetchResult<typeof dataOne>>[] = [];
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new ApolloLink((operation, forward) => {
          return new Observable((observer) => {
            observers.push(observer);
          });
        }),
      });
      const observableQuery = client.watchQuery({
        query,
        variables: { id: 1 },
      });
      const stream = new ObservableStream(observableQuery);

      observers[0].next({ data: dataOne });
      observers[0].complete();

      await expect(stream).toEmitApolloQueryResult({
        data: dataOne,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      void observableQuery.refetch({ id: 2 });
      void observableQuery.refetch({ id: 3 });

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

      await expect(stream).toEmitApolloQueryResult({
        data: {
          people_one: {
            name: "SomeOneElse",
          },
        },
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
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

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink(mockedResponses),
      });
      const firstRequest = mockedResponses[0].request;
      const observable = client.watchQuery({
        query: firstRequest.query,
        variables: firstRequest.variables,
        fetchPolicy: "no-cache",
      });

      // TODO: Determine how we can test this without looking at internal
      // implementation details
      const mocks = mockFetchQuery(client["queryManager"]);
      const stream = new ObservableStream(observable);

      await stream.takeNext();
      await observable.refetch(differentVariables);

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

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
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
        ]),
      });

      const observable = client.watchQuery({
        query: queryWithVars,
        variables: variables1,
        fetchPolicy: "cache-and-network",
        notifyOnNetworkStatusChange: true,
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await observable.refetch(variables2);

      await expect(stream).toEmitApolloQueryResult({
        data: undefined,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        partial: true,
      });

      await expect(stream).toEmitApolloQueryResult({
        data: data2,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await observable.refetch(variables1);

      await expect(stream).toEmitApolloQueryResult({
        data,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        partial: false,
      });

      await expect(stream).toEmitApolloQueryResult({
        data,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
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

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
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
          },
        ]),
      });

      const usedFetchPolicies: WatchQueryFetchPolicy[] = [];
      const observable = client.watchQuery({
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

      await expect(stream).toEmitApolloQueryResult({
        data,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.options.fetchPolicy).toBe("cache-first");

      await observable.refetch(variables2);

      await expect(stream).toEmitApolloQueryResult({
        data: undefined,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        partial: true,
      });
      expect(observable.options.fetchPolicy).toBe("cache-first");

      await expect(stream).toEmitApolloQueryResult({
        data: data2,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.options.fetchPolicy).toBe("cache-first");

      {
        const result = await observable.setOptions({ variables: variables1 });

        expect(result).toEqualApolloQueryResult({
          data,
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });
        expect(observable.options.fetchPolicy).toBe("cache-first");
      }

      await expect(stream).toEmitApolloQueryResult({
        data,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        partial: false,
      });
      expect(observable.options.fetchPolicy).toBe("cache-first");

      await expect(stream).toEmitApolloQueryResult({
        data,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.options.fetchPolicy).toBe("cache-first");

      {
        const result = await observable.reobserve({ variables: variables2 });

        expect(result).toEqualApolloQueryResult({
          data: data2,
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });
        expect(observable.options.fetchPolicy).toBe("cache-first");
      }

      await expect(stream).toEmitApolloQueryResult({
        data: data2,
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        partial: false,
      });
      expect(observable.options.fetchPolicy).toBe("cache-first");

      await expect(stream).toEmitApolloQueryResult({
        data: data2,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.options.fetchPolicy).toBe("cache-first");

      expect(usedFetchPolicies).toEqual([
        "cache-and-network",
        "network-only",
        "cache-and-network",
        "cache-and-network",
      ]);

      await expect(stream).not.toEmitAnything();
    });

    it("cache-and-network refetch should run @client(always: true) resolvers when network request fails", async () => {
      const query = gql`
        query MixedQuery {
          counter @client(always: true)
          name
        }
      `;

      let count = 0;

      let linkObservable = of({
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
        notifyOnNetworkStatusChange: true,
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data: { counter: 1 },
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitApolloQueryResult({
        data: { counter: 2, name: "Ben" },
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      const oldLinkObs = linkObservable;
      // Make the next network request fail.
      linkObservable = errorObservable;

      await expect(() => observable.refetch()).rejects.toThrow(
        intentionalNetworkFailure
      );

      await expect(stream).toEmitApolloQueryResult({
        data: { counter: 3, name: "Ben" },
        loading: true,
        networkStatus: NetworkStatus.refetch,
        partial: false,
      });

      await expect(stream).toEmitApolloQueryResult({
        data: { counter: 3, name: "Ben" },
        error: intentionalNetworkFailure,
        errors: [],
        loading: false,
        networkStatus: NetworkStatus.error,
        partial: false,
      });

      // Switch back from errorObservable.
      linkObservable = oldLinkObs;

      const result = await observable.refetch();

      expect(result).toEqualApolloQueryResult({
        data: {
          counter: 5,
          name: "Ben",
        },
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).toEmitApolloQueryResult({
        data: { counter: 4, name: "Ben" },
        loading: true,
        networkStatus: NetworkStatus.refetch,
        partial: false,
      });

      await expect(stream).toEmitApolloQueryResult({
        data: { counter: 5, name: "Ben" },
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
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

        const client = new ApolloClient({
          cache: new InMemoryCache(),
          link: new MockLink([makeMock("a", "b", "c"), makeMock("d", "e")]),
        });
        const observableWithoutVariables = client.watchQuery({
          query: queryWithoutVariables,
          variables: { variables: ["a", "b", "c"] },
        });

        const stream = new ObservableStream(observableWithoutVariables);

        await expect(stream).toEmitApolloQueryResult({
          data: {
            getVars: [
              { __typename: "Var", name: "a" },
              { __typename: "Var", name: "b" },
              { __typename: "Var", name: "c" },
            ],
          },
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await observableWithoutVariables.refetch({
          variables: ["d", "e"],
        });

        await expect(stream).toEmitApolloQueryResult({
          data: {
            getVars: [
              { __typename: "Var", name: "d" },
              { __typename: "Var", name: "e" },
            ],
          },
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
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

        await expect(stream).not.toEmitAnything();
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

        const mocks = [makeMock("a", "b", "c"), makeMock("d", "e")];
        const firstRequest = mocks[0].request;
        const client = new ApolloClient({
          cache: new InMemoryCache(),
          link: new MockLink(mocks, { showWarnings: false }),
        });

        const observableWithVarsVar = client.watchQuery({
          query: firstRequest.query,
          variables: firstRequest.variables,
          notifyOnNetworkStatusChange: false,
        });

        const stream = new ObservableStream(observableWithVarsVar);

        await expect(stream).toEmitApolloQueryResult({
          data: {
            getVars: [
              { __typename: "Var", name: "a" },
              { __typename: "Var", name: "b" },
              { __typename: "Var", name: "c" },
            ],
          },
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        // It's a common mistake to call refetch({ variables }) when you meant
        // to call refetch(variables).
        const promise = observableWithVarsVar.refetch({
          // @ts-expect-error
          variables: { vars: ["d", "e"] },
        });

        await expect(stream).toEmitMatchedValue({
          error: expect.objectContaining({
            message: expect.stringMatching(
              /No more mocked responses for the query: query QueryWithVarsVar\(\$vars: \[String!\]\)/
            ),
          }),
        });

        await expect(promise).rejects.toEqual(
          expect.objectContaining({
            message: expect.stringMatching(
              /No more mocked responses for the query: query QueryWithVarsVar\(\$vars: \[String!\]\)/
            ),
          })
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

        await expect(stream).not.toEmitAnything();
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

        const client = new ApolloClient({
          cache: new InMemoryCache(),
          link: new MockLink([makeMock("a", "b", "c"), makeMock("d", "e")]),
        });

        const observableWithVariablesVar = client.watchQuery({
          query: queryWithVariablesVar,
          variables: { variables: ["a", "b", "c"] },
        });

        const stream = new ObservableStream(observableWithVariablesVar);

        await expect(stream).toEmitApolloQueryResult({
          data: {
            getVars: [
              { __typename: "Var", name: "a" },
              { __typename: "Var", name: "b" },
              { __typename: "Var", name: "c" },
            ],
          },
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await observableWithVariablesVar.refetch({ variables: ["d", "e"] });

        await expect(stream).toEmitApolloQueryResult({
          data: {
            getVars: [
              { __typename: "Var", name: "d" },
              { __typename: "Var", name: "e" },
            ],
          },
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        expect(console.warn).not.toHaveBeenCalled();

        await expect(stream).not.toEmitAnything();
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

      const client = new ApolloClient({
        link: new MockLink([
          {
            request: { query: queryWithFragment, variables },
            result: { data: dataOneWithTypename },
          },
          {
            request: { query: queryWithFragment, variables },
            result: { data: dataTwoWithTypename },
          },
        ]),
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

      await expect(stream).toEmitApolloQueryResult({
        data: dataOneWithTypename,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      expect(observable.getCurrentResult()).toEqualApolloQueryResult({
        data: dataOneWithTypename,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      void observable.refetch();

      await expect(stream).toEmitApolloQueryResult({
        data: dataOneWithTypename,
        loading: true,
        networkStatus: NetworkStatus.refetch,
        partial: false,
      });
      expect(observable.getCurrentResult()).toEqualApolloQueryResult({
        data: dataOneWithTypename,
        loading: true,
        networkStatus: NetworkStatus.refetch,
        partial: false,
      });

      await expect(stream).toEmitApolloQueryResult({
        data: dataTwoWithTypename,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.getCurrentResult()).toEqualApolloQueryResult({
        data: dataTwoWithTypename,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("returns the current query status immediately", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { data: dataOne },
            delay: 100,
          },
        ]),
      });
      const observable = client.watchQuery({ query, variables });
      const stream = new ObservableStream(observable);

      expect(observable.getCurrentResult()).toEqualApolloQueryResult({
        data: undefined,
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await tick();

      expect(observable.getCurrentResult()).toEqualApolloQueryResult({
        data: undefined,
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await stream.takeNext();

      expect(observable.getCurrentResult()).toEqualApolloQueryResult({
        data: dataOne,
        loading: false,
        networkStatus: 7,
        partial: false,
      });
    });

    it("returns results from the store immediately", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { data: dataOne },
          },
        ]),
      });

      const result = await client.query({ query, variables });

      expect(result).toEqualApolloQueryResult({
        data: dataOne,
        loading: false,
        networkStatus: 7,
        partial: false,
      });

      const observable = client.watchQuery({ query, variables });

      expect(observable.getCurrentResult()).toEqualApolloQueryResult({
        data: dataOne,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
    });

    it("returns errors from the store immediately", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { errors: [error] },
          },
        ]),
      });

      const observable = client.watchQuery({ query, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data: undefined,
        error: new ApolloError({ graphQLErrors: [error] }),
        errors: [error],
        loading: false,
        networkStatus: NetworkStatus.error,
        partial: true,
      });

      expect(observable.getCurrentResult()).toEqualApolloQueryResult({
        data: undefined,
        error: new ApolloError({ graphQLErrors: [error] }),
        errors: [error],
        loading: false,
        networkStatus: NetworkStatus.error,
        partial: true,
      });
    });

    it("returns referentially equal errors", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { errors: [error] },
          },
        ]),
      });

      const observable = client.watchQuery({ query, variables });

      await expect(observable.result()).resolves.toMatchObject({
        error: new ApolloError({ graphQLErrors: [error] }),
      });

      const currentResult = observable.getCurrentResult();
      const currentResult2 = observable.getCurrentResult();

      expect(currentResult).toEqualApolloQueryResult({
        data: undefined,
        error: new ApolloError({ graphQLErrors: [error] }),
        errors: [error],
        loading: false,
        networkStatus: NetworkStatus.error,
        partial: true,
      });

      expect(currentResult.error === currentResult2.error).toBe(true);
    });

    it("returns errors with data if errorPolicy is all", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { data: dataOne, errors: [error] },
          },
        ]),
      });

      const observable = client.watchQuery({
        query,
        variables,
        errorPolicy: "all",
      });

      const result = await observable.result();
      const currentResult = observable.getCurrentResult();

      expect(result).toEqualApolloQueryResult({
        data: dataOne,
        errors: [error],
        loading: false,
        networkStatus: NetworkStatus.error,
        partial: false,
      });
      expect(currentResult).toEqualApolloQueryResult({
        data: dataOne,
        errors: [error],
        loading: false,
        // TODO: The networkStatus returned here is different than the one
        // returned from `observable.result()`. These should match
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
    });

    it("errors out if errorPolicy is none", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { data: dataOne, errors: [error] },
          },
        ]),
      });

      const observable = client.watchQuery({
        query,
        variables,
        errorPolicy: "none",
      });

      await expect(observable.result()).resolves.toMatchObject({
        error: wrappedError,
      });

      expect(observable.getLastError()).toEqual(wrappedError);
    });

    it("errors out if errorPolicy is none and the observable has completed", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { data: dataOne, errors: [error] },
          },
        ]),
      });

      const observable = client.watchQuery({
        query,
        variables,
        errorPolicy: "none",
      });

      await expect(observable.result()).resolves.toMatchObject({
        error: wrappedError,
      });
      await expect(observable.result()).resolves.toMatchObject({
        error: wrappedError,
      });

      expect(observable.getLastError()).toEqual(wrappedError);
    });

    it("ignores errors with data if errorPolicy is ignore", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { errors: [error], data: dataOne },
          },
        ]),
      });

      const observable = client.watchQuery({
        query,
        variables,
        errorPolicy: "ignore",
      });

      const result = await observable.result();
      const currentResult = observable.getCurrentResult();

      expect(result).toEqualApolloQueryResult({
        data: dataOne,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(currentResult).toEqualApolloQueryResult({
        data: dataOne,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
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

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query: superQuery, variables },
            result: { data: superDataOne },
          },
        ]),
      });

      await client.query({ query, variables });

      const observable = client.watchQuery({
        query: superQuery,
        variables,
        returnPartialData: true,
      });

      // TODO: Determine why this worked without the `false` argument before
      // since this updates the last value to be equal to the partial result.
      expect(observable.getCurrentResult(false)).toEqualApolloQueryResult({
        data: dataOne,
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data: dataOne,
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });
      expect(observable.getCurrentResult()).toEqualApolloQueryResult({
        data: dataOne,
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitApolloQueryResult({
        data: superDataOne,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.getCurrentResult()).toEqualApolloQueryResult({
        data: superDataOne,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    // TODO: Update this behavior when enforcing notifyOnNetworkStatusChange
    it("returns loading even if full data is available when using network-only fetchPolicy", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables },
            result: { data: dataTwo },
          },
        ]),
      });

      const result = await client.query({ query, variables });

      expect(result).toEqualApolloQueryResult({
        data: dataOne,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      const observable = client.watchQuery({
        query,
        variables,
        fetchPolicy: "network-only",
      });

      expect(observable.getCurrentResult()).toEqualApolloQueryResult({
        data: undefined,
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data: undefined,
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitApolloQueryResult({
        data: dataTwo,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    // TODO: This test seems to conflict with many other tests that do not emit
    // a loading state with a no-cache fetch policy. This should be more
    // consistent when we update how it works with notifyOnNetworkStatusChange
    // so I'm skipping this test which should be re-enabled when that work is
    // completed.
    it.skip("returns loading on no-cache fetchPolicy queries when calling getCurrentResult", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { data: dataOne },
          },
          {
            request: { query, variables },
            result: { data: dataTwo },
          },
        ]),
      });

      await client.query({ query, variables });

      const observable = client.watchQuery({
        query,
        variables,
        fetchPolicy: "no-cache",
      });

      expect(observable.getCurrentResult()).toEqualApolloQueryResult({
        data: undefined,
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitApolloQueryResult({
        data: undefined,
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });
      expect(observable.getCurrentResult()).toEqualApolloQueryResult({
        data: undefined,
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitApolloQueryResult({
        data: dataTwo,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.getCurrentResult()).toEqualApolloQueryResult({
        data: dataTwo,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
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

      await expect(stream).toEmitApolloQueryResult({
        data: {
          greeting: {
            message: "Hello world",
            __typename: "Greeting",
          },
        },
        loading: false,
        networkStatus: NetworkStatus.ready,
        // TODO: This should be true since there are still outstanding chunks
        // that haven't been processed.
        partial: false,
      });

      expect(obs.getCurrentResult()).toEqualApolloQueryResult({
        data: {
          greeting: {
            message: "Hello world",
            __typename: "Greeting",
          },
        },
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: true,
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

      await expect(stream).toEmitApolloQueryResult({
        data: {
          greeting: {
            message: "Hello world",
            recipient: {
              name: "Alice",
              __typename: "Person",
            },
            __typename: "Greeting",
          },
        },
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      expect(obs.getCurrentResult()).toEqualApolloQueryResult({
        data: {
          greeting: {
            message: "Hello world",
            recipient: {
              name: "Alice",
              __typename: "Person",
            },
            __typename: "Greeting",
          },
        },
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      // This 2nd identical check is intentional to ensure calling this function
      // more than once returns the right value.
      expect(obs.getCurrentResult()).toEqualApolloQueryResult({
        data: {
          greeting: {
            message: "Hello world",
            recipient: {
              name: "Alice",
              __typename: "Person",
            },
            __typename: "Greeting",
          },
        },
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    {
      type Result = ApolloQueryResult<{ hello: string }>;

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
          partial: false,
        },
        resultAfterSubscribe: {
          ...loadingStates.loading,
          data: cacheValues.initial,
          partial: false,
        },
        resultAfterCacheUpdate1: {
          ...loadingStates.loading,
          data: cacheValues.update1,
          partial: false,
        },
        resultAfterLinkNext: {
          ...loadingStates.done,
          data: cacheValues.link,
          partial: false,
        },
        resultAfterCacheUpdate2: {
          ...loadingStates.done,
          data: cacheValues.update2,
          partial: false,
        },
        resultAfterCacheUpdate3: {
          ...loadingStates.refetching,
          data: cacheValues.update3,
          partial: false,
        },
        resultAfterRefetchNext: {
          ...loadingStates.done,
          data: cacheValues.refetch,
          partial: false,
        },
        resultAfterCacheUpdate4: {
          ...loadingStates.done,
          data: cacheValues.update4,
          partial: false,
        },
      };

      const linkOnly: TestDetails = {
        resultBeforeSubscribe: {
          ...loadingStates.loading,
          data: undefined,
          partial: true,
        },
        resultAfterSubscribe: {
          ...loadingStates.loading,
          data: undefined,
          partial: true,
        },
        resultAfterCacheUpdate1: {
          ...loadingStates.loading,
          data: undefined,
          partial: true,
        },
        resultAfterLinkNext: {
          ...loadingStates.done,
          data: cacheValues.link,
          partial: false,
        },
        resultAfterCacheUpdate2: {
          ...loadingStates.done,
          data: cacheValues.link,
          partial: false,
        },
        resultAfterCacheUpdate3: {
          ...loadingStates.refetching,
          data: cacheValues.link,
          partial: false,
        },
        resultAfterRefetchNext: {
          ...loadingStates.done,
          data: cacheValues.refetch,
          partial: false,
        },
        resultAfterCacheUpdate4: {
          ...loadingStates.done,
          data: cacheValues.refetch,
          partial: false,
        },
      };

      const standbyOnly: TestDetails = {
        ...linkOnly,
        resultBeforeSubscribe: {
          ...loadingStates.loading,
          data: undefined,
          partial: true,
        },
        resultAfterSubscribe: {
          ...loadingStates.loading,
          data: undefined,
          partial: true,
        },
        resultAfterCacheUpdate1: {
          ...loadingStates.loading,
          data: undefined,
          partial: true,
        },
        resultAfterLinkNext: {
          ...loadingStates.loading,
          data: undefined,
          partial: true,
        },
        resultAfterCacheUpdate2: {
          ...loadingStates.loading,
          data: undefined,
          partial: true,
        },
        resultAfterCacheUpdate3: {
          ...loadingStates.refetching,
          data: undefined,
          partial: true,
        },
        // like linkOnly:
        // resultAfterRefetchNext
        // resultAfterCacheUpdate4
      };

      const linkOnlyThenCacheAndLink: TestDetails = {
        ...cacheAndLink,
        resultBeforeSubscribe: {
          ...loadingStates.loading,
          data: undefined,
          partial: true,
        },
        resultAfterSubscribe: {
          ...loadingStates.loading,
          data: undefined,
          partial: true,
        },
        resultAfterCacheUpdate1: {
          ...loadingStates.loading,
          data: undefined,
          partial: true,
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
          partial: false,
        },
        resultAfterSubscribe: {
          ...loadingStates.done,
          data: cacheValues.initial,
          partial: false,
        },
        resultAfterCacheUpdate1: {
          ...loadingStates.done,
          data: cacheValues.update1,
          partial: false,
        },
        resultAfterLinkNext: {
          ...loadingStates.done,
          data: cacheValues.update1,
          partial: false,
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
          let subject = new Subject<FetchResult>();
          const link = new ApolloLink(() => subject);
          const cache = new InMemoryCache({});
          cache.writeQuery({ query, data: cacheValues.initial });

          const client = new ApolloClient({ link, cache });
          const observableQuery = client.watchQuery({
            query,
            fetchPolicy,
            nextFetchPolicy,
          });

          expect(observableQuery.getCurrentResult()).toEqualApolloQueryResult(
            resultBeforeSubscribe
          );

          observableQuery.subscribe({});
          expect(observableQuery.getCurrentResult()).toEqualApolloQueryResult(
            resultAfterSubscribe
          );

          cache.writeQuery({ query, data: cacheValues.update1 });
          expect(observableQuery.getCurrentResult()).toEqualApolloQueryResult(
            resultAfterCacheUpdate1
          );

          setTimeout(() => {
            subject.next({ data: cacheValues.link });
            subject.complete();
            subject = new Subject();
          });

          await waitFor(
            () =>
              void expect(
                observableQuery.getCurrentResult()
              ).toEqualApolloQueryResult(resultAfterLinkNext),
            { interval: 1 }
          );

          cache.writeQuery({ query, data: cacheValues.update2 });
          expect(observableQuery.getCurrentResult()).toEqualApolloQueryResult(
            resultAfterCacheUpdate2
          );

          void observableQuery.refetch();

          cache.writeQuery({ query, data: cacheValues.update3 });
          expect(observableQuery.getCurrentResult()).toEqualApolloQueryResult(
            resultAfterCacheUpdate3
          );

          setTimeout(() => {
            subject.next({ data: cacheValues.refetch });
            subject.complete();
          });

          await waitFor(
            () =>
              void expect(
                observableQuery.getCurrentResult()
              ).toEqualApolloQueryResult(resultAfterRefetchNext),
            { interval: 1 }
          );

          cache.writeQuery({ query, data: cacheValues.update4 });
          expect(observableQuery.getCurrentResult()).toEqualApolloQueryResult(
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
        const client = new ApolloClient({
          cache: new InMemoryCache(),
          link: new MockLink([
            {
              request: { query, variables },
              result: { data: dataOne },
            },
            {
              request: { query: mutation },
              result: { data: mutationData },
            },
          ]),
        });

        const observable = client.watchQuery({
          query,
          variables,
        });

        const stream = new ObservableStream(observable);

        await expect(stream).toEmitApolloQueryResult({
          data: dataOne,
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });
        expect(observable.getCurrentResult()).toEqualApolloQueryResult({
          data: dataOne,
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        void client.mutate({
          mutation,
          optimisticResponse,
          updateQueries,
        });

        await expect(stream).toEmitApolloQueryResult({
          data: {
            people_one: optimisticResponse,
          },
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });
        expect(observable.getCurrentResult()).toEqualApolloQueryResult({
          data: {
            people_one: optimisticResponse,
          },
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await expect(stream).toEmitApolloQueryResult({
          data: {
            people_one: mutationData,
          },
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });
        expect(observable.getCurrentResult()).toEqualApolloQueryResult({
          data: {
            people_one: mutationData,
          },
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await expect(stream).not.toEmitAnything();
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
          link: new MockLink([
            { request: queryOptions, result: { data: { value: 1 } } },
            { request: queryOptions, result: { data: { value: 2 } } },
            { request: queryOptions, result: { data: { value: 3 } } },
          ]).setOnError((error) => {
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

    it("is updated with transformed query when `setOptions` changes the query", async () => {
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
        link: new ApolloLink(() => of({ data: {} })),
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

      await observable.setOptions({ query: updatedQuery });

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

  describe("updateQuery", () => {
    it("should be able to determine if the previous result is complete", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { data: dataOne },
          },
        ]),
      });

      const observable = client.watchQuery({
        query,
        variables,
      });

      let updateQuerySpy = jest.fn();
      observable.updateQuery((previous, { complete, previousData }) => {
        updateQuerySpy();
        expect(previous).toEqual(null);
        expect(complete).toBe(false);
        expect(previousData).toStrictEqual(previous);

        if (complete) {
          expectTypeOf(previousData).toEqualTypeOf<typeof dataOne>();
        } else {
          expectTypeOf(previousData).toEqualTypeOf<
            DeepPartial<typeof previous> | undefined
          >();
        }
      });

      observable.subscribe(jest.fn());

      await waitFor(() => {
        expect(observable.getCurrentResult(false)).toEqual({
          data: dataOne,
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });
      });

      observable.updateQuery((previous, { complete, previousData }) => {
        updateQuerySpy();
        expect(previous).toEqual(dataOne);
        expect(complete).toBe(true);
        expect(previousData).toStrictEqual(previous);

        if (complete) {
          expectTypeOf(previousData).toEqualTypeOf<typeof dataOne>();
        } else {
          expectTypeOf(previousData).toEqualTypeOf<
            DeepPartial<typeof previous> | undefined
          >();
        }
      });

      expect(updateQuerySpy).toHaveBeenCalledTimes(2);
    });
  });

  it("QueryInfo does not notify for !== but deep-equal results", async () => {
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink([
        {
          request: { query, variables },
          result: { data: dataOne },
        },
      ]),
    });

    const observable = client.watchQuery({
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

    await expect(stream).toEmitApolloQueryResult({
      data: dataOne,
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
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
    client.stop();

    await expect(stream).not.toEmitAnything();
  });

  // TODO: Determine if we still want this behavior
  it.skip("ObservableQuery#map respects Symbol.species", async () => {
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink([
        {
          request: { query, variables },
          result: { data: dataOne },
        },
      ]),
    });
    const observable = client.watchQuery({ query, variables });
    expect(observable).toBeInstanceOf(Observable);
    expect(observable).toBeInstanceOf(ObservableQuery);

    const mapped = observable.pipe(
      map((result) => {
        expect(result).toEqualApolloQueryResult({
          loading: false,
          networkStatus: NetworkStatus.ready,
          data: dataOne,
          partial: false,
        });
        return {
          ...result,
          data: { mapped: true },
        };
      })
    );
    expect(mapped).toBeInstanceOf(Observable);
    expect(mapped).not.toBeInstanceOf(ObservableQuery);

    const stream = new ObservableStream(mapped);

    await expect(stream).toEmitApolloQueryResult({
      loading: false,
      networkStatus: NetworkStatus.ready,
      data: { mapped: true },
      partial: false,
    });

    await expect(stream).not.toEmitAnything();
  });
});

test("regression test for #10587", async () => {
  let observers: Record<string, Observer<FetchResult>> = {};
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
          partial: false,
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
          partial: false,
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
          partial: false,
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
          partial: false,
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
          partial: false,
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

  await waitFor(() => {
    expect(query1Spy.mock.calls).toEqual(finalExpectedCalls.query1);
    expect(query2Spy.mock.calls).toEqual(finalExpectedCalls.query2.slice(0, 2));
  });
  // TODO: This fails when moved outside the waitFor due to the fact that we use
  // an async scehduler in the `fromData` function from  resultsFromCache. We
  // should try and emit that value synchronously, but that causes another test
  // to fail right now.
  // expect(query2Spy.mock.calls).toEqual(finalExpectedCalls.query2.slice(0, 2));

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
    expect(observable.getCurrentResult(false)).toEqualApolloQueryResult({
      data: { userCount: 10 },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });

  void observable.reobserve({ variables: { department: "HR" } });
  await wait(10);
  void observable.reobserve({ variables: { department: null } });

  // Wait for request to finish
  await wait(50);

  expect(observable.options.variables).toEqual({ department: null });
  expect(observable.getCurrentResult(false)).toEqualApolloQueryResult({
    data: { userCount: 10 },
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
});
