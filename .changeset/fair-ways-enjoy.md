---
"@apollo/client": patch
---

`ObservableQuery.variables` now returns `undefined` if no variables were set from `watchQuery` or if `variables` was set to an empty object. This ensures the value of `variables` lines up with the type.

This change also propogates to `useQuery` and `useLazyQuery`. The `variables` property returned from these hooks will be `undefined` instead of an empty object if no `variables` were set.
