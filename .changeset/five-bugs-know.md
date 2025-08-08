---
"@apollo/client": major
---

The `MaybeMasked` type exported from `@apollo/client/masking` is no longer overridable with HKT. Instead `MaybeMasked` uses new overridable `IsMaskingEnabled` and `Mask` types to determine whether to apply the masked or unmasked type. When `IsMaskingEnabled` returns `true`, `MaybeMasked` will apply `Mask<TData>`. When `IsMaskingEnabled` returns `false`, `MaybeMasked` will apply `Unmask<TData>`.
