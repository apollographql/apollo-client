---
"@apollo/client": patch
---

Fix nextFetchPolicy behaviour with transformed documents by keeping `options` reference stable when passing it through QueryManager.
