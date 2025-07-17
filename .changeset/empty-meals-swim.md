---
"@apollo/client": major
_tags:
  - ApolloClient
---

The `ApolloClient` constructor options `name` and `version` that are used to
configure the client awareness feature have moved onto a `clientAwareness` key.

```diff
const client = new ApolloClient({
  // ..
-  name: "my-app",
-  version: "1.0.0",
+  clientAwareness: {
+    name: "my-app",
+    version: "1.0.0",
+  },
});
```
