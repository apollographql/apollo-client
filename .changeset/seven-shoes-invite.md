---
"@apollo/client": patch
---

Fix an issue where a partial cache write for an errored query would result in automatically refetching that query.
