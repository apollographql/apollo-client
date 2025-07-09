---
"@apollo/client": patch
_tags:
  - useQuery
  - bugfix
---

Ensure `useQuery` rerenders when `notifyOnNetworkStatusChange` is `false` and a `refetch` that changes variables returns a result deeply equal to previous variables.
