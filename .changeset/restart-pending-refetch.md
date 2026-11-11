---
"@apollo/client": patch
---

Restart pending initial queries when refetching before their first network result, including requests waiting for asynchronous local resolvers, so consumers sharing a deduplicated request receive fresh data.

Preserve pending query promises and the final Suspense result when concurrent refetches finish together. Clean up restarted shared requests during synchronous delivery, and propagate synchronous link errors to shared watchers so subsequent refetches can retry.
