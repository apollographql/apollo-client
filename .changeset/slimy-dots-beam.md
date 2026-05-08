---
"@apollo/client": patch
---

Fix `refetchOn` merging when `defaultOptions.watchQuery.refetchOn` is set to a non-object value (`false`, `true`, or a function) and the per-query `refetchOn` is an object. Previously the per-query object completely replaced the default so unspecified events fell back to "enabled" regardless of the default.

The `defaultOptions` value now applies to any event the per-query object does not explicitly configure:

- `false` - unspecified events stay disabled
- `true` - unspecified events refetch
- Callback function - the function is called for unspecified events to determine whether to refetch

```ts
const client = new ApolloClient({
  // ...
  defaultOptions: {
    watchQuery: {
      refetchOn: false,
    },
  },
});

// Only `windowFocus` refetches. Other events stay disabled per the default.
useQuery(QUERY, { refetchOn: { windowFocus: true } });
```
