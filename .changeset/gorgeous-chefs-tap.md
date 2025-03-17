---
"@apollo/client": major
---

Remove the `TCacheShape` generic argument to `ApolloClient`. `client.extract()` now returns `unknown` by default. You will either need to type-cast this to the expected serialized shape, or use the `cache.extract()` directly from the subclass to get more specific types.
