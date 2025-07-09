---
"@apollo/client": major
_tags:
  - links
---

`HttpLink` and `BatchHttpLink` no longer emit a `next` notification with the JSON-parsed response body when a well-formed GraphQL response is returned and a `ServerError` is thrown.
