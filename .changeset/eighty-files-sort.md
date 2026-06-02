---
"@apollo/client": minor
---

Adds the plumbing and types implementation for declaring custom scalars and configuring custom scalars in `InMemoryCache`.

You can declare custom scalar types with declaration merging on the `ApolloCache.Scalars` interface:

```ts
// apollo.d.ts
import "@apollo/client";

declare module "@apollo/client" {
  namespace ApolloCache {
    interface Scalars {
      Date: { input: string; output: Date };
    }
  }
}
```

This enables the `scalars` option in `InMemoryCache`:

```ts
const cache = new InMemoryCache({
  scalars: {
    Date: {
      parse: (dateString) => new Date(dateString),
      serialize: (date) => date.toISOString(),
      is: (value) => value instanceof Date,
      devtools: {
        displayValue: (date) => {
          return format(date, "MMM dd, YYYY");
        },
      },
    },
  },
});
```
