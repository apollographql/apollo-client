import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { of } from "rxjs";

import type { OperationVariables } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { useQuery } from "@apollo/client/react";
import {
  createClientWrapper,
  dateScalar,
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
