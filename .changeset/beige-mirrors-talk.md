---
"@apollo/client": major
---

`onError` link now uses a single `error` property to report the error that caused the link callback to be called. This will be an instance of `CombinedGraphQLErrors` in the event GraphQL errors were emitted from the terminating link, `CombinedProtocolErrors` if the terminating link emitted protocol errors, or the unwrapped error type if any other non-GraphQL error was thrown or emitted.

```diff
- const errorLink = onError(({ graphQLErrors, networkError, protocolErrors }) => {
-   graphQLErrors.forEach(error => console.log(error.message));
+ const errorLink = onError(({ error }) => {
+   if (error.name === 'CombinedGraphQLErrors') {
+     error.errors.forEach(rawError => console.log(rawError.message));
+   }
});
```
