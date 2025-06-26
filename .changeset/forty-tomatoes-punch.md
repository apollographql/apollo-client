---
"@apollo/client": patch
_tags:
  - useLazyQuery
---

The returned `networkStatus` in `useLazyQuery` is now set to `setVariables` when calling the `useLazyQuery` `execute` function for the first time with variables.
