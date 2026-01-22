---
"@apollo/client": patch
---

Fix `createFetchMultipartSubscription` to support cancellation via `AbortController`

Previously, calling `dispose()` or `unsubscribe()` on a subscription created by `createFetchMultipartSubscription` had no effect - the underlying fetch request would continue running until completion. This was because no `AbortController` was created or passed to `fetch()`, and no cleanup function was returned from the Observable.

This fix:
- Creates an `AbortController` when the subscription starts
- Passes the `signal` to the fetch request
- Returns a cleanup function that calls `controller.abort()` when the subscription is disposed
- Filters out `AbortError` from the error handler to prevent spurious error callbacks on intentional cancellation

This follows the same pattern already used in `BaseHttpLink`.
