---
"@apollo/client": major
---

The promise returned when calling the execute function from `useLazyQuery` will now reject when using an `errorPolicy` of `none` when GraphQL errors are returned from the result.
