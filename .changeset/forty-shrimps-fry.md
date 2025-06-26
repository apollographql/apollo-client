---
"@apollo/client": major
_tags:
  - types
  - errors
  - client.subscribe
---

Subscriptions now emit a `SubscribeResult` instead of a `FetchResult`. As a result, the `errors` field has been removed in favor of `error`.
