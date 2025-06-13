---
"@apollo/client": patch
---

Fixed a bug in `PersistedQueryLink` where the `persistedQuery` extension would still be sent after a `PersistedQueryNotSupported` if `includeExtensions` was enabled on `HttpLink`.
