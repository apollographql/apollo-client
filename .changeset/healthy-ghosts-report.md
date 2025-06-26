---
"@apollo/client": minor
_tags:
  - types
---

The callback function that can be passed to the `ApolloClient.mutate`
`refetchQueries` option will now receive a `FormattedExecutionResult` with an
additional `dataState` option that describes if the result is `"streaming"`
or `"complete"`.
This indicates whether the `data` value is of type
* `Unmasked<TData>` (if `"complete"`)
* `Streaming<Unmasked<TData>>` (if `"streaming"`)
