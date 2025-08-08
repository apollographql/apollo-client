---
"@apollo/client": major
---

Update the HKT types used by the `MaybeMasked` and `Unmasked` types. `MaybeMasked` now uses the `Mask` HKT type and `Unmasked` uses the `Unmask` HKT type.

```diff
declare module "@apollo/client" {
  interface TypeOverrides {
-   MaybeMasked: CustomMaybeMaskedHKT
+   Mask: CustomMaybeMaskedHKT
-   Unmasked: CustomUnmaskedHKT
+   Unmask: CustomUnmaskedHKT
  }
}
```
