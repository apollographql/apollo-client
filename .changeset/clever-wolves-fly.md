---
"@apollo/client": patch
---

`cache.watchFragment` now returns an `Unmasked<TData>` result since `cache.watchFragment` does not mask fragment spreads.
