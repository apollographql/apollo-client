---
"@apollo/client": major
---

The `MaybeMasked` type exported from `@apollo/client/masking` is no longer overridable with HKT. Instead `MaybeMasked` uses new overridable `IsMasked` and `Mask` types to determine whether to apply the masked or unmasked type. When `IsMasked` returns `true`, `MaybeMasked` will apply `Mask<TData>`. When `IsMasked` returns `false`, `MaybeMasked` will apply `Unmask<TData>`.
