---
"@apollo/client": minor
---

Add an abstract `resolvesClientField` function to `ApolloCache` that can be used by caches to tell `LocalState` if it can resolve a `@client` field when a local resolver is not defined.

`LocalState` will emit a warning and set a fallback value of `null` when no local resolver is defined and `resolvesClientField` returns `false`, or isn't defined. Returning `true` from `resolvesClientField` signals that a mechanism in the cache will set the field value. In this case, `LocalState` won't set the field value.
