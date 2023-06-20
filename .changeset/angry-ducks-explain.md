---
"@apollo/client": patch
---

Fix a bug in `PersistedQueryLink` that would cause it to permanently skip persisted queries after a 400 or 500 status code.
