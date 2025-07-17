---
"@apollo/client": major
_tags:
  - LocalState
---

The resolver function's `context` argument (the 3rd argument) has changed to provide additional information without the possibility of name clashes. Previously the `context` argument would spread request context and override the `client` and `cache` properties to give access to both inside of a resolver. The `context` argument takes now takes the following shape:

```ts
{
  // the request context. By default `TContextValue` is of type `DefaultContext`,
  // but can be changed if a `context` function is provided.
  requestContext: TContextValue,
  // The client instance making the request
  client: ApolloClient,
  // Whether the resolver is run as a result of gathering exported variables
  // or resolving the value as part of the result
  phase: "exports" | "resolve"
}
```

To migrate, pull any request context from `requestContext` and the `cache` from the `client` property:

```diff
new LocalState({
  resolvers: {
    Query: {
-     myResolver: (parent, args, { someValue, cache }) => {
+     myResolver: (parent, args, { requestContext, client }) => {
+       const someValue = requestContext.someValue;
+       const cache = client.cache;
      }
    }
  }
});
```
