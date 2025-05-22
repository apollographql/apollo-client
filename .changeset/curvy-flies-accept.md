---
"@apollo/client": major
---

The `getCacheKey` function is no longer available from `operation.getContext()` in the link chain. Use `operation.client.cache.identify(obj)` in the link chain instead.
