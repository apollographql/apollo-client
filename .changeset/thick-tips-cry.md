---
"@apollo/client": patch
---

Persisted Query Link: improve memory management
* use LRU `WeakCache` instead of `WeakMap` to keep a limited number of hash results
* hash cache is initiated lazily, only when needed
* expose `persistedLink.resetHashCache()` method
* reset hash cache if the upstream server reports it doesn't accept persisted queries
