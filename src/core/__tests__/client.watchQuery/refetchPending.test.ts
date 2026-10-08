import { gql } from "graphql-tag";
import type { Observer } from "rxjs";
import { Observable } from "rxjs";

import { ApolloClient, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { Defer20220824Handler } from "@apollo/client/incremental";
import { ApolloLink } from "@apollo/client/link";
import { MockLink } from "@apollo/client/testing";
import { ObservableStream } from "@apollo/client/testing/internal";

const query = gql`
  query Greeting {
    greeting
  }
`;

test.each([
  ["cache-first", false],
  ["cache-first", true],
  ["no-cache", false],
  ["no-cache", true],
] as const)(
  "refetch refreshes both watchers (%s, refetch second watcher: %s)",
  async (fetchPolicy, refetchSecond) => {
    const observers: Observer<ApolloLink.Result>[] = [];
    const contexts: ApolloLink.OperationContext[] = [];
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new ApolloLink((operation) => {
        contexts.push(operation.getContext());
        return new Observable((observer) => {
          observers.push(observer);
        });
      }),
    });
    const first = client.watchQuery({
      query,
      fetchPolicy,
      context: { requestId: "initial" },
    });
    const second = client.watchQuery({ query, fetchPolicy });
    using firstStream = new ObservableStream(first);
    using secondStream = new ObservableStream(second);
    await firstStream.takeNext();
    await secondStream.takeNext();
    expect(observers).toHaveLength(1);

    const refetch = first.refetch();
    const concurrentRefetch = (refetchSecond ? second : first).refetch();
    expect(observers).toHaveLength(2);
    expect(contexts[1]).toMatchObject({
      queryDeduplication: true,
      requestId: "initial",
    });
    observers[1].next({ data: { greeting: "fresh" } });
    observers[1].complete();

    await expect(refetch).resolves.toEqual({ data: { greeting: "fresh" } });
    await expect(concurrentRefetch).resolves.toEqual({
      data: { greeting: "fresh" },
    });
    observers[0].next({ data: { greeting: "stale" } });
    observers[0].complete();
    for (const observable of [first, second]) {
      expect(observable.getCurrentResult()).toMatchObject({
        data: { greeting: "fresh" },
        loading: false,
        networkStatus: NetworkStatus.ready,
      });
    }
    if (fetchPolicy === "cache-first") {
      expect(client.readQuery({ query })).toEqual({
        greeting: "fresh",
      });
    }
  }
);

test("refetch re-executes the link instead of resubscribing to the old response", async () => {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: { data: { greeting: "stale" } },
        delay: Infinity,
      },
      {
        request: { query },
        result: { data: { greeting: "fresh" } },
        delay: 0,
      },
    ]),
  });
  const observable = client.watchQuery({ query });
  using stream = new ObservableStream(observable);
  await stream.takeNext();

  await expect(observable.refetch()).resolves.toEqual({
    data: { greeting: "fresh" },
  });
  expect(observable.getCurrentResult()).toMatchObject({
    data: { greeting: "fresh" },
    loading: false,
  });
});

test("a restarted request can complete synchronously", async () => {
  let requests = 0;
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(() => {
      const request = ++requests;
      return new Observable((observer) => {
        if (request > 1) {
          observer.next({ data: { greeting: "fresh" } });
          observer.complete();
        }
      });
    }),
  });
  const observable = client.watchQuery({ query });
  using stream = new ObservableStream(observable);
  await stream.takeNext();

  await expect(observable.refetch()).resolves.toEqual({
    data: { greeting: "fresh" },
  });
  expect(requests).toBe(2);
  expect(observable.getCurrentResult()).toMatchObject({
    data: { greeting: "fresh" },
    loading: false,
  });
});

test("refetch preserves an incremental request that has already emitted", async () => {
  const deferredQuery = gql`
    query Greeting {
      ... @defer {
        greeting
      }
    }
  `;
  const observers: Observer<ApolloLink.Result>[] = [];
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    incrementalHandler: new Defer20220824Handler(),
    link: new ApolloLink(
      () => new Observable((observer) => void observers.push(observer))
    ),
  });
  const observable = client.watchQuery({ query: deferredQuery });
  using stream = new ObservableStream(observable);
  await stream.takeNext();
  observers[0].next({ data: {}, hasNext: true });

  const refetch = observable.refetch();
  expect(observers).toHaveLength(1);
  observers[0].next({
    incremental: [{ data: { greeting: "fresh" }, path: [] }],
    hasNext: false,
  });
  observers[0].complete();

  await expect(refetch).resolves.toEqual({
    data: { __typename: "Query", greeting: "fresh" },
  });
  expect(observable.getCurrentResult()).toMatchObject({
    data: { greeting: "fresh" },
    loading: false,
  });
});

test("a restarted request propagates errors and allows a subsequent refetch", async () => {
  const observers: Observer<ApolloLink.Result>[] = [];
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(
      () => new Observable((observer) => void observers.push(observer))
    ),
  });
  const observable = client.watchQuery({ query });
  using stream = new ObservableStream(observable);
  await stream.takeNext();

  const refetch = observable.refetch();
  const error = new Error("Offline");
  observers[1].error(error);
  await expect(refetch).rejects.toBe(error);
  expect(observable.getCurrentResult()).toMatchObject({
    error,
    loading: false,
    networkStatus: NetworkStatus.error,
  });

  const retry = observable.refetch();
  expect(observers).toHaveLength(3);
  observers[2].next({ data: { greeting: "fresh" } });
  observers[2].complete();
  await expect(retry).resolves.toEqual({ data: { greeting: "fresh" } });
});
