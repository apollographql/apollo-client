import { ApolloClient, ApolloLink, gql } from "@apollo/client";
import { InMemoryCache, Scalar } from "@apollo/client/cache";

const dateScalar = new Scalar<string, Date>({
  serialize: (date) =>
    `${date.getFullYear()}-${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`,
  parse: (value) => new Date(value),
});

test("serializes scalar variables used in field arguments", () => {
  const client = new ApolloClient({
    cache: new InMemoryCache({ scalars: { Date: dateScalar } }),
    link: ApolloLink.empty(),
  });
  const query = gql`
    query Event($date: Date!) {
      event(date: $date) {
        name
      }
    }
  `;

  client.writeQuery({
    query,
    variables: { date: new Date(2026, 0, 1) },
    data: {
      event: { __typename: "Event", name: "GraphQL Summit" },
    },
  });

  expect(client.extract()).toStrictEqualTyped({
    ROOT_QUERY: {
      __typename: "Query",
      'event({"date":"2026-01-01"})': {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });
});

test("serializes scalar variables used in directive arguments", () => {
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Query: {
          fields: {
            event: {
              keyArgs: ["@on", ["date"]],
            },
          },
        },
      },
    }),
    link: ApolloLink.empty(),
  });
  const query = gql`
    query Event($date: Date!) {
      event @on(date: $date) {
        name
      }
    }
  `;

  client.writeQuery({
    query,
    variables: { date: new Date(2026, 0, 1) },
    data: {
      event: { __typename: "Event", name: "GraphQL Summit" },
    },
  });

  expect(client.extract()).toStrictEqualTyped({
    ROOT_QUERY: {
      __typename: "Query",
      'event:{"@on":{"date":"2026-01-01"}}': {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });
});

test("serializes scalar fields in input object variables", () => {
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      inputObjects: {
        EventFilter: {
          fields: {
            date: "Date",
          },
        },
      },
    }),
    link: ApolloLink.empty(),
  });
  const query = gql`
    query Event($filter: EventFilter!) {
      event(filter: $filter) {
        name
      }
    }
  `;

  client.writeQuery({
    query,
    variables: {
      filter: {
        date: new Date(2026, 0, 1),
      },
    },
    data: {
      event: { __typename: "Event", name: "GraphQL Summit" },
    },
  });

  expect(client.extract()).toStrictEqualTyped({
    ROOT_QUERY: {
      __typename: "Query",
      'event({"filter":{"date":"2026-01-01"}})': {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });
});
