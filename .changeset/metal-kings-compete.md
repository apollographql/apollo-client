---
"@apollo/client": patch
---

Deduplicate `maybeBroadcastWatch` calls in `InMemoryCache` by cache key to
improve duplicate watch scalability. Move watch callback in `QueryInfo` to
referentially consistent private static function and pass `Cache.WatchOption`'s
`watcher` property into it.
