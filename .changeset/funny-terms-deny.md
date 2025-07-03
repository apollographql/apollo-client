---
"@apollo/client": major
---

`ObservableQuery.variables` can now be reset back to empty when calling `reobserve` with `variables: undefined`. Previously the `variables` key would be ignored so `variables` would remain unchanged.
