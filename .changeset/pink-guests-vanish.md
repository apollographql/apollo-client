---
"@apollo/client": patch
---

Fix a potential crash when calling `clearStore` while a query was running.

Previously, calling `client.clearStore()` while a query was running had one of these results:
* `useQuery` would stay in a `loading: true` state.
* `useLazyQuery` would stay in a `loading: true` state, but also crash with a `"Cannot read property 'data' of undefined"` error.

Now, in both cases, the hook will enter an error state with a `networkError`, and the promise returned by the `useLazyQuery` `execute` function will return a result in an error state.
