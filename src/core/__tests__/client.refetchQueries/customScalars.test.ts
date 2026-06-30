import { of } from "rxjs";

import type { OperationVariables } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { MockLink } from "@apollo/client/testing";
import { dateScalar, ObservableStream } from "@apollo/client/testing/internal";

test("serializes scalar variables when refetching an active query", async () => {
  let requestVariables!: OperationVariables;
  let requestCount = 0;

  const link = new ApolloLink((operation) => {
    requestVariables = operation.variables;
    requestCount++;

    return of({
      data: {
        event: {
          __typename: "Event",
          name: `GraphQL Summit ${requestCount}`,
        },
      },
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
  const observable = client.watchQuery({
    query,
    variables: {
      date: new Date(2026, 0, 1),
    },
    notifyOnNetworkStatusChange: false,
  });
  using stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit 1",
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(
    client.refetchQueries({ include: [query] })
  ).resolves.toStrictEqualTyped([
    {
      data: {
        event: {
          __typename: "Event",
          name: "GraphQL Summit 2",
        },
      },
    },
  ]);

  await expect(stream).toEmitTypedValue({
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit 2",
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

test("parses custom scalar fields in refetched queries", async () => {
  const query = gql`
    query Event {
      event {
        id
        startDate
      }
    }
  `;
  let requestCount = 0;
  const link = new MockLink([
    {
      request: { query },
      maxUsageCount: 2,
      delay: 20,
      result: () => {
        requestCount++;

        return {
          data: {
            event: {
              __typename: "Event",
              id: "1",
              startDate: requestCount === 1 ? "2026-01-01" : "2026-02-02",
            },
          },
        };
      },
    },
  ]);
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: {
        Date: dateScalar,
      },
      typePolicies: {
        Event: {
          fields: {
            startDate: {
              scalar: "Date",
            },
          },
        },
      },
    }),
    link,
  });

  using stream = new ObservableStream(
    client.watchQuery({
      query,
      notifyOnNetworkStatusChange: false,
    })
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

  await expect(
    client.refetchQueries({ include: [query] })
  ).resolves.toStrictEqualTyped([
    {
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 1, 2),
        },
      },
    },
  ]);

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

  expect(client.readQuery({ query })).toStrictEqualTyped({
    event: {
      __typename: "Event",
      id: "1",
      startDate: new Date(2026, 1, 2),
    },
  });
});
