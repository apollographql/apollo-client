---
'@apollo/client': patch
---

Prevent `useFragment` from excessively unsubscribing and resubscribing the fragment with the cache on every render.
