---
"@apollo/client": major
---

`notifyOnNetworkStatusChange` now defaults to `true`. This means that loading states will be emitted (core API) or rendered (React) by default when calling `refetch`, `fetchMore`, etc. To maintain the old behavior, set `notifyOnNetworkStatusChange` to `false` in `defaultOptions`.

```ts
new ApolloClient({
  defaultOptions: {
    watchQuery: {
      // Use the v3 default
      notifyOnNetworkStatusChange: false
    }
  }
})
```
