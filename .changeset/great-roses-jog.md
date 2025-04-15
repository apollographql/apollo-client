---
"@apollo/client": patch
---

`client.watchQuery` now enforces a `variables` option if `TVariables` contains required variables. `ObservableQuery.variables` has been updated to return `TVariables` rather than `TVariables | undefined`. If there are no variables or a query contains all optional variables, `{}` will be returned when no `variables` have been defined.
