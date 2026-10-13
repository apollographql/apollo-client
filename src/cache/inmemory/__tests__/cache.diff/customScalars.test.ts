import { gql } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { dateScalar } from "@apollo/client/testing/internal";

test("serializes scalar variables used in field arguments", () => {
  const cache = new InMemoryCache({
    scalars: {
      Date: dateScalar,
    },
  });

  const query = gql`
    query Event($date: Date!) {
      event(date: $date) {
        name
      }
    }
  `;

  cache.writeQuery({
    query,
    variables: {
      date: "2026-01-01",
    },
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });

  expect(
    cache.diff({
      query,
      optimistic: false,
      variables: {
        date: new Date(2026, 0, 1),
      },
    })
  ).toStrictEqualTyped({
    complete: true,
    missing: undefined,
    result: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });
});

test("serializes scalar variables used in directive arguments", () => {
  const cache = new InMemoryCache({
    scalars: {
      Date: dateScalar,
    },
    typePolicies: {
      Query: {
        fields: {
          event: {
            keyArgs: ["@on", ["date"]],
          },
        },
      },
    },
  });

  const query = gql`
    query Event($date: Date!) {
      event @on(date: $date) {
        name
      }
    }
  `;

  cache.writeQuery({
    query,
    variables: {
      date: "2026-01-01",
    },
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });

  expect(
    cache.diff({
      query,
      optimistic: false,
      variables: {
        date: new Date(2026, 0, 1),
      },
    })
  ).toStrictEqualTyped({
    complete: true,
    missing: undefined,
    result: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });
});

test("serializes scalar fields in input object variables", () => {
  const cache = new InMemoryCache({
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
  });

  const query = gql`
    query Event($filter: EventFilter!) {
      event(filter: $filter) {
        name
      }
    }
  `;

  cache.writeQuery({
    query,
    variables: {
      filter: {
        date: "2026-01-01",
      },
    },
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });

  expect(
    cache.diff({
      query,
      optimistic: false,
      variables: {
        filter: {
          date: new Date(2026, 0, 1),
        },
      },
    })
  ).toStrictEqualTyped({
    complete: true,
    missing: undefined,
    result: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });
});

test("returns parsed custom scalar fields", () => {
  const cache = new InMemoryCache({
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
  });
  const query = gql`
    query Event {
      event {
        startDate
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      event: {
        __typename: "Event",
        startDate: "2026-01-01",
      },
    },
  });

  expect(cache.diff({ query, optimistic: false })).toStrictEqualTyped({
    complete: true,
    missing: undefined,
    result: {
      event: {
        __typename: "Event",
        startDate: new Date(2026, 0, 1),
      },
    },
  });
});
