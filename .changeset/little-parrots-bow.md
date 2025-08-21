---
"@apollo/client": major
_tags:
  - removals
  - LocalState
  - ApolloClient
---

Removes the `resolvers` option from `ApolloClient`. Local resolvers have instead been moved to the new `LocalState` instance which is assigned to the `localState` option in `ApolloClient`. To migrate, move the `resolvers` values into a `LocalState` instance and assign that instance to `localState`.

```diff
new ApolloClient({
- resolvers: { /* ... */ }
+ localState: new LocalState({
+   resolvers: { /* ... */ }
+ }),
});
```
