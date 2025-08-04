---
"@apollo/client": patch
---

`RetryLink` now emits a `next` event instead of an `error` event when encountering a protocol errors for multipart subscriptions when the operation is not retried. This ensures the observable notification remains the same as when `RetryLink` is not used.
