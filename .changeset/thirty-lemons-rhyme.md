---
"@apollo/client": minor
_tags:
  - links
---

Add `operationType` to `operation` in `ApolloLink`. This means that determining whether a `query` is a specific operation type can now be compared with this property instead of using `getMainDefinition`.

```diff
- import { getMainDefinition } from "@apollo/client/utilities";
+ import { OperationTypeNode } from "graphql";

ApolloLink.split(
- ({ query }) => {
-   const definition = getMainDefinition(query);
-   return (
-     definition.kind === 'OperationDefinition' &&
-     definition.operation === 'subscription'
-   );
-   return
- },
+ ({ operationType }) => {
+   return operationType === OperationTypeNode.SUBSCRIPTION;
+ },
  conditionTrueLink,
  conditionFalseLink,
);
```
