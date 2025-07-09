---
"@apollo/client": major
---

Unify error behavior on mutations for GraphQL errors and network errors by ensuring network errors are subject to the `errorPolicy`. Network errors created when using an `errorPolicy` of `all` will now resolve the promise and be returned on the `error` property of the result, or stripped away when the `errorPolicy` is `none`.
