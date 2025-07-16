---
"@apollo/client": major
---

The `defaultOptions` and `initialFetchPolicy` options are no longer supported with `useLazyQuery`.

If you use `defaultOptions`, pass those options directly to the hook instead. If you use `initialFetchPolicy`, use `fetchPolicy` instead.
