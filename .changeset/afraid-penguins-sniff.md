---
"@apollo/client": major
_tags:
  - errors
  - graphql_over_http
---

Replace the `result` property on `ServerError` with `bodyText`. `bodyText` is set to the raw string body. `HttpLink` and `BatchHttpLink` no longer try and parse the response body as JSON when a `ServerError` is thrown.
