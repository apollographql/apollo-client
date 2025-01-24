---
"@apollo/client": major
---

`cache.diff` now returns `null` instead of an empty object (`{}`) when `returnPartialData` is `true` and the result is empty.

If you use `cache.diff` directly with `returnPartialData: true`, you will need to check for `null` before accessing any other fields on the `result` property. A non-null value indicates that at least one field was present in the cache for the given query document.
