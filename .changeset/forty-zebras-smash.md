---
"@apollo/client": patch
---

Fix a bug where other fields could be aliased to `__typename` or `id`, in which case an incoming result would be merged into the wrong cache entry.
