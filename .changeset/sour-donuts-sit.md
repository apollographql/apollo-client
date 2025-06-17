---
"@apollo/client": minor
---

Prioritize usage of `FormattedExecutionResult` over `FetchResult` where applicable.

Many APIs used `FetchResult` in place of `FormattedExecutionResult`, which could
cause inconsistencies.

* `FetchResult` is now used to refer to an unhandled "raw" result as returned from
  a link.
  This can also include incremental results that might have an unexpected shape.
* `FormattedExecutionResult` from the `graphql` package is now used to represent
  a "handled" response and will always have the expected shape with the possible
  properties `data`, `errors` and `extensions`.
