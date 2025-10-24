---
"@apollo/client": patch
---

Deduplicate watches created by `useFragment`, `client.watchFragment`, and `cache.watchFragment` that contain the same fragment, variables, and identifier. This should improve performance in situations where a `useFragment` or a `client.watchFragment` is used to watch the same object in multiple places of an application.
