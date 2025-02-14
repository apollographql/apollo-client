---
"@apollo/client": major
---

`useLazyQuery` no longer supports calling the execute function in render and will now throw. If you need to execute the query immediately, consider using `useQuery` instead.
