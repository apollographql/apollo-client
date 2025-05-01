---
"@apollo/client": major
---

Remove the `getCacheKey` function from `operation.getContext(obj)`. Use `operation.client.cache.identify(obj)` instead.
