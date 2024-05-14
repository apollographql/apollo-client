---
"@apollo/client": patch
---

Fix a regression in [3.9.5](https://github.com/apollographql/apollo-client/releases/tag/v3.9.5) where a merge function that returned an incomplete result would not allow the client to refetch in order to fulfill the query.
