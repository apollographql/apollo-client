import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { delay, of } from "rxjs";

import type { OperationVariables } from "@apollo/client";
import {
  ApolloClient,
  ApolloLink,
  CombinedGraphQLErrors,
  gql,
  NetworkStatus,
} from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import {
  Defer20220824Handler,
  GraphQL17Alpha9Handler,
} from "@apollo/client/incremental";
import { useQuery } from "@apollo/client/react";
import {
  createClientWrapper,
  dateScalar,
  markAsStreaming,
  mockDefer20220824,
  mockDeferStreamGraphQL17Alpha9,
} from "@apollo/client/testing/internal";

test("serializes scalar variables used in field arguments", async () => {
  let requestVariables!: OperationVariables;

  const link = new ApolloLink((operation) => {
    requestVariables = operation.variables;

    return of({
      data: { event: { __typename: "Event", name: "GraphQL Summit" } },
    });
  });

  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: {
        Date: dateScalar,
      },
    }),
    link,
  });
  const query = gql`
    query Event($date: Date!) {
      event(date: $date) {
        name
      }
    }
  `;

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useQuery(query, {
        variables: {
          date: new Date(2026, 0, 1),
        },
      }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {
      date: new Date(2026, 0, 1),
    },
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {
      date: new Date(2026, 0, 1),
    },
  });

  await expect(takeSnapshot).not.toRerender();

  expect(requestVariables).toStrictEqualTyped({ date: "2026-01-01" });
});

test("serializes scalar variables used in directive arguments", async () => {
  let requestVariables!: OperationVariables;

  const link = new ApolloLink((operation) => {
    requestVariables = operation.variables;

    return of({
      data: { event: { __typename: "Event", name: "GraphQL Summit" } },
    });
  });

  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: {
        Date: dateScalar,
      },
    }),
    link,
  });
  const query = gql`
    query Event($date: Date!) {
      event @on(date: $date) {
        name
      }
    }
  `;

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useQuery(query, {
        variables: {
          date: new Date(2026, 0, 1),
        },
      }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {
      date: new Date(2026, 0, 1),
    },
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {
      date: new Date(2026, 0, 1),
    },
  });

  await expect(takeSnapshot).not.toRerender();

  expect(requestVariables).toStrictEqualTyped({ date: "2026-01-01" });
});

test("serializes scalar fields in input object variables", async () => {
  let requestVariables!: OperationVariables;

  const link = new ApolloLink((operation) => {
    requestVariables = operation.variables;

    return of({
      data: { event: { __typename: "Event", name: "GraphQL Summit" } },
    });
  });

  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: {
        Date: dateScalar,
      },
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
  const query = gql`
    query Event($filter: EventFilter!) {
      event(filter: $filter) {
        name
      }
    }
  `;

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useQuery(query, {
        variables: {
          filter: {
            date: new Date(2026, 0, 1),
          },
        },
      }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {
      filter: {
        date: new Date(2026, 0, 1),
      },
    },
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {
      filter: {
        date: new Date(2026, 0, 1),
      },
    },
  });

  await expect(takeSnapshot).not.toRerender();

  expect(requestVariables).toStrictEqualTyped({
    filter: {
      date: "2026-01-01",
    },
  });
});

test("parses cached custom scalar fields with a cache-only fetch policy", async () => {
  const query = gql`
    query Event {
      event {
        id
        startDate
      }
    }
  `;
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
    link: ApolloLink.empty(),
  });
  client.writeQuery({
    query,
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: "2026-01-01",
      },
    },
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query, { fetchPolicy: "cache-only" }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {},
  });
  await expect(takeSnapshot).not.toRerender();
});

test("parses cached custom scalar fields with a cache-first fetch policy", async () => {
  const query = gql`
    query Event {
      event {
        id
        startDate
      }
    }
  `;
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
    link: ApolloLink.empty(),
  });
  client.writeQuery({
    query,
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: "2026-01-01",
      },
    },
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query, { fetchPolicy: "cache-first" }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {},
  });
  await expect(takeSnapshot).not.toRerender();
});

test("parses network custom scalar fields with a cache-first fetch policy", async () => {
  const query = gql`
    query Event {
      event {
        id
        startDate
      }
    }
  `;
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
    link: new ApolloLink(() =>
      of({
        data: {
          event: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
          },
        },
      }).pipe(delay(20))
    ),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query, { fetchPolicy: "cache-first" }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });
  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {},
  });
  await expect(takeSnapshot).not.toRerender();
});

test("parses cached and network custom scalar fields with a cache-and-network fetch policy", async () => {
  const query = gql`
    query Event {
      event {
        id
        startDate
      }
    }
  `;
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
    link: new ApolloLink(() =>
      of({
        data: {
          event: {
            __typename: "Event",
            id: "1",
            startDate: "2026-02-02",
          },
        },
      }).pipe(delay(20))
    ),
  });
  client.writeQuery({
    query,
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: "2026-01-01",
      },
    },
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query, { fetchPolicy: "cache-and-network" }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });
  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 1, 2),
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
    variables: {},
  });
  await expect(takeSnapshot).not.toRerender();
});

test("parses network custom scalar fields with a cache-and-network fetch policy", async () => {
  const query = gql`
    query Event {
      event {
        id
        startDate
      }
    }
  `;
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
    link: new ApolloLink(() =>
      of({
        data: {
          event: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
          },
        },
      }).pipe(delay(20))
    ),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query, { fetchPolicy: "cache-and-network" }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });
  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {},
  });
  await expect(takeSnapshot).not.toRerender();
});

test("parses network custom scalar fields with a network-only fetch policy", async () => {
  const query = gql`
    query Event {
      event {
        id
        startDate
      }
    }
  `;
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
    link: new ApolloLink(() =>
      of({
        data: {
          event: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
          },
        },
      }).pipe(delay(20))
    ),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query, { fetchPolicy: "network-only" }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });
  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {},
  });
  await expect(takeSnapshot).not.toRerender();
});

test.failing(
  "parses custom scalar fields with a no-cache fetch policy",
  async () => {
    const query = gql`
      query Event {
        event {
          id
          startDate
        }
      }
    `;
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
      link: new ApolloLink(() =>
        of({
          data: {
            event: {
              __typename: "Event",
              id: "1",
              startDate: "2026-01-01",
            },
          },
        }).pipe(delay(20))
      ),
    });

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useQuery(query, { fetchPolicy: "no-cache" }),
      { wrapper: createClientWrapper(client) }
    );

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables: {},
    });

    await expect(takeSnapshot()).resolves.toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }
);

test("preserves referential identity when refetching identical serialized scalar values", async () => {
  const query = gql`
    query Event {
      event {
        id
        startDate
      }
    }
  `;
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
    link: new ApolloLink(() =>
      of({
        data: {
          event: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
          },
        },
      }).pipe(delay(20))
    ),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {},
  });

  const { data: previousData, refetch } = getCurrentSnapshot();

  await expect(refetch()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    previousData: undefined,
    variables: {},
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {},
  });

  const { data } = getCurrentSnapshot();

  expect(data).toBe(previousData);

  await expect(takeSnapshot).not.toRerender();
});

test("serializes scalar fields in the error with a `none` error policy", async () => {
  const query = gql`
    query Event {
      event {
        id
        startDate
        endDate
      }
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
            endDate: { scalar: "Date" },
          },
        },
      },
    }),
    link: new ApolloLink(() =>
      of({
        data: {
          event: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
            endDate: null,
          },
        },
        errors: [
          {
            message: "Could not resolve endDate",
            path: ["event", "endDate"],
          },
        ],
      }).pipe(delay(20))
    ),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query, { errorPolicy: "none" }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    error: new CombinedGraphQLErrors({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: "2026-01-01",
          endDate: null,
        },
      },
      errors: [
        {
          message: "Could not resolve endDate",
          path: ["event", "endDate"],
        },
      ],
    }),
    loading: false,
    networkStatus: NetworkStatus.error,
    previousData: undefined,
    variables: {},
  });

  await expect(takeSnapshot).not.toRerender();
});

test("parses scalar fields in the result and serializes them in the error with an `all` error policy", async () => {
  const query = gql`
    query Event {
      event {
        id
        startDate
        endDate
      }
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
            endDate: { scalar: "Date" },
          },
        },
      },
    }),
    link: new ApolloLink(() =>
      of({
        data: {
          event: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
            endDate: null,
          },
        },
        errors: [
          {
            message: "Could not resolve endDate",
            path: ["event", "endDate"],
          },
        ],
      }).pipe(delay(20))
    ),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query, { errorPolicy: "all" }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
        endDate: null,
      },
    },
    dataState: "complete",
    error: new CombinedGraphQLErrors({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          // TODO: Determine if this is correct
          startDate: new Date(2026, 0, 1),
          endDate: null,
        },
      },
      errors: [
        {
          message: "Could not resolve endDate",
          path: ["event", "endDate"],
        },
      ],
    }),
    loading: false,
    networkStatus: NetworkStatus.error,
    previousData: undefined,
    variables: {},
  });

  await expect(takeSnapshot).not.toRerender();
});

test("parses custom scalar fields with an `ignore` error policy", async () => {
  const query = gql`
    query Event {
      event {
        id
        startDate
        endDate
      }
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
            endDate: { scalar: "Date" },
          },
        },
      },
    }),
    link: new ApolloLink(() =>
      of({
        data: {
          event: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
            endDate: null,
          },
        },
        errors: [
          {
            message: "Could not resolve endDate",
            path: ["event", "endDate"],
          },
        ],
      }).pipe(delay(20))
    ),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query, { errorPolicy: "ignore" }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
        endDate: null,
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: undefined,
    variables: {},
  });

  await expect(takeSnapshot).not.toRerender();
});

test("parses custom scalar fields across `@defer` payloads (defer20220824)", async () => {
  const link = mockDefer20220824();
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
            endDate: { scalar: "Date" },
          },
        },
      },
    }),
    link: link.httpLink,
    incrementalHandler: new Defer20220824Handler(),
  });
  const query = gql`
    query Event {
      event {
        id
        startDate
        ... @defer {
          endDate
        }
      }
    }
  `;

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  link.enqueueInitialChunk({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: "2026-01-01",
      },
    },
    hasNext: true,
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: markAsStreaming({
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: undefined,
    variables: {},
  });

  link.enqueueSubsequentChunk({
    incremental: [{ data: { endDate: "2026-02-02" }, path: ["event"] }],
    hasNext: false,
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
        endDate: new Date(2026, 1, 2),
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
    variables: {},
  });

  await expect(takeSnapshot).not.toRerender();
});

test("parses custom scalar fields across `@defer` payloads (graphql17Alpha9)", async () => {
  const link = mockDeferStreamGraphQL17Alpha9();
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
            endDate: { scalar: "Date" },
          },
        },
      },
    }),
    link: link.httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });
  const query = gql`
    query Event {
      event {
        id
        startDate
        ... @defer {
          endDate
        }
      }
    }
  `;

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  link.enqueueInitialChunk({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: "2026-01-01",
      },
    },
    pending: [{ id: "0", path: ["event"] }],
    hasNext: true,
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: markAsStreaming({
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: undefined,
    variables: {},
  });

  link.enqueueSubsequentChunk({
    incremental: [{ data: { endDate: "2026-02-02" }, id: "0" }],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
        endDate: new Date(2026, 1, 2),
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
    variables: {},
  });

  await expect(takeSnapshot).not.toRerender();
});

test("parses custom scalar fields across `@stream` payloads (defer20220824)", async () => {
  const link = mockDefer20220824();
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
    link: link.httpLink,
    incrementalHandler: new Defer20220824Handler(),
  });
  const query = gql`
    query Events {
      events @stream(initialCount: 1) {
        id
        startDate
      }
    }
  `;

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  link.enqueueInitialChunk({
    data: {
      events: [
        {
          __typename: "Event",
          id: "1",
          startDate: "2026-01-01",
        },
      ],
    },
    hasNext: true,
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: markAsStreaming({
      events: [
        {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: undefined,
    variables: {},
  });

  link.enqueueSubsequentChunk({
    incremental: [
      {
        items: [
          {
            __typename: "Event",
            id: "2",
            startDate: "2026-02-02",
          },
        ] as any,
        path: ["events", 1],
      },
    ],
    hasNext: false,
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      events: [
        {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
        {
          __typename: "Event",
          id: "2",
          startDate: new Date(2026, 1, 2),
        },
      ],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: {
      events: [
        {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      ],
    },
    variables: {},
  });

  await expect(takeSnapshot).not.toRerender();
});

test("parses custom scalar fields across `@stream` payloads (graphql17Alpha9)", async () => {
  const link = mockDeferStreamGraphQL17Alpha9();
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
    link: link.httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });
  const query = gql`
    query Events {
      events @stream(initialCount: 1) {
        id
        startDate
      }
    }
  `;

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    previousData: undefined,
    variables: {},
  });

  link.enqueueInitialChunk({
    data: {
      events: [
        {
          __typename: "Event",
          id: "1",
          startDate: "2026-01-01",
        },
      ],
    },
    pending: [{ id: "0", path: ["events"] }],
    hasNext: true,
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: markAsStreaming({
      events: [
        {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      ],
    }),
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    previousData: undefined,
    variables: {},
  });

  link.enqueueSubsequentChunk({
    incremental: [
      {
        items: [
          {
            __typename: "Event",
            id: "2",
            startDate: "2026-02-02",
          },
        ] as any,
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: {
      events: [
        {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
        {
          __typename: "Event",
          id: "2",
          startDate: new Date(2026, 1, 2),
        },
      ],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    previousData: {
      events: [
        {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      ],
    },
    variables: {},
  });

  await expect(takeSnapshot).not.toRerender();
});
