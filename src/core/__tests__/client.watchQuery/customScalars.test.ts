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
import { MockLink } from "@apollo/client/testing";
import {
  dateScalar,
  markAsStreaming,
  mockDefer20220824,
  mockDeferStreamGraphQL17Alpha9,
  ObservableStream,
  spyOnConsole,
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

  using stream = new ObservableStream(
    client.watchQuery({
      query,
      variables: {
        date: new Date(2026, 0, 1),
      },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();

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

  using stream = new ObservableStream(
    client.watchQuery({
      query,
      variables: {
        date: new Date(2026, 0, 1),
      },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();

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

  using stream = new ObservableStream(
    client.watchQuery({
      query,
      variables: {
        filter: {
          date: new Date(2026, 0, 1),
        },
      },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();

  expect(requestVariables).toStrictEqualTyped({
    filter: {
      date: "2026-01-01",
    },
  });
});

test("serializes scalar variables passed to refetch", async () => {
  let requestVariables!: OperationVariables;

  const link = new ApolloLink((operation) => {
    requestVariables = operation.variables;

    return of({
      data: {
        event: {
          __typename: "Event",
          name: `Event on ${operation.variables.date}`,
        },
      },
    });
  });

  const client = new ApolloClient({
    cache: new InMemoryCache({ scalars: { Date: dateScalar } }),
    link,
  });
  const query = gql`
    query Event($date: Date!) {
      event(date: $date) {
        name
      }
    }
  `;
  const observable = client.watchQuery({
    query,
    variables: { date: "2025-01-01" },
    notifyOnNetworkStatusChange: false,
  });
  using stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        name: "Event on 2025-01-01",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(
    observable.refetch({ date: new Date(2026, 0, 1) })
  ).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        name: "Event on 2026-01-01",
      },
    },
  });

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        name: "Event on 2026-01-01",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
  await expect(stream).not.toEmitAnything();

  expect(requestVariables).toStrictEqualTyped({ date: "2026-01-01" });
});

test("serializes scalar variables passed to fetchMore", async () => {
  let requestVariables!: OperationVariables;

  const link = new ApolloLink((operation) => {
    requestVariables = operation.variables;

    return of({
      data: {
        event: {
          __typename: "Event",
          name: `Event on ${operation.variables.date}`,
        },
      },
    });
  });

  const client = new ApolloClient({
    cache: new InMemoryCache({ scalars: { Date: dateScalar } }),
    link,
  });
  const query = gql`
    query Event($date: Date!) {
      event(date: $date) {
        name
      }
    }
  `;
  const observable = client.watchQuery({
    query,
    variables: { date: "2025-01-01" },
    notifyOnNetworkStatusChange: false,
  });
  using stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        name: "Event on 2025-01-01",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(
    observable.fetchMore({
      variables: { date: new Date(2026, 0, 1) },
      updateQuery: (_, { fetchMoreResult }) => fetchMoreResult,
    })
  ).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        name: "Event on 2026-01-01",
      },
    },
  });

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        name: "Event on 2026-01-01",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
  await expect(stream).not.toEmitAnything();

  expect(requestVariables).toStrictEqualTyped({ date: "2026-01-01" });
});

test("serializes scalar variables passed to setVariables", async () => {
  let requestVariables!: OperationVariables;

  const link = new ApolloLink((operation) => {
    requestVariables = operation.variables;

    return of({
      data: {
        event: {
          __typename: "Event",
          name: `Event on ${operation.variables.date}`,
        },
      },
    });
  });

  const client = new ApolloClient({
    cache: new InMemoryCache({ scalars: { Date: dateScalar } }),
    link,
  });
  const query = gql`
    query Event($date: Date!) {
      event(date: $date) {
        name
      }
    }
  `;
  const observable = client.watchQuery({
    query,
    variables: { date: "2025-01-01" },
    notifyOnNetworkStatusChange: false,
  });
  using stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        name: "Event on 2025-01-01",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(
    observable.setVariables({ date: new Date(2026, 0, 1) })
  ).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        name: "Event on 2026-01-01",
      },
    },
  });

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        name: "Event on 2026-01-01",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
  await expect(stream).not.toEmitAnything();

  expect(requestVariables).toStrictEqualTyped({ date: "2026-01-01" });
});

test("serializes scalar variables passed to subscribeToMore", async () => {
  let requestVariables!: OperationVariables;

  const link = new ApolloLink((operation) => {
    requestVariables = operation.variables;

    return of({
      data:
        operation.operationName === "EventUpdates" ?
          {
            eventUpdated: {
              __typename: "Event",
              name: `Event on ${operation.variables.date}`,
            },
          }
        : {
            event: {
              __typename: "Event",
              name: `Event on ${operation.variables.date}`,
            },
          },
    });
  });

  const client = new ApolloClient({
    cache: new InMemoryCache({ scalars: { Date: dateScalar } }),
    link,
  });
  const query = gql`
    query Event($date: Date!) {
      event(date: $date) {
        name
      }
    }
  `;
  const subscription = gql`
    subscription EventUpdates($date: Date!) {
      eventUpdated(date: $date) {
        name
      }
    }
  `;
  const observable = client.watchQuery({
    query,
    variables: { date: "2025-01-01" },
  });
  using stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        name: "Event on 2025-01-01",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  observable.subscribeToMore({
    document: subscription,
    variables: { date: new Date(2026, 0, 1) },
    updateQuery: (_, { subscriptionData }) => ({
      event: (subscriptionData.data as any).eventUpdated,
    }),
  });

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        name: "Event on 2026-01-01",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
  await expect(stream).not.toEmitAnything();

  expect(requestVariables).toStrictEqualTyped({ date: "2026-01-01" });
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
  using stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "cache-only" })
  );

  await expect(stream).toEmitTypedValue({
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
    partial: false,
  });
  await expect(stream).not.toEmitAnything();
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
  using stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "cache-first" })
  );

  await expect(stream).toEmitTypedValue({
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
    partial: false,
  });
  await expect(stream).not.toEmitAnything();
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
  using stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "cache-first" })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });
  await expect(stream).toEmitTypedValue({
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
    partial: false,
  });
  await expect(stream).not.toEmitAnything();
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
  using stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "cache-and-network" })
  );

  await expect(stream).toEmitTypedValue({
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
    partial: false,
  });
  await expect(stream).toEmitTypedValue({
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
    partial: false,
  });
  await expect(stream).not.toEmitAnything();
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
  using stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "cache-and-network" })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });
  await expect(stream).toEmitTypedValue({
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
    partial: false,
  });
  await expect(stream).not.toEmitAnything();
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
  using stream = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });
  await expect(stream).toEmitTypedValue({
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
    partial: false,
  });
  await expect(stream).not.toEmitAnything();
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

    using stream = new ObservableStream(
      client.watchQuery({
        query,
        fetchPolicy: "no-cache",
      })
    );

    await expect(stream).toEmitTypedValue({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });
    await expect(stream).toEmitTypedValue({
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
      partial: false,
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

  const observable = client.watchQuery({
    query,
    notifyOnNetworkStatusChange: false,
  });
  using stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
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
    partial: false,
  });

  const { data: previousData } = observable.getCurrentResult();

  await expect(observable.refetch()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
  });

  await expect(stream).toEmitTypedValue({
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
    partial: false,
  });

  expect(observable.getCurrentResult().data).toBe(previousData);

  await expect(stream).not.toEmitAnything();
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

  using stream = new ObservableStream(
    client.watchQuery({ query, errorPolicy: "none" })
  );

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
    partial: true,
  });

  await expect(stream).not.toEmitAnything();
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

  using stream = new ObservableStream(
    client.watchQuery({ query, errorPolicy: "all" })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
        endDate: null,
      },
    },
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
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.error,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
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

  using stream = new ObservableStream(
    client.watchQuery({ query, errorPolicy: "ignore" })
  );

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(stream).toEmitTypedValue({
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
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
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

  using stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
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

  await expect(stream).toEmitTypedValue({
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
    partial: true,
  });

  link.enqueueSubsequentChunk({
    incremental: [{ data: { endDate: "2026-02-02" }, path: ["event"] }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
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
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
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

  using stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
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

  await expect(stream).toEmitTypedValue({
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
    partial: true,
  });

  link.enqueueSubsequentChunk({
    incremental: [{ data: { endDate: "2026-02-02" }, id: "0" }],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
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
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("parses custom scalar fields across `@defer` payloads when refetching (defer20220824)", async () => {
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

  const observable = client.watchQuery({ query });
  using stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
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

  await expect(stream).toEmitTypedValue({
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
    partial: true,
  });

  link.enqueueSubsequentChunk({
    incremental: [{ data: { endDate: "2026-02-02" }, path: ["event"] }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
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
    partial: false,
  });

  const refetchPromise = observable.refetch();

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
        endDate: new Date(2026, 1, 2),
      },
    },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  link.enqueueInitialChunk({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: "2027-01-01",
      },
    },
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2027, 0, 1),
        endDate: new Date(2026, 1, 2),
      },
    },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: false,
  });

  link.enqueueSubsequentChunk({
    incremental: [{ data: { endDate: "2027-02-02" }, path: ["event"] }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2027, 0, 1),
        endDate: new Date(2027, 1, 2),
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(refetchPromise).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2027, 0, 1),
        endDate: new Date(2027, 1, 2),
      },
    },
  });

  await expect(stream).not.toEmitAnything();
});

test("parses custom scalar fields across `@defer` payloads when refetching (graphql17Alpha9)", async () => {
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

  const observable = client.watchQuery({ query });
  using stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
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

  await expect(stream).toEmitTypedValue({
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
    partial: true,
  });

  link.enqueueSubsequentChunk({
    incremental: [{ data: { endDate: "2026-02-02" }, id: "0" }],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
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
    partial: false,
  });

  const refetchPromise = observable.refetch();

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
        endDate: new Date(2026, 1, 2),
      },
    },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.refetch,
    partial: false,
  });

  link.enqueueInitialChunk({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: "2027-01-01",
      },
    },
    pending: [{ id: "0", path: ["event"] }],
    hasNext: true,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2027, 0, 1),
        endDate: new Date(2026, 1, 2),
      },
    },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: false,
  });

  link.enqueueSubsequentChunk({
    incremental: [{ data: { endDate: "2027-02-02" }, id: "0" }],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2027, 0, 1),
        endDate: new Date(2027, 1, 2),
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(refetchPromise).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2027, 0, 1),
        endDate: new Date(2027, 1, 2),
      },
    },
  });

  await expect(stream).not.toEmitAnything();
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

  using stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
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

  await expect(stream).toEmitTypedValue({
    data: {
      events: [
        {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      ],
    },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: false,
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

  await expect(stream).toEmitTypedValue({
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
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
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

  using stream = new ObservableStream(client.watchQuery({ query }));

  await expect(stream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
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

  await expect(stream).toEmitTypedValue({
    data: {
      events: [
        {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      ],
    },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: false,
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

  await expect(stream).toEmitTypedValue({
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
    partial: false,
  });

  await expect(stream).not.toEmitAnything();
});

test("parses custom scalar fields when feud-stopping skips refetches", async () => {
  using _ = spyOnConsole("warn");

  const createdAtQuery = gql`
    query {
      post {
        createdAt
      }
    }
  `;

  const updatedAtQuery = gql`
    query {
      post {
        updatedAt
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Query: {
          fields: {
            post: {
              merge: false,
            },
          },
        },
        Post: {
          fields: {
            createdAt: { scalar: "Date" },
            updatedAt: { scalar: "Date" },
          },
        },
      },
    }),
    link: new MockLink([
      {
        request: { query: createdAtQuery },
        result: {
          data: { post: { __typename: "Post", createdAt: "2026-01-01" } },
        },
        delay: 20,
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
      {
        request: { query: updatedAtQuery },
        result: {
          data: { post: { __typename: "Post", updatedAt: "2026-02-02" } },
        },
        delay: 20,
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
  });

  const createdAtObservable = client.watchQuery({ query: createdAtQuery });
  using createdAtStream = new ObservableStream(createdAtObservable);

  await expect(createdAtStream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });
  await expect(createdAtStream).toEmitTypedValue({
    data: { post: { __typename: "Post", createdAt: new Date(2026, 0, 1) } },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  const updatedAtObservable = client.watchQuery({ query: updatedAtQuery });
  using updatedAtStream = new ObservableStream(updatedAtObservable);

  await expect(updatedAtStream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });
  await expect(updatedAtStream).toEmitTypedValue({
    data: { post: { __typename: "Post", updatedAt: new Date(2026, 1, 2) } },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  expect(client.extract()).toStrictEqualTyped({
    ROOT_QUERY: {
      __typename: "Query",
      post: { __typename: "Post", updatedAt: "2026-02-02" },
    },
  });

  await expect(createdAtStream).toEmitTypedValue({
    data: { post: { __typename: "Post", createdAt: new Date(2026, 0, 1) } },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: false,
  });
  await expect(createdAtStream).toEmitTypedValue({
    data: { post: { __typename: "Post", createdAt: new Date(2026, 0, 1) } },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  expect(client.extract()).toStrictEqualTyped({
    ROOT_QUERY: {
      __typename: "Query",
      post: { __typename: "Post", createdAt: "2026-01-01" },
    },
  });

  await expect(updatedAtStream).toEmitTypedValue({
    data: { post: { __typename: "Post", updatedAt: new Date(2026, 1, 2) } },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: false,
  });
  await expect(updatedAtStream).toEmitTypedValue({
    data: { post: { __typename: "Post", updatedAt: new Date(2026, 1, 2) } },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  expect(client.extract()).toStrictEqualTyped({
    ROOT_QUERY: {
      __typename: "Query",
      post: { __typename: "Post", updatedAt: "2026-02-02" },
    },
  });

  await expect(createdAtStream).not.toEmitAnything();
  await expect(updatedAtStream).not.toEmitAnything();

  expect(createdAtObservable.getCurrentResult()).toStrictEqualTyped({
    data: { post: { __typename: "Post", createdAt: new Date(2026, 0, 1) } },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
  expect(updatedAtObservable.getCurrentResult()).toStrictEqualTyped({
    data: { post: { __typename: "Post", updatedAt: new Date(2026, 1, 2) } },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
});

test("parses custom scalar fields when feud-stopping skips refetches with overlapping fields", async () => {
  using _ = spyOnConsole("warn");

  const updatedAtQuery = gql`
    query UpdatedAtQuery {
      post {
        createdAt
        updatedAt
      }
    }
  `;

  const publishedAtQuery = gql`
    query PublishedAtQuery {
      post {
        createdAt
        publishedAt
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Query: {
          fields: {
            post: {
              merge: false,
            },
          },
        },
        Post: {
          fields: {
            createdAt: { scalar: "Date" },
            updatedAt: { scalar: "Date" },
            publishedAt: { scalar: "Date" },
          },
        },
      },
    }),
    link: new MockLink([
      {
        request: { query: updatedAtQuery },
        result: {
          data: {
            post: {
              __typename: "Post",
              createdAt: "2026-01-01",
              updatedAt: "2026-02-02",
            },
          },
        },
        delay: 20,
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
      {
        request: { query: publishedAtQuery },
        result: {
          data: {
            post: {
              __typename: "Post",
              createdAt: "2026-01-01",
              publishedAt: "2026-03-03",
            },
          },
        },
        delay: 20,
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
  });

  const updatedAtObservable = client.watchQuery({ query: updatedAtQuery });
  using updatedAtStream = new ObservableStream(updatedAtObservable);

  await expect(updatedAtStream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });
  await expect(updatedAtStream).toEmitTypedValue({
    data: {
      post: {
        __typename: "Post",
        createdAt: new Date(2026, 0, 1),
        updatedAt: new Date(2026, 1, 2),
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  const publishedAtObservable = client.watchQuery({ query: publishedAtQuery });
  using publishedAtStream = new ObservableStream(publishedAtObservable);

  await expect(publishedAtStream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });
  await expect(publishedAtStream).toEmitTypedValue({
    data: {
      post: {
        __typename: "Post",
        createdAt: new Date(2026, 0, 1),
        publishedAt: new Date(2026, 2, 3),
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  expect(client.extract()).toStrictEqualTyped({
    ROOT_QUERY: {
      __typename: "Query",
      post: {
        __typename: "Post",
        createdAt: "2026-01-01",
        publishedAt: "2026-03-03",
      },
    },
  });

  await expect(updatedAtStream).toEmitTypedValue({
    data: {
      post: {
        __typename: "Post",
        createdAt: new Date(2026, 0, 1),
        updatedAt: new Date(2026, 1, 2),
      },
    },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: false,
  });
  await expect(updatedAtStream).toEmitTypedValue({
    data: {
      post: {
        __typename: "Post",
        createdAt: new Date(2026, 0, 1),
        updatedAt: new Date(2026, 1, 2),
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  expect(client.extract()).toStrictEqualTyped({
    ROOT_QUERY: {
      __typename: "Query",
      post: {
        __typename: "Post",
        createdAt: "2026-01-01",
        updatedAt: "2026-02-02",
      },
    },
  });

  await expect(publishedAtStream).toEmitTypedValue({
    data: {
      post: {
        __typename: "Post",
        createdAt: new Date(2026, 0, 1),
        publishedAt: new Date(2026, 2, 3),
      },
    },
    dataState: "complete",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: false,
  });
  await expect(publishedAtStream).toEmitTypedValue({
    data: {
      post: {
        __typename: "Post",
        createdAt: new Date(2026, 0, 1),
        publishedAt: new Date(2026, 2, 3),
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  expect(client.extract()).toStrictEqualTyped({
    ROOT_QUERY: {
      __typename: "Query",
      post: {
        __typename: "Post",
        createdAt: "2026-01-01",
        publishedAt: "2026-03-03",
      },
    },
  });

  await expect(updatedAtStream).not.toEmitAnything();
  await expect(publishedAtStream).not.toEmitAnything();

  expect(updatedAtObservable.getCurrentResult()).toStrictEqualTyped({
    data: {
      post: {
        __typename: "Post",
        createdAt: new Date(2026, 0, 1),
        updatedAt: new Date(2026, 1, 2),
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
  expect(publishedAtObservable.getCurrentResult()).toStrictEqualTyped({
    data: {
      post: {
        __typename: "Post",
        createdAt: new Date(2026, 0, 1),
        publishedAt: new Date(2026, 2, 3),
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
});
