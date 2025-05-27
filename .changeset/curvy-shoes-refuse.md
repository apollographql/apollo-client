---
"@apollo/client": major
---

More strictly adhere to the [GraphQL over HTTP spec](https://graphql.github.io/graphql-over-http/draft/). This change adds support for the `application/graphql-response+json` media type and modifies the behavior of the `application/json` media type.

- The client will parse the response as a well-formed GraphQL response when the server encodes `content-type` using `application/graphql-response+json` with a non-200 status code.
- The client will now throw a `ServerError` when the server encodes `content-type` using `application/json` and returns a non-200 status code.
- The client will now throw a `ServerError` when the server encodes using any other `content-type` and returns a non-200 status code.
