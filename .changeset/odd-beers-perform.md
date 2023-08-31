---
"@apollo/client": patch
---

Fixes an issue where triggering a query with differnt variables then rapidly changing back to the initial variables with a cached result would return the wrong result if the previous request finished after switching back to initial variables.
