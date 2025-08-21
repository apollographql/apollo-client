---
"@apollo/client": major
_tags:
  - ignore
_superseded: "Error.is"
---

Removes the `isApolloError` utility function to check if the error object is an `ApolloError` instance. Use `instanceof` to check for more specific error types that replace `ApolloError`.
