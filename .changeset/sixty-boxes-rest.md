---
"@apollo/client": minor
---

`QueryManager.inFlightLinkObservables` now uses a strong `Trie` as an internal data structure.

#### Warning: requires `@apollo/experimental-nextjs-app-support` update
If you are using `@apollo/experimental-nextjs-app-support`, you will need to update that to at least 0.5.2, as it accesses this internal data structure.
