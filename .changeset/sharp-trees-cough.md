---
'@apollo/client': patch
---

More robust typings for the `data` property returned from `useSuspenseQuery` when using `returnPartialData: true` or an `errorPolicy` of `all` or `ignore`. `TData` now defaults to `unknown` instead of `any`.
