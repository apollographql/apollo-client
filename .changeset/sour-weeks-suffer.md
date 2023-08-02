---
'@apollo/client': patch
---

Throw errors in `useSuspenseQuery` for errors returned in incremental chunks when `errorPolicy` is `none`. This provides a more consistent behavior of the `errorPolicy` in the hook.

### Potentially breaking change

Previously, if you issued a query with `@defer` and relied on `errorPolicy: 'none'` to set the `error` property returned from `useSuspenseQuery` when the error was returned in an incremental chunk, this error is now thrown. Switch the `errorPolicy` to `all` to avoid throwing the error and instead return it in the `error` property.
