---
"@apollo/client": patch
---

`parse` function: improve memory management
* use LRU `WeakCache` instead of `Map` to keep a limited number of parsed results
* cache is initiated lazily, only when needed
* expose `parse.resetCache()` method
