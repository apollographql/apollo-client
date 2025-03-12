---
"@apollo/client": major
---

The result resolved from the promise returned from the execute function in `useLazyQuery` is now an `ApolloQueryResult` type and no longer includes all the fields returned from the `useLazyQuery` hook tuple.

If you need access to the additional properties such as `called`, `refetch`, etc. not included in `ApolloQueryResult`, read them from the hook instead.
