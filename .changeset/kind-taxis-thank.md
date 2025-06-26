---
"@apollo/client": patch
_tags:
  - LocalState
---

Don't warn about a missing resolver if a `@client` does not have a configured resolver. It is possible the cache contains a `read` function for the field and the warning added confusion.

Note that `read` functions without a defined resolver will receive the `existing` argument as `null` instead of `undefined` even when data hasn't been written to the cache. This is because `LocalState` sets a default value of `null` when a resolver is not defined to ensure that the field contains a value in case a `read` function is not defined rather than omitting the field entirely.
