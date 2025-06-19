---
"@apollo/client": major
---

The `Cache.DiffResult<T>` type is now a union type with better type safety for both complete and partial results. Checking `diff.complete` will now narrow the type of `result` depending on whether the value is `true` or `false`.

When `true`, `diff.result` will be a non-null value equal to the `T` generic type. When `false`, `diff.result` now reports `result` as `DeepPartial<T> | null` indicating that fields in the result may be missing (`DeepPartial<T>`) or empty entirely (`null`).
