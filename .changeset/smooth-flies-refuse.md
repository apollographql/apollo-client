---
"@apollo/client": patch
---

Fix issue where setting `returnPartialData: true` might report the wrong `dataState` when partial data was written to the cache and `@defer` fragments were pending.
