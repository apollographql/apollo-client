---
"@apollo/client": major
---

The `concat`, `from`, and `split` functions on `ApollLink` no longer support a plain request handler function. Please wrap the request handler with `new ApolloLink`.

```diff
const link = new ApolloLink(/* ... */);

link.concat(
- (operation, forward) => forward(operation),
+ new ApolloLink((operation, forward) => forward(operation)),
);
```
