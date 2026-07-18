import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";

import { ApolloClient, gql } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { useSubscription } from "@apollo/client/react";
import { MockSubscriptionLink } from "@apollo/client/testing";
import {
  createClientWrapper,
  dateScalar,
} from "@apollo/client/testing/internal";

test("serializes scalar variables used in field arguments", async () => {
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

test("serializes scalar variables used in directive arguments", async () => {
  const link = new MockSubscriptionLink();
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
    }),
    link,
  });

  const subscription = gql`
    subscription EventCreated($date: Date!) {
      eventCreated @on(date: $date) {
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

test("serializes scalar fields in input object variables", async () => {
  const link = new MockSubscriptionLink();
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      inputObjects: {
        EventFilter: {
          fields: {
            date: "Date",
          },
        },
      },
    }),
    link,
  });

  const subscription = gql`
    subscription EventCreated($filter: EventFilter!) {
      eventCreated(filter: $filter) {
        name
      }
    }
  `;

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useSubscription(subscription, {
        variables: { filter: { date: new Date(2026, 0, 1) } },
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
  expect(link.operation?.variables).toStrictEqualTyped({
    filter: { date: "2026-01-01" },
  });
});

test("parses custom scalar fields with a cache-only fetch policy", async () => {
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
    () => useSubscription(subscription, { fetchPolicy: "cache-only" }),
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

test("parses custom scalar fields with a cache-first fetch policy", async () => {
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
    () => useSubscription(subscription, { fetchPolicy: "cache-first" }),
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

test("parses custom scalar fields with a network-only fetch policy", async () => {
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
    () => useSubscription(subscription, { fetchPolicy: "network-only" }),
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

test.failing(
  "parses custom scalar fields with a no-cache fetch policy",
  async () => {
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
      () => useSubscription(subscription, { fetchPolicy: "no-cache" }),
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
  }
);
