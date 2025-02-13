---
"@apollo/client": patch
---

Fix the type of the `variables` property passed as the 2nd argument to the `subscribeToMore` callback. This was previously reported as the `variables` type for the subscription itself, but is now properly typed as the query `variables`.
