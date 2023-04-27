---
"@apollo/client": patch
---

Fix a potential memory leak in SSR scenarios when many `persistedQuery` instances were created over time.
