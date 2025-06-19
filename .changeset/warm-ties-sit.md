---
"@apollo/client": major
---

Subscriptions no longer emit errors in the `error` callback and instead provide errors on the `error` property on the result passed to the `next` callback. As a result, errors will no longer automatically terminate the connection allowing additional results to be emitted when the connection stays open.

When an error terminates the downstream connection, a `next` event will be emitted with an `error` property followed by a `complete` event instead.
