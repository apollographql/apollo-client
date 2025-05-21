---
"@apollo/client": major
---

A call to `ObservableQuery.setVariables` with different variables or a `ObservableQuery.refetch` call will always now guarantee that a value will be emitted from the observable, even if it is deep equal to the previous value.
