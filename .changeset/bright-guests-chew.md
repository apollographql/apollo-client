---
"@apollo/client": patch
---

Fix the return type of the `updateQuery` function to allow for `undefined`. `updateQuery` had the ability to bail out of the update by returning a falsey value, but the return type enforced a query value.

```ts
observableQuery.updateQuery((unsafePreviousData, { previousData, complete }) => {
  if (!complete) {
    // Bail out of the update by returning early
    return;
  }

  // ...
});
```
