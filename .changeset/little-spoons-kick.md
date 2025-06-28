---
"@apollo/client": major
_tags:
  - types
  - errors
  - removals
---

`client.mutate` now returns a `MutateResult` instead of `FetchResult`. As a result, the `errors` property has been removed in favor of `error` which is set if either a network error occured or GraphQL errors are returned from the server.

`useMutation` now also returns a `MutateResult` instead of a `FetchResult`.
