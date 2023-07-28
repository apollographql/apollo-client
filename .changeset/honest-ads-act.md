---
'@apollo/client': patch
---

Adjust the rerender timing of `useQuery` to more closely align with `useFragment`. This means that cache updates delivered to both hooks should trigger renders at relatively the same time. Previously, the `useFragment` might rerender much faster leading to some confusion.
