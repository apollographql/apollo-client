---
"@apollo/client": patch
---

Fix a possible race condition on queries that were reobserved before they were subscribed to the first time.
