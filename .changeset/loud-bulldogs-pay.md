---
"@apollo/client": patch
---

Fix an issue where a `@defer` query reported the `dataState` as `complete` instead of `streaming` when an error occurs on a deferred field that bubbled to the defer boundary.
