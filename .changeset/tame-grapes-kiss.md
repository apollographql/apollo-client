---
"@apollo/client": patch
---

Support `skipToken` with `useQuery` to skip execution.

```ts
import { skipToken, useQuery } from "@apollo/client/react"

// Use `skipToken` in place of `skip: true` for better type safety
// for required variables
const { data } = useQuery(QUERY, id ? { variables: { id } } : skipToken);
```
