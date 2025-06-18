---
"@apollo/client": major
---

`cache-only` queries are now excluded from `client.refetchQueries` when using `include: 'all'` or `include: 'active'` since `cache-only` queries are no longer refetchable. `cache-only` queries affected by `updateCache` are also excluded from `refetchQueries` when `onQueryUpdated` is not provided.

Calling `client.refetchQueries` and including the `cache-only` query explicitly in `include` will throw.

