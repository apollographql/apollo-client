---
"@apollo/client": major
---

Remove `TSerialized` generic argument to `ApolloCache`. The `ApolloCache` base cache abstraction now returns `unknown` for `cache.extract` which can be overridden by a cache subclass.
