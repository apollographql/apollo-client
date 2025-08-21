---
"@apollo/client": patch
_tags:
  - useLazyQuery
  - removals
---

Ensure `useLazyQuery` does not return a `partial` property which is not specified by the result type.
