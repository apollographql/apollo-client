---
"@apollo/client": patch
---

Fixes an issue where `client.watchFragment`/`useFragment` with `@includes` crashes when a separate cache update writes to the conditionally included fields.
