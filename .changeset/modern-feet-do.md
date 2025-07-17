---
"@apollo/client": patch
_tags:
  - types
  - removals
---

`@apollo/client`, `@apollo/client/core` and `@apollo/client/cache` no longer export an empty `Cache` runtime object. This is meant to be a type-only namespace.
