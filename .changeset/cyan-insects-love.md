---
'@apollo/client': patch
---

Automatically strips `__typename` fields from `variables` sent to the server when using [`HttpLink`](https://www.apollographql.com/docs/react/api/link/apollo-link-http), [`BatchHttpLink`](https://www.apollographql.com/docs/react/api/link/apollo-link-batch-http), or [`GraphQLWsLink`](https://www.apollographql.com/docs/react/api/link/apollo-link-subscriptions). This allows GraphQL data returned from a query to be used as an argument to a subsequent GraphQL operation without the need to strip the `__typename` in user-space.
