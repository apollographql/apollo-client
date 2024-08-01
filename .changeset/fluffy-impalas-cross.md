---
"@apollo/client": patch
---

Fix an issue where multiple fetches with results that returned errors would sometimes set the `data` property with an `errorPolicy` of `none`.
