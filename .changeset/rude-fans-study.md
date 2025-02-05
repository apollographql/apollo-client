---
"@apollo/client": major
---

Deprecate the `partial` flag on `ApolloQueryResult` and make it a non-optional property. Previously `partial` was only set conditionally if the result emitted was partial. This value is now available with all results that return an `ApolloQueryResult`.
