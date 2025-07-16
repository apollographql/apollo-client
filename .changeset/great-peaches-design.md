---
"@apollo/client": major
---

Apply document transforms before reading data from the cache for `client.readQuery`, `client.readFragment`, `client.watchFragment`, `useFragment`, and `useSuspenseFragment`.

NOTE: This change does not affect the equivalent `cache.*` APIs. To read data from the cache without first running document transforms, run `cache.readQuery`, `cache.readFragment`, etc.
