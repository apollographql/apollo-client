---
"@apollo/client": patch
---

**Potentially disruptive change**

When calling `fetchMore` with a query that has a `no-cache` fetch policy, `fetchMore` will now throw if an `updateQuery` function is not provided. This provides a mechanism to merge the results from the `fetchMore` call with the query's previous result.
