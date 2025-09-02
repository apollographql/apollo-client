---
"@apollo/client": patch
---

Support `skipToken` with `useQuery` to provide a more type-safe way to skip query execution.

```ts
import { skipToken, useQuery } from "@apollo/client/react"

// Use `skipToken` in place of `skip: true` for better type safety
// for required variables
const { data } = useQuery(QUERY, id ? { variables: { id } } : skipToken);
```

Note: this change is provided as a patch within the 4.0 minor version because the changes to TypeScript validation with required variables in version 4.0 made using the `skip` option more difficult.
