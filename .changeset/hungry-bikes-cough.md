---
"@apollo/client": patch
---

Fix type of `variables` returned from `useLazyQuery`. When `called` is `false`, `variables` is now `Partial<TVariables>` instead of `TVariables`.
