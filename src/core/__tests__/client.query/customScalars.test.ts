import { of } from "rxjs";

import type { OperationVariables } from "@apollo/client";
import { ApolloClient, ApolloLink, gql } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { dateScalar } from "@apollo/client/testing/internal";

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

  await expect(
    client.query({
      query,
      variables: {
        date: new Date(2026, 0, 1),
      },
    })
  ).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });

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

  await expect(
    client.query({
      query,
      variables: {
        date: new Date(2026, 0, 1),
      },
    })
  ).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });

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

  await expect(
    client.query({
      query,
      variables: {
        filter: {
          date: new Date(2026, 0, 1),
        },
      },
    })
  ).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });

  expect(requestVariables).toStrictEqualTyped({
    filter: {
      date: "2026-01-01",
    },
  });
});
