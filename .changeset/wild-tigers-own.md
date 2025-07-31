---
"@apollo/client": major
---

The `forward` function passed to the request handler is now always provided to `request` and no longer optional. If you create custom links by subclassing `ApolloLink`, the `forward` function no longer needs to be optional:

```ts
class CustomLink extends ApolloLink {
  request(
    operation: ApolloLink.Operation,
    // This no longer needs to be typed as optional
    forward: ApolloLink.ForwardFunction
  ) {
    // ...
  }
}
```

As a result of this change, `ApolloLink` no longer detects terminating links by checking function arity on the request handler. This means using methods such as `concat` on a terminating link no longer emit a warning. On the flip side, if the terminating link calls the `forward` function, a warning is emitted and an observable that immediately completes is returned which will result in an error from Apollo Client.
