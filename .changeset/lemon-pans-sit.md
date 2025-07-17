---
"@apollo/client": major
_tags:
  - ObservableQuery
  - client.refetchQueries
---

`cache-only` queries are now excluded from `client.refetchQueries` in all situations. `cache-only` queries affected by `updateCache` are also excluded from `refetchQueries` when `onQueryUpdated` is not provided.
