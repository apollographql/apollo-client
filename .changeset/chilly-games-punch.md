---
"@apollo/client": patch
---

Fix an issue where `useQuery` would poll with `pollInterval` when `skip` was initialized to `true`.
