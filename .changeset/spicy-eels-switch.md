---
"@apollo/client": patch
---

`DeepPartial<Array<TData>>` now returns `Array<DeepPartial<TData>>` instead of `Array<DeepPartial<TData | undefined>>`.
