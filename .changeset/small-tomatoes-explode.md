---
'@apollo/client': minor
---

Allow `ApolloCache` implementations to specify default value for `assumeImmutableResults` client option, improving performance for applications currently using `InMemoryCache` without configuring `new ApolloClient({ assumeImmutableResults: true })`
