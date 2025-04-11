---
"@apollo/client": minor
---

`ObservableQuery` `variables` can now be reset back to `undefined` by calling `reobserve` with a `variables` key set to `undefined`:

```ts
observable.reobserve({ variables: undefined });
```

Previously this would leave `variables` unchanged and would require setting `variables` to an empty object.

Calling `reobserve({ variables: {} })` has the same effect as `undefined` and will reset `ObservableQuery.variables` back to `undefined`.
