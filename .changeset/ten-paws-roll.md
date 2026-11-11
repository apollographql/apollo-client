---
"@apollo/client": minor
---

`CombinedGraphQLErrors` and `CombinedProtocolErrors` now extend `AggregateError`.
This means that you will need to use at least `lib: ["es2021"]` or `lib: ["es2021.promise"]` in your TypeScript configuration.
