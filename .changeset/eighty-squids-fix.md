---
"@apollo/client": major
---

Make `ObservableQuery.reobserve` a private API. As a result, `reobserve` has been removed from `useQuery` as well. Instead prefer to use `ObservableQuery.setOptions(newOptions)` to reevaluate the query against a new set of options.

`ObservableQuery.rerun` has been introduced to reevaluate the query against the current set of options. If you previously used `reobserve` with no arguments, use `rerun` instead.

```diff
const observable = client.watchQuery(options);

// Use setOptions to set new options and reevaluate the query
- observable.reobserve(newOptions);
+ observable.setOptions(newOptions);

// Use rerun to reevaluate the query against the current set of options
- observable.reobserve();
+ observable.rerun();
```
