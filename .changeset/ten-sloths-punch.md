---
"@apollo/client": minor
---

The `mutationResult` option passed to the `updateQueries` callback now has an
additional property, `dataState` with possible values of `"complete"` and `"streaming"`.
This indicates whether the `data` value is of type
* `Unmasked<TData>` (if `"complete"`)
* `Unmasked<DeepPartial<TData>>` (if `"streaming"`)
