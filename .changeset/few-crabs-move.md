---
"@apollo/client": major
_tags:
  - ObservableQuery
---

`ObservableQuery` will now keep previous `data` around when emitting a `loading` state, unless `query` or `variables` changed.
Note that `@exports` variables are not taken into account for this, so `data` will stay around even if they change.
