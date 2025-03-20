---
"@apollo/client": major
---

`ObservableQuery.setOptions` has been removed as it was an alias of `reobserve`. Prefer using `reobserve` directly instead.

```diff
const observable = client.watchQuery(options);

// Use reobserve to set new options and reevaluate the query
- observable.setOptions(newOptions);
+ observable.reobserve(newOptions);
```

As a result of this change, `reobserve` has been marked for public use and is no longer considered an internal API. The `newNetworkStatus` argument has been removed to facilitate this change.
