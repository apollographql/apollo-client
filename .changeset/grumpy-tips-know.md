---
"@apollo/client": patch
---

More robust types for the `data` property on `UseFragmentResult`. When a partial result is given, the type is now correctly set to `Partial<TData>`.
