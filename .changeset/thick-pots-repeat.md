---
"@apollo/client": patch
---

Unregister the watch when an immediate `cache.watch` broadcast throws. Previously the watch was added to the cache before its first read, and a read that threw left the watch registered while the caller never received the unsubscribe function, so it could not be removed and every later broadcast ran into the same failing read.
