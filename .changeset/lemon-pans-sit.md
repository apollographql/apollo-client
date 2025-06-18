---
"@apollo/client": major
---

`cache-only` queries are now excluded from `client.refetchQueries` when using `include: 'all'`, `include: 'active'`, or a `cache-only` query is listed in `include`. `cache-only` queries affected by `updateCache` are also excluded from `refetchQueries` when `onQueryUpdated` is not provided.
