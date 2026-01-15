---
"@apollo/client": minor
---

`InMemoryCache` no longer filters out explicitly returned `undefined` items from `read` functions for array fields. This now makes it possible to create `read` functions on array fields that return partial data and trigger a fetch for the full list.
