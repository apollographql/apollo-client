---
"@apollo/client": patch
---

**Potentially disruptive change**

When calling `fetchMore` with a query that has a `no-cache` fetch policy, `fetchMore` will now throw if an `updateQuery` function is not provided. This ensures that Apollo Client can properly update and report the result of the query.
