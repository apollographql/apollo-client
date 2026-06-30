import { of } from "rxjs";

import type { OperationVariables } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
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
