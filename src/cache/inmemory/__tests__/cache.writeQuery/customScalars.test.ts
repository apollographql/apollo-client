import { gql } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { bigIntScalar, dateScalar } from "@apollo/client/testing/internal";

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
      date: new Date(2026, 0, 1),
    },
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });

  expect(cache.extract()).toStrictEqualTyped({
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
      date: new Date(2026, 0, 1),
    },
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });

  expect(cache.extract()).toStrictEqualTyped({
    ROOT_QUERY: {
      __typename: "Query",
      'event:{"@on":{"date":"2026-01-01"}}': {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });
});

test("serializes scalar variables used in field arguments with keyArgs", () => {
  const cache = new InMemoryCache({
    scalars: {
      Date: dateScalar,
    },
    typePolicies: {
      Query: {
        fields: {
          event: {
            keyArgs: ["date"],
          },
        },
      },
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
      date: new Date(2026, 0, 1),
    },
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });

  expect(cache.extract()).toStrictEqualTyped({
    ROOT_QUERY: {
      __typename: "Query",
      'event:{"date":"2026-01-01"}': {
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
        date: new Date(2026, 0, 1),
      },
    },
    data: {
      event: {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });

  expect(cache.extract()).toStrictEqualTyped({
    ROOT_QUERY: {
      __typename: "Query",
      'event({"filter":{"date":"2026-01-01"}})': {
        __typename: "Event",
        name: "GraphQL Summit",
      },
    },
  });
});

// https://github.com/apollographql/apollo-client/issues/13494
test("identifies entities with parsed non-JSON-serializable scalar key fields", () => {
  const cache = new InMemoryCache({
    scalars: { BigInt: bigIntScalar },
    typePolicies: {
      Product: {
        keyFields: ["id"],
        fields: {
          id: { scalar: "BigInt" },
        },
      },
    },
  });

  const query = gql`
    query Product {
      product {
        id
        name
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      product: { __typename: "Product", id: 5n, name: "GraphQL Hoodie" },
    },
  });

  expect(cache.extract()).toStrictEqualTyped({
    ROOT_QUERY: {
      __typename: "Query",
      product: { __ref: 'Product:{"id":"5"}' },
    },
    'Product:{"id":"5"}': {
      __typename: "Product",
      id: "5",
      name: "GraphQL Hoodie",
    },
  });
});

// https://github.com/apollographql/apollo-client/issues/13494
test("identifies entities with a parsed non-JSON-serializable scalar default id field", () => {
  const cache = new InMemoryCache({
    scalars: { BigInt: bigIntScalar },
    typePolicies: {
      Product: {
        fields: {
          id: { scalar: "BigInt" },
        },
      },
    },
  });

  const query = gql`
    query Product {
      product {
        id
        name
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      product: { __typename: "Product", id: 5n, name: "GraphQL Hoodie" },
    },
  });

  expect(cache.extract()).toStrictEqualTyped({
    ROOT_QUERY: {
      __typename: "Query",
      product: { __ref: "Product:5" },
    },
    "Product:5": {
      __typename: "Product",
      id: "5",
      name: "GraphQL Hoodie",
    },
  });
});

// https://github.com/apollographql/apollo-client/issues/13494
test("identifies entities with parsed nested non-JSON-serializable scalar key fields", () => {
  const cache = new InMemoryCache({
    scalars: { BigInt: bigIntScalar },
    typePolicies: {
      Order: {
        keyFields: ["product", ["sku"]],
      },
      Product: {
        fields: {
          sku: { scalar: "BigInt" },
        },
      },
    },
  });

  const query = gql`
    query Order {
      order {
        product {
          sku
        }
        quantity
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      order: {
        __typename: "Order",
        product: { __typename: "Product", sku: 5n },
        quantity: 2,
      },
    },
  });

  expect(cache.extract()).toStrictEqualTyped({
    ROOT_QUERY: {
      __typename: "Query",
      order: { __ref: 'Order:{"product":{"sku":"5"}}' },
    },
    'Order:{"product":{"sku":"5"}}': {
      __typename: "Order",
      product: { __typename: "Product", sku: "5" },
      quantity: 2,
    },
  });
});

// https://github.com/apollographql/apollo-client/issues/13494
test("serializes non-JSON-serializable scalar variables used in keyArgs", () => {
  const cache = new InMemoryCache({
    scalars: { BigInt: bigIntScalar },
    typePolicies: {
      Query: {
        fields: {
          products: {
            keyArgs: ["ids", "$after"],
          },
        },
      },
    },
  });

  const query = gql`
    query Products($ids: [BigInt!]!, $after: BigInt) {
      products(ids: $ids) {
        name
        reviews(after: $after) {
          body
        }
      }
    }
  `;

  cache.writeQuery({
    query,
    variables: { ids: [5n], after: 10n },
    data: {
      products: [
        {
          __typename: "Product",
          name: "GraphQL Hoodie",
          reviews: [{ __typename: "Review", body: "So comfy" }],
        },
      ],
    },
  });

  expect(cache.extract()).toStrictEqualTyped({
    ROOT_QUERY: {
      __typename: "Query",
      'products:{"ids":["5"],"$after":"10"}': [
        {
          __typename: "Product",
          name: "GraphQL Hoodie",
          'reviews({"after":"10"})': [
            { __typename: "Review", body: "So comfy" },
          ],
        },
      ],
    },
  });
});
