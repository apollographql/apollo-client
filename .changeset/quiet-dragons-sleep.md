---
"@apollo/client": patch
---

This change adds a new option to `client.watchQuery`, `variablesUnknown`, which may be set `true` for queries starting with a `fetchPolicy` of `standby`. It will only be applied when creating the `ObervableQuery` instance and cannot be changed later. This flag indicates that the query's variables are not yet known, and thus it should be excluded from refetch operations until they are.

Fixes #12996, an issue where queries starting with `skipToken` were included in `client.refetchQueries()` before they had been executed for the first time. While generally queries with a `standby` `fetchPolicy` should be included in refetch, these queries never had `variables` passed in, so they should be excluded until they have run once and received their actual variables.

These queries are now properly excluded from refetch operations until after their initial execution.
