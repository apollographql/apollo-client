---
"@apollo/client": major
---

Rename hook result types and options.

Query hooks now use a common naming scheme where the name of the hook prefixes the `*Options` or `*Result` type. For example, `useQuery` uses a `UseQueryOptions` type and returns a `UseQueryResult` type.
