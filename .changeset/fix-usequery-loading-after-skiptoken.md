---
"@apollo/client": patch
---

Fix `useQuery` staying in `loading: true` after returning from `skipToken` when the cache lost a selected field while skipped and the refetch returns data deep-equal to the pre-skip result. Leaving `standby` now forces the first non-loading value through, like `refetch` and `setVariables` already do.
