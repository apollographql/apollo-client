---
"@apollo/client": major
---

`createOperation` no longer accepts `context` as the first argument. Instead make sure `context` is set as the `context` property on the request passed to `createOperation`.

```diff
createOperation(
- startingContext,
- { query },
+ { query, context: startingContext },
  { client }
);
```
