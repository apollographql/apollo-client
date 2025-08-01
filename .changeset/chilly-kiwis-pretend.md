---
"@apollo/client": major
---

The `ApolloLink.Request` (i.e. `GraphQLRequest`) passed to `ApolloLink.execute` no longer accepts `operationName` and `operationType` options. These properties are derived from the `query` and set on the returned `ApolloLink.Operation` type.
