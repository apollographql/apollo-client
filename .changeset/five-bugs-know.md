---
"@apollo/client": major
---

The `MaybeMasked` type exported from `@apollo/client/masking` is no longer overridable with HKT. Instead `MaybeMasked` is aliased to a new overridable `Mask` type which is expected to return the masked type wehn available.
