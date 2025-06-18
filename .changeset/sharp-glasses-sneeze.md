---
"@apollo/client": major
---

The `ErrorResponse` object passed to the `disable` and `retry` callback options provided to `createPersistedQueryLink` no longer provides separate `graphQLErrors` and `networkError` properties and instead have been combined to a single `error` property of type `ErrorLike`.


```diff
// The following also applies to the `retry` function since it has the same signature
createPersistedQueryLink({
- disable: ({ graphQLErrors, networkError }) => {
+ disable: ({ error }) => {
-   if (graphQLErrors) {
+   if (CombinedGraphQLErrors.is(error)) {
      // ... handle GraphQL errors
    }

-   if (networkError) {
+   if (error) {
      // ... handle link errors
    }

    // optionally check for a specific kind of error
-   if (networkError) {
+   if (ServerError.is(error)) {
      // ... handle a server error
    }
});
```

The `response` property has also been renamed to `result`.

```diff
createPersistedQueryLink({
-  disable: ({ response }) => {
+  disable: ({ result }) => {

      // ... handle GraphQL errors
    }
  }
});
```
