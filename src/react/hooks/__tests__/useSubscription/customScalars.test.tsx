import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";

import type { TypedDocumentNode } from "@apollo/client";
import { ApolloClient, gql } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { useSubscription } from "@apollo/client/react";
import { MockSubscriptionLink } from "@apollo/client/testing";
import {
  createClientWrapper,
  dateScalar,
} from "@apollo/client/testing/internal";

test("serializes parsed scalar values in variables", async () => {
  const link = new MockSubscriptionLink();
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
    }),
    link,
  });

  const subscription = gql`
    subscription EventCreated($date: Date!) {
      eventCreated(date: $date) {
        name
      }
    }
  `;

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useSubscription(subscription, {
        variables: { date: new Date(2026, 0, 1) },
      }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    error: undefined,
    loading: true,
  });

  link.simulateResult(
    {
      result: {
        data: {
          eventCreated: {
            __typename: "Event",
            name: "GraphQL Summit",
          },
        },
      },
    },
    true
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      eventCreated: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
    error: undefined,
    loading: false,
  });

  await expect(takeSnapshot).not.toRerender();
  expect(link.operation?.variables).toStrictEqualTyped({ date: "2026-01-01" });
});

test("returns parsed scalar fields", async () => {
  const subscription = gql`
    subscription EventCreated {
      eventCreated {
        id
        startDate
      }
    }
  `;
  const link = new MockSubscriptionLink();
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
          },
        },
      },
    }),
    link,
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useSubscription(subscription),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    error: undefined,
    loading: true,
  });

  link.simulateResult(
    {
      result: {
        data: {
          eventCreated: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
          },
        },
      },
    },
    true
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      eventCreated: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
    error: undefined,
    loading: false,
  });

  await expect(takeSnapshot).not.toRerender();
});

test("preserves referential identity when a subscription emits identical scalar values", async () => {
  const subscription: TypedDocumentNode<{
    eventCreated: { __typename: "Event"; id: string; startDate: Date };
  }> = gql`
    subscription EventCreated {
      eventCreated {
        id
        startDate
      }
    }
  `;
  const link = new MockSubscriptionLink();
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
          },
        },
      },
    }),
    link,
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useSubscription(subscription),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    error: undefined,
    loading: true,
  });

  link.simulateResult({
    result: {
      data: {
        eventCreated: {
          __typename: "Event",
          id: "1",
          startDate: "2026-01-01",
        },
      },
    },
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      eventCreated: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
    error: undefined,
    loading: false,
  });

  const previousData = getCurrentSnapshot().data;

  link.simulateResult(
    {
      result: {
        data: {
          eventCreated: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
          },
        },
      },
    },
    true
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      eventCreated: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
    error: undefined,
    loading: false,
  });

  expect(getCurrentSnapshot().data!.eventCreated).toBe(
    previousData!.eventCreated
  );

  await expect(takeSnapshot).not.toRerender();
});
