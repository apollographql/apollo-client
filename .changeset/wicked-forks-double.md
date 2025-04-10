---
"@apollo/client": major
---

Remove `newData` option for mocked responses passed to `MockLink` or the `mocks` option on `MockedProvider`. This option was undocumented and was nearly identical to using the `result` option as a callback.

To replicate the old behavior of `newData`, use `result` as a callback and add the `maxUsageCount` option with a value set to `Number.POSITIVE_INFINITY`.

**with `MockLink`**
```diff
new MockLink([
  {
    request: { query, variables },
-   newData: (variables) => ({ data: { greeting: "Hello " + variables.greeting } }),
+   result: (variables) => ({ data: { greeting: "Hello " + variables.greeting } }),
+   maxUsageCount: Number.POSITIVE_INFINITY,
  }
])
```

**with `MockedProvider`**
```diff
<MockedProvider
  mocks={[
    {
      request: { query, variables },
-     newData: (variables) => ({ data: { greeting: "Hello " + variables.greeting } }),
+     result: (variables) => ({ data: { greeting: "Hello " + variables.greeting } }),
+     maxUsageCount: Number.POSITIVE_INFINITY,
    }
  ]}
/>
```
