---
"@apollo/client": minor
---

Adds a `scalar` option to `InMemoryCache` field policies that tells the cache which scalar to use when parsing or serializing the field value.

```ts
import { Scalar } from "@apollo/client";

new InMemoryCache({
  scalars: {
    DateTime: new Scalar({
      parse: (dateString) => new Date(dateString),
      serialize: (date) => date.toISOString(),
    }),
  },
  typePolicies: {
    Event: {
      fields: {
        startTime: {
          // Parse this field using the DateTime scalar
          scalar: "DateTime",
        },
      },
    },
  },
});
```

This scalar definition is now used to properly parse or serialize the field value for cache reads and writes as well as `cache.extract()` and `cache.restore()`.
