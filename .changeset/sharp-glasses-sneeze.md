---
"@apollo/client": major
---

The `ErrorResponse` object passed to the `disable` and `retry` callback options provided to `createPersistedQueryLink` no longer provides separate `graphQLErrors` and `networkError` properties and instead have been combined to a single `error` property of type `ErrorLike`.


```diff
// The following also applies to the retry function since it has the same signature
createPersistedQueryLink({
  disable: (errorResponse) => {
-   if (errorResponse.graphQLErrors) {
+   if (CombinedGraphQLErrors.is(errorResponse.error)) {
      // ... handle GraphQL errors
    }

-   if (errorResponse.networkError) {
+   if (errorResponse.error) {
      // ... handle a NetworkError errors
    }
  }
});
```

The `response` property has also been removed. To access partial data returned in GraphQL responses, access the `data` property on the `CombinedGraphQLErrors` instance.

```diff
createPersistedQueryLink({
  disable: (errorResponse) => {
-   if (errorResponse.response) {
-     const data = errorResponse.response.data;
+   if (CombinedGraphQLErrors.is(errorResponse.error)) {
+     const data = errorResponse.error.data;

      // ... handle GraphQL errors
    }
  }
});
```
