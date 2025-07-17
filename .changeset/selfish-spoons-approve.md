---
"@apollo/client": major
_tags:
  - removals
  - types
---

Move internal testing utilities in `@apollo/client/testing` to `@apollo/client/testing/internal` and remove deprecated testing utilities. Some of the testing utilities exported from the `@apollo/client/testing` endpoint were not considered stable. As a result of this change, testing utilities or types exported from `@apollo/client/testing` are now considered stable and will not undergo breaking changes.

The following APIs were removed. To migrate, update usages of the following APIs as such:

**`createMockClient`**

```diff
- const client = createMockClient(data, query, variables);
+ const client = new ApolloClient({
+   cache: new InMemoryCache(),
+   link: new MockLink([
+     {
+       request: { query, variables },
+       result: { data },
+     }
+   ]),
+ });
```

**`mockObservableLink`**

```diff
- const link = mockObservableLink();
+ const link = new MockSubscriptionLink();
```

**`mockSingleLink`**

```diff
- const link = mockSingleLink({
-   request: { query, variables },
-   result: { data },
- });
+ const link = new MockLink([
+   {
+     request: { query, variables },
+     result: { data },
+   }
+ ]);
```
