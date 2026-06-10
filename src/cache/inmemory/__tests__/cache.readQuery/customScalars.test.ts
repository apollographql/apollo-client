import { gql } from "@apollo/client";
import { InMemoryCache, Scalar } from "@apollo/client/cache";

const dateScalar = new Scalar<string, Date>({
  serialize: (date) =>
    `${date.getFullYear()}-${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`,
  parse: (value) => new Date(value),
});

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
    cache.readQuery({
      query,
      variables: {
        date: new Date(2026, 0, 1),
      },
    })
  ).toStrictEqualTyped({
    event: {
      __typename: "Event",
      name: "GraphQL Summit",
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
    cache.readQuery({
      query,
      variables: {
        date: new Date(2026, 0, 1),
      },
    })
  ).toStrictEqualTyped({
    event: {
      __typename: "Event",
      name: "GraphQL Summit",
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
    cache.readQuery({
      query,
      variables: {
        filter: {
          date: new Date(2026, 0, 1),
        },
      },
    })
  ).toStrictEqualTyped({
    event: {
      __typename: "Event",
      name: "GraphQL Summit",
    },
  });
});
