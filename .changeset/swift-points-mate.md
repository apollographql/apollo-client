---
'@apollo/client': patch
---

Make `ApolloClient.writeQuery` and `ApolloClient.writeFragment` behave more like `cache.writeQuery` and `cache.writeFragment` by returning the reference returned by the cache.
