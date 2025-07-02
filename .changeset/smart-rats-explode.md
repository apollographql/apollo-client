---
"@apollo/client": major
_tags:
  - removals
  - ObservableQuery
---

Remove `ObservableQuery.resetQueryStoreErrors` method. This method reset some internal state that was not consumed elsewhere in the client and resulted in a no-op.
