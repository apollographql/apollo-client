---
"@apollo/client": patch
---

Remove `QueryInfo.listeners` as there were always only 0 or 1 listeners. Subscribe directly instead.
