import { waitFor } from "@testing-library/react";
import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { expectTypeOf } from "expect-type";
import { GraphQLFormattedError } from "graphql";
import { gql } from "graphql-tag";
import React from "react";
import { ErrorBoundary } from "react-error-boundary";

import { InMemoryCache as Cache } from "@apollo/client/cache";
import {
  ApolloClient,
  ApolloLink,
  concat,
  TypedDocumentNode,
} from "@apollo/client/core";
import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
} from "@apollo/client/errors";
import { Masked, MaskedDocumentNode } from "@apollo/client/masking";
import { ApolloProvider } from "@apollo/client/react/context";
import { MockSubscriptionLink, tick, wait } from "@apollo/client/testing";
import { InvariantError } from "@apollo/client/utilities/invariant";

import { MockedSubscriptionResult } from "../../../testing/core/mocking/mockSubscriptionLink.js";
import { mockMultipartSubscriptionStream } from "../../../testing/internal/index.js";
import { useSubscription } from "../useSubscription.js";

const IS_REACT_17 = React.version.startsWith("17");

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
      cache: new Cache(),
    });

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useSubscription(subscription),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      error: undefined,
      loading: true,
    });

    link.simulateResult(results[0]);

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: results[0].result.data,
      error: undefined,
      loading: false,
    });

    link.simulateResult(results[1]);

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: results[1].result.data,
      error: undefined,
      loading: false,
    });

    link.simulateResult(results[2]);

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: results[2].result.data,
      error: undefined,
      loading: false,
    });

    link.simulateResult(results[3]);

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: results[3].result.data,
      error: undefined,
      loading: false,
    });

    await expect(takeSnapshot).not.toRerender();
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
      result: { data: { car: { make: null } }, errors: [{ message: "test" }] },
    };

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache(),
    });

    const onError = jest.fn();
    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useSubscription(subscription, { onError }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      error: undefined,
      loading: true,
    });

    link.simulateResult(results[0]);

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: results[0].result.data,
      error: undefined,
      loading: false,
    });

    link.simulateResult(errorResult);

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      error: new CombinedGraphQLErrors([{ message: "test" }]),
      loading: false,
    });

    await expect(takeSnapshot).not.toRerender();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      new CombinedGraphQLErrors([{ message: "test" }])
    );
  });

  it("can continue to receive new results after an error", async () => {
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
      result: { data: { car: { make: null } }, errors: [{ message: "test" }] },
    };

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache(),
    });

    const onError = jest.fn();
    const onData = jest.fn();
    const onComplete = jest.fn();
    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useSubscription(subscription, { onError, onData, onComplete }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      error: undefined,
      loading: true,
    });

    link.simulateResult(results[0]);

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: results[0].result.data,
      error: undefined,
      loading: false,
    });

    expect(onData).toHaveBeenCalledTimes(1);
    expect(onData).toHaveBeenLastCalledWith({
      client,
      data: {
        data: results[0].result.data,
        error: undefined,
        loading: false,
        variables: undefined,
      },
    });
    expect(onError).toHaveBeenCalledTimes(0);
    expect(onComplete).toHaveBeenCalledTimes(0);

    link.simulateResult(errorResult);

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      error: new CombinedGraphQLErrors([{ message: "test" }]),
      loading: false,
    });

    expect(onData).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenLastCalledWith(
      new CombinedGraphQLErrors([{ message: "test" }])
    );
    expect(onComplete).toHaveBeenCalledTimes(0);

    link.simulateResult(results[1]);

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: results[1].result.data,
      error: undefined,
      loading: false,
    });

    expect(onData).toHaveBeenCalledTimes(2);
    expect(onData).toHaveBeenLastCalledWith({
      client,
      data: {
        data: results[1].result.data,
        error: undefined,
        loading: false,
        variables: undefined,
      },
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(0);

    await expect(takeSnapshot).not.toRerender();
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
      cache: new Cache(),
    });

    const onComplete = jest.fn();
    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useSubscription(subscription, { onComplete }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      error: undefined,
      loading: true,
    });

    link.simulateResult(results[0]);

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: results[0].result.data,
      error: undefined,
      loading: false,
    });

    link.simulateComplete();

    await expect(takeSnapshot).not.toRerender();
    expect(onComplete).toHaveBeenCalledTimes(1);
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
      cache: new Cache(),
    });

    const onData = jest.fn();
    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, unmount } = await renderHookToSnapshotStream(
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

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      error: undefined,
      loading: true,
    });

    link.simulateResult(results[0]);

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: results[0].result.data,
      error: undefined,
      loading: false,
    });

    expect(onData).toHaveBeenCalledTimes(1);
    expect(onData).toHaveBeenCalledWith({
      client,
      data: {
        data: results[0].result.data,
        error: undefined,
        loading: false,
        variables: undefined,
      },
    });

    // After the component has been unmounted, the internal
    // ObservableQuery should be stopped, meaning it shouldn't
    // receive any new data (so the onDataCount should
    // stay at 1).
    unmount();
    link.simulateResult(results[0]);

    await wait(100);
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
      cache: new Cache(),
    });

    const onData = jest.fn();

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, unmount, rerender } =
      await renderHookToSnapshotStream(
        ({ variables }) =>
          useSubscription(subscription, { variables, skip: true, onData }),
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

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      error: undefined,
      loading: false,
    });

    await rerender({ variables: { foo: "bar2" } });

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      error: undefined,
      loading: false,
    });

    await expect(takeSnapshot).not.toRerender();

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
      cache: new Cache(),
    });

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
      ({ skip }) => useSubscription(subscription, { skip }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
        initialProps: { skip: true },
      }
    );

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      error: undefined,
      loading: false,
    });

    await rerender({ skip: false });

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      error: undefined,
      loading: true,
    });

    link.simulateResult(results[0]);

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: results[0].result.data,
      error: undefined,
      loading: false,
    });

    await rerender({ skip: true });

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      error: undefined,
      loading: false,
    });

    // ensure state persists across rerenders
    await rerender({ skip: true });

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      error: undefined,
      loading: false,
    });

    await expect(takeSnapshot).not.toRerender();

    // ensure state persists across rerenders
    await rerender({ skip: false });

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      error: undefined,
      loading: true,
    });

    link.simulateResult(results[1]);

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: results[1].result.data,
      error: undefined,
      loading: false,
    });

    await expect(takeSnapshot).not.toRerender();
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
      cache: new Cache(),
    });

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
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

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      error: undefined,
      loading: true,
    });

    link.simulateResult(results[0]);

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: results[0].result.data,
      error: undefined,
      loading: false,
    });

    link.simulateResult(results[1]);

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: results[1].result.data,
      error: undefined,
      loading: false,
    });

    await expect(takeSnapshot).not.toRerender();

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
      cache: new Cache(),
    });

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
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

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      error: undefined,
      loading: true,
    });

    link.simulateResult(results[0]);

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: results[0].result.data,
      error: undefined,
      loading: false,
    });

    link.simulateResult(results[1]);

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: results[1].result.data,
      error: undefined,
      loading: false,
    });

    await expect(takeSnapshot).not.toRerender();

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
      cache: new Cache(),
    });

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
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

    {
      const { sub1, sub2 } = await takeSnapshot();

      expect(sub1).toEqualStrictTyped({
        data: undefined,
        error: undefined,
        loading: true,
      });

      expect(sub2).toEqualStrictTyped({
        data: undefined,
        error: undefined,
        loading: true,
      });
    }

    link.simulateResult(results[0]);

    if (IS_REACT_17) {
      const { sub1, sub2 } = await takeSnapshot();

      expect(sub1).toEqualStrictTyped({
        data: results[0].result.data,
        error: undefined,
        loading: false,
      });

      expect(sub2).toEqualStrictTyped({
        data: undefined,
        error: undefined,
        loading: true,
      });
    }

    {
      const { sub1, sub2 } = await takeSnapshot();

      expect(sub1).toEqualStrictTyped({
        data: results[0].result.data,
        error: undefined,
        loading: false,
      });

      expect(sub2).toEqualStrictTyped({
        data: results[0].result.data,
        error: undefined,
        loading: false,
      });
    }

    link.simulateResult(results[1]);

    if (IS_REACT_17) {
      const { sub1, sub2 } = await takeSnapshot();

      expect(sub1).toEqualStrictTyped({
        data: results[1].result.data,
        error: undefined,
        loading: false,
      });

      expect(sub2).toEqualStrictTyped({
        data: results[0].result.data,
        error: undefined,
        loading: false,
      });
    }

    {
      const { sub1, sub2 } = await takeSnapshot();

      expect(sub1).toEqualStrictTyped({
        data: results[1].result.data,
        error: undefined,
        loading: false,
      });

      expect(sub2).toEqualStrictTyped({
        data: results[1].result.data,
        error: undefined,
        loading: false,
      });
    }

    await expect(takeSnapshot).not.toRerender();
  });

  it("should handle immediate completions gracefully", async () => {
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
      cache: new Cache(),
    });

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useSubscription(subscription),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      error: undefined,
      loading: true,
    });

    // Simulating the behavior of HttpLink, which calls next and complete in sequence.
    link.simulateResult(
      { result: { data: { car: { __typename: "Car", make: "Audi" } } } },
      /* complete */ true
    );

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: { car: { __typename: "Car", make: "Audi" } },
      error: undefined,
      loading: false,
    });

    await expect(takeSnapshot).not.toRerender();
  });

  it("should handle immediate completions with multiple subscriptions gracefully", async () => {
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
      cache: new Cache(),
    });

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
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

    {
      const { sub1, sub2, sub3 } = await takeSnapshot();

      expect(sub1).toEqualStrictTyped({
        data: undefined,
        error: undefined,
        loading: true,
      });

      expect(sub2).toEqualStrictTyped({
        data: undefined,
        error: undefined,
        loading: true,
      });

      expect(sub3).toEqualStrictTyped({
        data: undefined,
        error: undefined,
        loading: true,
      });
    }

    // Simulating the behavior of HttpLink, which calls next and complete in sequence.
    link.simulateResult(
      { result: { data: { car: { __typename: "Car", make: "Audi" } } } },
      /* complete */ true
    );

    if (IS_REACT_17) {
      {
        const { sub1, sub2, sub3 } = await takeSnapshot();

        expect(sub1).toEqualStrictTyped({
          data: { car: { __typename: "Car", make: "Audi" } },
          error: undefined,
          loading: false,
        });

        expect(sub2).toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: true,
        });

        expect(sub3).toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: true,
        });
      }

      {
        const { sub1, sub2, sub3 } = await takeSnapshot();

        expect(sub1).toEqualStrictTyped({
          data: { car: { __typename: "Car", make: "Audi" } },
          error: undefined,
          loading: false,
        });

        expect(sub2).toEqualStrictTyped({
          data: { car: { __typename: "Car", make: "Audi" } },
          error: undefined,
          loading: false,
        });

        expect(sub3).toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: true,
        });
      }
    }

    {
      const { sub1, sub2, sub3 } = await takeSnapshot();

      expect(sub1).toEqualStrictTyped({
        data: { car: { __typename: "Car", make: "Audi" } },
        error: undefined,
        loading: false,
      });

      expect(sub2).toEqualStrictTyped({
        data: { car: { __typename: "Car", make: "Audi" } },
        error: undefined,
        loading: false,
      });

      expect(sub3).toEqualStrictTyped({
        data: { car: { __typename: "Car", make: "Audi" } },
        error: undefined,
        loading: false,
      });
    }

    await expect(takeSnapshot).not.toRerender();
  });

  describe("multipart subscriptions", () => {
    it("should handle a simple subscription properly", async () => {
      const { httpLink, enqueueProtocolErrors } =
        mockMultipartSubscriptionStream();

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

      const client = new ApolloClient({
        link: httpLink,
        cache: new Cache(),
      });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () => useSubscription(subscription),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      await expect(takeSnapshot()).resolves.toEqualStrictTyped({
        data: undefined,
        error: undefined,
        loading: true,
      });

      enqueueProtocolErrors([
        {
          message: "cannot read message from websocket",
          extensions: {
            code: "WEBSOCKET_MESSAGE_ERROR",
          },
        },
      ]);

      await expect(takeSnapshot()).resolves.toEqualStrictTyped({
        data: undefined,
        error: new CombinedProtocolErrors([
          {
            message: "cannot read message from websocket",
            extensions: {
              code: "WEBSOCKET_MESSAGE_ERROR",
            },
          },
        ]),
        loading: false,
      });

      await expect(takeSnapshot).not.toRerender();
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
      cache: new Cache(),
    });

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
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

    {
      const { heads, tails } = await takeSnapshot();

      expect(heads).toEqualStrictTyped({
        data: undefined,
        error: undefined,
        loading: true,
      });

      expect(tails).toEqualStrictTyped({
        data: undefined,
        error: undefined,
        loading: false,
      });
    }

    await rerender({ coin: "tails" });

    {
      const { heads, tails } = await takeSnapshot();

      expect(heads).toEqualStrictTyped({
        data: undefined,
        error: undefined,
        loading: false,
      });

      expect(tails).toEqualStrictTyped({
        data: undefined,
        error: undefined,
        loading: true,
      });
    }

    await wait(20);

    link.simulateResult(results[0]);

    {
      const { heads, tails } = await takeSnapshot();

      expect(heads).toEqualStrictTyped({
        data: undefined,
        error: undefined,
        loading: false,
      });

      expect(tails).toEqualStrictTyped({
        data: results[0].result.data,
        error: undefined,
        loading: false,
      });
    }

    await rerender({ coin: "heads" });

    {
      const { heads, tails } = await takeSnapshot();

      expect(heads).toEqualStrictTyped({
        data: undefined,
        error: undefined,
        loading: true,
      });

      expect(tails).toEqualStrictTyped({
        data: undefined,
        error: undefined,
        loading: false,
      });
    }

    link.simulateResult(results[1]);

    {
      const { heads, tails } = await takeSnapshot();

      expect(heads).toEqualStrictTyped({
        data: results[1].result.data,
        error: undefined,
        loading: false,
      });

      expect(tails).toEqualStrictTyped({
        data: undefined,
        error: undefined,
        loading: false,
      });
    }

    await expect(takeSnapshot).not.toRerender();
  });

  describe("errorPolicy", () => {
    async function setup(
      initialProps: useSubscription.Options<{ totalLikes: number }, {}>
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
      const { takeSnapshot } = await renderHookToSnapshotStream(
        (options: useSubscription.Options<{ totalLikes: number }, {}>) =>
          useSubscription(subscription, options),
        {
          initialProps,
          wrapper,
        }
      );
      const graphQlErrorResult: MockedSubscriptionResult = {
        result: {
          data: { totalLikes: 42 },
          errors: [{ message: "test" }],
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
          using _disabledAct = disableActEnvironment();
          const {
            takeSnapshot,
            link,
            graphQlErrorResult,
            errorBoundaryOnError,
          } = await setup({ errorPolicy, onError, onData });

          await expect(takeSnapshot()).resolves.toEqualStrictTyped({
            data: undefined,
            error: undefined,
            loading: true,
          });

          link.simulateResult(graphQlErrorResult);

          {
            const snapshot = await takeSnapshot();
            expect(snapshot).toEqualStrictTyped({
              loading: false,
              error: new CombinedGraphQLErrors(
                graphQlErrorResult.result!.errors as any
              ),
              data: undefined,
            });
          }

          expect(onError).toHaveBeenCalledTimes(1);
          expect(onError).toHaveBeenCalledWith(
            new CombinedGraphQLErrors(graphQlErrorResult.result!.errors!)
          );
          expect(onData).toHaveBeenCalledTimes(0);
          expect(errorBoundaryOnError).toHaveBeenCalledTimes(0);
        }
      );
      it("`errorPolicy: 'all'`: returns `{ error, data }`, calls `onError`", async () => {
        const onData = jest.fn();
        const onError = jest.fn();
        using _disabledAct = disableActEnvironment();
        const { takeSnapshot, link, graphQlErrorResult, errorBoundaryOnError } =
          await setup({ errorPolicy: "all", onError, onData });

        await expect(takeSnapshot()).resolves.toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: true,
        });

        link.simulateResult(graphQlErrorResult);

        {
          const snapshot = await takeSnapshot();
          expect(snapshot).toEqualStrictTyped({
            loading: false,
            error: new CombinedGraphQLErrors(
              graphQlErrorResult.result!.errors!
            ),
            data: { totalLikes: 42 },
          });
        }

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(
          new CombinedGraphQLErrors(graphQlErrorResult.result!.errors!)
        );
        expect(onData).toHaveBeenCalledTimes(0);
        expect(errorBoundaryOnError).toHaveBeenCalledTimes(0);
      });

      it("`errorPolicy: 'ignore'`: returns `{ data }`, calls `onData`", async () => {
        const onData = jest.fn();
        const onError = jest.fn();
        using _disabledAct = disableActEnvironment();
        const { takeSnapshot, link, graphQlErrorResult, errorBoundaryOnError } =
          await setup({
            errorPolicy: "ignore",
            onError,
            onData,
          });

        await expect(takeSnapshot()).resolves.toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: true,
        });

        link.simulateResult(graphQlErrorResult);

        {
          const snapshot = await takeSnapshot();
          expect(snapshot).toEqualStrictTyped({
            loading: false,
            error: undefined,
            data: { totalLikes: 42 },
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
      it.each([undefined, "none", "all"] as const)(
        "`errorPolicy: '%s'`: returns `{ error }`, calls `onError`",
        async (errorPolicy) => {
          const { httpLink, enqueueProtocolErrors } =
            mockMultipartSubscriptionStream();

          const subscription: TypedDocumentNode<{ totalLikes: number }, {}> =
            gql`
              subscription ($id: ID!) {
                totalLikes
              }
            `;
          const client = new ApolloClient({
            link: httpLink,
            cache: new Cache(),
          });

          const onData = jest.fn();
          const onError = jest.fn();
          const onComplete = jest.fn();

          using _disabledAct = disableActEnvironment();
          const { takeSnapshot } = await renderHookToSnapshotStream(
            () =>
              useSubscription(subscription, {
                errorPolicy,
                onError,
                onData,
                onComplete,
              }),
            {
              wrapper: ({ children }) => (
                <ApolloProvider client={client}>{children}</ApolloProvider>
              ),
            }
          );

          await expect(takeSnapshot()).resolves.toEqualStrictTyped({
            data: undefined,
            error: undefined,
            loading: true,
          });

          enqueueProtocolErrors([
            { message: "Socket closed with event -1: I'm a test!" },
          ]);

          const expectedError = new CombinedProtocolErrors([
            { message: "Socket closed with event -1: I'm a test!" },
          ]);

          await expect(takeSnapshot()).resolves.toEqualStrictTyped({
            data: undefined,
            error: expectedError,
            loading: false,
          });

          expect(onError).toHaveBeenCalledTimes(1);
          expect(onError).toHaveBeenCalledWith(expectedError);
          expect(onData).toHaveBeenCalledTimes(0);
          expect(onComplete).toHaveBeenCalledTimes(1);
        }
      );

      it("`errorPolicy: 'ignore'`: does not rerender, calls `onComplete`", async () => {
        const { httpLink, enqueueProtocolErrors } =
          mockMultipartSubscriptionStream();

        const subscription: TypedDocumentNode<{ totalLikes: number }, {}> = gql`
          subscription ($id: ID!) {
            totalLikes
          }
        `;
        const client = new ApolloClient({
          link: httpLink,
          cache: new Cache(),
        });

        const onData = jest.fn();
        const onError = jest.fn();
        const onComplete = jest.fn();

        using _disabledAct = disableActEnvironment();
        const { takeSnapshot } = await renderHookToSnapshotStream(
          () =>
            useSubscription(subscription, {
              errorPolicy: "ignore",
              onError,
              onData,
              onComplete,
            }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider client={client}>{children}</ApolloProvider>
            ),
          }
        );

        await expect(takeSnapshot()).resolves.toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: true,
        });

        enqueueProtocolErrors([
          { message: "Socket closed with event -1: I'm a test!" },
        ]);

        await expect(takeSnapshot).not.toRerender();

        expect(onError).toHaveBeenCalledTimes(0);
        expect(onData).toHaveBeenCalledTimes(0);
        expect(onComplete).toHaveBeenCalledTimes(1);
      });
    });
  });
});

describe("`restart` callback", () => {
  async function setup(
    initialProps: useSubscription.Options<
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
      await renderHookToSnapshotStream(
        (
          options: useSubscription.Options<
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
    using _disabledAct = disableActEnvironment();
    const {
      link,
      takeSnapshot,
      getCurrentSnapshot,
      onSubscribe,
      onUnsubscribe,
    } = await setup({
      variables: { id: "1" },
    });

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: true,
        data: undefined,
        error: undefined,
      });
    }

    link.simulateResult({ result: { data: { totalLikes: 1 } } });

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: false,
        data: { totalLikes: 1 },
        error: undefined,
      });
    }

    await expect(takeSnapshot).not.toRerender({ timeout: 20 });
    expect(onUnsubscribe).toHaveBeenCalledTimes(0);
    expect(onSubscribe).toHaveBeenCalledTimes(1);

    getCurrentSnapshot().restart();

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: true,
        data: undefined,
        error: undefined,
      });
    }

    await waitFor(() => expect(onUnsubscribe).toHaveBeenCalledTimes(1));
    expect(onSubscribe).toHaveBeenCalledTimes(2);

    link.simulateResult({ result: { data: { totalLikes: 2 } } });

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: false,
        data: { totalLikes: 2 },
        error: undefined,
      });
    }
  });

  it("will use the most recently passed in options", async () => {
    using _disabledAct = disableActEnvironment();
    const {
      link,
      takeSnapshot,
      getCurrentSnapshot,
      onSubscribe,
      onUnsubscribe,
      rerender,
    } = await setup({
      variables: { id: "1" },
    });

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: true,
        data: undefined,
        error: undefined,
      });
    }

    // deliberately keeping a reference to a very old `restart` function
    // to show that the most recent options are used even with that
    const restart = getCurrentSnapshot().restart;
    link.simulateResult({ result: { data: { totalLikes: 1 } } });

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: false,
        data: { totalLikes: 1 },
        error: undefined,
      });
    }

    await expect(takeSnapshot).not.toRerender({ timeout: 20 });
    expect(onUnsubscribe).toHaveBeenCalledTimes(0);
    expect(onSubscribe).toHaveBeenCalledTimes(1);

    void rerender({ variables: { id: "2" } });

    await waitFor(() => expect(onUnsubscribe).toHaveBeenCalledTimes(1));
    expect(onSubscribe).toHaveBeenCalledTimes(2);
    expect(link.operation?.variables).toStrictEqual({ id: "2" });

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: true,
        data: undefined,
        error: undefined,
      });
    }

    link.simulateResult({ result: { data: { totalLikes: 1000 } } });

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: false,
        data: { totalLikes: 1000 },
        error: undefined,
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
      expect(snapshot).toEqualStrictTyped({
        loading: true,
        data: undefined,
        error: undefined,
      });
    }

    link.simulateResult({ result: { data: { totalLikes: 1005 } } });

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: false,
        data: { totalLikes: 1005 },
        error: undefined,
      });
    }
  });

  it("can restart a subscription that has completed", async () => {
    using _disabledAct = disableActEnvironment();
    const {
      link,
      takeSnapshot,
      getCurrentSnapshot,
      onSubscribe,
      onUnsubscribe,
    } = await setup({
      variables: { id: "1" },
    });

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: true,
        data: undefined,
        error: undefined,
      });
    }

    link.simulateResult({ result: { data: { totalLikes: 1 } } }, true);

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: false,
        data: { totalLikes: 1 },
        error: undefined,
      });
    }

    await expect(takeSnapshot).not.toRerender({ timeout: 20 });
    expect(onUnsubscribe).toHaveBeenCalledTimes(1);
    expect(onSubscribe).toHaveBeenCalledTimes(1);

    getCurrentSnapshot().restart();

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: true,
        data: undefined,
        error: undefined,
      });
    }

    await waitFor(() => expect(onSubscribe).toHaveBeenCalledTimes(2));
    expect(onUnsubscribe).toHaveBeenCalledTimes(1);

    link.simulateResult({ result: { data: { totalLikes: 2 } } });

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: false,
        data: { totalLikes: 2 },
        error: undefined,
      });
    }
  });

  it("can restart a subscription that has errored", async () => {
    using _disabledAct = disableActEnvironment();
    const {
      link,
      takeSnapshot,
      getCurrentSnapshot,
      onSubscribe,
      onUnsubscribe,
    } = await setup({
      variables: { id: "1" },
    });

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: true,
        data: undefined,
        error: undefined,
      });
    }

    const error: GraphQLFormattedError = { message: "error" };
    link.simulateResult({
      result: { errors: [error] },
    });

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: false,
        data: undefined,
        error: new CombinedGraphQLErrors([error]),
      });
    }

    await expect(takeSnapshot).not.toRerender({ timeout: 20 });
    expect(onUnsubscribe).toHaveBeenCalledTimes(0);
    expect(onSubscribe).toHaveBeenCalledTimes(1);

    getCurrentSnapshot().restart();

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: true,
        data: undefined,
        error: undefined,
      });
    }

    await waitFor(() => expect(onSubscribe).toHaveBeenCalledTimes(2));
    await tick();
    expect(onUnsubscribe).toHaveBeenCalledTimes(1);

    link.simulateResult({ result: { data: { totalLikes: 2 } } });

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: false,
        data: { totalLikes: 2 },
        error: undefined,
      });
    }
  });

  it("will not restart a subscription that has been `skip`ped", async () => {
    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot, onSubscribe, onUnsubscribe } =
      await setup({
        variables: { id: "1" },
        skip: true,
      });

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: false,
        data: undefined,
        error: undefined,
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
      cache: new Cache(),
    });

    const onData = jest.fn((() => {}) as useSubscription.Options["onData"]);
    const onError = jest.fn((() => {}) as useSubscription.Options["onError"]);
    const onComplete = jest.fn(
      (() => {}) as useSubscription.Options["onComplete"]
    );
    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
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
    expect(snapshot).toEqualStrictTyped({
      loading: false,
      error: undefined,
      data: undefined,
    });

    link.simulateResult(results[0]);
    await tick();

    expect(onData).toHaveBeenCalledTimes(1);
    expect(onData).toHaveBeenLastCalledWith({
      client,
      data: {
        data: results[0].result.data,
        error: undefined,
        loading: false,
        variables: undefined,
      },
    });
    expect(onError).toHaveBeenCalledTimes(0);
    expect(onComplete).toHaveBeenCalledTimes(0);

    link.simulateResult(results[1], true);
    await tick();

    expect(onData).toHaveBeenCalledTimes(2);
    expect(onData).toHaveBeenLastCalledWith({
      client,
      data: {
        data: results[1].result.data,
        error: undefined,
        loading: false,
        variables: undefined,
      },
    });
    expect(onError).toHaveBeenCalledTimes(0);
    expect(onComplete).toHaveBeenCalledTimes(1);

    await expect(takeSnapshot).not.toRerender();
  });

  it("should not rerender when ignoreResults is true and an error occurs", async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache(),
    });

    const onData = jest.fn((() => {}) as useSubscription.Options["onData"]);
    const onError = jest.fn((() => {}) as useSubscription.Options["onError"]);
    const onComplete = jest.fn(
      (() => {}) as useSubscription.Options["onComplete"]
    );
    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
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
    expect(snapshot).toEqualStrictTyped({
      loading: false,
      error: undefined,
      data: undefined,
    });

    link.simulateResult(results[0]);
    await tick();

    expect(onData).toHaveBeenCalledTimes(1);
    expect(onData).toHaveBeenLastCalledWith({
      client,
      data: {
        data: results[0].result.data,
        error: undefined,
        loading: false,
        variables: undefined,
      },
    });
    expect(onError).toHaveBeenCalledTimes(0);
    expect(onComplete).toHaveBeenCalledTimes(0);

    const error = new Error("test");
    link.simulateResult({ error });
    await tick();

    expect(onData).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenLastCalledWith(error);
    expect(onComplete).toHaveBeenCalledTimes(1);

    await expect(takeSnapshot).not.toRerender();
  });

  it("can switch from `ignoreResults: true` to `ignoreResults: false` and will start rerendering, without creating a new subscription", async () => {
    const subscriptionCreated = jest.fn();
    const link = new MockSubscriptionLink();
    link.onSetup(subscriptionCreated);
    const client = new ApolloClient({
      link,
      cache: new Cache(),
    });

    const onData = jest.fn((() => {}) as useSubscription.Options["onData"]);
    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
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

    if (!IS_REACT_17) {
      await wait(0);
      expect(subscriptionCreated).toHaveBeenCalledTimes(1);
    }

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: false,
        error: undefined,
        data: undefined,
      });
      expect(onData).toHaveBeenCalledTimes(0);
    }

    link.simulateResult(results[0]);

    await expect(takeSnapshot).not.toRerender({ timeout: 20 });
    expect(onData).toHaveBeenCalledTimes(1);

    await rerender({ ignoreResults: false });

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: false,
        error: undefined,
        // `data` appears immediately after changing to `ignoreResults: false`
        data: results[0].result.data,
      });
      // `onData` should not be called again for the same result
      expect(onData).toHaveBeenCalledTimes(1);
    }

    link.simulateResult(results[1]);

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: false,
        error: undefined,
        data: results[1].result.data,
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
      cache: new Cache(),
    });

    const onData = jest.fn((() => {}) as useSubscription.Options["onData"]);
    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
      ({ ignoreResults }) =>
        useSubscription(subscription, { ignoreResults, onData }),
      {
        initialProps: { ignoreResults: false },
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    if (!IS_REACT_17) {
      await wait(0);
      expect(subscriptionCreated).toHaveBeenCalledTimes(1);
    }

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: true,
        error: undefined,
        data: undefined,
      });
      expect(onData).toHaveBeenCalledTimes(0);
    }

    link.simulateResult(results[0]);

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: false,
        error: undefined,
        data: results[0].result.data,
      });
      expect(onData).toHaveBeenCalledTimes(1);
    }

    await expect(takeSnapshot).not.toRerender({ timeout: 20 });

    await rerender({ ignoreResults: true });

    {
      const snapshot = await takeSnapshot();
      expect(snapshot).toEqualStrictTyped({
        loading: false,
        error: undefined,
        // switching back to the default `ignoreResults: true` return value
        data: undefined,
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

describe("data masking", () => {
  test("masks data returned when dataMasking is `true`", async () => {
    const subscription = gql`
      subscription NewCommentSubscription {
        addedComment {
          id
          ...CommentFields
        }
      }

      fragment CommentFields on Comment {
        comment
        author
      }
    `;

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      dataMasking: true,
      cache: new Cache(),
      link,
    });

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useSubscription(subscription),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      error: undefined,
      loading: true,
    });

    link.simulateResult({
      result: {
        data: {
          addedComment: {
            __typename: "Comment",
            id: 1,
            comment: "Test comment",
            author: "Test User",
          },
        },
      },
    });

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: {
        addedComment: {
          __typename: "Comment",
          id: 1,
        },
      },
      error: undefined,
      loading: false,
    });

    await expect(takeSnapshot).not.toRerender();
  });

  test("does not mask data returned from subscriptions when dataMasking is `false`", async () => {
    const subscription = gql`
      subscription NewCommentSubscription {
        addedComment {
          id
          ...CommentFields
        }
      }

      fragment CommentFields on Comment {
        comment
        author
      }
    `;

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      dataMasking: false,
      cache: new Cache(),
      link,
    });

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useSubscription(subscription),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      error: undefined,
      loading: true,
    });

    link.simulateResult({
      result: {
        data: {
          addedComment: {
            __typename: "Comment",
            id: 1,
            comment: "Test comment",
            author: "Test User",
          },
        },
      },
    });

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: {
        addedComment: {
          __typename: "Comment",
          id: 1,
          comment: "Test comment",
          author: "Test User",
        },
      },
      error: undefined,
      loading: false,
    });

    await expect(takeSnapshot).not.toRerender();
  });

  test("masks data passed to onData callback when dataMasking is `true`", async () => {
    const subscription = gql`
      subscription NewCommentSubscription {
        addedComment {
          id
          ...CommentFields
        }
      }

      fragment CommentFields on Comment {
        comment
        author
      }
    `;

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      dataMasking: true,
      cache: new Cache(),
      link,
    });

    const onData = jest.fn();
    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useSubscription(subscription, { onData }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      error: undefined,
      loading: true,
    });

    link.simulateResult({
      result: {
        data: {
          addedComment: {
            __typename: "Comment",
            id: 1,
            comment: "Test comment",
            author: "Test User",
          },
        },
      },
    });

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: {
        addedComment: {
          __typename: "Comment",
          id: 1,
        },
      },
      error: undefined,
      loading: false,
    });

    expect(onData).toHaveBeenCalledTimes(1);
    expect(onData).toHaveBeenCalledWith({
      client,
      data: {
        data: { addedComment: { __typename: "Comment", id: 1 } },
        loading: false,
        error: undefined,
        variables: undefined,
      },
    });

    await expect(takeSnapshot).not.toRerender();
  });

  test("uses unmasked data when using the @unmask directive", async () => {
    const subscription = gql`
      subscription NewCommentSubscription {
        addedComment {
          id
          ...CommentFields @unmask
        }
      }

      fragment CommentFields on Comment {
        comment
        author
      }
    `;

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      dataMasking: true,
      cache: new Cache(),
      link,
    });

    const onData = jest.fn();
    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useSubscription(subscription, { onData }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      error: undefined,
      loading: true,
    });

    link.simulateResult({
      result: {
        data: {
          addedComment: {
            __typename: "Comment",
            id: 1,
            comment: "Test comment",
            author: "Test User",
          },
        },
      },
    });

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: {
        addedComment: {
          __typename: "Comment",
          id: 1,
          comment: "Test comment",
          author: "Test User",
        },
      },
      error: undefined,
      loading: false,
    });

    expect(onData).toHaveBeenCalledTimes(1);
    expect(onData).toHaveBeenCalledWith({
      client: expect.anything(),
      data: {
        data: {
          addedComment: {
            __typename: "Comment",
            id: 1,
            comment: "Test comment",
            author: "Test User",
          },
        },
        loading: false,
        error: undefined,
        variables: undefined,
      },
    });

    await expect(takeSnapshot).not.toRerender();
  });
});

describe.skip("Type Tests", () => {
  test("uses masked types when using masked document", async () => {
    type UserFieldsFragment = {
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Subscription {
      userUpdated: {
        __typename: "User";
        id: string;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const subscription: MaskedDocumentNode<Subscription> = gql``;

    const { data } = useSubscription(subscription, {
      onData: ({ data }) => {
        expectTypeOf(data.data).toEqualTypeOf<
          Masked<Subscription> | undefined
        >();
      },
    });

    expectTypeOf(data).toEqualTypeOf<Masked<Subscription> | undefined>();
  });

  test("uses unmodified type when using TypedDocumentNode", async () => {
    type UserFieldsFragment = {
      __typename: "User";
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" };

    interface Subscription {
      userUpdated: {
        __typename: "User";
        id: string;
        name: string;
      } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
    }

    const subscription: TypedDocumentNode<Subscription> = gql``;

    const { data } = useSubscription(subscription, {
      onData: ({ data }) => {
        expectTypeOf(data.data).toEqualTypeOf<Subscription | undefined>();
      },
    });

    expectTypeOf(data).toEqualTypeOf<Subscription | undefined>();
  });
});
