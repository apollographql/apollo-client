---
"@apollo/client": major
---

Subscriptions now emit a `SubscribeResult` instead of a `FetchResult`. As a result, the `errors` field has been removed in favor of `error`.
