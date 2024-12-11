---
"@apollo/client": patch
---

Ensure `MaybeMasked` does not try to unwrap the type as `Unmasked` if the type contains `any`.
