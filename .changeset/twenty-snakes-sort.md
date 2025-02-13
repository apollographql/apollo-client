---
"@apollo/client": major
---

`useLazyQuery` will now only execute the query when the execute function is called. Previously `useLazyQuery` would behave like `useQuery` after the first call to the execute function which means changes to options might perform network requests.

You can now safely rerender `useLazyQuery` with new options which will now take effect for the next query.
