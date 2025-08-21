---
"@apollo/client": minor
_tags:
  - types
  - links
---

Prioritize usage of `FormattedExecutionResult` over `FetchResult` where applicable.

Many APIs used `FetchResult` in place of `FormattedExecutionResult`, which could
cause inconsistencies.

* `FetchResult` is now used to refer to an unhandled "raw" result as returned from
  a link.
  This can also include incremental results that use a different format.
* `FormattedExecutionResult` from the `graphql` package is now used to represent
  the execution of a standard GraphQL request without incremental results.

If your custom links access the `data` property, you might need to first check if
the result is a standard GraphQL result by using the `isFormattedExecutionResult`
helper from `@apollo/client/utilities`.
