---
'@apollo/client': patch
---

Fixes an issue where `useSuspenseQuery` would not respond to cache updates when using a cache-first `fetchPolicy` after the hook was mounted with data already in the cache.
