---
"@apollo/client": minor
---

Support `skipToken` with `useSubscription` to provide a more type-safe way to skip subscription execution with required variables.

```ts
import { skipToken, useSubscription } from "@apollo/client/react";

// Use `skipToken` in place of `skip: true` for better type safety
// for required variables
const { data } = useSubscription(
  SUBSCRIPTION,
  id ? { variables: { id } } : skipToken
);
```
