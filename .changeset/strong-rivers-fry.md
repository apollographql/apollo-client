---
"@apollo/client": major
---

The resolver function's `context` argument (the 3rd argument) has changed to provide additional information without the possibility of name clashes. Previously the `context` argument would spread request context and override the `client` and `cache` properties to give access to both inside of a resolver. The `context` argument takes now takes the following shape:

```ts
{
  // the request context
  requestContext: DefaultContext,
  // The client instance making the request
  client: ApolloClient,
  // Whether the resolver is run as a result of gathering exported variables
  // or resolving the value as part of the result
  phase: "exports" | "resolve"
}
```

To migrate, pull any request context from `context` and the `cache` from the `client` property:

```diff
new LocalState({
  resolvers: {
    Query: {
-     myResolver: (parent, args, { someValue, cache }) => {
+     myResolver: (parent, args, { context, client }) => {
+       const someValue = context.someValue;
+       const cache = client.cache;
      }
    }
  }
});
```
