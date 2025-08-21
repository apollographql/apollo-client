---
"@apollo/client": minor
_tags:
  - subscriptions
  - features
---

Deduplicating subscription operations is now supported. Previously it was possible to deduplicate a subscription only if the new subscription was created before a previously subscribed subscription emitted any values. As soon as a value was emitted from a subscription, new subscriptions would create new connections. Deduplication is now active for as long as a subscription connection is open (i.e. the source observable hasn't emitted a `complete` or `error` notification yet.)

To disable deduplication and force a new connection, use the `queryDeduplication` option in `context` like you would a query operation.

As a result of this change, calling the `restart` function returned from `useSubscription` will now restart the connection on deduplicated subscriptions.
