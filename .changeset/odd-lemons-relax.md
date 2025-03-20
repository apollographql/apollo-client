---
"@apollo/client": major
---

Rename hook result types and options.

Query hooks now use a common naming scheme where the types are now prefixed with the hook name. For example, `useQuery` uses a `UseQueryOptions` type and returns a `UseQueryResult` type.
