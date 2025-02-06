---
"@apollo/client": minor
---

Provide a more type-safe option for `observableQuery.updateQuery` which types the value of previous data incorrectly which could result in crashes at runtime. The `updateQuery` callback function is now called with a new type-safe `previousData` property and a `complete` property in the 2nd argument that determines whether `previousData` is a complete or partial result.

As a result of this change, it is recommended to use the `previousData` property passed to the 2nd argument of the callback rather than using the previous data value from the first argument since that value is not type-safe. The first argument is now deprecated and will be removed in a future version of Apollo Client.

```ts
observableQuery.updateQuery((unsafePreviousData, { previousData, complete }) => {
  previousData
  // ^? TData | DeepPartial<TData> | undefined

  if (complete) {
    previousData
    // ^? TData
  } else {
    previousData
    // ^? DeepPartial<TData> | undefined
  }
})
```
