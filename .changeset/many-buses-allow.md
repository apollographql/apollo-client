---
"@apollo/client": patch
---

Fix an issue where passing `onError` to `useMutation` would resolve the promise returned by the `mutate` function instead of rejecting when using an `errorPolicy` of `none`.
