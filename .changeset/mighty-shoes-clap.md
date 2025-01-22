---
"@apollo/client": patch
---

Fix the array type for the `errors` field on the `ApolloPayloadResult` type. This type was always in the shape of the GraphQL error format, per the [multipart subscriptions protocol](https://www.apollographql.com/docs/graphos/routing/operations/subscriptions/multipart-protocol#message-and-error-format) and never a plain string or a JavaScript error object.
