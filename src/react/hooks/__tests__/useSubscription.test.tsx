import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import gql from "graphql-tag";

import {
  ApolloClient,
  ApolloError,
  ApolloLink,
  concat,
  TypedDocumentNode,
} from "../../../core";
import { PROTOCOL_ERRORS_SYMBOL } from "../../../errors";
import { InMemoryCache as Cache } from "../../../cache";
import { ApolloProvider } from "../../context";
import { MockSubscriptionLink } from "../../../testing";
import { useSubscription } from "../useSubscription";
import { spyOnConsole } from "../../../testing/internal";
import { SubscriptionHookOptions } from "../../types/types";
import { ErrorBoundary } from "react-error-boundary";
import { MockedSubscriptionResult } from "../../../testing/core/mocking/mockSubscriptionLink";
import { GraphQLError } from "graphql";
import { InvariantError } from "ts-invariant";
import { renderHookToSnapshotStream } from "@testing-library/react-render-stream";

describe("useSubscription Hook", () => {
  it("should handle a simple subscription properly", async () => {
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = ["Audi", "BMW", "Mercedes", "Hyundai"].map((make) => ({
      result: { data: { car: { make } } },
    }));

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const { result } = renderHook(() => useSubscription(subscription), {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(undefined);
    expect(result.current.data).toBe(undefined);
    setTimeout(() => link.simulateResult(results[0]));
    await waitFor(
      () => {
        expect(result.current.data).toEqual(results[0].result.data);
      },
      { interval: 1 }
    );
    expect(result.current.loading).toBe(false);
    setTimeout(() => link.simulateResult(results[1]));
    await waitFor(
      () => {
        expect(result.current.data).toEqual(results[1].result.data);
      },
      { interval: 1 }
    );
    expect(result.current.loading).toBe(false);
    setTimeout(() => link.simulateResult(results[2]));
    await waitFor(
      () => {
        expect(result.current.data).toEqual(results[2].result.data);
      },
      { interval: 1 }
    );
    expect(result.current.loading).toBe(false);
    setTimeout(() => link.simulateResult(results[3]));
    await waitFor(
      () => {
        expect(result.current.data).toEqual(results[3].result.data);
      },
      { interval: 1 }
    );
    expect(result.current.loading).toBe(false);
  });

  it("should call onError after error results", async () => {
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = ["Audi", "BMW", "Mercedes", "Hyundai"].map((make) => ({
      result: { data: { car: { make } } },
    }));

    const errorResult = {
      error: new ApolloError({ errorMessage: "test" }),
      result: { data: { car: { make: null } } },
    };

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const onError = jest.fn();
    const { result } = renderHook(
      () => useSubscription(subscription, { onError }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(undefined);
    expect(result.current.data).toBe(undefined);
    setTimeout(() => link.simulateResult(results[0]));
    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { interval: 1 }
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(results[0].result.data);
    setTimeout(() => link.simulateResult(errorResult));
    await waitFor(
      () => {
        expect(onError).toHaveBeenCalledTimes(1);
      },
      { interval: 1 }
    );
  });

  it("should call onComplete after subscription is complete", async () => {
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = [
      {
        result: { data: { car: { make: "Audi" } } },
      },
    ];

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const onComplete = jest.fn();
    renderHook(() => useSubscription(subscription, { onComplete }), {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    });

    link.simulateResult(results[0]);

    setTimeout(() => link.simulateComplete());
    await waitFor(
      () => {
        expect(onComplete).toHaveBeenCalledTimes(1);
      },
      { interval: 1 }
    );
  });

  it("should cleanup after the subscription component has been unmounted", async () => {
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = [
      {
        result: { data: { car: { make: "Pagani" } } },
      },
    ];

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const onData = jest.fn();
    const { result, unmount } = renderHook(
      () =>
        useSubscription(subscription, {
          onData,
        }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(undefined);
    expect(result.current.data).toBe(undefined);
    setTimeout(() => link.simulateResult(results[0]));
    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { interval: 1 }
    );
    expect(result.current.error).toBe(undefined);
    expect(result.current.data).toBe(results[0].result.data);
    setTimeout(() => {
      expect(onData).toHaveBeenCalledTimes(1);
      // After the component has been unmounted, the internal
      // ObservableQuery should be stopped, meaning it shouldn't
      // receive any new data (so the onDataCount should
      // stay at 1).
      unmount();
      link.simulateResult(results[0]);
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onData).toHaveBeenCalledTimes(1);
  });

  it("should never execute a subscription with the skip option", async () => {
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const onSetup = jest.fn();
    const link = new MockSubscriptionLink();
    link.onSetup(onSetup);
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const onData = jest.fn();

    const { result, unmount, rerender } = renderHook(
      ({ variables }) =>
        useSubscription(subscription, {
          variables,
          skip: true,
          onData,
        }),
      {
        initialProps: {
          variables: {
            foo: "bar",
          },
        },
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(undefined);
    expect(result.current.data).toBe(undefined);

    rerender({ variables: { foo: "bar2" } });
    await expect(
      waitFor(
        () => {
          expect(result.current.data).not.toBe(undefined);
        },
        { interval: 1, timeout: 20 }
      )
    ).rejects.toThrow();

    expect(onSetup).toHaveBeenCalledTimes(0);
    expect(onData).toHaveBeenCalledTimes(0);
    unmount();
  });

  it("should create a subscription after skip has changed from true to a falsy value", async () => {
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = [
      {
        result: { data: { car: { make: "Pagani" } } },
      },
      {
        result: { data: { car: { make: "Scoop" } } },
      },
    ];

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });
    const { result, rerender } = renderHook(
      ({ skip }) => useSubscription(subscription, { skip }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
        initialProps: { skip: true },
      }
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(undefined);
    expect(result.current.error).toBe(undefined);

    rerender({ skip: false });
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(undefined);
    expect(result.current.error).toBe(undefined);

    setTimeout(() => {
      link.simulateResult(results[0]);
    });

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { interval: 1 }
    );
    expect(result.current.data).toEqual(results[0].result.data);
    expect(result.current.error).toBe(undefined);

    rerender({ skip: true });
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(undefined);
    expect(result.current.error).toBe(undefined);

    // ensure state persists across rerenders
    rerender({ skip: true });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(undefined);
    expect(result.current.error).toBe(undefined);

    await expect(
      waitFor(
        () => {
          expect(result.current.data).not.toBe(undefined);
        },
        { interval: 1, timeout: 20 }
      )
    ).rejects.toThrow();

    // ensure state persists across rerenders
    rerender({ skip: false });

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(undefined);
    expect(result.current.error).toBe(undefined);
    setTimeout(() => {
      link.simulateResult(results[1]);
    });

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { interval: 1 }
    );
    expect(result.current.data).toEqual(results[1].result.data);
    expect(result.current.error).toBe(undefined);
  });

  it("should share context set in options", async () => {
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = ["Audi", "BMW"].map((make) => ({
      result: { data: { car: { make } } },
    }));

    let context: string;
    const link = new MockSubscriptionLink();
    const contextLink = new ApolloLink((operation, forward) => {
      context = operation.getContext()?.make;
      return forward(operation);
    });
    const client = new ApolloClient({
      link: concat(contextLink, link),
      cache: new Cache({ addTypename: false }),
    });

    const { result } = renderHook(
      () =>
        useSubscription(subscription, {
          context: { make: "Audi" },
        }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(undefined);
    expect(result.current.data).toBe(undefined);
    setTimeout(() => {
      link.simulateResult(results[0]);
    }, 100);

    await waitFor(
      () => {
        expect(result.current.data).toEqual(results[0].result.data);
      },
      { interval: 1 }
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(undefined);

    setTimeout(() => {
      link.simulateResult(results[1]);
    });

    await waitFor(
      () => {
        expect(result.current.data).toEqual(results[1].result.data);
      },
      { interval: 1 }
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(undefined);

    expect(context!).toBe("Audi");
  });

  it("should share extensions set in options", async () => {
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = ["Audi", "BMW"].map((make) => ({
      result: { data: { car: { make } } },
    }));

    let extensions: string;
    const link = new MockSubscriptionLink();
    const extensionsLink = new ApolloLink((operation, forward) => {
      extensions = operation.extensions.make;
      return forward(operation);
    });
    const client = new ApolloClient({
      link: concat(extensionsLink, link),
      cache: new Cache({ addTypename: false }),
    });

    const { result } = renderHook(
      () =>
        useSubscription(subscription, {
          extensions: { make: "Audi" },
        }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(undefined);
    expect(result.current.data).toBe(undefined);
    setTimeout(() => {
      link.simulateResult(results[0]);
    }, 100);

    await waitFor(
      () => {
        expect(result.current.data).toEqual(results[0].result.data);
      },
      { interval: 1 }
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(undefined);

    setTimeout(() => {
      link.simulateResult(results[1]);
    });

    await waitFor(
      () => {
        expect(result.current.data).toEqual(results[1].result.data);
      },
      { interval: 1 }
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(undefined);

    expect(extensions!).toBe("Audi");
  });

  it("should handle multiple subscriptions properly", async () => {
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = ["Audi", "BMW"].map((make) => ({
      result: { data: { car: { make } } },
    }));

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const { result } = renderHook(
      () => ({
        sub1: useSubscription(subscription),
        sub2: useSubscription(subscription),
      }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    expect(result.current.sub1.loading).toBe(true);
    expect(result.current.sub1.error).toBe(undefined);
    expect(result.current.sub1.data).toBe(undefined);
    expect(result.current.sub2.loading).toBe(true);
    expect(result.current.sub2.error).toBe(undefined);
    expect(result.current.sub2.data).toBe(undefined);

    setTimeout(() => {
      link.simulateResult(results[0]);
    });

    await waitFor(
      () => {
        expect(result.current.sub1.data).toEqual(results[0].result.data);
      },
      { interval: 1 }
    );
    expect(result.current.sub1.loading).toBe(false);
    expect(result.current.sub1.error).toBe(undefined);
    expect(result.current.sub2.loading).toBe(false);
    expect(result.current.sub2.error).toBe(undefined);
    expect(result.current.sub2.data).toEqual(results[0].result.data);

    setTimeout(() => {
      link.simulateResult(results[1]);
    });

    await waitFor(
      () => {
        expect(result.current.sub1.data).toEqual(results[1].result.data);
      },
      { interval: 1 }
    );
    expect(result.current.sub1.loading).toBe(false);
    expect(result.current.sub1.error).toBe(undefined);
    expect(result.current.sub2.loading).toBe(false);
    expect(result.current.sub2.error).toBe(undefined);
    expect(result.current.sub2.data).toEqual(results[1].result.data);
  });

  it("should handle immediate completions gracefully", async () => {
    using consoleSpy = spyOnConsole("error");

    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const { result } = renderHook(() => useSubscription(subscription), {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    });

    setTimeout(() => {
      // Simulating the behavior of HttpLink, which calls next and complete in sequence.
      link.simulateResult({ result: { data: null } }, /* complete */ true);
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(undefined);
    expect(result.current.data).toBe(undefined);
    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { interval: 1 }
    );
    expect(result.current.error).toBe(undefined);
    expect(result.current.data).toBe(null);

    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    expect(consoleSpy.error.mock.calls[0]).toStrictEqual([
      "Missing field '%s' while writing result %o",
      "car",
      Object.create(null),
    ]);
  });

  it("should handle immediate completions with multiple subscriptions gracefully", async () => {
    using consoleSpy = spyOnConsole("error");
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const { result } = renderHook(
      () => ({
        sub1: useSubscription(subscription),
        sub2: useSubscription(subscription),
        sub3: useSubscription(subscription),
      }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    expect(result.current.sub1.loading).toBe(true);
    expect(result.current.sub1.error).toBe(undefined);
    expect(result.current.sub1.data).toBe(undefined);
    expect(result.current.sub2.loading).toBe(true);
    expect(result.current.sub2.error).toBe(undefined);
    expect(result.current.sub2.data).toBe(undefined);
    expect(result.current.sub3.loading).toBe(true);
    expect(result.current.sub3.error).toBe(undefined);
    expect(result.current.sub3.data).toBe(undefined);

    setTimeout(() => {
      // Simulating the behavior of HttpLink, which calls next and complete in sequence.
      link.simulateResult({ result: { data: null } }, /* complete */ true);
    });

    await waitFor(
      () => {
        expect(result.current.sub1.loading).toBe(false);
      },
      { interval: 1 }
    );

    expect(result.current.sub1.error).toBe(undefined);
    expect(result.current.sub1.data).toBe(null);
    expect(result.current.sub2.loading).toBe(false);
    expect(result.current.sub2.error).toBe(undefined);
    expect(result.current.sub2.data).toBe(null);
    expect(result.current.sub3.loading).toBe(false);
    expect(result.current.sub3.error).toBe(undefined);
    expect(result.current.sub3.data).toBe(null);

    expect(consoleSpy.error).toHaveBeenCalledTimes(3);
    expect(consoleSpy.error.mock.calls[0]).toStrictEqual([
      "Missing field '%s' while writing result %o",
      "car",
      Object.create(null),
    ]);
    expect(consoleSpy.error.mock.calls[1]).toStrictEqual([
      "Missing field '%s' while writing result %o",
      "car",
      Object.create(null),
    ]);
    expect(consoleSpy.error.mock.calls[2]).toStrictEqual([
      "Missing field '%s' while writing result %o",
      "car",
      Object.create(null),
    ]);
  });

  test("should warn when using 'onSubscriptionData' and 'onData' together", () => {
    using consoleSpy = spyOnConsole("warn");
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    renderHook(
      () =>
        useSubscription(subscription, {
          onData: jest.fn(),
          onSubscriptionData: jest.fn(),
        }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpy.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "supports only the 'onSubscriptionData' or 'onData' option"
      )
    );
  });

  test("prefers 'onData' when using 'onSubscriptionData' and 'onData' together", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = [
      {
        result: { data: { car: { make: "Pagani" } } },
      },
    ];

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const onData = jest.fn();
    const onSubscriptionData = jest.fn();

    renderHook(
      () =>
        useSubscription(subscription, {
          onData,
          onSubscriptionData,
        }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    setTimeout(() => link.simulateResult(results[0]));
    await waitFor(
      () => {
        expect(onData).toHaveBeenCalledTimes(1);
      },
      { interval: 1 }
    );
    expect(onSubscriptionData).toHaveBeenCalledTimes(0);
  });

  test("uses 'onSubscriptionData' when 'onData' is absent", async () => {
    using _consoleSpy = spyOnConsole("warn");
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = [
      {
        result: { data: { car: { make: "Pagani" } } },
      },
    ];

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const onSubscriptionData = jest.fn();

    renderHook(
      () =>
        useSubscription(subscription, {
          onSubscriptionData,
        }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    setTimeout(() => link.simulateResult(results[0]));
    await waitFor(
      () => {
        expect(onSubscriptionData).toHaveBeenCalledTimes(1);
      },
      { interval: 1 }
    );
  });

  test("only warns once using `onSubscriptionData`", () => {
    using consoleSpy = spyOnConsole("warn");
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const { rerender } = renderHook(
      () =>
        useSubscription(subscription, {
          onSubscriptionData: jest.fn(),
        }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    rerender();

    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
  });

  test("should warn when using 'onComplete' and 'onSubscriptionComplete' together", () => {
    using consoleSpy = spyOnConsole("warn");
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    renderHook(
      () =>
        useSubscription(subscription, {
          onComplete: jest.fn(),
          onSubscriptionComplete: jest.fn(),
        }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpy.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "supports only the 'onSubscriptionComplete' or 'onComplete' option"
      )
    );
  });

  test("prefers 'onComplete' when using 'onComplete' and 'onSubscriptionComplete' together", async () => {
    using _consoleSpy = spyOnConsole("warn");
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = [
      {
        result: { data: { car: { make: "Audi" } } },
      },
    ];

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const onComplete = jest.fn();
    const onSubscriptionComplete = jest.fn();

    renderHook(
      () =>
        useSubscription(subscription, {
          onComplete,
          onSubscriptionComplete,
        }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    link.simulateResult(results[0]);

    setTimeout(() => link.simulateComplete());
    await waitFor(
      () => {
        expect(onComplete).toHaveBeenCalledTimes(1);
      },
      { interval: 1 }
    );
    expect(onSubscriptionComplete).toHaveBeenCalledTimes(0);
  });

  test("uses 'onSubscriptionComplete' when 'onComplete' is absent", async () => {
    using _consoleSpy = spyOnConsole("warn");
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = [
      {
        result: { data: { car: { make: "Audi" } } },
      },
    ];

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const onSubscriptionComplete = jest.fn();

    renderHook(
      () =>
        useSubscription(subscription, {
          onSubscriptionComplete,
        }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    link.simulateResult(results[0]);

    setTimeout(() => link.simulateComplete());
    await waitFor(
      () => {
        expect(onSubscriptionComplete).toHaveBeenCalledTimes(1);
      },
      { interval: 1 }
    );
  });

  test("only warns once using `onSubscriptionComplete`", () => {
    using consoleSpy = spyOnConsole("warn");
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const { rerender } = renderHook(
      () =>
        useSubscription(subscription, {
          onSubscriptionComplete: jest.fn(),
        }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    rerender();

    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
  });

  describe("multipart subscriptions", () => {
    it("should handle a simple subscription properly", async () => {
      const subscription = gql`
        subscription ANewDieWasCreated {
          aNewDieWasCreated {
            die {
              color
              roll
              sides
            }
          }
        }
      `;
      const results = [
        {
          result: {
            data: null,
            extensions: {
              [PROTOCOL_ERRORS_SYMBOL]: [
                {
                  message: "cannot read message from websocket",
                  extensions: [
                    {
                      code: "WEBSOCKET_MESSAGE_ERROR",
                    },
                  ],
                },
              ],
            },
          },
        },
      ];
      const link = new MockSubscriptionLink();
      const client = new ApolloClient({
        link,
        cache: new Cache({ addTypename: false }),
      });
      let renderCount = 0;

      const { result } = renderHook(
        () => {
          renderCount++;
          return useSubscription(subscription);
        },
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBe(undefined);
      expect(result.current.data).toBe(undefined);
      link.simulateResult(results[0]);
      expect(renderCount).toBe(1);
      await waitFor(
        () => {
          expect(result.current.error).toBeInstanceOf(ApolloError);
        },
        { interval: 1 }
      );
      expect(result.current.error!.protocolErrors[0].message).toBe(
        "cannot read message from websocket"
      );
    });
  });

  it("should handle simple subscription after old in-flight teardown immediately \
followed by new in-flight setup", async () => {
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const results = ["Audi", "BMW"].map((make) => ({
      result: { data: { car: { make } } },
    }));

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const { result, unmount, rerender } = renderHook(
      ({ coin }) => {
        const heads = useSubscription(subscription, {
          variables: {},
          skip: coin === "tails",
          context: { coin: "heads" },
        });
        const tails = useSubscription(subscription, {
          variables: {},
          skip: coin === "heads",
          context: { coin: "tails" },
        });
        return { heads, tails };
      },
      {
        initialProps: {
          coin: "heads",
        },
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    rerender({ coin: "tails" });

    await new Promise((resolve) => setTimeout(() => resolve("wait"), 20));

    link.simulateResult(results[0]);

    await waitFor(
      () => {
        expect(result.current.tails.data).toEqual(results[0].result.data);
      },
      { interval: 1 }
    );
    expect(result.current.heads.data).toBeUndefined();

    rerender({ coin: "heads" });

    link.simulateResult(results[1]);

    await waitFor(
      () => {
        expect(result.current.heads.data).toEqual(results[1].result.data);
      },
      { interval: 1 }
    );
    expect(result.current.tails.data).toBeUndefined();

    unmount();
  });

  describe("errorPolicy", () => {
    function setup(
      initialProps: SubscriptionHookOptions<{ totalLikes: number }, {}>
    ) {
      const subscription: TypedDocumentNode<{ totalLikes: number }, {}> = gql`
        subscription ($id: ID!) {
          totalLikes
        }
      `;
      const errorBoundaryOnError = jest.fn();
      const link = new MockSubscriptionLink();
      const client = new ApolloClient({
        link,
        cache: new Cache(),
      });
      const wrapper = ({ children }: { children: any }) => (
        <ApolloProvider client={client}>
          <ErrorBoundary onError={errorBoundaryOnError} fallback={<>error</>}>
            {children}
          </ErrorBoundary>
        </ApolloProvider>
      );
      const { takeSnapshot } = renderHookToSnapshotStream(
        (options: SubscriptionHookOptions<{ totalLikes: number }, {}>) =>
          useSubscription(subscription, options),
        {
          initialProps,
          wrapper,
        }
      );
      const graphQlErrorResult: MockedSubscriptionResult = {
        result: {
          data: { totalLikes: 42 },
          errors: [{ message: "test" } as any],
        },
      };
      const protocolErrorResult: MockedSubscriptionResult = {
        error: new Error("Socket closed with event -1: I'm a test!"),
      };
      return {
        client,
        link,
        errorBoundaryOnError,
        takeSnapshot,
        graphQlErrorResult,
        protocolErrorResult,
      };
    }
    describe("GraphQL error", () => {
      it.each([undefined, "none"] as const)(
        "`errorPolicy: '%s'`: returns `{ error }`, calls `onError`",
        async (errorPolicy) => {
          const onData = jest.fn();
          const onError = jest.fn();
          const {
            takeSnapshot,
            link,
            graphQlErrorResult,
            errorBoundaryOnError,
          } = setup({ errorPolicy, onError, onData });

          await takeSnapshot();
          link.simulateResult(graphQlErrorResult);
          {
            const snapshot = await takeSnapshot();
            console.dir({ graphQlErrorResult, snapshot }, { depth: 5 });
            expect(snapshot).toStrictEqual({
              loading: false,
              error: new ApolloError({
                graphQLErrors: graphQlErrorResult.result!.errors as any,
              }),
              data: undefined,
              restart: expect.any(Function),
              variables: undefined,
            });
            expect(snapshot.error).toBeInstanceOf(ApolloError);
          }
          expect(onError).toHaveBeenCalledTimes(1);
          expect(onError).toHaveBeenCalledWith(
            new ApolloError({
              graphQLErrors: graphQlErrorResult.result!.errors as any,
            })
          );
          expect(onError).toHaveBeenCalledWith(expect.any(ApolloError));
          expect(onData).toHaveBeenCalledTimes(0);
          expect(errorBoundaryOnError).toHaveBeenCalledTimes(0);
        }
      );
      it("`errorPolicy: 'all'`: returns `{ error, data }`, calls `onError`", async () => {
        const onData = jest.fn();
        const onError = jest.fn();
        const { takeSnapshot, link, graphQlErrorResult, errorBoundaryOnError } =
          setup({ errorPolicy: "all", onError, onData });

        await takeSnapshot();
        link.simulateResult(graphQlErrorResult);
        {
          const snapshot = await takeSnapshot();
          expect(snapshot).toStrictEqual({
            loading: false,
            error: new ApolloError({
              errorMessage: "test",
              graphQLErrors: graphQlErrorResult.result!.errors as any,
            }),
            data: { totalLikes: 42 },
            restart: expect.any(Function),
            variables: undefined,
          });
          expect(snapshot.error).toBeInstanceOf(ApolloError);
        }

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(
          new ApolloError({
            errorMessage: "test",
            graphQLErrors: graphQlErrorResult.result!.errors as any,
          })
        );
        expect(onError).toHaveBeenCalledWith(expect.any(ApolloError));
        expect(onData).toHaveBeenCalledTimes(0);
        expect(errorBoundaryOnError).toHaveBeenCalledTimes(0);
      });
      it("`errorPolicy: 'ignore'`: returns `{ data }`, calls `onData`", async () => {
        const onData = jest.fn();
        const onError = jest.fn();
        const { takeSnapshot, link, graphQlErrorResult, errorBoundaryOnError } =
          setup({
            errorPolicy: "ignore",
            onError,
            onData,
          });

        await takeSnapshot();
        link.simulateResult(graphQlErrorResult);
        {
          const snapshot = await takeSnapshot();
          expect(snapshot).toStrictEqual({
            loading: false,
            error: undefined,
            data: { totalLikes: 42 },
            restart: expect.any(Function),
            variables: undefined,
          });
        }

        expect(onError).toHaveBeenCalledTimes(0);
        expect(onData).toHaveBeenCalledTimes(1);
        expect(onData).toHaveBeenCalledWith({
          client: expect.anything(),
          data: {
            data: { totalLikes: 42 },
            loading: false,
            // should this be undefined?
            error: undefined,
            variables: undefined,
          },
        });
        expect(errorBoundaryOnError).toHaveBeenCalledTimes(0);
      });
    });
    describe("protocol error", () => {
      it.each([undefined, "none", "all", "ignore"] as const)(
        "`errorPolicy: '%s'`: returns `{ error }`, calls `onError`",
        async (errorPolicy) => {
          const onData = jest.fn();
          const onError = jest.fn();
          const {
            takeSnapshot,
            link,
            protocolErrorResult,
            errorBoundaryOnError,
          } = setup({ errorPolicy, onError, onData });

          await takeSnapshot();
          link.simulateResult(protocolErrorResult);
          {
            const snapshot = await takeSnapshot();
            expect(snapshot).toStrictEqual({
              loading: false,
              error: new ApolloError({
                protocolErrors: [protocolErrorResult.error!],
              }),
              data: undefined,
              restart: expect.any(Function),
              variables: undefined,
            });
            expect(snapshot.error).toBeInstanceOf(ApolloError);
          }

          expect(onError).toHaveBeenCalledTimes(1);
          expect(onError).toHaveBeenCalledWith(expect.any(ApolloError));
          expect(onError).toHaveBeenCalledWith(
            new ApolloError({
              protocolErrors: [protocolErrorResult.error!],
            })
          );
          expect(onData).toHaveBeenCalledTimes(0);
          expect(errorBoundaryOnError).toHaveBeenCalledTimes(0);
        }
      );
    });
  });
});

describe("`restart` callback", () => {
  function setup(
    initialProps: SubscriptionHookOptions<
      { totalLikes: number },
      { id: string }
    >
  ) {
    const subscription: TypedDocumentNode<
      { totalLikes: number },
      { id: string }
    > = gql`
      subscription ($id: ID!) {
        totalLikes(postId: $id)
      }
    `;
    const onSubscribe = jest.fn();
    const onUnsubscribe = jest.fn();
    const link = new MockSubscriptionLink();
    link.onSetup(onSubscribe);
    link.onUnsubscribe(onUnsubscribe);
    const client = new ApolloClient({
      link,
      cache: new Cache(),
    });
    const { takeSnapshot, getCurrentSnapshot, rerender } =
      renderHookToSnapshotStream(
        (
          options: SubscriptionHookOptions<
            { totalLikes: number },
            { id: string }
          >
        ) => useSubscription(subscription, options),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
          initialProps,
        }
      );
    return {
      client,
      link,
      takeSnapshot,
      getCurrentSnapshot,
      onSubscribe,
      onUnsubscribe,
      rerender,
    };
  }
  it("can restart a running subscription", async () => {
    const {
      link,
      takeSnapshot,
      getCurrentSnapshot,
      onSubscribe,
      onUnsubscribe,
    } = setup({
      variables: { id: "1" },
    });

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: true,
        data: undefined,
        error: undefined,
        restart: expect.any(Function),
        variables: { id: "1" },
      });
    }
    link.simulateResult({ result: { data: { totalLikes: 1 } } });
    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: false,
        data: { totalLikes: 1 },
        error: undefined,
        restart: expect.any(Function),
        variables: { id: "1" },
      });
    }
    await expect(takeSnapshot).not.toRerender({ timeout: 20 });
    expect(onUnsubscribe).toHaveBeenCalledTimes(0);
    expect(onSubscribe).toHaveBeenCalledTimes(1);

    getCurrentSnapshot().restart();

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: true,
        data: undefined,
        error: undefined,
        restart: expect.any(Function),
        variables: { id: "1" },
      });
    }
    await waitFor(() => expect(onUnsubscribe).toHaveBeenCalledTimes(1));
    expect(onSubscribe).toHaveBeenCalledTimes(2);

    link.simulateResult({ result: { data: { totalLikes: 2 } } });
    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: false,
        data: { totalLikes: 2 },
        error: undefined,
        restart: expect.any(Function),
        variables: { id: "1" },
      });
    }
  });
  it("will use the most recently passed in options", async () => {
    const {
      link,
      takeSnapshot,
      getCurrentSnapshot,
      onSubscribe,
      onUnsubscribe,
      rerender,
    } = setup({
      variables: { id: "1" },
    });
    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: true,
        data: undefined,
        error: undefined,
        restart: expect.any(Function),
        variables: { id: "1" },
      });
    }
    // deliberately keeping a reference to a very old `restart` function
    // to show that the most recent options are used even with that
    const restart = getCurrentSnapshot().restart;
    link.simulateResult({ result: { data: { totalLikes: 1 } } });
    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: false,
        data: { totalLikes: 1 },
        error: undefined,
        restart: expect.any(Function),
        variables: { id: "1" },
      });
    }
    await expect(takeSnapshot).not.toRerender({ timeout: 20 });
    expect(onUnsubscribe).toHaveBeenCalledTimes(0);
    expect(onSubscribe).toHaveBeenCalledTimes(1);

    rerender({ variables: { id: "2" } });
    await waitFor(() => expect(onUnsubscribe).toHaveBeenCalledTimes(1));
    expect(onSubscribe).toHaveBeenCalledTimes(2);
    expect(link.operation?.variables).toStrictEqual({ id: "2" });

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: true,
        data: undefined,
        error: undefined,
        restart: expect.any(Function),
        variables: { id: "2" },
      });
    }
    link.simulateResult({ result: { data: { totalLikes: 1000 } } });
    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: false,
        data: { totalLikes: 1000 },
        error: undefined,
        restart: expect.any(Function),
        variables: { id: "2" },
      });
    }

    expect(onUnsubscribe).toHaveBeenCalledTimes(1);
    expect(onSubscribe).toHaveBeenCalledTimes(2);
    expect(link.operation?.variables).toStrictEqual({ id: "2" });

    restart();

    await waitFor(() => expect(onUnsubscribe).toHaveBeenCalledTimes(2));
    expect(onSubscribe).toHaveBeenCalledTimes(3);
    expect(link.operation?.variables).toStrictEqual({ id: "2" });

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: true,
        data: undefined,
        error: undefined,
        restart: expect.any(Function),
        variables: { id: "2" },
      });
    }
    link.simulateResult({ result: { data: { totalLikes: 1005 } } });
    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: false,
        data: { totalLikes: 1005 },
        error: undefined,
        restart: expect.any(Function),
        variables: { id: "2" },
      });
    }
  });
  it("can restart a subscription that has completed", async () => {
    const {
      link,
      takeSnapshot,
      getCurrentSnapshot,
      onSubscribe,
      onUnsubscribe,
    } = setup({
      variables: { id: "1" },
    });
    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: true,
        data: undefined,
        error: undefined,
        restart: expect.any(Function),
        variables: { id: "1" },
      });
    }
    link.simulateResult({ result: { data: { totalLikes: 1 } } }, true);
    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: false,
        data: { totalLikes: 1 },
        error: undefined,
        restart: expect.any(Function),
        variables: { id: "1" },
      });
    }
    await expect(takeSnapshot).not.toRerender({ timeout: 20 });
    expect(onUnsubscribe).toHaveBeenCalledTimes(1);
    expect(onSubscribe).toHaveBeenCalledTimes(1);

    getCurrentSnapshot().restart();

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: true,
        data: undefined,
        error: undefined,
        restart: expect.any(Function),
        variables: { id: "1" },
      });
    }
    await waitFor(() => expect(onSubscribe).toHaveBeenCalledTimes(2));
    expect(onUnsubscribe).toHaveBeenCalledTimes(1);

    link.simulateResult({ result: { data: { totalLikes: 2 } } });
    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: false,
        data: { totalLikes: 2 },
        error: undefined,
        restart: expect.any(Function),
        variables: { id: "1" },
      });
    }
  });
  it("can restart a subscription that has errored", async () => {
    const {
      link,
      takeSnapshot,
      getCurrentSnapshot,
      onSubscribe,
      onUnsubscribe,
    } = setup({
      variables: { id: "1" },
    });
    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: true,
        data: undefined,
        error: undefined,
        restart: expect.any(Function),
        variables: { id: "1" },
      });
    }
    const error = new GraphQLError("error");
    link.simulateResult({
      result: { errors: [error] },
    });
    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: false,
        data: undefined,
        error: new ApolloError({ graphQLErrors: [error] }),
        restart: expect.any(Function),
        variables: { id: "1" },
      });
    }
    await expect(takeSnapshot).not.toRerender({ timeout: 20 });
    expect(onUnsubscribe).toHaveBeenCalledTimes(1);
    expect(onSubscribe).toHaveBeenCalledTimes(1);

    getCurrentSnapshot().restart();

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: true,
        data: undefined,
        error: undefined,
        restart: expect.any(Function),
        variables: { id: "1" },
      });
    }
    await waitFor(() => expect(onSubscribe).toHaveBeenCalledTimes(2));
    expect(onUnsubscribe).toHaveBeenCalledTimes(1);

    link.simulateResult({ result: { data: { totalLikes: 2 } } });
    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: false,
        data: { totalLikes: 2 },
        error: undefined,
        restart: expect.any(Function),
        variables: { id: "1" },
      });
    }
  });
  it("will not restart a subscription that has been `skip`ped", async () => {
    const { takeSnapshot, getCurrentSnapshot, onSubscribe, onUnsubscribe } =
      setup({
        variables: { id: "1" },
        skip: true,
      });
    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: false,
        data: undefined,
        error: undefined,
        restart: expect.any(Function),
        variables: { id: "1" },
      });
    }
    expect(onUnsubscribe).toHaveBeenCalledTimes(0);
    expect(onSubscribe).toHaveBeenCalledTimes(0);

    expect(() => getCurrentSnapshot().restart()).toThrow(
      new InvariantError("A subscription that is skipped cannot be restarted.")
    );

    await expect(takeSnapshot).not.toRerender({ timeout: 20 });
    expect(onUnsubscribe).toHaveBeenCalledTimes(0);
    expect(onSubscribe).toHaveBeenCalledTimes(0);
  });
});

describe("ignoreResults", () => {
  const subscription = gql`
    subscription {
      car {
        make
      }
    }
  `;

  const results = ["Audi", "BMW"].map((make) => ({
    result: { data: { car: { make } } },
  }));

  it("should not rerender when ignoreResults is true, but will call `onData` and `onComplete`", async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const onData = jest.fn((() => {}) as SubscriptionHookOptions["onData"]);
    const onError = jest.fn((() => {}) as SubscriptionHookOptions["onError"]);
    const onComplete = jest.fn(
      (() => {}) as SubscriptionHookOptions["onComplete"]
    );
    const { takeSnapshot } = renderHookToSnapshotStream(
      () =>
        useSubscription(subscription, {
          ignoreResults: true,
          onData,
          onError,
          onComplete,
        }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    const snapshot = await takeSnapshot();
    expect(snapshot).toStrictEqual({
      loading: false,
      error: undefined,
      data: undefined,
      variables: undefined,
      restart: expect.any(Function),
    });
    link.simulateResult(results[0]);

    await waitFor(() => {
      expect(onData).toHaveBeenCalledTimes(1);
      expect(onData).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: {
            data: results[0].result.data,
            error: undefined,
            loading: false,
            variables: undefined,
          },
        })
      );
      expect(onError).toHaveBeenCalledTimes(0);
      expect(onComplete).toHaveBeenCalledTimes(0);
    });

    link.simulateResult(results[1], true);
    await waitFor(() => {
      expect(onData).toHaveBeenCalledTimes(2);
      expect(onData).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: {
            data: results[1].result.data,
            error: undefined,
            loading: false,
            variables: undefined,
          },
        })
      );
      expect(onError).toHaveBeenCalledTimes(0);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    await expect(takeSnapshot).not.toRerender();
  });

  it("should not rerender when ignoreResults is true and an error occurs", async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const onData = jest.fn((() => {}) as SubscriptionHookOptions["onData"]);
    const onError = jest.fn((() => {}) as SubscriptionHookOptions["onError"]);
    const onComplete = jest.fn(
      (() => {}) as SubscriptionHookOptions["onComplete"]
    );
    const { takeSnapshot } = renderHookToSnapshotStream(
      () =>
        useSubscription(subscription, {
          ignoreResults: true,
          onData,
          onError,
          onComplete,
        }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    const snapshot = await takeSnapshot();
    expect(snapshot).toStrictEqual({
      loading: false,
      error: undefined,
      data: undefined,
      variables: undefined,
      restart: expect.any(Function),
    });
    link.simulateResult(results[0]);

    await waitFor(() => {
      expect(onData).toHaveBeenCalledTimes(1);
      expect(onData).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: {
            data: results[0].result.data,
            error: undefined,
            loading: false,
            variables: undefined,
          },
        })
      );
      expect(onError).toHaveBeenCalledTimes(0);
      expect(onComplete).toHaveBeenCalledTimes(0);
    });

    const error = new Error("test");
    link.simulateResult({ error });
    await waitFor(() => {
      expect(onData).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenLastCalledWith(
        new ApolloError({ protocolErrors: [error] })
      );
      expect(onComplete).toHaveBeenCalledTimes(0);
    });

    await expect(takeSnapshot).not.toRerender();
  });

  it("can switch from `ignoreResults: true` to `ignoreResults: false` and will start rerendering, without creating a new subscription", async () => {
    const subscriptionCreated = jest.fn();
    const link = new MockSubscriptionLink();
    link.onSetup(subscriptionCreated);
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const onData = jest.fn((() => {}) as SubscriptionHookOptions["onData"]);
    const { takeSnapshot, rerender } = renderHookToSnapshotStream(
      ({ ignoreResults }: { ignoreResults: boolean }) =>
        useSubscription(subscription, {
          ignoreResults,
          onData,
        }),
      {
        initialProps: { ignoreResults: true },
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );
    expect(subscriptionCreated).toHaveBeenCalledTimes(1);

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: false,
        error: undefined,
        data: undefined,
        variables: undefined,
        restart: expect.any(Function),
      });
      expect(onData).toHaveBeenCalledTimes(0);
    }
    link.simulateResult(results[0]);
    await expect(takeSnapshot).not.toRerender({ timeout: 20 });
    expect(onData).toHaveBeenCalledTimes(1);

    rerender({ ignoreResults: false });
    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: false,
        error: undefined,
        // `data` appears immediately after changing to `ignoreResults: false`
        data: results[0].result.data,
        variables: undefined,
        restart: expect.any(Function),
      });
      // `onData` should not be called again for the same result
      expect(onData).toHaveBeenCalledTimes(1);
    }

    link.simulateResult(results[1]);
    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: false,
        error: undefined,
        data: results[1].result.data,
        variables: undefined,
        restart: expect.any(Function),
      });
      expect(onData).toHaveBeenCalledTimes(2);
    }
    // a second subscription should not have been started
    expect(subscriptionCreated).toHaveBeenCalledTimes(1);
  });
  it("can switch from `ignoreResults: false` to `ignoreResults: true` and will stop rerendering, without creating a new subscription", async () => {
    const subscriptionCreated = jest.fn();
    const link = new MockSubscriptionLink();
    link.onSetup(subscriptionCreated);
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const onData = jest.fn((() => {}) as SubscriptionHookOptions["onData"]);
    const { takeSnapshot, rerender } = renderHookToSnapshotStream(
      ({ ignoreResults }: { ignoreResults: boolean }) =>
        useSubscription(subscription, {
          ignoreResults,
          onData,
        }),
      {
        initialProps: { ignoreResults: false },
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );
    expect(subscriptionCreated).toHaveBeenCalledTimes(1);

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: true,
        error: undefined,
        data: undefined,
        variables: undefined,
        restart: expect.any(Function),
      });
      expect(onData).toHaveBeenCalledTimes(0);
    }
    link.simulateResult(results[0]);
    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: false,
        error: undefined,
        data: results[0].result.data,
        variables: undefined,
        restart: expect.any(Function),
      });
      expect(onData).toHaveBeenCalledTimes(1);
    }
    await expect(takeSnapshot).not.toRerender({ timeout: 20 });

    rerender({ ignoreResults: true });
    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toStrictEqual({
        loading: false,
        error: undefined,
        // switching back to the default `ignoreResults: true` return value
        data: undefined,
        variables: undefined,
        restart: expect.any(Function),
      });
      // `onData` should not be called again
      expect(onData).toHaveBeenCalledTimes(1);
    }

    link.simulateResult(results[1]);
    await expect(takeSnapshot).not.toRerender({ timeout: 20 });
    expect(onData).toHaveBeenCalledTimes(2);

    // a second subscription should not have been started
    expect(subscriptionCreated).toHaveBeenCalledTimes(1);
  });
});

describe.skip("Type Tests", () => {
  test("NoInfer prevents adding arbitrary additional variables", () => {
    const typedNode = {} as TypedDocumentNode<{ foo: string }, { bar: number }>;
    const { variables } = useSubscription(typedNode, {
      variables: {
        bar: 4,
        // @ts-expect-error
        nonExistingVariable: "string",
      },
    });
    variables?.bar;
    // @ts-expect-error
    variables?.nonExistingVariable;
  });
});
