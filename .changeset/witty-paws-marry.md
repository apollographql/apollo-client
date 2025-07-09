---
"@apollo/client": major
_tags:
  - ApolloClient
  - removals
---

Require the `link` option when instantiating `ApolloClient`. This removes the `uri`, `credentials` and `headers` options from `ApolloClient` in favor of passing an instantiated `HttpLink` directly. To migrate:

**If using `uri`, `credentials`, or `headers` options**
```diff
new ApolloClient({
  // ...
- uri,
- credentials,
- headers,
+ link: new HttpLink({ uri, credentials, headers }),
// or if you prefer the function call approach:
+ link: createHttpLink({ uri, credentials, headers }),
});
```

**If creating a client without the `link` option**
```diff
new ApolloClient({
  // ...
+ link: ApolloLink.empty()
});
```
