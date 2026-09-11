---
"@apollo/client": minor
---

Automatically serialize variables that include custom scalar values. This includes cache reads and writes as well as requests to the network.

For more complex input objects, a new `inputObjects` option is available to `InMemoryCache` that specifies where nested scalar fields are found.

```ts
const cache = new InMemoryCache({
  scalars: {
    DateTime: new Scalar({
      parse: (value) => new Date(value),
      serialize: (value) => value.toISOString(),
      is: (value) => value instanceof Date,
    }),
  },
  inputObjects: {
    EventFilter: {
      fields: {
        date: "DateTime",
      },
    },
  },
});

const client = new ApolloClient({ cache, link });

await client.query({
  query: gql`
    query Event($filter: EventFilter!) {
      event(filter: $filter) {
        name
      }
    }
  `,
  variables: {
    filter: {
      date: new Date("2026-01-01T00:00:00.000Z"),
    },
  },
});

// The link receives:
// { filter: { date: "2026-01-01T00:00:00.000Z" } }
```
