---
"@apollo/client": minor
---

Add the ability to specify a name for the client instance for use with Apollo Client Devtools. This is useful when instantiating multiple clients to identify the client instance more easily. This deprecates the `connectToDevtools` option in favor of a new `devtools` configuration.

```ts
new ApolloClient({
  devtools: {
    enabled: true,
    name: "Test Client",
  },
});
```

This option is backwards-compatible with `connectToDevtools` and will be used in the absense of a `devtools` option.
