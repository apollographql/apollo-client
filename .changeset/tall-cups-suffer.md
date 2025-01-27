---
"@apollo/client": major
---

### Changes for users of `InMemoryCache`

`cache.diff` now returns `null` instead of an empty object (`{}`) when `returnPartialData` is `true` and the result is empty.

If you use `cache.diff` directly with `returnPartialData: true`, you will need to check for `null` before accessing any other fields on the `result` property. A non-null value indicates that at least one field was present in the cache for the given query document.

### Changes for third-party cache implementations

The client now expects `cache.diff` to return `null` instead of an empty object when there is no data that can be fulfilled from the cache and `returnPartialData` is `true`. If your cache implementation returns an empty object, please update this to return `null`.
