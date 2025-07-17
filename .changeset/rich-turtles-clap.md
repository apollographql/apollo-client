---
"@apollo/client": major
_tags:
  - links
  - graphql_over_http
---

`HttpLink` and `BatchHttpLink` no longer emit a `next` notification with the JSON-parsed response body when a well-formed GraphQL response is returned and a `ServerError` is thrown.
