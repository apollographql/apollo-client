import { delay, of } from "rxjs";

import type { OperationVariables } from "@apollo/client";
import { ApolloClient, ApolloLink, gql } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { dateScalar } from "@apollo/client/testing/internal";

test("serializes scalar variables used in field arguments", async () => {
  let requestVariables!: OperationVariables;

  const link = new ApolloLink((operation) => {
    requestVariables = operation.variables;

    return of({
      data: { createEvent: { __typename: "Event", name: "GraphQL Summit" } },
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

  const mutation = gql`
    mutation CreateEvent($date: Date!) {
      createEvent(date: $date) {
        name
      }
    }
  `;

  await expect(
    client.mutate({
      mutation,
      variables: {
        date: new Date(2026, 0, 1),
      },
    })
  ).resolves.toStrictEqualTyped({
    data: {
      createEvent: {
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
      data: { createEvent: { __typename: "Event", name: "GraphQL Summit" } },
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

  const mutation = gql`
    mutation CreateEvent($date: Date!) {
      createEvent @on(date: $date) {
        name
      }
    }
  `;

  await expect(
    client.mutate({
      mutation,
      variables: {
        date: new Date(2026, 0, 1),
      },
    })
  ).resolves.toStrictEqualTyped({
    data: {
      createEvent: {
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
      data: { createEvent: { __typename: "Event", name: "GraphQL Summit" } },
    });
  });

  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: {
        Date: dateScalar,
      },
      inputObjects: {
        EventInput: {
          fields: {
            date: "Date",
          },
        },
      },
    }),
    link,
  });

  const mutation = gql`
    mutation CreateEvent($input: EventInput!) {
      createEvent(input: $input) {
        name
      }
    }
  `;

  await expect(
    client.mutate({
      mutation,
      variables: {
        input: {
          date: new Date(2026, 0, 1),
        },
      },
    })
  ).resolves.toStrictEqualTyped({
    data: {
      createEvent: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });

  expect(requestVariables).toStrictEqualTyped({
    input: {
      date: "2026-01-01",
    },
  });
});

test("parses custom scalar fields with a network-only fetch policy", async () => {
  const mutation = gql`
    mutation CreateEvent {
      createEvent {
        id
        startDate
      }
    }
  `;
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
    link: new ApolloLink(() =>
      of({
        data: {
          createEvent: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
          },
        },
      }).pipe(delay(20))
    ),
  });

  await expect(
    client.mutate({
      mutation,
      fetchPolicy: "network-only",
    })
  ).resolves.toStrictEqualTyped({
    data: {
      createEvent: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
  });
});

test.failing(
  "parses custom scalar fields with a no-cache fetch policy",
  async () => {
    const mutation = gql`
      mutation CreateEvent {
        createEvent {
          id
          startDate
        }
      }
    `;
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
      link: new ApolloLink(() =>
        of({
          data: {
            createEvent: {
              __typename: "Event",
              id: "1",
              startDate: "2026-01-01",
            },
          },
        }).pipe(delay(20))
      ),
    });

    await expect(
      client.mutate({
        mutation,
        fetchPolicy: "no-cache",
      })
    ).resolves.toStrictEqualTyped({
      data: {
        createEvent: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      },
    });
  }
);
