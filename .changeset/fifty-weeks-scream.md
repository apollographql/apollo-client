---
"@apollo/client": patch
---

Fix a problem with `fetchMore` where the loading state wouldn't reset if the result wouldn't result in a data update.
