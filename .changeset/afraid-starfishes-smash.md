---
"@apollo/client": minor
---

Field policies and `inputObjects` can now tell the cache whether a field is a list of scalars or a scalar whose value is an array. Previously all arrays were iterated and only the inner type was provided to the scalar `parse`/`serialize` functions.

This required some breaking changes from previous prerelease versions:

- The field policy `scalar` option and `inputObjects` type string now use GraphQL list syntax to mark a field as a list of scalars
- The abstract `cache.getScalarForField` is now `cache.getScalarTypeForField` and is expected to return the string representing the scalar type rather than the `Scalar` instance

```ts
new InMemoryCache({
  scalars: {
    DateTime: new Scalar(/*...*/),
  },
  inputObjects: {
    EventFilter: {
      fields: {
        // Previously only the scalar type was provided
        datesBefore: "DateTime",

        // List syntax now required
        datesAfter: "[DateTime]",
        dates2d: "[[DateTime]]",
      },
    },
  },
  typePolicies: {
    Event: {
      fields: {
        // Previously only the scalar type was provided
        datesBefore: {
          scalar: "DateTime",
        },

        // List syntax now required
        datesAfter: {
          scalar: "[DateTime]",
        },
        dates2d: {
          scalar: "[[DateTime]]",
        },
      },
    },
  },
});
```

Now it's possible to handle scalars that are represented by arrays:

```ts
const dateTimeRangeScalar = new Scalar<
  [string, string],
  { start: Date; end: Date }
>({
  parse: ([start, end]) => ({
    start: new Date(start),
    end: new Date(end),
  }),
  serialize: (range) => [range.start.toISOString(), range.end.toISOString()],
  is: (value) => !Array.isArray(value),
});

const cache = new InMemoryCache({
  scalars: {
    DateTimeRange: dateTimeRangeScalar,
  },
  typePolicies: {
    Event: {
      fields: {
        range: {
          scalar: "DateTimeRange",
        },
      },
    },
  },
});

const query = gql`
  query {
    event {
      range
    }
  }
`;

cache.writeQuery({
  query,
  data: {
    event: {
      __typename: "Event",
      // Server returns DateTimeRange as a JSON array
      range: ["2024-01-01T00:00:00Z", "2024-06-01T00:00:00Z"],
    },
  },
});

const { data } = useQuery(query);
// => { event: { __typename: "Event", range: { start: Date, end: Date } } }
```
