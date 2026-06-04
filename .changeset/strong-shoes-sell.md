---
"@apollo/client": minor
---

Adds a `scalar` option to `InMemoryCache` field policies that dictates whether to parse the raw value using the custom scalar definition. Scalar parsing is now performed on cache reads.

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
