---
"@apollo/client": patch
---

Fix `createFetchMultipartSubscription` to support cancellation via `AbortController`

Previously, calling `dispose()` or `unsubscribe()` on a subscription created by `createFetchMultipartSubscription` had no effect - the underlying fetch request would continue running until completion. This was because no `AbortController` was created or passed to `fetch()`, and no cleanup function was returned from the Observable.
