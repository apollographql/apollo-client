---
"@apollo/client": major
_tags:
  - ObservableQuery
---

`cache-only` queries are no longer refetched when calling `client.reFetchObservableQueries` when `includeStandby` is `true`.
