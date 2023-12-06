---
"@apollo/client": patch
---

InMemoryCache.gc now also triggers FragmentRegistry.resetCaches (if there is a FragmentRegistry)
