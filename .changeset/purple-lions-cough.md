---
"@apollo/client": major
_tags:
  - ObservableQuery
---

`ObservableQuery.setVariables` will now resolve with the last emitted result instead of `undefined` when either the variables match the current variables or there are no subscribers to the query.
