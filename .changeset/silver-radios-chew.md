---
'@apollo/client': patch
---

Ensure `refetch`, `fetchMore`, and `subscribeToMore` functions returned by `useSuspenseQuery` are referentially stable between renders, even as `data` is updated.
