---
"@apollo/client": patch
---

Defer expensive `MissingFieldError` construction on the cache-diff hot path. `diffQueryAgainstStore` now derives `diff.complete` from the raw missing-field tree and lazily builds the error only when `diff.missing` is actually accessed. Missing-field messages now use `cache.identify()` for normalized objects and `JSON.stringify` for non-normalized (embedded) objects, preserving debuggability while avoiding the cost of `JSON.stringify` on the most common (normalized) code path.
