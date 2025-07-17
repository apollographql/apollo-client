---
"@apollo/client": patch
_tags:
  - types
  - ObservableQuery
---

`ObservableQuery.variables` has been updated to return `TVariables` rather than `TVariables | undefined`. This is more consistent with the runtime value where an empty object (`{}`) will be returned when the `variables` option is not provided.
