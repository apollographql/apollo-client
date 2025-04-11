---
"@apollo/client": major
---

The `previousData` property on `useLazyQuery` will now change only when `data` changes. Previously `previousData` would change to the same value as `data` while the query was loading.
