---
"@apollo/client": patch
---

Fixes an issue where triggering a query with different variables, then rapidly changing back to initial variables with a cached result would return the wrong result if the previous request finished after switching back to initial variables.
