---
"@apollo/client": major
---

`useLazyQuery` no longer supports SSR environments and will now throw if the `execute` function is called in SSR. If you need to run a query in an SSR environment, use `useQuery` instead.
