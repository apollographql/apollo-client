---
"@apollo/client": patch
---

Reduce the number of observables created by `watchFragment` by reusing existing observables as much as possible. This should improve performance when watching the same item in the cache multiple times after a cache update occurs.
