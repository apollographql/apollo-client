import { of } from "rxjs";

import type { OperationVariables } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { dateScalar, ObservableStream } from "@apollo/client/testing/internal";

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
