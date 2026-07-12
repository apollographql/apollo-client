---
"@apollo/client": patch
---

Defer expensive `MissingFieldError` construction and avoid `JSON.stringify` of store objects on the cache-diff hot path. `diffQueryAgainstStore` now derives `diff.complete` from the raw missing-field tree and lazily builds the error only when `diff.missing` is actually accessed. Missing-field messages for embedded (non-normalized) parents now use `__typename` instead of pretty-printing the full parent object.
