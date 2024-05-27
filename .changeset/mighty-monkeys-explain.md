---
"@apollo/client": patch
---

Prevent writing to a ref in render in `useMutation`.
As a result, you might encounter problems in the future if you call the mutation's `execute` function during render. Please note that this was never supported behavior, and we strongly recommend against it.
