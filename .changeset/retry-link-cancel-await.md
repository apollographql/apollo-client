---
"@apollo/client": patch
---

Fix `RetryLink` scheduling a retry after the consumer has unsubscribed while an async `retryIf` was still pending.
