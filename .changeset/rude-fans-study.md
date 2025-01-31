---
"@apollo/client": major
---

Remove the `partial` flag on `ApolloQueryResult` in favor of a `complete` flag. The `complete` flag is now only set when `returnPartialData` is `true` as a means to determine if the returned result is a complete or partial result.

If you use `result.partial`, you can migrate to use `!result.complete` to achieve the same result for any query that uses `returnPartialData: true`. All queries where `returnPartialData` is not set or set to `false`, you will need to remove this check and instead check if `data` is `undefined` or not.
