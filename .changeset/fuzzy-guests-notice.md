---
"@apollo/client": patch
---

Expose `source` in `nextFetchPolicy` callbacks.

This allows `nextFetchPolicy` function to adjust their behavior based on what source (`useQuery`, `useLazyQuery`, etc.) is triggering the fetch policy change.
This can be useful in `defaultOptions` where you want different `nextFetchPolicy` logic depending on how the query was initiated.

E.g. this change would restore the Apollo Client 3.0 behavior where `useLazyQuery`'s `nextFetchPolicy` would be reset to `initialFetchPolicy` with every variable change:

```ts
new ApolloClient({
  // ...
  defaultOptions: {
    watchQuery: {
      nextFetchPolicy: (current, { reason, initialFetchPolicy, source }) => {
        if (reason === "variables-changed" && source === "useLazyQuery") {
          return initialFetchPolicy;
        }
        return current;
      },
    },
  },
});
```

Possible values for `source` are:
```ts
  export type Source =
    | "unknown"
    | "ApolloClient.watchQuery"
    | "ApolloClient.getObservableQueries"
    | "useQuery"
    | "useLazyQuery";
```
