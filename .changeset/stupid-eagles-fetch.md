---
"@apollo/client": major
---

`cache-only` queries no longer poll when a `pollInterval` is set. Instead a warning is now emitted that polling has no effect. If the `fetchPolicy` is changed to `cache-only` after polling is already active, polling is stopped.
