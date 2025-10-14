import type {
  ResultOf,
  TypedDocumentNode,
} from "@graphql-typed-document-node/core";
import { waitFor } from "@testing-library/react";
import { expectTypeOf } from "expect-type";
import { GraphQLError } from "graphql";
import { gql } from "graphql-tag";
import type { ObservedValueOf, Observer } from "rxjs";
import { delay, from, lastValueFrom, Observable, of, Subject } from "rxjs";

import type {
  ObservableQuery,
  OperationVariables,
  WatchQueryFetchPolicy,
} from "@apollo/client";
import { ApolloClient, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { Defer20220824Handler } from "@apollo/client/incremental";
import { ApolloLink } from "@apollo/client/link";
import { LocalState } from "@apollo/client/local-state";
import { MockLink, MockSubscriptionLink } from "@apollo/client/testing";
import {
  markAsStreaming,
  ObservableStream,
  setupVariablesCase,
  spyOnConsole,
  wait,
} from "@apollo/client/testing/internal";
import type { DeepPartial } from "@apollo/client/utilities";
import {
  DocumentTransform,
  relayStylePagination,
} from "@apollo/client/utilities";
import { removeDirectivesFromDocument } from "@apollo/client/utilities/internal";

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
  const wrappedError = new CombinedGraphQLErrors({
    data: dataOne,
    errors: [error],
  });

  describe("reobserve", () => {
    describe("to change pollInterval", () => {
      it("starts polling if goes from 0 -> something", async () => {
        const query = gql`
          query {
            count
          }
        `;
        let count = 0;
        const client = new ApolloClient({
          cache: new InMemoryCache(),
          link: new MockLink([
            {
              request: { query },
              result: () => ({ data: { count: ++count } }),
              maxUsageCount: Number.POSITIVE_INFINITY,
              delay: 20,
            },
          ]),
        });

        const observable = client.watchQuery({ query });

        const stream = new ObservableStream(observable);

        await expect(stream).toEmitTypedValue({
          data: undefined,
          dataState: "empty",
          loading: true,
          networkStatus: NetworkStatus.loading,
          partial: true,
        });

        await expect(stream).toEmitTypedValue({
          data: { count: 1 },
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await expect(stream).not.toEmitAnything();

        // The value is returned from the cache
        await expect(
          observable.reobserve({ pollInterval: 10 })
        ).resolves.toStrictEqualTyped({ data: { count: 1 } });

        // We don't expect to see a loading state from reobserve since it just
        // read the value from the cache and did not fetch from the network. The
        // poll state is the first loading state we will see

        await expect(stream).toEmitTypedValue({
          data: { count: 1 },
          dataState: "complete",
          loading: true,
          networkStatus: NetworkStatus.poll,
          partial: false,
        });

        await expect(stream).toEmitTypedValue({
          data: { count: 2 },
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await expect(stream).toEmitTypedValue({
          data: { count: 2 },
          dataState: "complete",
          loading: true,
          networkStatus: NetworkStatus.poll,
          partial: false,
        });

        await expect(stream).toEmitTypedValue({
          data: { count: 3 },
          dataState: "complete",
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
              delay: 20,
            },
            {
              request: { query, variables },
              result: { data: dataTwo },
              delay: 20,
            },
          ]),
        });

        const observable = client.watchQuery({
          query,
          variables,
          pollInterval: 10,
        });

        const stream = new ObservableStream(observable);

        await expect(stream).toEmitTypedValue({
          data: undefined,
          dataState: "empty",
          loading: true,
          networkStatus: NetworkStatus.loading,
          partial: true,
        });

        await expect(stream).toEmitTypedValue({
          data: dataOne,
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await expect(stream).toEmitTypedValue({
          data: dataOne,
          dataState: "complete",
          loading: true,
          networkStatus: NetworkStatus.poll,
          partial: false,
        });

        await expect(stream).toEmitTypedValue({
          data: dataTwo,
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await observable.reobserve({ pollInterval: 0 });

        await expect(stream).not.toEmitAnything();
      });

      it("stops polling if goes from something -> fetchPolicy: standby", async () => {
        const client = new ApolloClient({
          cache: new InMemoryCache(),
          link: new MockLink([
            {
              request: { query, variables },
              result: { data: dataOne },
              delay: 20,
            },
            {
              request: { query, variables },
              result: { data: dataTwo },
              delay: 20,
            },
          ]),
        });

        const observable = client.watchQuery({
          query,
          variables,
          pollInterval: 10,
        });

        const stream = new ObservableStream(observable);

        await expect(stream).toEmitTypedValue({
          data: undefined,
          dataState: "empty",
          loading: true,
          networkStatus: NetworkStatus.loading,
          partial: true,
        });

        await expect(stream).toEmitTypedValue({
          data: dataOne,
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await expect(stream).toEmitTypedValue({
          data: dataOne,
          dataState: "complete",
          loading: true,
          networkStatus: NetworkStatus.poll,
          partial: false,
        });

        await expect(stream).toEmitTypedValue({
          data: dataTwo,
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await observable.reobserve({ fetchPolicy: "standby" });

        await expect(stream).not.toEmitAnything();
      });

      it("resumes polling if goes from fetchPolicy: standby to non-standby", async () => {
        const query = gql`
          query {
            greeting
          }
        `;
        let count = 0;
        const client = new ApolloClient({
          cache: new InMemoryCache(),
          link: new MockLink([
            {
              request: { query },
              result: () => ({ data: { greeting: `hello ${++count}` } }),
              delay: 20,
              maxUsageCount: Number.POSITIVE_INFINITY,
            },
          ]),
        });

        const observable = client.watchQuery({ query, pollInterval: 10 });
        const stream = new ObservableStream(observable);

        await expect(stream).toEmitTypedValue({
          data: undefined,
          dataState: "empty",
          loading: true,
          networkStatus: NetworkStatus.loading,
          partial: true,
        });

        await expect(stream).toEmitTypedValue({
          data: { greeting: "hello 1" },
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await expect(stream).toEmitTypedValue({
          data: { greeting: "hello 1" },
          dataState: "complete",
          loading: true,
          networkStatus: NetworkStatus.poll,
          partial: false,
        });

        await expect(stream).toEmitTypedValue({
          data: { greeting: "hello 2" },
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await expect(
          observable.reobserve({ fetchPolicy: "standby" })
        ).resolves.toStrictEqualTyped({ data: undefined });

        await expect(stream).not.toEmitAnything();

        await expect(
          observable.reobserve({ fetchPolicy: "cache-first" })
        ).resolves.toStrictEqualTyped({ data: { greeting: "hello 2" } });

        await expect(stream).toEmitTypedValue({
          data: { greeting: "hello 2" },
          dataState: "complete",
          loading: true,
          networkStatus: NetworkStatus.poll,
          partial: false,
        });

        await expect(stream).toEmitTypedValue({
          data: { greeting: "hello 3" },
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        observable.stopPolling();

        await expect(stream).not.toEmitAnything();
      });

      it("can change pollInterval from one value to another", async () => {
        const query = gql`
          query {
            count
          }
        `;
        let count = 0;
        const client = new ApolloClient({
          cache: new InMemoryCache(),
          link: new MockLink([
            {
              request: { query },
              result: () => ({ data: { count: ++count } }),
              maxUsageCount: Number.POSITIVE_INFINITY,
              delay: 20,
            },
          ]),
        });

        const observable = client.watchQuery({ query, pollInterval: 100 });

        const stream = new ObservableStream(observable);

        await expect(stream).toEmitTypedValue({
          data: undefined,
          dataState: "empty",
          loading: true,
          networkStatus: NetworkStatus.loading,
          partial: true,
        });

        await expect(stream).toEmitTypedValue({
          data: { count: 1 },
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await expect(stream).toEmitTypedValue(
          {
            data: { count: 1 },
            dataState: "complete",
            loading: true,
            networkStatus: NetworkStatus.poll,
            partial: false,
          },
          { timeout: 110 }
        );

        await expect(stream).toEmitTypedValue({
          data: { count: 2 },
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        // Value is read from the cache
        await expect(
          observable.reobserve({ pollInterval: 10 })
        ).resolves.toStrictEqualTyped({ data: { count: 2 } });

        // We don't see a loading state from reobserve since it reread the value
        // from the cache

        await expect(stream).toEmitTypedValue(
          {
            data: { count: 2 },
            dataState: "complete",
            loading: true,
            networkStatus: NetworkStatus.poll,
            partial: false,
          },
          { timeout: 20 }
        );

        await expect(stream).toEmitTypedValue({
          data: { count: 3 },
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        observable.stopPolling();

        await expect(stream).not.toEmitAnything();
      });

      it("warns and does not start polling on a cache-only query when using reobserve to change poll interval", async () => {
        using _ = spyOnConsole("warn");
        const query = gql`
          query CountQuery {
            count
          }
        `;
        const client = new ApolloClient({
          cache: new InMemoryCache(),
          link: ApolloLink.empty(),
        });

        const observable = client.watchQuery({
          query,
          fetchPolicy: "cache-only",
        });

        const stream = new ObservableStream(observable);

        await expect(stream).toEmitTypedValue({
          data: undefined,
          dataState: "empty",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: true,
        });

        await expect(
          observable.reobserve({ pollInterval: 10 })
        ).resolves.toStrictEqualTyped({ data: undefined });

        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith(
          "Cannot poll on 'cache-only' query '%s' and as such, polling is disabled. Please use a different fetch policy.",
          "CountQuery"
        );

        await expect(stream).not.toEmitAnything();
      });

      it("warns and does not start polling on a cache-only query when initializing with poll interval", async () => {
        using _ = spyOnConsole("warn");
        const query = gql`
          query CountQuery {
            count
          }
        `;
        const client = new ApolloClient({
          cache: new InMemoryCache(),
          link: ApolloLink.empty(),
        });

        const observable = client.watchQuery({
          query,
          fetchPolicy: "cache-only",
          pollInterval: 10,
        });

        const stream = new ObservableStream(observable);

        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith(
          "Cannot poll on 'cache-only' query '%s' and as such, polling is disabled. Please use a different fetch policy.",
          "CountQuery"
        );

        await expect(stream).toEmitTypedValue({
          data: undefined,
          dataState: "empty",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: true,
        });

        await expect(stream).not.toEmitAnything();
      });

      it("warns and does not start polling on a cache-only query when calling startPolling", async () => {
        using _ = spyOnConsole("warn");
        const query = gql`
          query CountQuery {
            count
          }
        `;
        const client = new ApolloClient({
          cache: new InMemoryCache(),
          link: ApolloLink.empty(),
        });

        const observable = client.watchQuery({
          query,
          fetchPolicy: "cache-only",
        });

        const stream = new ObservableStream(observable);

        await expect(stream).toEmitTypedValue({
          data: undefined,
          dataState: "empty",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: true,
        });

        observable.startPolling(10);

        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith(
          "Cannot poll on 'cache-only' query '%s' and as such, polling is disabled. Please use a different fetch policy.",
          "CountQuery"
        );

        await expect(stream).not.toEmitAnything();
      });

      it("does not warn about polling on cache-only query multiple times", async () => {
        using consoleSpy = spyOnConsole("warn");
        const query = gql`
          query CountQuery {
            count
          }
        `;
        const client = new ApolloClient({
          cache: new InMemoryCache(),
          link: ApolloLink.empty(),
        });

        const observable = client.watchQuery({
          query,
          fetchPolicy: "cache-only",
        });

        const stream = new ObservableStream(observable);

        await expect(stream).toEmitTypedValue({
          data: undefined,
          dataState: "empty",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: true,
        });

        observable.startPolling(10);

        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith(
          "Cannot poll on 'cache-only' query '%s' and as such, polling is disabled. Please use a different fetch policy.",
          "CountQuery"
        );

        await expect(stream).not.toEmitAnything();

        consoleSpy.warn.mockClear();
        observable.startPolling(10);

        expect(console.warn).not.toHaveBeenCalled();
        await expect(stream).not.toEmitAnything();
      });

      it("cancels polling when changing to a cache-only fetchPolicy", async () => {
        using _ = spyOnConsole("warn");
        const query = gql`
          query CountQuery {
            count
          }
        `;
        let count = 0;
        const client = new ApolloClient({
          cache: new InMemoryCache(),
          link: new MockLink([
            {
              request: { query },
              result: () => ({ data: { count: ++count } }),
              maxUsageCount: Number.POSITIVE_INFINITY,
              delay: 20,
            },
          ]),
        });

        const observable = client.watchQuery({ query, pollInterval: 100 });

        const stream = new ObservableStream(observable);

        await expect(stream).toEmitTypedValue({
          data: undefined,
          dataState: "empty",
          loading: true,
          networkStatus: NetworkStatus.loading,
          partial: true,
        });

        await expect(stream).toEmitTypedValue({
          data: { count: 1 },
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await expect(stream).toEmitTypedValue({
          data: { count: 1 },
          dataState: "complete",
          loading: true,
          networkStatus: NetworkStatus.poll,
          partial: false,
        });

        await expect(stream).toEmitTypedValue({
          data: { count: 2 },
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await expect(
          observable.reobserve({ fetchPolicy: "cache-only" })
        ).resolves.toStrictEqualTyped({ data: { count: 2 } });

        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith(
          "Cannot poll on 'cache-only' query '%s' and as such, polling is disabled. Please use a different fetch policy.",
          "CountQuery"
        );

        await expect(stream).not.toEmitAnything();
      });
    });

    it("does not break refetch", async () => {
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
      const variables1 = { first: 0 };

      const data2 = { allPeople: { people: [{ name: "Leia Skywalker" }] } };
      const variables2 = { first: 1 };

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query: query, variables: variables1 },
            result: { data },
            delay: 20,
          },
          {
            request: { query: query, variables: variables2 },
            result: { data: data2 },
            delay: 20,
          },
        ]),
      });

      const observable = client.watchQuery({
        query: query,
        variables: variables1,
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await observable.refetch(variables2);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.refetch,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: data2,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("rerenders when refetch is called", async () => {
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
            request: { query, variables },
            result: { data },
            delay: 20,
          },
          {
            request: { query, variables },
            result: { data: data2 },
            delay: 20,
          },
        ]),
      });

      const observable = client.watchQuery({ query, variables });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await observable.refetch();

      await expect(stream).toEmitTypedValue({
        data,
        dataState: "complete",
        loading: true,
        networkStatus: NetworkStatus.refetch,
        partial: false,
      });

      await expect(stream).toEmitTypedValue({
        data: data2,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("rerenders with new variables then shows correct data for previous variables", async () => {
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

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await observable.reobserve({ variables: variables2 });

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: data2,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      // go back to first set of variables
      const current = await observable.reobserve({ variables });
      expect(current).toStrictEqualTyped({ data });

      await expect(stream).toEmitTypedValue({
        data,
        dataState: "complete",
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
            result: { data: dataOne, errors: [error] },
          },
          {
            request: { query, variables },
            result: { data: dataOne },
          },
        ]),
      });
      const observable = client.watchQuery({ query, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataOne,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(observable.refetch()).rejects.toThrow(
        new CombinedGraphQLErrors({ data: dataOne, errors: [error] })
      );

      await expect(stream).toEmitTypedValue({
        data: dataOne,
        dataState: "complete",
        loading: true,
        networkStatus: NetworkStatus.refetch,
        partial: false,
      });

      await expect(stream).toEmitTypedValue({
        data: dataOne,
        dataState: "complete",
        error: new CombinedGraphQLErrors({ data: dataOne, errors: [error] }),
        loading: false,
        networkStatus: NetworkStatus.error,
        partial: false,
      });

      await expect(observable.refetch()).resolves.toStrictEqualTyped({
        data: dataOne,
      });

      await expect(stream).toEmitTypedValue({
        data: dataOne,
        dataState: "complete",
        loading: true,
        networkStatus: NetworkStatus.refetch,
        partial: false,
      });

      await expect(stream).toEmitTypedValue({
        data: dataOne,
        dataState: "complete",
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

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataOne,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await observable.reobserve({ fetchPolicy: "network-only" });

      await expect(stream).toEmitTypedValue({
        data: dataOne,
        dataState: "complete",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: false,
      });

      await expect(stream).toEmitTypedValue({
        data: dataTwo,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    // TODO: This test does not match the description since it never becomes
    // "not cache-only" after it is set to cache-only.
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
      const link = ApolloLink.from([
        new ApolloLink(
          () =>
            new Observable((observer) => {
              timesFired += 1;
              observer.next({ data });
              observer.complete();
            })
        ),
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

      await expect(stream).toEmitTypedValue({
        data,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      expect(timesFired).toBe(1);

      await expect(
        observable.reobserve({ fetchPolicy: "cache-only" })
      ).resolves.toStrictEqualTyped({ data });
      await client.resetStore();

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
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
      const link = ApolloLink.from([
        new ApolloLink(() => {
          return new Observable((observer) => {
            setTimeout(() => {
              timesFired += 1;
              observer.next({ data });
              observer.complete();
            });
          });
        }),
      ]);

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link,
      });

      const observable = client.watchQuery({
        query: testQuery,
        fetchPolicy: "cache-only",
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: true,
      });
      expect(timesFired).toBe(0);

      await observable.reobserve({ fetchPolicy: "cache-first" });

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data,
        dataState: "complete",
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
      const link = ApolloLink.from([
        new ApolloLink(() => {
          return new Observable((observer) => {
            timesFired += 1;
            setTimeout(() => {
              observer.next({ data });
              observer.complete();
            }, 20);
          });
        }),
      ]);
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link,
      });
      const observable = client.watchQuery({
        query: testQuery,
        fetchPolicy: "cache-first",
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(timesFired).toBe(1);

      await expect(
        observable.reobserve({ query, fetchPolicy: "standby" })
      ).resolves.toStrictEqualTyped({ data: undefined });

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
      const link = ApolloLink.from([
        new ApolloLink(() => {
          return new Observable((observer) => {
            timesFired += 1;
            setTimeout(() => {
              observer.next({ data });
              observer.complete();
            }, 20);
          });
        }),
      ]);
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link,
      });

      client.writeQuery({ query: testQuery, data });

      const observable = client.watchQuery({
        query: testQuery,
        fetchPolicy: "cache-only",
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      expect(timesFired).toBe(0);

      await expect(
        observable.reobserve({ query, fetchPolicy: "standby" })
      ).resolves.toStrictEqualTyped({ data: undefined });

      // make sure the query didn't get fired again.
      await expect(stream).not.toEmitAnything();
      expect(timesFired).toBe(0);
    });

    it("returns a promise which eventually returns data", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { data: dataOne },
            delay: 20,
          },
          {
            request: { query, variables },
            result: { data: dataTwo },
            delay: 20,
          },
        ]),
      });
      const observable = client.watchQuery({ query, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataOne,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      const res = await observable.reobserve({
        fetchPolicy: "cache-and-network",
      });

      expect(res).toStrictEqualTyped({ data: dataTwo });

      await expect(stream).toEmitTypedValue({
        data: dataOne,
        dataState: "complete",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: false,
      });

      await expect(stream).toEmitTypedValue({
        data: dataTwo,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("registers and unregisters `ObservableQuery` even if it is not subscribed to", async () => {
      const link = new MockSubscriptionLink();
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link,
      });

      const observable = client.watchQuery({ query, variables });
      expect(client.getObservableQueries().size).toBe(0);
      const promise = observable.reobserve();
      expect(client.getObservableQueries().size).toBe(1);
      link.simulateResult(
        {
          result: { data: dataOne },
        },
        true
      );
      await promise;
      expect(client.getObservableQueries().size).toBe(0);
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
            delay: 20,
          },
          {
            request: { query, variables: differentVariables },
            result: { data: dataTwo },
            delay: 20,
          },
        ]),
      });

      const observable = client.watchQuery({ query, variables });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataOne,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(
        observable.setVariables(differentVariables)
      ).resolves.toStrictEqualTyped({ data: dataTwo });

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataTwo,
        dataState: "complete",
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
            delay: 20,
          },
          {
            request: { query, variables: differentVariables },
            result: { data: dataTwo },
            delay: 20,
          },
        ]),
      });
      const observable = client.watchQuery({ query, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataOne,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: dataOne,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(
        observable.setVariables(differentVariables)
      ).resolves.toStrictEqualTyped({ data: dataTwo });

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        partial: true,
      });
      await expect(stream).toEmitTypedValue({
        data: dataTwo,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: dataTwo,
        dataState: "complete",
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
            delay: 20,
          },
          {
            request: { query, variables: differentVariables },
            result: { data: dataTwo },
            delay: 20,
          },
        ]),
      });

      const observable = client.watchQuery({
        query,
        variables,
        errorPolicy: "all",
      });

      const stream = new ObservableStream(observable);

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
        error: new CombinedGraphQLErrors({ errors: [error] }),
        loading: false,
        networkStatus: NetworkStatus.error,
        partial: true,
      });
      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: undefined,
        dataState: "empty",
        error: new CombinedGraphQLErrors({ errors: [error] }),
        loading: false,
        networkStatus: NetworkStatus.error,
        partial: true,
      });

      await expect(
        observable.setVariables(differentVariables)
      ).resolves.toStrictEqualTyped({ data: dataTwo });

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        partial: true,
      });
      await expect(stream).toEmitTypedValue({
        data: dataTwo,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: dataTwo,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("sets networkStatus to `setVariables` when fetching", async () => {
      const mockedResponses = [
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
      ];

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink(mockedResponses),
      });
      const observable = client.watchQuery({ query, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataOne,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(
        observable.setVariables(differentVariables)
      ).resolves.toStrictEqualTyped({ data: dataTwo });

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataTwo,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("sets networkStatus to `refetch` when calling refetch with new variables", async () => {
      const mockedResponses = [
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
      ];

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink(mockedResponses),
      });
      const observable = client.watchQuery({ query, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataOne,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(
        observable.refetch(differentVariables)
      ).resolves.toStrictEqualTyped({ data: dataTwo });

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.refetch,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataTwo,
        dataState: "complete",
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
            delay: 20,
          },
          {
            request: { query, variables },
            result: { data: dataTwo },
            delay: 20,
          },
        ]),
      });
      const observable = client.watchQuery({ query, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataOne,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(
        observable.setVariables(variables)
      ).resolves.toStrictEqualTyped({ data: dataOne });

      await expect(stream).not.toEmitAnything();
    });

    it("treats setVariables({}) as unchanged if previous variables are undefined", async () => {
      const query = gql`
        query ($offset: Int) {
          users(offset: $offset) {
            id
          }
        }
      `;

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query },
            result: { data: { users: [{ __typename: "User", id: 1 }] } },
          },
        ]),
      });
      const observable = client.watchQuery({
        query,
        // Ensure we don't get another network request
        fetchPolicy: "network-only",
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: { users: [{ __typename: "User", id: 1 }] },
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(observable.setVariables({})).resolves.toStrictEqualTyped({
        data: { users: [{ __typename: "User", id: 1 }] },
      });

      await expect(stream).not.toEmitAnything();
    });

    it("treats setVariables as unchanged if passing variables with default in query", async () => {
      const query = gql`
        query ($limit: Int = 5, $offset: Int) {
          users(offset: $offset) {
            id
          }
        }
      `;

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables: { limit: 5, offset: 0 } },
            result: { data: { users: [{ __typename: "User", id: 1 }] } },
          },
        ]),
      });
      const observable = client.watchQuery({
        query,
        variables: { limit: 5, offset: 0 },
        // Ensure we don't get another network request
        fetchPolicy: "network-only",
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: { users: [{ __typename: "User", id: 1 }] },
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(
        observable.setVariables({ offset: 0 })
      ).resolves.toStrictEqualTyped({
        data: { users: [{ __typename: "User", id: 1 }] },
      });

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

      await expect(
        observable.setVariables(differentVariables)
      ).resolves.toStrictEqualTyped({ data: dataTwo });

      // Initial fetch
      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      // setVariables
      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataTwo,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });
  });

  describe("refetch", () => {
    // TODO: If updating this to include a cache result for the changed
    // variables, a cache value is emitted for the refetch, but I believe this
    // should be undefined.
    it("calls fetchRequest with fetchPolicy `network-only` when using a non-networked fetch policy", async () => {
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
        fetchPolicy: "cache-first",
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataOne,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await observable.refetch(differentVariables);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.refetch,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataTwo,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      expect(observable.options.fetchPolicy).toBe("cache-first");

      await expect(stream).not.toEmitAnything();
    });

    it("calling refetch with different variables before the query itself resolved will only yield the result for the new variables", async () => {
      const observers: Observer<ApolloLink.Result<typeof dataOne>>[] = [];
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
        loading: true,
        networkStatus: NetworkStatus.refetch,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataTwo,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("calling refetch multiple times with different variables will return only results for the most recent variables", async () => {
      const observers: Observer<ApolloLink.Result<typeof dataOne>>[] = [];
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

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataOne,
        dataState: "complete",
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

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.refetch,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: {
          people_one: {
            name: "SomeOneElse",
          },
        },
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("if an ObservableQuery is unsubscribed while `refetch` is running, the promise returned by `refetch` rejects with an `AbortError`.", async () => {
      const observers: Observer<ApolloLink.Result<typeof dataOne>>[] = [];
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

      const promise = observableQuery.refetch({ id: 2 });

      stream.unsubscribe();

      observers[1].next({ data: dataTwo });
      observers[1].complete();

      await expect(promise).rejects.toEqual(
        new DOMException("The operation was aborted.", "AbortError")
      );
    });

    it("handles `no-cache` fetchPolicy with refetch", async () => {
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
      const observable = client.watchQuery({
        query,
        variables,
        fetchPolicy: "no-cache",
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataOne,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      expect(client.extract()).toEqual({});

      await expect(
        observable.refetch(differentVariables)
      ).resolves.toStrictEqualTyped({ data: dataTwo });

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.refetch,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataTwo,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      expect(client.extract()).toEqual({});

      // Unlike network-only or cache-and-network, the no-cache
      // FetchPolicy does not switch to cache-first after the first
      // network request.
      expect(observable.options.fetchPolicy).toBe("no-cache");
    });

    it("allows refetch on cache-only query", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          { request: { query, variables }, result: { data: dataOne } },
        ]),
      });
      const observable = client.watchQuery({
        query,
        variables,
        fetchPolicy: "cache-only",
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: true,
      });

      await expect(observable.refetch()).resolves.toStrictEqualTyped({
        data: dataOne,
      });

      await expect(stream).toEmitSimilarValue({
        expected: (previous) => ({
          ...previous,
          loading: true,
          networkStatus: NetworkStatus.refetch,
        }),
      });

      await expect(stream).toEmitTypedValue({
        data: dataOne,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("returns cached results after refetch when changing variables using a cache-and-network fetch policy", async () => {
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
      const variables1 = { first: 0 };

      const data2 = { allPeople: { people: [{ name: "Leia Skywalker" }] } };
      const variables2 = { first: 1 };

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables: variables1 },
            result: { data },
            delay: 20,
          },
          {
            request: { query, variables: variables2 },
            result: { data: data2 },
            delay: 20,
          },
          {
            request: { query, variables: variables1 },
            result: { data },
            delay: 20,
          },
        ]),
      });

      const observable = client.watchQuery({
        query,
        variables: variables1,
        fetchPolicy: "cache-and-network",
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await observable.refetch(variables2);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.refetch,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: data2,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await observable.refetch(variables1);

      await expect(stream).toEmitTypedValue({
        data,
        dataState: "complete",
        loading: true,
        networkStatus: NetworkStatus.refetch,
        partial: false,
      });

      await expect(stream).toEmitTypedValue({
        data,
        dataState: "complete",
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
            delay: 20,
          },
          {
            request: {
              query: queryWithVars,
              variables: variables2,
            },
            result: { data: data2 },
            delay: 20,
          },
          {
            request: {
              query: queryWithVars,
              variables: variables1,
            },
            result: { data },
            delay: 20,
          },
          {
            request: {
              query: queryWithVars,
              variables: variables2,
            },
            result: { data: data2 },
            delay: 20,
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
      });

      expect(observable.options.fetchPolicy).toBe("cache-and-network");
      expect(observable.options.initialFetchPolicy).toBe("cache-and-network");

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.options.fetchPolicy).toBe("cache-first");

      await observable.refetch(variables2);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.refetch,
        partial: true,
      });
      expect(observable.options.fetchPolicy).toBe("cache-first");

      await expect(stream).toEmitTypedValue({
        data: data2,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.options.fetchPolicy).toBe("cache-first");

      {
        const result = await observable.reobserve({ variables: variables1 });

        expect(result).toStrictEqualTyped({ data });
        expect(observable.options.fetchPolicy).toBe("cache-first");
      }

      await expect(stream).toEmitTypedValue({
        data,
        dataState: "complete",
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        partial: false,
      });
      expect(observable.options.fetchPolicy).toBe("cache-first");

      await expect(stream).toEmitTypedValue({
        data,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.options.fetchPolicy).toBe("cache-first");

      {
        const result = await observable.reobserve({ variables: variables2 });

        expect(result).toStrictEqualTyped({ data: data2 });
        expect(observable.options.fetchPolicy).toBe("cache-first");
      }

      await expect(stream).toEmitTypedValue({
        data: data2,
        dataState: "complete",
        loading: true,
        networkStatus: NetworkStatus.setVariables,
        partial: false,
      });
      expect(observable.options.fetchPolicy).toBe("cache-first");

      await expect(stream).toEmitTypedValue({
        data: data2,
        dataState: "complete",
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

    // TODO: Revisit what this will look like when we move local resolvers to
    // the link chain. This is not something that will work if its combined with
    // other cached data.
    it.failing(
      "cache-and-network refetch should run @client(always: true) resolvers when network request fails",
      async () => {
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
        }).pipe(delay(20));

        const intentionalNetworkFailure = new Error(
          "intentional network failure"
        );

        const errorObservable: typeof linkObservable = new Observable(
          (observer) => {
            observer.error(intentionalNetworkFailure);
          }
        );

        const client = new ApolloClient({
          link: new ApolloLink(() => linkObservable),
          cache: new InMemoryCache(),
          localState: new LocalState({
            resolvers: {
              Query: {
                counter() {
                  return ++count;
                },
              },
            },
          }),
        });

        const observable = client.watchQuery({
          query,
          fetchPolicy: "cache-and-network",
          returnPartialData: true,
        });

        const stream = new ObservableStream(observable);

        await expect(stream).toEmitTypedValue({
          data: { counter: 1 },
          dataState: "partial",
          loading: true,
          networkStatus: NetworkStatus.loading,
          partial: true,
        });

        await expect(stream).toEmitTypedValue({
          data: { counter: 2, name: "Ben" },
          dataState: "complete",
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

        await expect(stream).toEmitTypedValue({
          data: { counter: 3, name: "Ben" },
          dataState: "complete",
          loading: true,
          networkStatus: NetworkStatus.refetch,
          partial: false,
        });

        await expect(stream).toEmitTypedValue({
          data: { counter: 3, name: "Ben" },
          dataState: "complete",
          error: intentionalNetworkFailure,
          loading: false,
          networkStatus: NetworkStatus.error,
          partial: false,
        });

        // Switch back from errorObservable.
        linkObservable = oldLinkObs;

        const result = await observable.refetch();

        expect(result).toStrictEqualTyped({
          data: {
            counter: 5,
            name: "Ben",
          },
        });

        await expect(stream).toEmitTypedValue({
          data: { counter: 4, name: "Ben" },
          dataState: "complete",
          loading: true,
          networkStatus: NetworkStatus.refetch,
          partial: false,
        });

        await expect(stream).toEmitTypedValue({
          data: { counter: 5, name: "Ben" },
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await expect(stream).not.toEmitAnything();
      }
    );

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
            delay: 20,
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

        await expect(stream).toEmitTypedValue({
          data: undefined,
          dataState: "empty",
          loading: true,
          networkStatus: NetworkStatus.loading,
          partial: true,
        });

        await expect(stream).toEmitTypedValue({
          data: {
            getVars: [
              { __typename: "Var", name: "a" },
              { __typename: "Var", name: "b" },
              { __typename: "Var", name: "c" },
            ],
          },
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await observableWithoutVariables.refetch({
          variables: ["d", "e"],
        });

        await expect(stream).toEmitTypedValue({
          data: {
            getVars: [
              { __typename: "Var", name: "a" },
              { __typename: "Var", name: "b" },
              { __typename: "Var", name: "c" },
            ],
          },
          dataState: "complete",
          loading: true,
          networkStatus: NetworkStatus.refetch,
          partial: false,
        });

        await expect(stream).toEmitTypedValue({
          data: {
            getVars: [
              { __typename: "Var", name: "d" },
              { __typename: "Var", name: "e" },
            ],
          },
          dataState: "complete",
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

        const queryWithVarsVar: TypedDocumentNode<
          { getVars: Array<{ __typename: "Var"; name: string }> },
          { vars: string[] }
        > = gql`
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
        });

        const stream = new ObservableStream(observableWithVarsVar);

        await expect(stream).toEmitTypedValue({
          data: undefined,
          dataState: "empty",
          loading: true,
          networkStatus: NetworkStatus.loading,
          partial: true,
        });

        await expect(stream).toEmitTypedValue({
          data: {
            getVars: [
              { __typename: "Var", name: "a" },
              { __typename: "Var", name: "b" },
              { __typename: "Var", name: "c" },
            ],
          },
          dataState: "complete",
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

        await expect(stream).toEmitTypedValue({
          data: {
            getVars: [
              { __typename: "Var", name: "a" },
              { __typename: "Var", name: "b" },
              { __typename: "Var", name: "c" },
            ],
          },
          dataState: "complete",
          loading: true,
          networkStatus: NetworkStatus.refetch,
          partial: false,
        });

        await expect(stream).toEmitTypedValue({
          data: {
            getVars: [
              { __typename: "Var", name: "a" },
              { __typename: "Var", name: "b" },
              { __typename: "Var", name: "c" },
            ],
          },
          dataState: "complete",
          error: expect.objectContaining({
            message: expect.stringMatching(
              /No more mocked responses for the query:\s+query QueryWithVarsVar\(\$vars: \[String!\]\)/
            ),
          }),
          loading: false,
          networkStatus: NetworkStatus.error,
          partial: false,
        });

        await expect(promise).rejects.toEqual(
          expect.objectContaining({
            message: expect.stringMatching(
              /No more mocked responses for the query:\s+query QueryWithVarsVar\(\$vars: \[String!\]\)/
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

        const queryWithVariablesVar: TypedDocumentNode<
          { getVars: Array<{ __typename: "Var"; name: string }> },
          { variables: string[] }
        > = gql`
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

        await expect(stream).toEmitTypedValue({
          data: undefined,
          dataState: "empty",
          loading: true,
          networkStatus: NetworkStatus.loading,
          partial: true,
        });

        await expect(stream).toEmitTypedValue({
          data: {
            getVars: [
              { __typename: "Var", name: "a" },
              { __typename: "Var", name: "b" },
              { __typename: "Var", name: "c" },
            ],
          },
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await observableWithVariablesVar.refetch({ variables: ["d", "e"] });

        await expect(stream).toEmitTypedValue({
          data: undefined,
          dataState: "empty",
          loading: true,
          networkStatus: NetworkStatus.refetch,
          partial: true,
        });

        await expect(stream).toEmitTypedValue({
          data: {
            getVars: [
              { __typename: "Var", name: "d" },
              { __typename: "Var", name: "e" },
            ],
          },
          dataState: "complete",
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
      });

      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      const stream = new ObservableStream(observable);

      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });
      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataOneWithTypename,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: dataOneWithTypename,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      void observable.refetch();

      await expect(stream).toEmitTypedValue({
        data: dataOneWithTypename,
        dataState: "complete",
        loading: true,
        networkStatus: NetworkStatus.refetch,
        partial: false,
      });
      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: dataOneWithTypename,
        dataState: "complete",
        loading: true,
        networkStatus: NetworkStatus.refetch,
        partial: false,
      });

      await expect(stream).toEmitTypedValue({
        data: dataTwoWithTypename,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.getCurrentResult()).toStrictEqualTyped({
        dataState: "complete",
        data: dataTwoWithTypename,
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("returns results from the store immediately", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { data: dataOne },
            delay: 20,
          },
        ]),
      });

      client.writeQuery({ query, variables, data: dataOne });

      const observable = client.watchQuery({ query, variables });

      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: dataOne,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      const stream = new ObservableStream(observable);

      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: dataOne,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).toEmitTypedValue({
        data: dataOne,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: dataOne,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("returns errors from the store immediately", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { errors: [error] },
            delay: 20,
          },
        ]),
      });

      const observable = client.watchQuery({ query, variables });

      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      const stream = new ObservableStream(observable);

      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        error: new CombinedGraphQLErrors({ errors: [error] }),
        loading: false,
        networkStatus: NetworkStatus.error,
        partial: true,
      });

      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: undefined,
        dataState: "empty",
        error: new CombinedGraphQLErrors({ errors: [error] }),
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
            delay: 20,
          },
        ]),
      });

      const observable = client.watchQuery({ query, variables });
      const stream = new ObservableStream(observable);

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
        error: new CombinedGraphQLErrors({ errors: [error] }),
        loading: false,
        networkStatus: NetworkStatus.error,
        partial: true,
      });

      const currentResult = observable.getCurrentResult();
      const currentResult2 = observable.getCurrentResult();

      expect(currentResult).toStrictEqualTyped({
        data: undefined,
        dataState: "empty",
        error: new CombinedGraphQLErrors({ errors: [error] }),
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
            delay: 20,
          },
        ]),
      });

      const observable = client.watchQuery({
        query,
        variables,
        errorPolicy: "all",
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataOne,
        dataState: "complete",
        error: new CombinedGraphQLErrors({ data: dataOne, errors: [error] }),
        loading: false,
        networkStatus: NetworkStatus.error,
        partial: false,
      });
      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: dataOne,
        dataState: "complete",
        error: new CombinedGraphQLErrors({ data: dataOne, errors: [error] }),
        loading: false,
        networkStatus: NetworkStatus.error,
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
            delay: 20,
          },
        ]),
      });

      const observable = client.watchQuery({
        query,
        variables,
        errorPolicy: "none",
      });

      const stream = new ObservableStream(observable);

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
        error: wrappedError,
        loading: false,
        networkStatus: NetworkStatus.error,
        partial: true,
      });

      expect(observable.getCurrentResult().error).toEqual(wrappedError);
    });

    it("errors out if errorPolicy is none and the observable has completed", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { data: dataOne, errors: [error] },
            delay: 20,
          },
        ]),
      });

      const observable = client.watchQuery({
        query,
        variables,
        errorPolicy: "none",
      });
      const stream = new ObservableStream(observable);

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
        error: new CombinedGraphQLErrors({ data: dataOne, errors: [error] }),
        loading: false,
        networkStatus: NetworkStatus.error,
        partial: true,
      });

      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: undefined,
        dataState: "empty",
        error: wrappedError,
        loading: false,
        networkStatus: NetworkStatus.error,
        partial: true,
      });
      expect(observable.getCurrentResult()).toMatchObject({
        data: undefined,
        error: wrappedError,
        loading: false,
        networkStatus: NetworkStatus.error,
        partial: true,
      });
    });

    it("ignores errors with data if errorPolicy is ignore", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { errors: [error], data: dataOne },
            delay: 20,
          },
        ]),
      });

      const observable = client.watchQuery({
        query,
        variables,
        errorPolicy: "ignore",
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataOne,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: dataOne,
        dataState: "complete",
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
            request: { query: superQuery, variables },
            result: { data: superDataOne },
            delay: 20,
          },
        ]),
      });

      client.writeQuery({ query, variables, data: dataOne });

      const observable = client.watchQuery({
        query: superQuery,
        variables,
        returnPartialData: true,
      });

      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: dataOne,
        dataState: "partial",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: dataOne,
        dataState: "partial",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });
      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: dataOne,
        dataState: "partial",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: superDataOne,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: superDataOne,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("returns loading even if full data is available when using network-only fetchPolicy", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { data: dataTwo },
            delay: 20,
          },
        ]),
      });

      client.writeQuery({ query, variables, data: dataOne });

      const observable = client.watchQuery({
        query,
        variables,
        fetchPolicy: "network-only",
      });

      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataTwo,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: dataTwo,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("returns loading on no-cache fetchPolicy queries when calling getCurrentResult", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink([
          {
            request: { query, variables },
            result: { data: dataTwo },
            delay: 20,
          },
        ]),
      });

      client.writeQuery({ query, variables, data: dataOne });

      const observable = client.watchQuery({
        query,
        variables,
        fetchPolicy: "no-cache",
      });

      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });
      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      await expect(stream).toEmitTypedValue({
        data: dataTwo,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });
      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: dataTwo,
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      expect(client.readQuery({ query, variables })).toStrictEqualTyped(
        dataOne
      );

      await expect(stream).not.toEmitAnything();
    });

    it("returns loading: false on cache-only queries when calling getCurrentResult with no data in the cache", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: ApolloLink.empty(),
      });

      const observable = client.watchQuery({
        query,
        variables,
        fetchPolicy: "cache-only",
      });

      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: undefined,
        dataState: "empty",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: true,
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: true,
      });
      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: undefined,
        dataState: "empty",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: true,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("returns loading: false on cache-only queries with returnPartialData: true when calling getCurrentResult with partial data in the cache", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: ApolloLink.empty(),
      });

      const observable = client.watchQuery({
        query,
        variables,
        fetchPolicy: "cache-only",
      });

      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: undefined,
        dataState: "empty",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: true,
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: true,
      });
      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: undefined,
        dataState: "empty",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: true,
      });

      await expect(stream).not.toEmitAnything();
    });

    it("returns loading: false on cache-only queries when calling getCurrentResult with data in the cache", async () => {
      const query = gql`
        query {
          user {
            id
            name
          }
        }
      `;
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: ApolloLink.empty(),
      });

      client.writeQuery({
        query: gql`
          query {
            user {
              id
            }
          }
        `,
        variables,
        data: { user: { __typename: "User", id: "1" } },
      });

      const observable = client.watchQuery({
        query,
        variables,
        fetchPolicy: "cache-only",
        returnPartialData: true,
      });

      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: { user: { __typename: "User", id: "1" } },
        dataState: "partial",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: true,
      });

      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue({
        data: { user: { __typename: "User", id: "1" } },
        dataState: "partial",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: true,
      });
      expect(observable.getCurrentResult()).toStrictEqualTyped({
        data: { user: { __typename: "User", id: "1" } },
        dataState: "partial",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: true,
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
        incrementalHandler: new Defer20220824Handler(),
      });

      const obs = client.watchQuery({ query });
      const stream = new ObservableStream(obs);

      await expect(stream).toEmitTypedValue({
        data: undefined,
        dataState: "empty",
        loading: true,
        networkStatus: NetworkStatus.loading,
        partial: true,
      });

      expect(obs.getCurrentResult()).toBe(stream.getCurrent());
      expect(obs.getCurrentResult()).toBe(stream.getCurrent());

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

      await expect(stream).toEmitTypedValue({
        data: markAsStreaming({
          greeting: {
            message: "Hello world",
            __typename: "Greeting",
          },
        }),
        dataState: "streaming",
        loading: true,
        networkStatus: NetworkStatus.streaming,
        partial: true,
      });

      expect(obs.getCurrentResult()).toBe(stream.getCurrent());
      expect(obs.getCurrentResult()).toBe(stream.getCurrent());

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

      await expect(stream).toEmitTypedValue({
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
        dataState: "complete",
        loading: false,
        networkStatus: NetworkStatus.ready,
        partial: false,
      });

      expect(obs.getCurrentResult()).toBe(stream.getCurrent());
      // This 2nd identical check is intentional to ensure calling this function
      // more than once returns the right value.
      expect(obs.getCurrentResult()).toBe(stream.getCurrent());

      await expect(stream).not.toEmitAnything();
    });

    {
      type Result =
        // wait for the emit of a new value
        | { emit: ObservableQuery.Result<{ hello: string }> }
        // don't expect an emit, but `currentResult` should change
        | { currentResult: ObservableQuery.Result<{ hello: string }> }
        // `currentResult` should stay the same
        | undefined;

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
        resultBeforeSubscribe: Exclude<Result, { emit: any }>;
        // observableQuery.subscribe
        resultAfterSubscribe: Result;
        // writeCache:  cacheValues.update1
        resultAfterCacheUpdate1: Result;
        // incoming result: cacheValues.link
        resultAfterLinkNext: Result;
        // writeCache:  cacheValues.update2
        resultAfterCacheUpdate2: Result;
        // observableQuery.refetch
        resultAfterRefetchCall: Result;
        // writeCache:  cacheValues.update3
        resultAfterCacheUpdate3: Result;
        // incoming result:  cacheValues.refetch
        resultAfterRefetchNext: Result;
        // writeCache:  cacheValues.update4
        resultAfterCacheUpdate4: Result;
      };

      it.each<
        [
          initialFetchPolicy: WatchQueryFetchPolicy,
          nextFetchPolicy: WatchQueryFetchPolicy,
          notifyOnNetworkStatusChange: boolean,
          testDetails: TestDetails,
        ]
      >([
        [
          "cache-and-network",
          "cache-and-network",
          true,
          {
            resultBeforeSubscribe: {
              currentResult: {
                ...loadingStates.loading,
                data: cacheValues.initial,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterSubscribe: {
              emit: {
                ...loadingStates.loading,
                data: cacheValues.initial,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate1: {
              emit: {
                ...loadingStates.loading,
                data: cacheValues.update1,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterLinkNext: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.link,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate2: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update2,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterRefetchCall: {
              emit: {
                ...loadingStates.refetching,
                data: cacheValues.update2,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate3: {
              emit: {
                ...loadingStates.refetching,
                data: cacheValues.update3,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterRefetchNext: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.refetch,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate4: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update4,
                dataState: "complete",
                partial: false,
              },
            },
          },
        ],
        [
          "cache-and-network",
          "cache-and-network",
          false,
          {
            resultBeforeSubscribe: {
              currentResult: {
                ...loadingStates.loading,
                data: cacheValues.initial,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterSubscribe: {
              emit: {
                ...loadingStates.loading,
                data: cacheValues.initial,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate1: {
              emit: {
                ...loadingStates.loading,
                data: cacheValues.update1,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterLinkNext: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.link,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate2: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update2,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterRefetchCall: {
              currentResult: {
                ...loadingStates.refetching,
                data: cacheValues.update2,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate3: {
              emit: {
                ...loadingStates.refetching,
                data: cacheValues.update3,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterRefetchNext: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.refetch,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate4: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update4,
                dataState: "complete",
                partial: false,
              },
            },
          },
        ],
        [
          "cache-first",
          "cache-first",
          true,
          {
            resultBeforeSubscribe: {
              currentResult: {
                ...loadingStates.done,
                data: cacheValues.initial,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterSubscribe: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.initial,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate1: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update1,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterLinkNext: undefined,
            resultAfterCacheUpdate2: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update2,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterRefetchCall: {
              emit: {
                ...loadingStates.refetching,
                data: cacheValues.update2,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate3: undefined,
            resultAfterRefetchNext: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.refetch,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate4: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update4,
                dataState: "complete",
                partial: false,
              },
            },
          },
        ],
        [
          "cache-first",
          "cache-first",
          false,
          {
            resultBeforeSubscribe: {
              currentResult: {
                ...loadingStates.done,
                data: cacheValues.initial,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterSubscribe: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.initial,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate1: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update1,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterLinkNext: undefined,
            resultAfterCacheUpdate2: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update2,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterRefetchCall: {
              currentResult: {
                ...loadingStates.refetching,
                data: cacheValues.update2,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate3: undefined,
            resultAfterRefetchNext: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.refetch,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate4: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update4,
                dataState: "complete",
                partial: false,
              },
            },
          },
        ],
        [
          "cache-first",
          "cache-and-network",
          true,
          {
            resultBeforeSubscribe: {
              currentResult: {
                ...loadingStates.done,
                data: cacheValues.initial,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterSubscribe: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.initial,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate1: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update1,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterLinkNext: undefined,
            resultAfterCacheUpdate2: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update2,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterRefetchCall: {
              emit: {
                ...loadingStates.refetching,
                data: cacheValues.update2,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate3: {
              emit: {
                ...loadingStates.refetching,
                data: cacheValues.update3,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterRefetchNext: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.refetch,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate4: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update4,
                dataState: "complete",
                partial: false,
              },
            },
          },
        ],
        [
          "cache-first",
          "cache-and-network",
          false,
          {
            resultBeforeSubscribe: {
              currentResult: {
                ...loadingStates.done,
                data: cacheValues.initial,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterSubscribe: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.initial,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate1: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update1,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterLinkNext: undefined,
            resultAfterCacheUpdate2: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update2,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterRefetchCall: {
              currentResult: {
                ...loadingStates.refetching,
                data: cacheValues.update2,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate3: {
              emit: {
                ...loadingStates.refetching,
                data: cacheValues.update3,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterRefetchNext: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.refetch,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate4: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update4,
                dataState: "complete",
                partial: false,
              },
            },
          },
        ],
        [
          "no-cache",
          "no-cache",
          true,
          {
            resultBeforeSubscribe: {
              currentResult: {
                ...loadingStates.loading,
                data: undefined,
                dataState: "empty",
                partial: true,
              },
            },
            resultAfterSubscribe: {
              emit: {
                ...loadingStates.loading,
                data: undefined,
                dataState: "empty",
                partial: true,
              },
            },
            resultAfterCacheUpdate1: undefined,
            resultAfterLinkNext: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.link,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate2: undefined,
            resultAfterRefetchCall: {
              emit: {
                ...loadingStates.refetching,
                data: cacheValues.link,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate3: undefined,
            resultAfterRefetchNext: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.refetch,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate4: undefined,
          },
        ],
        [
          "no-cache",
          "no-cache",
          false,
          {
            resultBeforeSubscribe: {
              currentResult: {
                ...loadingStates.loading,
                data: undefined,
                dataState: "empty",
                partial: true,
              },
            },
            resultAfterSubscribe: {
              currentResult: {
                ...loadingStates.loading,
                data: undefined,
                dataState: "empty",
                partial: true,
              },
            },
            resultAfterCacheUpdate1: undefined,
            resultAfterLinkNext: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.link,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate2: undefined,
            resultAfterRefetchCall: {
              currentResult: {
                ...loadingStates.refetching,
                data: cacheValues.link,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate3: undefined,
            resultAfterRefetchNext: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.refetch,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate4: undefined,
          },
        ],
        [
          "no-cache",
          "cache-and-network",
          true,
          {
            resultBeforeSubscribe: {
              currentResult: {
                ...loadingStates.loading,
                data: undefined,
                dataState: "empty",
                partial: true,
              },
            },
            resultAfterSubscribe: {
              emit: {
                ...loadingStates.loading,
                data: undefined,
                dataState: "empty",
                partial: true,
              },
            },
            resultAfterCacheUpdate1: undefined,
            resultAfterLinkNext: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.link,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate2: undefined,
            resultAfterRefetchCall: {
              emit: {
                ...loadingStates.refetching,
                data: cacheValues.link,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate3: {
              emit: {
                ...loadingStates.refetching,
                data: cacheValues.update3,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterRefetchNext: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.refetch,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate4: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update4,
                dataState: "complete",
                partial: false,
              },
            },
          },
        ],
        [
          "no-cache",
          "cache-and-network",
          false,
          {
            resultBeforeSubscribe: {
              currentResult: {
                ...loadingStates.loading,
                data: undefined,
                dataState: "empty",
                partial: true,
              },
            },
            resultAfterSubscribe: {
              currentResult: {
                ...loadingStates.loading,
                data: undefined,
                dataState: "empty",
                partial: true,
              },
            },
            resultAfterCacheUpdate1: undefined,
            resultAfterLinkNext: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.link,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate2: undefined,
            resultAfterRefetchCall: {
              currentResult: {
                ...loadingStates.refetching,
                data: cacheValues.link,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate3: {
              emit: {
                ...loadingStates.refetching,
                data: cacheValues.update3,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterRefetchNext: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.refetch,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate4: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update4,
                dataState: "complete",
                partial: false,
              },
            },
          },
        ],
        [
          "standby",
          "standby",
          true,
          {
            resultBeforeSubscribe: {
              currentResult: {
                ...loadingStates.done,
                data: undefined,
                dataState: "empty",
                partial: true,
              },
            },
            resultAfterSubscribe: {
              currentResult: {
                ...loadingStates.done,
                data: undefined,
                dataState: "empty",
                partial: true,
              },
            },
            resultAfterCacheUpdate1: undefined,
            resultAfterLinkNext: undefined,
            resultAfterCacheUpdate2: undefined,
            resultAfterRefetchCall: {
              // TODO: this seems to be wrong behavior
              currentResult: {
                ...loadingStates.refetching,
                data: undefined,
                dataState: "empty",
                partial: true,
              },
            },
            resultAfterCacheUpdate3: undefined,
            resultAfterRefetchNext: {
              currentResult: {
                ...loadingStates.done,
                data: cacheValues.refetch,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate4: undefined,
          },
        ],
        [
          "standby",
          "standby",
          false,
          {
            resultBeforeSubscribe: {
              currentResult: {
                ...loadingStates.done,
                data: undefined,
                dataState: "empty",
                partial: true,
              },
            },
            resultAfterSubscribe: {
              currentResult: {
                ...loadingStates.done,
                data: undefined,
                dataState: "empty",
                partial: true,
              },
            },
            resultAfterCacheUpdate1: undefined,
            resultAfterLinkNext: undefined,
            resultAfterCacheUpdate2: undefined,
            resultAfterRefetchCall: {
              // TODO: this seems to be wrong behavior
              currentResult: {
                ...loadingStates.refetching,
                data: undefined,
                dataState: "empty",
                partial: true,
              },
            },
            resultAfterCacheUpdate3: undefined,
            resultAfterRefetchNext: {
              currentResult: {
                ...loadingStates.done,
                data: cacheValues.refetch,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate4: undefined,
          },
        ],
        [
          "standby",
          "cache-and-network",
          true,
          {
            resultBeforeSubscribe: {
              currentResult: {
                ...loadingStates.done,
                data: undefined,
                dataState: "empty",
                partial: true,
              },
            },
            resultAfterSubscribe: {
              currentResult: {
                ...loadingStates.done,
                data: undefined,
                dataState: "empty",
                partial: true,
              },
            },
            resultAfterCacheUpdate1: undefined,
            resultAfterLinkNext: undefined,
            resultAfterCacheUpdate2: undefined,
            resultAfterRefetchCall: {
              // TODO: this seems to be wrong behavior
              currentResult: {
                ...loadingStates.refetching,
                data: undefined,
                dataState: "empty",
                partial: true,
              },
            },
            resultAfterCacheUpdate3: undefined,
            resultAfterRefetchNext: {
              currentResult: {
                ...loadingStates.done,
                data: cacheValues.refetch,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate4: undefined,
          },
        ],
        [
          "standby",
          "cache-and-network",
          false,
          {
            resultBeforeSubscribe: {
              currentResult: {
                ...loadingStates.done,
                data: undefined,
                dataState: "empty",
                partial: true,
              },
            },
            resultAfterSubscribe: {
              currentResult: {
                ...loadingStates.done,
                data: undefined,
                dataState: "empty",
                partial: true,
              },
            },
            resultAfterCacheUpdate1: undefined,
            resultAfterLinkNext: undefined,
            resultAfterCacheUpdate2: undefined,
            resultAfterRefetchCall: {
              // TODO: this seems to be wrong behavior
              currentResult: {
                ...loadingStates.refetching,
                data: undefined,
                dataState: "empty",
                partial: true,
              },
            },
            resultAfterCacheUpdate3: undefined,
            resultAfterRefetchNext: {
              currentResult: {
                ...loadingStates.done,
                data: cacheValues.refetch,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate4: undefined,
          },
        ],
        [
          "cache-only",
          "cache-only",
          true,
          {
            resultBeforeSubscribe: {
              currentResult: {
                ...loadingStates.done,
                data: cacheValues.initial,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterSubscribe: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.initial,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate1: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update1,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterLinkNext: undefined,
            resultAfterCacheUpdate2: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update2,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterRefetchCall: {
              emit: {
                ...loadingStates.refetching,
                data: cacheValues.update2,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate3: {
              emit: {
                ...loadingStates.refetching,
                data: cacheValues.update3,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterRefetchNext: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.refetch,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate4: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update4,
                dataState: "complete",
                partial: false,
              },
            },
          },
        ],
        [
          "cache-only",
          "cache-only",
          false,
          {
            resultBeforeSubscribe: {
              currentResult: {
                ...loadingStates.done,
                data: cacheValues.initial,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterSubscribe: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.initial,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate1: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update1,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterLinkNext: undefined,
            resultAfterCacheUpdate2: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update2,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterRefetchCall: {
              currentResult: {
                ...loadingStates.refetching,
                data: cacheValues.update2,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate3: {
              emit: {
                ...loadingStates.refetching,
                data: cacheValues.update3,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterRefetchNext: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.refetch,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate4: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update4,
                dataState: "complete",
                partial: false,
              },
            },
          },
        ],
        [
          "cache-only",
          "cache-and-network",
          true,
          {
            resultBeforeSubscribe: {
              currentResult: {
                ...loadingStates.done,
                data: cacheValues.initial,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterSubscribe: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.initial,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate1: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update1,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterLinkNext: undefined,
            resultAfterCacheUpdate2: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update2,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterRefetchCall: {
              emit: {
                ...loadingStates.refetching,
                data: cacheValues.update2,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate3: {
              emit: {
                ...loadingStates.refetching,
                data: cacheValues.update3,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterRefetchNext: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.refetch,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate4: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update4,
                dataState: "complete",
                partial: false,
              },
            },
          },
        ],
        [
          "cache-only",
          "cache-and-network",
          false,
          {
            resultBeforeSubscribe: {
              currentResult: {
                ...loadingStates.done,
                data: cacheValues.initial,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterSubscribe: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.initial,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate1: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update1,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterLinkNext: undefined,
            resultAfterCacheUpdate2: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update2,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterRefetchCall: {
              currentResult: {
                ...loadingStates.refetching,
                data: cacheValues.update2,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate3: {
              emit: {
                ...loadingStates.refetching,
                data: cacheValues.update3,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterRefetchNext: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.refetch,
                dataState: "complete",
                partial: false,
              },
            },
            resultAfterCacheUpdate4: {
              emit: {
                ...loadingStates.done,
                data: cacheValues.update4,
                dataState: "complete",
                partial: false,
              },
            },
          },
        ],
      ])(
        "fetchPolicy %s -> %s (notifyOnNetworkStatusChange %s)",
        async (
          fetchPolicy,
          nextFetchPolicy,
          notifyOnNetworkStatusChange,
          {
            resultBeforeSubscribe,
            resultAfterSubscribe,
            resultAfterCacheUpdate1,
            resultAfterLinkNext,
            resultAfterCacheUpdate2,
            resultAfterRefetchCall,
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
          let subject = new Subject<ApolloLink.Result>();
          const link = new ApolloLink(() => subject);
          const cache = new InMemoryCache({});
          cache.writeQuery({ query, data: cacheValues.initial });

          const client = new ApolloClient({ link, cache });
          const observableQuery = client.watchQuery({
            query,
            fetchPolicy,
            nextFetchPolicy,
            notifyOnNetworkStatusChange,
          });

          let lastCurrentResult = observableQuery.getCurrentResult();
          async function check(result: Result, expectedName: string) {
            if (!result) {
              expect(observableQuery.getCurrentResult()).toStrictEqualTyped(
                lastCurrentResult,
                {
                  received: "observableQuery.getCurrentResult()",
                  expected: expectedName,
                  hintOptions: {
                    comment: "should not change from previous comparison",
                  },
                }
              );
            } else if ("emit" in result) {
              await expect(stream).toEmitTypedValue(result.emit, {
                expected: expectedName,
              });
              expect(observableQuery.getCurrentResult()).toStrictEqualTyped(
                result.emit,
                {
                  expected: expectedName,
                  received: "observableQuery.getCurrentResult()",
                  hintOptions: {
                    comment:
                      "observableQuery.getCurrentResult() should equal emitted value immediately after emit",
                  },
                }
              );
            } else {
              await waitFor(() => {
                expect(observableQuery.getCurrentResult()).toStrictEqualTyped(
                  result.currentResult,
                  {
                    expected: expectedName,
                    received: "observableQuery.getCurrentResult()",
                    hintOptions: {
                      comment:
                        "waiting for `getCurrentResult` to change to expected value",
                    },
                  }
                );
              });
            }
            lastCurrentResult = observableQuery.getCurrentResult();
          }

          await check(resultBeforeSubscribe, "resultBeforeSubscribe");

          const stream = new ObservableStream(observableQuery);
          await check(resultAfterSubscribe, "resultAfterSubscribe");

          cache.writeQuery({ query, data: cacheValues.update1 });

          await check(resultAfterCacheUpdate1, "resultAfterCacheUpdate1");

          setTimeout(() => {
            subject.next({ data: cacheValues.link });
            subject.complete();
          });
          await check(resultAfterLinkNext, "resultAfterLinkNext");

          cache.writeQuery({ query, data: cacheValues.update2 });
          await check(resultAfterCacheUpdate2, "resultAfterCacheUpdate2");

          await lastValueFrom(subject, { defaultValue: undefined });
          subject = new Subject();
          void observableQuery.refetch().catch(() => {});
          await check(resultAfterRefetchCall, "resultAfterRefetchCall");

          cache.writeQuery({ query, data: cacheValues.update3 });

          await check(resultAfterCacheUpdate3, "resultAfterCacheUpdate3");

          setTimeout(() => {
            subject.next({ data: cacheValues.refetch });
            subject.complete();
          });
          await check(resultAfterRefetchNext, "resultAfterRefetchNext");

          cache.writeQuery({ query, data: cacheValues.update4 });
          await check(resultAfterCacheUpdate4, "resultAfterCacheUpdate4");

          await expect(stream).not.toEmitAnything();
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

        await expect(stream).toEmitTypedValue({
          data: undefined,
          dataState: "empty",
          loading: true,
          networkStatus: NetworkStatus.loading,
          partial: true,
        });

        await expect(stream).toEmitTypedValue({
          data: dataOne,
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });
        expect(observable.getCurrentResult()).toStrictEqualTyped({
          data: dataOne,
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        void client.mutate({
          mutation,
          optimisticResponse,
          updateQueries,
        });

        await expect(stream).toEmitTypedValue({
          data: {
            people_one: optimisticResponse,
          },
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });
        expect(observable.getCurrentResult()).toStrictEqualTyped({
          data: {
            people_one: optimisticResponse,
          },
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await expect(stream).toEmitTypedValue({
          data: {
            people_one: mutationData,
          },
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });
        expect(observable.getCurrentResult()).toStrictEqualTyped({
          data: {
            people_one: mutationData,
          },
          dataState: "complete",
          loading: false,
          networkStatus: NetworkStatus.ready,
          partial: false,
        });

        await expect(stream).not.toEmitAnything();
      });
    });
  });

  describe("assumeImmutableResults", () => {
    // Need to handle loading state or notifyOnNetworkStatusChange: false
    // properly
    it.skip("should prevent costly (but safe) cloneDeep calls", async () => {
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
          ]),
          assumeImmutableResults,
          cache,
        });

        const observable = client.watchQuery<any>(queryOptions);
        const values: any[] = [];

        return new Promise<any[]>((resolve, reject) => {
          observable.subscribe({
            next({ data }) {
              values.push(data.value);
              if (assertFrozenResults) {
                try {
                  data.value = "oyez";
                } catch (error) {
                  observable.stopPolling();
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

    it("is updated with transformed query when `reobserve` changes the query", async () => {
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

      // Don't write results to the cache to prevent cache write warnings on
      // missing data
      const observable = client.watchQuery({ query, fetchPolicy: "no-cache" });

      expect(observable.query).toMatchDocument(gql`
        query {
          currentUser {
            id
            __typename
          }
        }
      `);

      await observable.reobserve({ query: updatedQuery });

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
        expect(observable.getCurrentResult()).toStrictEqualTyped({
          data: dataOne,
          dataState: "complete",
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

    const observable = client.watchQuery({ query, variables });

    const cache = client.cache;
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: dataOne,
      dataState: "complete",
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
        expect(watch.watcher).toBe(observable);
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

    expect(invalidateCount).toBe(1);
    expect(onWatchUpdatedCount).toBe(1);
    client.stop();

    await expect(stream).toComplete();
  });
});

test("regression test for #10587", async () => {
  let observers: Record<string, Observer<ApolloLink.Result>> = {};
  const link = new ApolloLink((operation) => {
    return new Observable((observer) => {
      observers[operation.operationName!] = observer;
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
          dataState: "complete",
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
          dataState: "complete",
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
          dataState: "complete",
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
          dataState: "complete",
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
              b: "b",
            },
          },
          dataState: "complete",
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
  });
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
    expect(observable.getCurrentResult()).toStrictEqualTyped({
      data: { userCount: 10 },
      dataState: "complete",
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
  expect(observable.getCurrentResult()).toStrictEqualTyped({
    data: { userCount: 10 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
});

test("works with `from`", async () => {
  const query = gql`
    query {
      hello
    }
  `;
  const data = {
    hello: "world",
  };
  const link = new MockLink([
    {
      request: { query },
      result: { data },
    },
  ]);
  const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
  });
  const observableQuery = client.watchQuery({
    query,
  });

  const observable = from(observableQuery);
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data,
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
});

test("does not emit initial loading state with notifyOnNetworkStatusChange: false", async () => {
  const query = gql`
    query {
      hello
    }
  `;
  const data = { hello: "world" };

  const client = new ApolloClient({
    link: new MockLink([{ request: { query }, result: { data } }]),
    cache: new InMemoryCache(),
  });

  const observable = client.watchQuery({
    query,
    notifyOnNetworkStatusChange: false,
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data,
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("does not emit initial loading state using network-only fetch policy with notifyOnNetworkStatusChange: false", async () => {
  const query = gql`
    query {
      hello
    }
  `;
  const data = { hello: "world" };

  const client = new ApolloClient({
    link: new MockLink([{ request: { query }, result: { data } }]),
    cache: new InMemoryCache(),
  });

  const observable = client.watchQuery({
    query,
    notifyOnNetworkStatusChange: false,
    fetchPolicy: "network-only",
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data,
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("does not emit initial loading state using cache-and-network fetch policy with notifyOnNetworkStatusChange: false", async () => {
  const query = gql`
    query {
      hello
    }
  `;
  const data = { hello: "world" };

  const client = new ApolloClient({
    link: new MockLink([{ request: { query }, result: { data } }]),
    cache: new InMemoryCache(),
  });

  const observable = client.watchQuery({
    query,
    notifyOnNetworkStatusChange: false,
    fetchPolicy: "cache-and-network",
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data,
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("emits initial loading state using cache-and-network fetch policy with initial cached data with notifyOnNetworkStatusChange: false", async () => {
  const query = gql`
    query {
      hello
    }
  `;

  const client = new ApolloClient({
    link: new MockLink([
      { request: { query }, result: { data: { hello: "world" } }, delay: 20 },
    ]),
    cache: new InMemoryCache(),
  });

  client.writeQuery({ query, data: { hello: "world (cached)" } });

  const observable = client.watchQuery({
    query,
    notifyOnNetworkStatusChange: false,
    fetchPolicy: "cache-and-network",
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: { hello: "world (cached)" },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: false,
  });

  await expect(stream).toEmitTypedValue({
    data: { hello: "world" },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("does not emit initial loading state using no-cache fetch policy with notifyOnNetworkStatusChange: false", async () => {
  const query = gql`
    query {
      hello
    }
  `;
  const data = { hello: "world" };

  const client = new ApolloClient({
    link: new MockLink([{ request: { query }, result: { data } }]),
    cache: new InMemoryCache(),
  });

  const observable = client.watchQuery({
    query,
    notifyOnNetworkStatusChange: false,
    fetchPolicy: "no-cache",
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data,
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("does not emit loading state on refetch with notifyOnNetworkStatusChange: false", async () => {
  const query = gql`
    query {
      hello
    }
  `;

  const client = new ApolloClient({
    link: new MockLink([
      { request: { query }, result: { data: { hello: "world" } }, delay: 20 },
      { request: { query }, result: { data: { hello: "world 2" } }, delay: 20 },
    ]),
    cache: new InMemoryCache(),
  });

  const observable = client.watchQuery({
    query,
    notifyOnNetworkStatusChange: false,
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: { hello: "world" },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(observable.refetch()).resolves.toStrictEqualTyped({
    data: { hello: "world 2" },
  });

  await expect(stream).toEmitTypedValue({
    data: { hello: "world 2" },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("does not emit loading state on refetch with new variables with notifyOnNetworkStatusChange: false", async () => {
  const query = gql`
    query ($recipient: String!) {
      greeting(recipient: $recipient)
    }
  `;

  const client = new ApolloClient({
    link: new ApolloLink((operation) => {
      return new Observable((observer) => {
        setTimeout(() => {
          observer.next({
            data: { greeting: `Hello, ${operation.variables.recipient}` },
          });
          observer.complete();
        }, 20);
      });
    }),
    cache: new InMemoryCache(),
  });

  const observable = client.watchQuery({
    query,
    variables: { recipient: "Test" },
    notifyOnNetworkStatusChange: false,
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: { greeting: "Hello, Test" },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(
    observable.refetch({ recipient: "Test 2" })
  ).resolves.toStrictEqualTyped({ data: { greeting: "Hello, Test 2" } });

  await expect(stream).toEmitTypedValue({
    data: { greeting: "Hello, Test 2" },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("does not emit loading state on setVariables with notifyOnNetworkStatusChange: false", async () => {
  const query: TypedDocumentNode<{ greeting: string }, { recipient: string }> =
    gql`
      query ($recipient: String!) {
        greeting(recipient: $recipient)
      }
    `;

  const client = new ApolloClient({
    link: new ApolloLink((operation) => {
      return new Observable((observer) => {
        setTimeout(() => {
          observer.next({
            data: { greeting: `Hello, ${operation.variables.recipient}` },
          });
          observer.complete();
        }, 20);
      });
    }),
    cache: new InMemoryCache(),
  });

  const observable = client.watchQuery({
    query,
    variables: { recipient: "Test" },
    notifyOnNetworkStatusChange: false,
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: { greeting: "Hello, Test" },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(
    observable.setVariables({ recipient: "Test 2" })
  ).resolves.toStrictEqualTyped({ data: { greeting: "Hello, Test 2" } });

  await expect(stream).toEmitTypedValue({
    data: { greeting: "Hello, Test 2" },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("does not emit loading state on reobserve with notifyOnNetworkStatusChange: false", async () => {
  const query: TypedDocumentNode<{ greeting: string }, { recipient: string }> =
    gql`
      query ($recipient: String!) {
        greeting(recipient: $recipient)
      }
    `;

  const client = new ApolloClient({
    link: new ApolloLink((operation) => {
      return new Observable((observer) => {
        setTimeout(() => {
          observer.next({
            data: { greeting: `Hello, ${operation.variables.recipient}` },
          });
          observer.complete();
        }, 20);
      });
    }),
    cache: new InMemoryCache(),
  });

  const observable = client.watchQuery({
    query,
    variables: { recipient: "Test" },
    notifyOnNetworkStatusChange: false,
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: { greeting: "Hello, Test" },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(
    observable.reobserve({ variables: { recipient: "Test 2" } })
  ).resolves.toStrictEqualTyped({ data: { greeting: "Hello, Test 2" } });

  await expect(stream).toEmitTypedValue({
    data: { greeting: "Hello, Test 2" },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("does not emit loading state on fetchMore with notifyOnNetworkStatusChange: false", async () => {
  const query: TypedDocumentNode<
    { comments: Array<{ __typename: "Comment"; id: number }> },
    { limit: number; offset: number }
  > = gql`
    query ($limit: Int!, $offset: Int!) {
      comments(limit: $limit, offset: $offset) {
        id
      }
    }
  `;

  const client = new ApolloClient({
    link: new MockLink([
      {
        request: { query, variables: { offset: 0, limit: 2 } },
        result: {
          data: {
            comments: [
              { __typename: "Comment", id: 1 },
              { __typename: "Comment", id: 2 },
            ],
          },
        },
      },
      {
        request: { query, variables: { offset: 2, limit: 2 } },
        result: {
          data: {
            comments: [
              { __typename: "Comment", id: 3 },
              { __typename: "Comment", id: 4 },
            ],
          },
        },
      },
    ]),
    cache: new InMemoryCache(),
  });

  const observable = client.watchQuery({
    query,
    variables: { offset: 0, limit: 2 },
    notifyOnNetworkStatusChange: false,
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: {
      comments: [
        { __typename: "Comment", id: 1 },
        { __typename: "Comment", id: 2 },
      ],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(
    observable.fetchMore({
      variables: { offset: 2, limit: 2 },
      updateQuery: (_, { fetchMoreResult }) => fetchMoreResult,
    })
  ).resolves.toStrictEqualTyped({
    data: {
      comments: [
        { __typename: "Comment", id: 3 },
        { __typename: "Comment", id: 4 },
      ],
    },
  });

  await expect(stream).toEmitTypedValue({
    data: {
      comments: [
        { __typename: "Comment", id: 3 },
        { __typename: "Comment", id: 4 },
      ],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test.each(["cache-first", "network-only"] as const)(
  "`fetchMore` with `fetchPolicy` `%s` will leave `loading` even if a result doesn't trigger cache change",
  async (fetchPolicy) => {
    const query: TypedDocumentNode<
      {
        items: {
          __typename: "ItemConnection";
          edges: {
            __typename: "ItemEdge";
            cursor: string;
            node: { __typename: "Item"; id: string; attributes: string[] };
          }[];
          pageInfo: {
            __typename: "PageInfo";
            hasNextPage: boolean;
            endCursor: string | null;
          };
        };
      },
      {
        first?: number;
        after?: string;
      }
    > = gql`
  query Items($first: Int, $after: String) {
    items(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          attributes
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
    const firstResult: ResultOf<typeof query> = {
      items: {
        edges: [
          {
            cursor: "YXJyYXljb25uZWN0aW9uOjA=",
            node: {
              id: "0",
              attributes: ["data"],
              __typename: "Item",
            },
            __typename: "ItemEdge",
          },
          {
            cursor: "YXJyYXljb25uZWN0aW9uOjk=",
            node: {
              id: "9",
              attributes: ["data"],
              __typename: "Item",
            },
            __typename: "ItemEdge",
          },
        ],
        pageInfo: {
          hasNextPage: false,
          endCursor: "YXJyYXljb25uZWN0aW9uOjk=",
          __typename: "PageInfo",
        },
        __typename: "ItemConnection",
      },
    };

    const secondResult: ResultOf<typeof query> = {
      items: {
        edges: [],
        pageInfo: {
          hasNextPage: false,
          endCursor: null,
          __typename: "PageInfo",
        },
        __typename: "ItemConnection",
      },
    };

    const client = new ApolloClient({
      link: new MockLink([
        {
          request: { query, variables: { first: 2 } },
          result: {
            data: firstResult,
          },
        },
        {
          request: {
            query,
            variables: {
              first: 10,
              after: "YXJyYXljb25uZWN0aW9uOjk=",
            },
          },
          result: {
            data: secondResult,
          },
        },
      ] satisfies MockLink.MockedResponse<ResultOf<typeof query>>[]),
      cache: new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              items: relayStylePagination(),
            },
          },
        },
      }),
    });

    const observable = client.watchQuery({
      query,
      variables: { first: 2 },
      fetchPolicy,
    });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: {
        items: {
          __typename: "ItemConnection",
          edges: firstResult.items.edges,
          pageInfo: {
            __typename: "PageInfo",
            hasNextPage: false,
            endCursor: "YXJyYXljb25uZWN0aW9uOjk=",
          },
        },
      },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    const more = observable.fetchMore({
      variables: {
        first: 10,
        after: "YXJyYXljb25uZWN0aW9uOjk=",
      },
    });

    await expect(stream).toEmitSimilarValue({
      expected(previous) {
        return {
          ...previous,
          loading: true,
          networkStatus: NetworkStatus.fetchMore,
        };
      },
    });

    await expect(more).resolves.toStrictEqualTyped({
      data: {
        items: {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
            __typename: "PageInfo",
          },
          __typename: "ItemConnection",
        },
      },
    });

    await expect(stream).toEmitSimilarValue({
      expected(previous) {
        return {
          ...previous,
          loading: false,
          networkStatus: NetworkStatus.ready,
        };
      },
    });

    await expect(stream).not.toEmitAnything();
  }
);

test("does not emit loading state on client.resetStore with notifyOnNetworkStatusChange: false", async () => {
  const query: TypedDocumentNode<
    { count: number },
    Record<string, never>
  > = gql`
    query {
      count
    }
  `;

  let count = 0;
  const client = new ApolloClient({
    link: new ApolloLink(() => {
      return new Observable((observer) => {
        setTimeout(() => {
          observer.next({
            data: { count: ++count },
          });
          observer.complete();
        }, 20);
      });
    }),
    cache: new InMemoryCache(),
  });

  const observable = client.watchQuery({
    query,
    notifyOnNetworkStatusChange: false,
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: { count: 1 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await client.resetStore();

  await expect(stream).toEmitTypedValue({
    data: { count: 2 },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("does not emit loading state on when evicting fields with notifyOnNetworkStatusChange: false", async () => {
  const query = gql`
    query {
      user {
        id
        username
      }
    }
  `;

  const cache = new InMemoryCache();
  const client = new ApolloClient({
    cache,
    link: new MockLink([
      {
        request: { query },
        result: {
          data: { user: { __typename: "User", id: 1, username: "test1" } },
        },
      },
      {
        request: { query },
        result: {
          data: { user: { __typename: "User", id: 1, username: "test2" } },
        },
      },
    ]),
  });

  const observable = client.watchQuery({
    query,
    notifyOnNetworkStatusChange: false,
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: { user: { __typename: "User", id: 1, username: "test1" } },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  client.cache.modify({
    id: cache.identify({ __typename: "User", id: 1 }),
    fields: {
      username: (_, { DELETE }) => DELETE,
    },
  });

  await expect(stream).toEmitTypedValue({
    data: { user: { __typename: "User", id: 1, username: "test2" } },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("emits proper cache result if cache changes between watchQuery initialization and subscription", async () => {
  const query = gql`
    query {
      value
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeQuery({ query, data: { value: "initial" } });
  const observable = client.watchQuery({ query });
  client.writeQuery({ query, data: { value: "updated" } });

  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: { value: "updated" },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("emits proper cache result if cache changes when subscribing after previously unsubscribing", async () => {
  const query = gql`
    query {
      value
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeQuery({ query, data: { value: "initial" } });
  const observable = client.watchQuery({ query });

  {
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: { value: "initial" },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await expect(stream).not.toEmitAnything();

    stream.unsubscribe();
  }

  client.writeQuery({ query, data: { value: "updated" } });

  {
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: { value: "updated" },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await expect(stream).not.toEmitAnything();
  }
});

test("emits loading state when switching from standby to non-standby fetch policy", async () => {
  const query = gql`
    query {
      greeting
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: { data: { greeting: "hello" } },
        delay: 20,
      },
    ]),
  });

  const observable = client.watchQuery({ query, fetchPolicy: "standby" });
  const stream = new ObservableStream(observable);

  await expect(stream).not.toEmitAnything();

  await expect(
    observable.reobserve({ fetchPolicy: "cache-first" })
  ).resolves.toStrictEqualTyped({ data: { greeting: "hello" } });

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { greeting: "hello" },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("does not emit loading state when changing variables with standby fetch policy", async () => {
  const query = gql`
    query ($id: ID!) {
      user(id: $id) {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const observable = client.watchQuery({
    query,
    variables: { id: 1 },
    fetchPolicy: "standby",
  });
  const stream = new ObservableStream(observable);

  await expect(stream).not.toEmitAnything();

  await expect(
    observable.reobserve({ variables: { id: 2 } })
  ).resolves.toStrictEqualTyped({ data: undefined });

  await expect(stream).not.toEmitAnything();

  expect(observable.options.variables).toStrictEqualTyped({ id: 2 });
});

test("emits loading state when calling reobserve with new fetch policy after changing variables with standby fetch policy", async () => {
  const query = gql`
    query ($id: ID!) {
      user(id: $id) {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: { id: 2 } },
        result: {
          data: { user: { __typename: "User", id: 2, name: "Test 2" } },
        },
        delay: 20,
      },
    ]),
  });

  const observable = client.watchQuery({
    query,
    variables: { id: 1 },
    fetchPolicy: "standby",
  });
  const stream = new ObservableStream(observable);

  await expect(stream).not.toEmitAnything();

  await expect(
    observable.reobserve({ variables: { id: 2 } })
  ).resolves.toStrictEqualTyped({ data: undefined });

  await expect(stream).not.toEmitAnything();

  await expect(
    observable.reobserve({ fetchPolicy: "cache-first" })
  ).resolves.toStrictEqualTyped({
    data: { user: { __typename: "User", id: 2, name: "Test 2" } },
  });

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { user: { __typename: "User", id: 2, name: "Test 2" } },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test('completes open subscription when "stop" is called', async () => {
  const link = new MockSubscriptionLink();
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link,
  });
  const query = gql`
    query {
      greeting
    }
  `;
  const observable = client.watchQuery({ query });
  const stream = new ObservableStream(observable);
  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  expect(observable.hasObservers()).toBe(true);
  observable.stop();
  await expect(stream).toComplete();
  expect(observable.hasObservers()).toBe(false);
});

test('accepts new subscribers after "stop" is called', async () => {
  const link = new MockSubscriptionLink();
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link,
  });
  const query = gql`
    query {
      greeting
    }
  `;
  const observable = client.watchQuery({ query });
  const stream = new ObservableStream(observable);
  const firstOperation = link.operation;
  expect(firstOperation).toBeDefined();
  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  expect(observable.hasObservers()).toBe(true);
  observable.stop();
  await expect(stream).toComplete();
  expect(observable.hasObservers()).toBe(false);

  const stream2 = new ObservableStream(observable);
  const secondOperation = link.operation;
  expect(secondOperation).toBeDefined();
  expect(secondOperation).not.toBe(firstOperation);
  await expect(stream2).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  expect(observable.hasObservers()).toBe(true);
});

test('completes open subscription when "client.stop" is called', async () => {
  const link = new MockSubscriptionLink();
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link,
  });
  const query = gql`
    query {
      greeting
    }
  `;
  const observable = client.watchQuery({ query });
  const stream = new ObservableStream(observable);
  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  expect(observable.hasObservers()).toBe(true);
  client.stop();
  await expect(stream).toComplete();
  expect(observable.hasObservers()).toBe(false);
});

describe(".variables", () => {
  test("returns empty object when no variables are passed", () => {
    const query: TypedDocumentNode<
      { greeting: string },
      Record<string, never>
    > = gql`
      query {
        greeting
      }
    `;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });
    const observable = client.watchQuery({ query });

    expect(observable.variables).toStrictEqualTyped({});
  });

  test("returns configured variables", () => {
    const query: TypedDocumentNode<{ user: { name: string } }, { id: number }> =
      gql`
        query ($id: ID!) {
          user(id: $id) {
            name
          }
        }
      `;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });
    const observable = client.watchQuery({ query, variables: { id: 1 } });

    expect(observable.variables).toStrictEqualTyped({ id: 1 });
  });

  test("contains default variables from query", () => {
    const query: TypedDocumentNode<
      { user: { name: string } },
      { id?: number }
    > = gql`
      query ($id: ID! = 1) {
        user(id: $id) {
          name
        }
      }
    `;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });
    const observable = client.watchQuery({ query });

    expect(observable.variables).toStrictEqualTyped({ id: 1 });
  });

  test("contains combined default variables from query and configured variables", () => {
    const query: TypedDocumentNode<
      { users: Array<{ name: string }> },
      { limit?: number; offset: number }
    > = gql`
      query ($limit: Int = 10, $offset: Int!) {
        users(limit: $limit, offset: $offset) {
          name
        }
      }
    `;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });
    const observable = client.watchQuery({ query, variables: { offset: 0 } });

    expect(observable.variables).toStrictEqualTyped({ limit: 10, offset: 0 });
  });

  test("handles default variables in query overwritten by configured variables", () => {
    const query: TypedDocumentNode<
      { users: Array<{ name: string }> },
      { limit?: number; offset: number }
    > = gql`
      query ($limit: Int = 10, $offset: Int!) {
        users(limit: $limit, offset: $offset) {
          name
        }
      }
    `;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });
    const observable = client.watchQuery({
      query,
      variables: { limit: 5, offset: 0 },
    });

    expect(observable.variables).toStrictEqualTyped({ limit: 5, offset: 0 });
  });

  test("returns updated variables set from setVariables", () => {
    const query: TypedDocumentNode<{ user: { name: string } }, { id: number }> =
      gql`
        query ($id: ID!) {
          user(id: $id) {
            name
          }
        }
      `;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });
    const observable = client.watchQuery({
      query,
      variables: { id: 1 },
    });

    expect(observable.variables).toStrictEqualTyped({ id: 1 });

    void observable.setVariables({ id: 2 });

    expect(observable.variables).toStrictEqualTyped({ id: 2 });
  });

  test("returns updated variables set from refetch", () => {
    const query: TypedDocumentNode<{ user: { name: string } }, { id: number }> =
      gql`
        query ($id: ID!) {
          user(id: $id) {
            name
          }
        }
      `;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });
    const observable = client.watchQuery({
      query,
      variables: { id: 1 },
    });

    expect(observable.variables).toStrictEqualTyped({ id: 1 });

    void observable.refetch({ id: 2 });

    expect(observable.variables).toStrictEqualTyped({ id: 2 });
  });

  test("returns updated variables set from reobserve", () => {
    const query: TypedDocumentNode<{ user: { name: string } }, { id: number }> =
      gql`
        query ($id: ID!) {
          user(id: $id) {
            name
          }
        }
      `;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });
    const observable = client.watchQuery({
      query,
      variables: { id: 1 },
    });

    expect(observable.variables).toStrictEqualTyped({ id: 1 });

    void observable.reobserve({ variables: { id: 2 } }).catch(() => {});

    expect(observable.variables).toStrictEqualTyped({ id: 2 });
  });

  test("does not return variables given to fetchMore", () => {
    const query: TypedDocumentNode<
      { users: Array<{ name: string }> },
      { limit: number; offset: number }
    > = gql`
      query ($limit: Int!, $offset: Int!) {
        users(limit: $limit, offset: $offset) {
          name
        }
      }
    `;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });
    const observable = client.watchQuery({
      query,
      variables: { limit: 10, offset: 0 },
    });

    expect(observable.variables).toStrictEqualTyped({ limit: 10, offset: 0 });

    void observable.fetchMore({ variables: { offset: 5 } }).catch(() => {});

    expect(observable.variables).toStrictEqualTyped({ limit: 10, offset: 0 });
  });

  test("handles undefined values", () => {
    const query: TypedDocumentNode<
      { users: Array<{ name: string }> },
      { limit?: number; offset: number }
    > = gql`
      query ($limit: Int, $offset: Int!) {
        users(limit: $limit, offset: $offset) {
          name
        }
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });
    const observable = client.watchQuery({
      query,
      variables: { limit: undefined, offset: 0 },
    });

    expect(observable.variables).toStrictEqualTyped({
      limit: undefined,
      offset: 0,
    });

    void observable.setVariables({ limit: 10, offset: 0 }).catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: 10, offset: 0 });

    void observable
      .setVariables({ limit: undefined, offset: 0 })
      .catch(() => {});
    expect(observable.variables).toStrictEqualTyped({
      limit: undefined,
      offset: 0,
    });

    void observable.refetch({ limit: 10, offset: 0 }).catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: 10, offset: 0 });

    void observable.refetch({ limit: undefined, offset: 0 }).catch(() => {});
    expect(observable.variables).toStrictEqualTyped({
      limit: undefined,
      offset: 0,
    });

    void observable
      .reobserve({ variables: { limit: 10, offset: 0 } })
      .catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: 10, offset: 0 });

    void observable
      .reobserve({ variables: { limit: undefined, offset: 0 } })
      .catch(() => {});
    expect(observable.variables).toStrictEqualTyped({
      limit: undefined,
      offset: 0,
    });
  });

  test("handles undefined values with default variables in the query", () => {
    const query: TypedDocumentNode<
      { users: Array<{ name: string }> },
      { limit?: number; offset: number }
    > = gql`
      query ($limit: Int = 5, $offset: Int!) {
        users(limit: $limit, offset: $offset) {
          name
        }
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });
    const observable = client.watchQuery({
      query,
      variables: { limit: undefined, offset: 0 },
    });

    expect(observable.variables).toStrictEqualTyped({ limit: 5, offset: 0 });

    void observable.setVariables({ limit: 10, offset: 0 }).catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: 10, offset: 0 });

    void observable
      .setVariables({ limit: undefined, offset: 0 })
      .catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: 5, offset: 0 });

    void observable.refetch({ limit: 10, offset: 0 }).catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: 10, offset: 0 });

    void observable.refetch({ limit: undefined, offset: 0 }).catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: 5, offset: 0 });

    void observable
      .reobserve({ variables: { limit: 10, offset: 0 } })
      .catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: 10, offset: 0 });

    void observable
      .reobserve({ variables: { limit: undefined, offset: 0 } })
      .catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: 5, offset: 0 });
  });

  test("handles null values with default variables in the query", () => {
    const query: TypedDocumentNode<
      { users: Array<{ name: string }> },
      { limit?: number | null; offset: number }
    > = gql`
      query ($limit: Int = 5, $offset: Int!) {
        users(limit: $limit, offset: $offset) {
          name
        }
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });
    const observable = client.watchQuery({
      query,
      variables: { limit: null, offset: 0 },
    });

    expect(observable.variables).toStrictEqualTyped({ limit: null, offset: 0 });

    void observable.setVariables({ limit: 10, offset: 0 }).catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: 10, offset: 0 });

    void observable.setVariables({ limit: null, offset: 0 }).catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: null, offset: 0 });

    void observable.refetch({ limit: 10, offset: 0 }).catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: 10, offset: 0 });

    void observable.refetch({ limit: null, offset: 0 }).catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: null, offset: 0 });

    void observable
      .reobserve({ variables: { limit: 10, offset: 0 } })
      .catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: 10, offset: 0 });

    void observable
      .reobserve({ variables: { limit: null, offset: 0 } })
      .catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: null, offset: 0 });
  });

  test("handles omitted keys with default variables in the query", () => {
    const query: TypedDocumentNode<
      { users: Array<{ name: string }> },
      { limit?: number; offset: number }
    > = gql`
      query ($limit: Int = 5, $offset: Int!) {
        users(limit: $limit, offset: $offset) {
          name
        }
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });
    const observable = client.watchQuery({
      query,
      variables: { offset: 0 },
    });

    expect(observable.variables).toStrictEqualTyped({ limit: 5, offset: 0 });

    void observable.setVariables({ limit: 10, offset: 0 }).catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: 10, offset: 0 });

    void observable.setVariables({ offset: 0 }).catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: 5, offset: 0 });

    void observable.refetch({ limit: 8, offset: 0 }).catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: 8, offset: 0 });

    // Refetch does a merge of variables so we don't expect `limit` to change.
    void observable.refetch({ offset: 0 }).catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: 8, offset: 0 });

    void observable
      .reobserve({ variables: { limit: 10, offset: 0 } })
      .catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: 10, offset: 0 });

    void observable.reobserve({ variables: { offset: 0 } }).catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: 5, offset: 0 });
  });

  test("resets variables to {} when passing variables as undefined", () => {
    const query: TypedDocumentNode<
      { users: Array<{ name: string }> },
      { limit?: number; offset?: number }
    > = gql`
      query ($limit: Int, $offset: Int) {
        users(limit: $limit, offset: $offset) {
          name
        }
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });
    const observable = client.watchQuery({
      query,
      variables: { limit: 10, offset: 0 },
    });

    expect(observable.variables).toStrictEqualTyped({ limit: 10, offset: 0 });

    void observable.reobserve({ variables: undefined }).catch(() => {});

    expect(observable.variables).toStrictEqualTyped({});
  });

  test("sets variables as {} when using empty object as variables", () => {
    const query: TypedDocumentNode<
      { users: Array<{ name: string }> },
      { limit?: number; offset?: number }
    > = gql`
      query ($limit: Int, $offset: Int) {
        users(limit: $limit, offset: $offset) {
          name
        }
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });
    const observable = client.watchQuery({
      query,
      variables: {},
    });

    expect(observable.variables).toStrictEqualTyped({});

    void observable.setVariables({ limit: 10 }).catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: 10 });

    void observable.setVariables({}).catch(() => {});
    expect(observable.variables).toStrictEqualTyped({});

    void observable.refetch({ limit: 10 }).catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: 10 });

    // Since `refetch` merges variables, we don't expect variables to change
    void observable.refetch({}).catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: 10 });

    void observable.reobserve({ variables: { limit: 10 } }).catch(() => {});
    expect(observable.variables).toStrictEqualTyped({ limit: 10 });

    void observable.reobserve({ variables: {} }).catch(() => {});
    expect(observable.variables).toStrictEqualTyped({});
  });
});

describe.skip("type tests", () => {
  test.skip("type test for `from`", () => {
    expectTypeOf<
      ObservedValueOf<ObservableQuery<{ foo: string }, { bar: number }>>
    >().toEqualTypeOf<ObservableQuery.Result<{ foo: string }>>();
  });

  test("variables with DocumentNode", () => {
    const query = gql``;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });

    const observable = client.watchQuery({ query });

    expectTypeOf(observable.variables).toEqualTypeOf<OperationVariables>();

    void observable.setVariables({});
    void observable.setVariables({ foo: "bar" });
    void observable.setVariables({ bar: "baz" });

    void observable.refetch();
    void observable.refetch({});
    void observable.refetch({ foo: "bar" });
    void observable.refetch({ foo: "baz" });

    void observable.reobserve();
    void observable.reobserve({ variables: {} });
    void observable.reobserve({ variables: { foo: "bar" } });
    void observable.reobserve({ variables: { foo: "baz" } });

    void observable.fetchMore({});
    void observable.fetchMore({ variables: {} });
    void observable.fetchMore({ variables: { foo: "bar" } });
    void observable.fetchMore({ variables: { foo: "baz" } });
  });

  test("is invalid with variables as never", () => {
    const query: TypedDocumentNode<{ greeting: string }, never> = gql``;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });

    // @ts-expect-error expecting variables key
    const observable = client.watchQuery({ query });

    expectTypeOf(observable.variables).toEqualTypeOf<never>();

    // @ts-expect-error
    void observable.setVariables({});
    // @ts-expect-error
    void observable.setVariables({ foo: "bar" });

    void observable.refetch();
    // @ts-expect-error
    void observable.refetch({});
    // @ts-expect-error
    void observable.refetch({ foo: "bar" });

    void observable.reobserve();
    void observable.reobserve({
      // @ts-expect-error variables is never
      variables: {},
    });
    void observable.reobserve({ variables: undefined });
    void observable.reobserve({
      // @ts-expect-error
      variables: { foo: "bar" },
    });

    void observable.fetchMore({});
    void observable.fetchMore({
      // @ts-expect-error unknown variables
      variables: {},
    });
    void observable.fetchMore({ variables: undefined });
    void observable.fetchMore({
      // @ts-expect-error variables is never
      variables: { foo: "bar" },
    });
  });

  test("variables with Record<string, never>", () => {
    const query: TypedDocumentNode<
      { greeting: string },
      Record<string, never>
    > = gql``;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });

    const observable = client.watchQuery({ query });

    expectTypeOf(observable.variables).toEqualTypeOf<Record<string, never>>();

    void observable.setVariables({});
    void observable.setVariables({
      // @ts-expect-error unknown variables
      foo: "bar",
    });

    void observable.refetch();
    void observable.refetch({});
    void observable.refetch({
      // @ts-expect-error unknown variables
      foo: "bar",
    });

    void observable.reobserve();
    void observable.reobserve({ variables: {} });
    void observable.reobserve({
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });

    void observable.fetchMore({});
    void observable.fetchMore({
      variables: {},
    });
    void observable.fetchMore({
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
  });

  test("variables with optional variables", () => {
    const query: TypedDocumentNode<{ posts: string[] }, { limit?: number }> =
      gql``;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });

    const observable = client.watchQuery({ query });

    expectTypeOf(observable.variables).toEqualTypeOf<{ limit?: number }>();

    void observable.setVariables({});
    void observable.setVariables({ limit: 10 });
    void observable.setVariables({
      // @ts-expect-error unknown variables
      foo: "bar",
    });
    void observable.setVariables({
      limit: 10,
      // @ts-expect-error unknown variables
      foo: "bar",
    });

    void observable.refetch();
    void observable.refetch({});
    void observable.refetch({ limit: 10 });
    void observable.refetch({
      // @ts-expect-error unknown variables
      foo: "bar",
    });
    void observable.refetch({
      limit: 10,
      // @ts-expect-error unknown variables
      foo: "bar",
    });

    void observable.reobserve();
    void observable.reobserve({ variables: {} });
    void observable.reobserve({ variables: { limit: 10 } });
    void observable.reobserve({
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    void observable.reobserve({
      variables: {
        limit: 10,
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });

    void observable.fetchMore({});
    void observable.fetchMore({ variables: {} });
    void observable.fetchMore({ variables: { limit: 10 } });
    void observable.fetchMore({
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    void observable.fetchMore({
      variables: {
        limit: 10,
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
  });

  test("variables with required variables", () => {
    const query: TypedDocumentNode<{ character: string }, { id: string }> =
      gql``;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });

    const observable = client.watchQuery({ query, variables: { id: "1" } });

    expectTypeOf(observable.variables).toEqualTypeOf<{ id: string }>();

    // @ts-expect-error missing required variable
    void observable.setVariables({});
    void observable.setVariables({ id: "1" });
    void observable.setVariables({
      // @ts-expect-error unknown variables
      foo: "bar",
    });
    void observable.setVariables({
      id: "1",
      // @ts-expect-error unknown variables
      foo: "bar",
    });

    void observable.refetch();
    void observable.refetch({});
    void observable.refetch({ id: "1" });
    void observable.refetch({
      // @ts-expect-error unknown variables
      foo: "bar",
    });
    void observable.refetch({
      id: "1",
      // @ts-expect-error unknown variables
      foo: "bar",
    });

    void observable.reobserve();
    void observable.reobserve({
      // @ts-expect-error missing required variable
      variables: {},
    });
    void observable.reobserve({ variables: { id: "1" } });
    void observable.reobserve({
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    void observable.reobserve({
      variables: {
        id: "1",
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });

    void observable.fetchMore({});
    void observable.fetchMore({ variables: {} });
    void observable.fetchMore({ variables: { id: "1" } });
    void observable.fetchMore({
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    void observable.fetchMore({
      variables: {
        id: "1",
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
  });

  test("variables with mixed required and optional", () => {
    const query: TypedDocumentNode<
      { character: string },
      { id: string; language?: string }
    > = gql``;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });

    const observable = client.watchQuery({ query, variables: { id: "1" } });

    expectTypeOf(observable.variables).toEqualTypeOf<{
      id: string;
      language?: string;
    }>();

    // @ts-expect-error missing required variable
    void observable.setVariables({});
    void observable.setVariables({ id: "1" });
    // @ts-expect-error missing required variable
    void observable.setVariables({ language: "en" });
    void observable.setVariables({ id: "1", language: "en" });
    void observable.setVariables({
      // @ts-expect-error unknown variables
      foo: "bar",
    });
    void observable.setVariables({
      id: "1",
      // @ts-expect-error unknown variables
      foo: "bar",
    });
    void observable.setVariables({
      id: "1",
      language: "en",
      // @ts-expect-error unknown variables
      foo: "bar",
    });

    void observable.refetch();
    void observable.refetch({});
    void observable.refetch({ id: "1" });
    void observable.refetch({ language: "en" });
    void observable.refetch({ id: "1", language: "en" });
    void observable.refetch({
      // @ts-expect-error unknown variables
      foo: "bar",
    });
    void observable.refetch({
      id: "1",
      // @ts-expect-error unknown variables
      foo: "bar",
    });
    void observable.refetch({
      id: "1",
      language: "en",
      // @ts-expect-error unknown variables
      foo: "bar",
    });

    void observable.reobserve();
    void observable.reobserve({
      // @ts-expect-error missing required variable
      variables: {},
    });
    void observable.reobserve({ variables: { id: "1" } });
    void observable.reobserve({
      // @ts-expect-error missing required variable
      variables: { language: "en" },
    });
    void observable.reobserve({ variables: { id: "1", language: "en" } });
    void observable.reobserve({
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    void observable.reobserve({
      variables: {
        id: "1",
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    void observable.reobserve({
      variables: {
        id: "1",
        language: "en",
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });

    void observable.fetchMore({});
    void observable.fetchMore({ variables: {} });
    void observable.fetchMore({ variables: { id: "1" } });
    void observable.fetchMore({ variables: { language: "en" } });
    void observable.fetchMore({ variables: { id: "1", language: "en" } });
    void observable.fetchMore({
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    void observable.fetchMore({
      variables: {
        id: "1",
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    void observable.fetchMore({
      variables: {
        id: "1",
        language: "en",
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
  });
});

test("does not return partial cache data when `returnPartialData` is false and new variables are passed in", async () => {
  const partialQuery = gql`
    query MyCar($id: ID) {
      car(id: $id) {
        id
        make
      }
    }
  `;

  const query = gql`
    query MyCar($id: ID) {
      car(id: $id) {
        id
        make
        model
      }
    }
  `;

  const cache = new InMemoryCache();
  const client = new ApolloClient({
    cache,
    link: new MockLink([
      {
        request: { query, variables: { id: 2 } },
        result: {
          data: {
            car: { __typename: "Car", id: 2, make: "Ford", model: "Bronco" },
          },
        },
        delay: 50,
      },
    ]),
  });

  cache.writeQuery({
    query,
    variables: { id: 1 },
    data: {
      car: {
        __typename: "Car",
        id: 1,
        make: "Ford",
        model: "Pinto",
      },
    },
  });

  cache.writeQuery({
    query: partialQuery,
    variables: { id: 2 },
    data: {
      car: {
        __typename: "Car",
        id: 2,
        make: "Ford",
        model: "Bronco",
      },
    },
  });

  const observable = client.watchQuery({
    query,
    variables: { id: 1 },
    returnPartialData: false,
  });

  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: {
      car: { __typename: "Car", id: 1, make: "Ford", model: "Pinto" },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  void observable.reobserve({ variables: { id: 2 } });

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.setVariables,
    partial: true,
  });

  expect(observable.getCurrentResult()).toBe(stream.getCurrent());

  await expect(stream).toEmitTypedValue({
    data: { car: { __typename: "Car", id: 2, make: "Ford", model: "Bronco" } },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  expect(observable.getCurrentResult()).toBe(stream.getCurrent());
});

test("emits data: undefined when changing variables and an error is returned with notifyOnNetworkStatusChange: false", async () => {
  const { query, mocks } = setupVariablesCase();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      mocks[0],
      {
        request: { query, variables: { id: "2" } },
        result: { errors: [{ message: "Something went wrong" }] },
      },
    ]),
  });

  const observable = client.watchQuery({
    query,
    variables: { id: "1" },
    notifyOnNetworkStatusChange: false,
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: {
      character: { __typename: "Character", id: "1", name: "Spider-Man" },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(
    observable.reobserve({ variables: { id: "2" } })
  ).rejects.toEqual(
    new CombinedGraphQLErrors({
      errors: [{ message: "Something went wrong" }],
    })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    error: new CombinedGraphQLErrors({
      errors: [{ message: "Something went wrong" }],
    }),
    loading: false,
    networkStatus: NetworkStatus.error,
    partial: true,
  });

  await expect(stream).not.toEmitAnything();
});
