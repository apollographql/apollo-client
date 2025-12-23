---
"@apollo/client": minor
---

Add an `extensions` option to `cache.write`, `cache.writeQuery`, and `client.writeQuery`. This makes `extensions` available in cache `merge` functions which can be accessed with the other merge function options.

As a result of this change, any `extensions` returned in GraphQL operations are now available in `merge` in the cache writes for these operations.
