---
"@apollo/client": major
_tags:
  - useLazyQuery
---

Remove `context` from `useLazyQuery` hook options. If used, `context` must now be provided to the `execute` function. `context` will reset to `{}` if not provided as an option to `execute`.
