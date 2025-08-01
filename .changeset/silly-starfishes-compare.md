---
"@apollo/client": minor
---

Many of the types exported from `@apollo/client/link` now live on the `ApolloLink` namespace. The old types are now deprecated in favor of the namespaced types.

- `FetchResult` -> `ApolloLink.Result`
- `GraphQLRequest` -> `ApolloLink.Request`
- `NextLink` -> `ApolloLink.ForwardFunction`
- `Operation` -> `ApolloLink.Operation`
- `RequestHandler` -> `ApolloLink.RequestHandler`
