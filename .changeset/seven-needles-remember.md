---
'@apollo/client': patch
---

[#10509](https://github.com/apollographql/apollo-client/pull/10509) introduced some helpers for determining the type of operation for a GraphQL query. This imported the `OperationTypeNode` from graphql-js which is not available in GraphQL 14. To maintain compatibility with graphql-js v14, this has been reverted to use plain strings.
