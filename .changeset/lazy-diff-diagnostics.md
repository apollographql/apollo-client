---
"@apollo/client": patch
---

Cache diffs for incomplete queries no longer pay the cost of building a full `MissingFieldError` when the `missing` property is not accessed. The error object is now only constructed when the `missing` property is accessed the first time. This improves performance by avoiding a V8 stack capture when `missing` is ignored entirely.

As an additional small performance improvement, `JSON.stringify` is no longer used in the error message on objects whose cache ID is known. `JSON.stringify` is only used for non-normalized objects.
