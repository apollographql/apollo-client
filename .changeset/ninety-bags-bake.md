---
"@apollo/client": major
---

Mocked responses passed to `MockLink` now accept a callback for the `request.variables` option. This is used to determine if the mock should be matched for a set of request variables. With this change, the `variableMatcher` option has been removed in favor of passing a callback to `variables`. Update by moving the callback function from `variableMatcher` to `request.variables`.

```diff
new MockLink([
  {
    request: {
      query,
+     variables: (requestVariables) => true
    },
-   variableMatcher: (requestVariables) => true
  }
]);
```
