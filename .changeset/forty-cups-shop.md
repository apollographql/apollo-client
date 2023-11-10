---
"@apollo/client": patch
---

Fixes a potential memory leak (that was not triggered by ApolloClient until now) in `Concast`.
