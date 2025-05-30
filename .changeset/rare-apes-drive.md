---
"@apollo/client": minor
---

Deduplicating subscription operations is now supported. Previously it was possible to deduplicate a subscription only if the new subscription was created before a previously subscribed subscription emitted any values. As soon as a value was emitted from a subscription, new subscriptions would create a new connection. Deduplication is now active for as long as a subscription connection is open (i.e. the source observable hasn't emitted a `complete` or `error` notification yet.).

To disable deduplication and force a new conneciton, use the `queryDeduplication` option in `context` like you would a query operation.
