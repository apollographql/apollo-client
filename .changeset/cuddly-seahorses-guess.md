---
"@apollo/client": patch
---

Fix a timing problem where `useQuery` would execute an outdated callback reference.
