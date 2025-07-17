---
"@apollo/client": patch
_tags:
  - links
  - bugfix
---

Fixed a bug in `PersistedQueryLink` where the `persistedQuery` extension would still be sent after a `PersistedQueryNotSupported` if `includeExtensions` was enabled on `HttpLink`.
