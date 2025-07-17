---
"@apollo/client": patch
_tags:
  - useQuery
---

When updating `skip` from `false` to `true` in `useQuery`, retain `data` if it is available rather than setting it to `undefined`.
