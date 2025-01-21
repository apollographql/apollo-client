---
"@apollo/client": patch
---

Remove the `string` type from the array union for the `errors` field on the `ApolloPayloadResult` type. Errors were never plain strings and always in the GraphQL error format.
