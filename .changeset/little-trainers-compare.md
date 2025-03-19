---
"@apollo/client": patch
---

Fix an issue where a `cache-first` query would return the result for previous variables when a cache update is issued after simultaneously changing variables and skipping the query.
