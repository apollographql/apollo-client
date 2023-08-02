---
'@apollo/client': patch
---

Change an import in `useQuery` and `useMutation` that added an unnecessary runtime dependency on `@apollo/client/core`. This drastically reduces the bundle size of each the hooks.
