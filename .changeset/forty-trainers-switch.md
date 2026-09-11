---
"@apollo/client": patch
---

Fix issue where the wrong `dataState` was returned when there was nothing written to the cache and a `@defer` fragment was marked pending.
