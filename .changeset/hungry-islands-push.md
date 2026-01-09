---
"@apollo/client": patch
---

Expose the `ExtensionsWithStreamInfo` type for `extensions` in `Cache.writeQuery`, `Cache.write` and `Cache.update` so other cache implementations also can correctly access them.
