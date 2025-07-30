import { gql } from "graphql-tag";
import type { Subscriber } from "rxjs";

import type { TypedDocumentNode } from "@apollo/client";
import { ApolloClient, ApolloLink, Observable } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
} from "@apollo/client/errors";
import { MockSubscriptionLink } from "@apollo/client/testing";
import {
  mockMultipartSubscriptionStream,
  ObservableStream,
  spyOnConsole,
} from "@apollo/client/testing/internal";

describe("GraphQL Subscriptions", () => {
  const results = [
    "Dahivat Pandya",
    "Vyacheslav Kim",
    "Changping Chen",
    "Amanda Liu",
  ].map((name) => ({
    result: { data: { user: { __typename: "User" as const, name } } },
    delay: 10,
  }));

  const subscription: TypedDocumentNode<
    { user: { __typename: "User"; name: string } },
    { name?: string }
  > = gql`
    subscription UserInfo($name: String) {
      user(name: $name) {
        name
      }
    }
  `;

  it("should start a subscription on network interface and unsubscribe", async () => {
    const link = new MockSubscriptionLink();
    // This test calls directly through Apollo Client
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const stream = new ObservableStream(
      client.subscribe({
        query: gql`
          subscription UserInfo($name: String = "Changping Chen") {
            user(name: $name) {
              name
            }
          }
        `,
      })
    );
    link.simulateResult(results[0]);

    await expect(stream).toEmitTypedValue(results[0].result);

    stream.unsubscribe();
  });

  it("should subscribe with default values", async () => {
    const link = new MockSubscriptionLink();
    // This test calls directly through Apollo Client
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const stream = new ObservableStream(
      client.subscribe({
        query: subscription,
        variables: { name: "Changping Chen" },
      })
    );

    link.simulateResult(results[0]);

    await expect(stream).toEmitTypedValue(results[0].result);

    stream.unsubscribe();
  });

  test("does not eagerly start subscription until subscribing to the returned observable", async () => {
    const onSubscribe = jest.fn();
    const link = new MockSubscriptionLink();
    link.onSetup(onSubscribe);

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const observable = client.subscribe({
      query: subscription,
      variables: { name: "Changping Chen" },
    });

    expect(onSubscribe).not.toHaveBeenCalled();

    observable.subscribe();

    expect(onSubscribe).toHaveBeenCalledTimes(1);
  });

  it("should multiplex subscriptions", async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe({
      query: subscription,
      variables: { name: "Changping Chen" },
    });
    const stream1 = new ObservableStream(obs);
    const stream2 = new ObservableStream(obs);

    link.simulateResult(results[0]);

    await expect(stream1).toEmitTypedValue(results[0].result);
    await expect(stream2).toEmitTypedValue(results[0].result);
  });

  it("tears down subscription only after all subscribers are unsubscribed", async () => {
    const onUnsubscribe = jest.fn();
    const link = new MockSubscriptionLink();
    link.onUnsubscribe(onUnsubscribe);
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe({
      query: subscription,
      variables: { name: "Changping Chen" },
    });

    const stream1 = new ObservableStream(obs);
    const stream2 = new ObservableStream(obs);

    link.simulateResult(results[0]);

    await expect(stream1).toEmitTypedValue(results[0].result);
    await expect(stream2).toEmitTypedValue(results[0].result);

    stream1.unsubscribe();
    expect(onUnsubscribe).toHaveBeenCalledTimes(0);

    link.simulateResult(results[1]);

    await expect(stream1).not.toEmitAnything();
    await expect(stream2).toEmitTypedValue(results[1].result);

    stream2.unsubscribe();
    expect(onUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it("should receive multiple results for a subscription", async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const stream = new ObservableStream(
      client.subscribe({
        query: subscription,
        variables: { name: "Changping Chen" },
      })
    );

    for (let i = 0; i < 4; i++) {
      link.simulateResult(results[i]);
    }

    await expect(stream).toEmitTypedValue(results[0].result);
    await expect(stream).toEmitTypedValue(results[1].result);
    await expect(stream).toEmitTypedValue(results[2].result);
    await expect(stream).toEmitTypedValue(results[3].result);
    await expect(stream).not.toEmitAnything();
  });

  it("should not cache subscription data if a `no-cache` fetch policy is used", async () => {
    const link = new MockSubscriptionLink();
    const cache = new InMemoryCache();
    const client = new ApolloClient({
      link,
      cache,
    });

    expect(cache.extract()).toEqual({});

    const stream = new ObservableStream(
      client.subscribe({
        query: subscription,
        fetchPolicy: "no-cache",
        variables: { name: "Changping Chen" },
      })
    );

    link.simulateResult(results[0]);

    await expect(stream).toEmitNext();
    expect(cache.extract()).toEqual({});
  });

  it("emits an error if the result has GraphQL errors", async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe({
      query: subscription,
      variables: { name: "Changping Chen" },
    });
    const stream = new ObservableStream(obs);

    link.simulateResult({
      result: {
        data: null,
        errors: [
          {
            message: "This is an error",
            locations: [
              {
                column: 3,
                line: 2,
              },
            ],
            path: ["result"],
          },
        ],
      },
    });

    await expect(stream).toEmitTypedValue({
      data: undefined,
      error: new CombinedGraphQLErrors({
        data: null,
        errors: [
          {
            message: "This is an error",
            locations: [
              {
                column: 3,
                line: 2,
              },
            ],
            path: ["result"],
          },
        ],
      }),
    });
  });

  it("can continue receiving results after GraphQL errors when the connection remains open", async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe({
      query: subscription,
      variables: { name: "Changping Chen" },
    });
    const stream = new ObservableStream(obs);

    link.simulateResult({
      result: {
        data: null,
        errors: [
          {
            message: "This is an error",
            locations: [
              {
                column: 3,
                line: 2,
              },
            ],
            path: ["result"],
          },
        ],
      },
    });

    await expect(stream).toEmitTypedValue({
      data: undefined,
      error: new CombinedGraphQLErrors({
        data: null,
        errors: [
          {
            message: "This is an error",
            locations: [
              {
                column: 3,
                line: 2,
              },
            ],
            path: ["result"],
          },
        ],
      }),
    });

    link.simulateResult(results[0]);

    await expect(stream).toEmitTypedValue({ data: results[0].result.data });
  });

  it("emits a result with error if the result has network errors", async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe({
      query: subscription,
      variables: { name: "Changping Chen" },
    });
    const stream = new ObservableStream(obs);

    link.simulateResult({ error: new Error("Oops") });

    await expect(stream).toEmitTypedValue({
      data: undefined,
      error: new Error("Oops"),
    });

    await expect(stream).toComplete();
  });

  it('returns errors in next result when `errorPolicy` is "all"', async () => {
    const query = gql`
      subscription UserInfo($name: String) {
        user(name: $name) {
          name
        }
      }
    `;
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe({
      query,
      variables: { name: "Iron Man" },
      errorPolicy: "all",
    });
    const stream = new ObservableStream(obs);

    link.simulateResult(
      {
        result: {
          data: null,
          errors: [{ message: "This is an error" }],
        },
      },
      true
    );

    await expect(stream).toEmitTypedValue({
      data: undefined,
      error: new CombinedGraphQLErrors({
        data: null,
        errors: [{ message: "This is an error" }],
      }),
    });

    await expect(stream).toComplete();
  });

  it("emits a result with error and completes when the result has network errors with `errorPolicy: 'all'`", async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe({
      query: subscription,
      errorPolicy: "all",
      variables: { name: "Changping Chen" },
    });
    const stream = new ObservableStream(obs);

    link.simulateResult({ error: new Error("Oops") });

    await expect(stream).toEmitTypedValue({
      data: undefined,
      error: new Error("Oops"),
    });
    await expect(stream).toComplete();
  });

  it('emits protocol errors when `errorPolicy` is "all"', async () => {
    const { httpLink, enqueueProtocolErrors } =
      mockMultipartSubscriptionStream();

    const client = new ApolloClient({
      link: httpLink,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe({
      query: subscription,
      variables: { name: "Iron Man" },
      errorPolicy: "all",
    });
    const stream = new ObservableStream(obs);

    // Silence warning about missing field for cache write
    // TODO: Investigate this to see if we can silence this since this should
    // not be expected.
    using _consoleSpy = spyOnConsole("error");

    enqueueProtocolErrors([
      {
        message: "cannot read message from websocket",
        extensions: {
          code: "WEBSOCKET_MESSAGE_ERROR",
        },
      },
    ]);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      error: new CombinedProtocolErrors([
        {
          message: "cannot read message from websocket",
          extensions: {
            code: "WEBSOCKET_MESSAGE_ERROR",
          },
        },
      ]),
    });

    await expect(stream).toComplete();
  });

  it('does not emit anything for GraphQL errors with no data in next result when `errorPolicy` is "ignore"', async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe({
      query: subscription,
      variables: { name: "Iron Man" },
      errorPolicy: "ignore",
    });
    const stream = new ObservableStream(obs);

    link.simulateResult({
      result: {
        data: null,
        errors: [{ message: "This is an error" }],
      },
    });

    await expect(stream).not.toEmitAnything();

    link.simulateComplete();
    await expect(stream).toComplete();
  });

  it('does not emit anything for network errors with no data in next result when `errorPolicy` is "ignore"', async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe({
      query: subscription,
      variables: { name: "Iron Man" },
      errorPolicy: "ignore",
    });
    const stream = new ObservableStream(obs);

    link.simulateResult({ error: new Error("Oops") });

    await expect(stream).toComplete();
  });

  it('does not emit anything and completes observable for protocolErrors when `errorPolicy` is "ignore"', async () => {
    const { httpLink, enqueueProtocolErrors } =
      mockMultipartSubscriptionStream();
    const client = new ApolloClient({
      link: httpLink,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe({
      query: subscription,
      variables: { name: "Iron Man" },
      errorPolicy: "ignore",
    });
    const stream = new ObservableStream(obs);

    // Silence warning about missing field for cache write
    using _consoleSpy = spyOnConsole("error");

    enqueueProtocolErrors([
      {
        message: "cannot read message from websocket",
        extensions: {
          code: "WEBSOCKET_MESSAGE_ERROR",
        },
      },
    ]);

    await expect(stream).toComplete();
  });

  it("should call complete handler when the subscription completes", async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const stream = new ObservableStream(
      client.subscribe({ query: subscription })
    );

    setTimeout(() => link.simulateComplete(), 50);

    await expect(stream).toComplete();
  });

  it("should pass a context object through the link execution chain", async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    const stream = new ObservableStream(
      client.subscribe({
        query: subscription,
        variables: { name: "Changping Chen" },
        context: { someVar: "Some value" },
      })
    );

    link.simulateResult(results[0]);

    await expect(stream).toEmitTypedValue(results[0].result);

    expect(link.operation?.getContext().someVar).toEqual("Some value");
  });

  it("emits an error if the result has protocolErrors on it", async () => {
    const { httpLink, enqueueProtocolErrors } =
      mockMultipartSubscriptionStream();

    const client = new ApolloClient({
      link: httpLink,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe({
      query: subscription,
      variables: { name: "Changping Chen" },
    });
    const stream = new ObservableStream(obs);

    // Silence warning about missing field for cache write
    using _consoleSpy = spyOnConsole("error");

    enqueueProtocolErrors([
      {
        message: "cannot read message from websocket",
        extensions: {
          code: "WEBSOCKET_MESSAGE_ERROR",
        },
      },
    ]);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      error: new CombinedProtocolErrors([
        {
          message: "cannot read message from websocket",
          extensions: {
            code: "WEBSOCKET_MESSAGE_ERROR",
          },
        },
      ]),
    });

    await expect(stream).toComplete();
  });

  it("deduplicates subscriptions by default", async () => {
    const subscription = gql`
      subscription UserInfo($name: String = "Changping Chen") {
        user(name: $name) {
          name
        }
      }
    `;
    const observers = new Set<Subscriber<ApolloLink.Result>>();
    const link = new ApolloLink((_operation) => {
      return new Observable((observer) => {
        observers.add(observer);
        return () => observers.delete(observer);
      });
    });

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    using sub1 = new ObservableStream(
      client.subscribe({ query: subscription })
    );
    using sub2 = new ObservableStream(
      client.subscribe({ query: subscription })
    );

    expect(observers.size).toBe(1);

    const [observer] = Array.from(observers);

    observer.next(results[0].result);

    await expect(sub1).toEmitTypedValue(results[0].result);
    await expect(sub2).toEmitTypedValue(results[0].result);

    observer.next(results[1].result);

    await expect(sub1).toEmitTypedValue(results[1].result);
    await expect(sub2).toEmitTypedValue(results[1].result);

    using sub3 = new ObservableStream(
      client.subscribe({ query: subscription })
    );

    expect(observers.size).toBe(1);

    observer.next(results[2].result);

    await expect(sub1).toEmitTypedValue(results[2].result);
    await expect(sub2).toEmitTypedValue(results[2].result);
    await expect(sub3).toEmitTypedValue(results[2].result);

    observer.complete();

    await expect(sub1).toComplete();
    await expect(sub2).toComplete();
    await expect(sub3).toComplete();
  });

  it("does not deduplicate new request after unsubscribing from previous deduped request", async () => {
    const subscription = gql`
      subscription UserInfo($name: String = "Changping Chen") {
        user(name: $name) {
          name
        }
      }
    `;
    let lastOperation!: ApolloLink.Operation;
    const observers = new Set<Subscriber<ApolloLink.Result>>();
    const link = new ApolloLink((operation) => {
      return new Observable((observer) => {
        lastOperation = operation;
        observers.add(observer);
        return () => observers.delete(observer);
      });
    });

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    using sub1 = new ObservableStream(
      client.subscribe({ query: subscription, context: { count: 1 } })
    );

    expect(observers.size).toBe(1);
    expect(lastOperation.getContext()).toMatchObject({ count: 1 });

    const [observer1] = Array.from(observers);
    observer1.next(results[0].result);

    await expect(sub1).toEmitTypedValue(results[0].result);
    sub1.unsubscribe();

    expect(observers.size).toBe(0);

    using sub2 = new ObservableStream(
      client.subscribe({ query: subscription, context: { count: 2 } })
    );

    expect(observers.size).toBe(1);
    expect(lastOperation.getContext()).toMatchObject({ count: 2 });

    const [observer2] = Array.from(observers);

    observer2.next(results[2].result);

    await expect(sub2).toEmitTypedValue(results[2].result);
  });

  it("does not deduplicate requests when disabling queryDeduplication", async () => {
    const subscription = gql`
      subscription UserInfo($name: String = "Changping Chen") {
        user(name: $name) {
          name
        }
      }
    `;
    const observers = new Set<Subscriber<ApolloLink.Result>>();
    const link = new ApolloLink((_operation) => {
      return new Observable((observer) => {
        observers.add(observer);
        return () => observers.delete(observer);
      });
    });

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    using sub1 = new ObservableStream(
      client.subscribe({
        query: subscription,
        context: { queryDeduplication: false },
      })
    );
    using sub2 = new ObservableStream(
      client.subscribe({
        query: subscription,
        context: { queryDeduplication: false },
      })
    );

    expect(observers.size).toBe(2);

    const [observer1, observer2] = Array.from(observers);

    observer1.next(results[0].result);

    await expect(sub1).toEmitTypedValue(results[0].result);
    await expect(sub2).not.toEmitAnything();

    observer2.next(results[0].result);

    await expect(sub1).not.toEmitAnything();
    await expect(sub2).toEmitTypedValue(results[0].result);

    using sub3 = new ObservableStream(
      client.subscribe({
        query: subscription,
        context: { queryDeduplication: false },
      })
    );

    expect(observers.size).toBe(3);

    const [, , observer3] = Array.from(observers);

    observer3.next(results[1].result);

    await expect(sub1).not.toEmitAnything();
    await expect(sub2).not.toEmitAnything();
    await expect(sub3).toEmitTypedValue(results[1].result);

    observer1.complete();

    await expect(sub1).toComplete();
    await expect(sub2).not.toEmitAnything();
    await expect(sub3).not.toEmitAnything();

    observer2.complete();

    await expect(sub2).toComplete();
    await expect(sub3).not.toEmitAnything();

    observer3.complete();

    await expect(sub3).toComplete();
  });

  it("can mix deduplicated requests and new subscriptions with `queryDeduplication: false`", async () => {
    const subscription = gql`
      subscription UserInfo($name: String = "Changping Chen") {
        user(name: $name) {
          name
        }
      }
    `;
    const observers = new Set<Subscriber<ApolloLink.Result>>();
    const link = new ApolloLink((_operation) => {
      return new Observable((observer) => {
        observers.add(observer);
        return () => observers.delete(observer);
      });
    });

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    using sub1 = new ObservableStream(
      client.subscribe({ query: subscription })
    );
    using sub2 = new ObservableStream(
      client.subscribe({ query: subscription })
    );

    expect(observers.size).toBe(1);

    const [observer1] = Array.from(observers);

    observer1.next(results[0].result);

    await expect(sub1).toEmitTypedValue(results[0].result);
    await expect(sub2).toEmitTypedValue(results[0].result);

    using sub3 = new ObservableStream(
      client.subscribe({
        query: subscription,
        context: { queryDeduplication: false },
      })
    );

    expect(observers.size).toBe(2);

    const [, observer2] = Array.from(observers);

    observer2.next(results[1].result);

    await expect(sub1).not.toEmitAnything();
    await expect(sub2).not.toEmitAnything();
    await expect(sub3).toEmitTypedValue(results[1].result);

    observer1.next(results[2].result);

    await expect(sub1).toEmitTypedValue(results[2].result);
    await expect(sub2).toEmitTypedValue(results[2].result);
    await expect(sub3).not.toEmitAnything();

    observer2.next(results[3].result);

    await expect(sub1).not.toEmitAnything();
    await expect(sub2).not.toEmitAnything();
    await expect(sub3).toEmitTypedValue(results[3].result);

    observer1.complete();

    await expect(sub1).toComplete();
    await expect(sub2).toComplete();
    await expect(sub3).not.toEmitAnything();

    observer2.complete();

    await expect(sub3).toComplete();
  });

  test("can restart a subscription", async () => {
    const onUnsubscribe = jest.fn();
    const onSubscribe = jest.fn();
    const link = new MockSubscriptionLink();
    link.onUnsubscribe(onUnsubscribe);
    link.onSetup(onSubscribe);

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.subscribe({
      query: subscription,
      variables: { name: "Changping Chen" },
    });
    const stream = new ObservableStream(observable);

    expect(onSubscribe).toHaveBeenCalledTimes(1);

    link.simulateResult(results[0]);

    await expect(stream).toEmitTypedValue(results[0].result);

    observable.restart();

    expect(onUnsubscribe).toHaveBeenCalledTimes(1);
    expect(onSubscribe).toHaveBeenCalledTimes(2);
    // Ensure restarting the connection doesn't complete the existing observable
    await expect(stream).not.toEmitAnything();

    link.simulateResult(results[1], true);

    await expect(stream).toEmitTypedValue(results[1].result);
    await expect(stream).toComplete();
  });

  test("restarts subscription with multiple observers", async () => {
    const onUnsubscribe = jest.fn();
    const onSubscribe = jest.fn();
    const link = new MockSubscriptionLink();
    link.onUnsubscribe(onUnsubscribe);
    link.onSetup(onSubscribe);

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.subscribe({
      query: subscription,
      variables: { name: "Changping Chen" },
    });
    const stream1 = new ObservableStream(observable);
    const stream2 = new ObservableStream(observable);

    expect(onSubscribe).toHaveBeenCalledTimes(1);

    link.simulateResult(results[0]);

    await expect(stream1).toEmitTypedValue(results[0].result);
    await expect(stream2).toEmitTypedValue(results[0].result);

    observable.restart();

    expect(onUnsubscribe).toHaveBeenCalledTimes(1);
    expect(onSubscribe).toHaveBeenCalledTimes(2);
    // Ensure restarting the connection doesn't complete the existing observable
    await expect(stream1).not.toEmitAnything();
    await expect(stream2).not.toEmitAnything();

    link.simulateResult(results[1], true);

    await expect(stream1).toEmitTypedValue(results[1].result);
    await expect(stream1).toComplete();

    await expect(stream2).toEmitTypedValue(results[1].result);
    await expect(stream2).toComplete();
  });

  test("restarts subscriptions on deduplicated subscriptions", async () => {
    const subscription = gql`
      subscription UserInfo($name: String = "Changping Chen") {
        user(name: $name) {
          name
        }
      }
    `;
    const onUnsubscribe = jest.fn();
    const onSubscribe = jest.fn();
    const link = new MockSubscriptionLink();
    link.onUnsubscribe(onUnsubscribe);
    link.onSetup(onSubscribe);

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const observable1 = client.subscribe({ query: subscription });
    const observable2 = client.subscribe({ query: subscription });

    // Ensure we aren't eagerly subscribing
    expect(onSubscribe).not.toHaveBeenCalled();

    using sub1 = new ObservableStream(observable1);
    using sub2 = new ObservableStream(observable2);

    expect(onUnsubscribe).toHaveBeenCalledTimes(0);
    expect(onSubscribe).toHaveBeenCalledTimes(1);

    link.simulateResult(results[0]);

    await expect(sub1).toEmitTypedValue(results[0].result);
    await expect(sub2).toEmitTypedValue(results[0].result);

    observable1.restart();

    expect(onUnsubscribe).toHaveBeenCalledTimes(1);
    expect(onSubscribe).toHaveBeenCalledTimes(2);

    link.simulateResult(results[1]);

    await expect(sub1).toEmitTypedValue(results[1].result);
    await expect(sub2).toEmitTypedValue(results[1].result);

    observable2.restart();

    expect(onUnsubscribe).toHaveBeenCalledTimes(2);
    expect(onSubscribe).toHaveBeenCalledTimes(3);

    const observable3 = client.subscribe({ query: subscription });
    using sub3 = new ObservableStream(observable3);

    expect(onSubscribe).toHaveBeenCalledTimes(3);

    link.simulateResult(results[2]);

    await expect(sub1).toEmitTypedValue(results[2].result);
    await expect(sub2).toEmitTypedValue(results[2].result);
    await expect(sub3).toEmitTypedValue(results[2].result);

    observable3.restart();

    expect(onUnsubscribe).toHaveBeenCalledTimes(3);
    expect(onSubscribe).toHaveBeenCalledTimes(4);

    link.simulateResult(results[3], true);

    await expect(sub1).toEmitTypedValue(results[3].result);
    await expect(sub2).toEmitTypedValue(results[3].result);
    await expect(sub3).toEmitTypedValue(results[3].result);

    await expect(sub1).toComplete();
    await expect(sub2).toComplete();
    await expect(sub3).toComplete();
  });

  test("restarts only own connection on non deduplicated subscriptions", async () => {
    const subscription = gql`
      subscription UserInfo($name: String = "Changping Chen") {
        user(name: $name) {
          name
        }
      }
    `;
    const onUnsubscribe = jest.fn();
    const onSubscribe = jest.fn();
    const link = new MockSubscriptionLink();
    link.onUnsubscribe(onUnsubscribe);
    link.onSetup(onSubscribe);

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const observable1 = client.subscribe({
      query: subscription,
      context: { queryDeduplication: false },
    });
    const observable2 = client.subscribe({
      query: subscription,
      context: { queryDeduplication: false },
    });

    // Ensure we aren't eagerly subscribing
    expect(onSubscribe).not.toHaveBeenCalled();

    using sub1 = new ObservableStream(observable1);
    using sub2 = new ObservableStream(observable2);

    expect(onUnsubscribe).toHaveBeenCalledTimes(0);
    expect(onSubscribe).toHaveBeenCalledTimes(2);

    link.simulateResult(results[0]);

    await expect(sub1).toEmitTypedValue(results[0].result);
    await expect(sub2).toEmitTypedValue(results[0].result);

    observable1.restart();

    expect(onUnsubscribe).toHaveBeenCalledTimes(1);
    expect(onSubscribe).toHaveBeenCalledTimes(3);

    link.simulateResult(results[1]);

    await expect(sub1).toEmitTypedValue(results[1].result);
    await expect(sub2).toEmitTypedValue(results[1].result);

    observable2.restart();

    expect(onUnsubscribe).toHaveBeenCalledTimes(2);
    expect(onSubscribe).toHaveBeenCalledTimes(4);

    const observable3 = client.subscribe({
      query: subscription,
      context: { queryDeduplication: false },
    });
    using sub3 = new ObservableStream(observable3);

    expect(onSubscribe).toHaveBeenCalledTimes(5);

    link.simulateResult(results[2]);

    await expect(sub1).toEmitTypedValue(results[2].result);
    await expect(sub2).toEmitTypedValue(results[2].result);
    await expect(sub3).toEmitTypedValue(results[2].result);

    observable3.restart();

    expect(onUnsubscribe).toHaveBeenCalledTimes(3);
    expect(onSubscribe).toHaveBeenCalledTimes(6);

    link.simulateResult(results[3], true);

    await expect(sub1).toEmitTypedValue(results[3].result);
    await expect(sub2).toEmitTypedValue(results[3].result);
    await expect(sub3).toEmitTypedValue(results[3].result);

    await expect(sub1).toComplete();
    await expect(sub2).toComplete();
    await expect(sub3).toComplete();
  });

  test("does not start link subscription after observable is unsubscribed", async () => {
    const onUnsubscribe = jest.fn();
    const onSubscribe = jest.fn();
    const link = new MockSubscriptionLink();
    link.onUnsubscribe(onUnsubscribe);
    link.onSetup(onSubscribe);

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.subscribe({
      query: subscription,
      variables: { name: "Changping Chen" },
    });
    const stream = new ObservableStream(observable);

    expect(onSubscribe).toHaveBeenCalledTimes(1);

    stream.unsubscribe();

    expect(onUnsubscribe).toHaveBeenCalledTimes(1);
    expect(onSubscribe).toHaveBeenCalledTimes(1);

    onSubscribe.mockReset();
    onUnsubscribe.mockReset();

    observable.restart();

    expect(onUnsubscribe).not.toHaveBeenCalled();
    expect(onSubscribe).not.toHaveBeenCalled();
  });

  test("does not start link subscription after observable is complete", async () => {
    const onUnsubscribe = jest.fn();
    const onSubscribe = jest.fn();
    const link = new MockSubscriptionLink();
    link.onUnsubscribe(onUnsubscribe);
    link.onSetup(onSubscribe);

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.subscribe({
      query: subscription,
      variables: { name: "Changping Chen" },
    });
    const stream = new ObservableStream(observable);

    link.simulateResult(results[0], true);

    await expect(stream).toEmitTypedValue(results[0].result);
    await expect(stream).toComplete();

    expect(onUnsubscribe).toHaveBeenCalledTimes(1);
    expect(onSubscribe).toHaveBeenCalledTimes(1);

    onSubscribe.mockReset();
    onUnsubscribe.mockReset();

    observable.restart();

    expect(onUnsubscribe).not.toHaveBeenCalled();
    expect(onSubscribe).not.toHaveBeenCalled();
  });

  test("restart does not affect future subscriptions", async () => {
    const onUnsubscribe = jest.fn();
    const onSubscribe = jest.fn();
    const link = new MockSubscriptionLink();
    link.onUnsubscribe(onUnsubscribe);
    link.onSetup(onSubscribe);

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    const observable1 = client.subscribe({
      query: subscription,
      variables: { name: "Changping Chen" },
    });
    const stream = new ObservableStream(observable1);

    link.simulateResult(results[0], true);

    await expect(stream).toEmitTypedValue(results[0].result);
    await expect(stream).toComplete();

    expect(onUnsubscribe).toHaveBeenCalledTimes(1);
    expect(onSubscribe).toHaveBeenCalledTimes(1);

    const observable2 = client.subscribe({
      query: subscription,
      variables: { name: "Changping Chen" },
    });
    const stream2 = new ObservableStream(observable2);

    expect(onSubscribe).toHaveBeenCalledTimes(2);
    expect(onUnsubscribe).toHaveBeenCalledTimes(1);

    link.simulateResult(results[0]);

    await expect(stream2).toEmitTypedValue(results[0].result);

    onSubscribe.mockReset();
    onUnsubscribe.mockReset();

    observable1.restart();

    expect(onUnsubscribe).not.toHaveBeenCalled();
    expect(onSubscribe).not.toHaveBeenCalled();

    link.simulateResult(results[1]);

    await expect(stream2).toEmitTypedValue(results[1].result);
  });
});
