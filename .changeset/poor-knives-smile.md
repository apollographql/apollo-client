---
"@apollo/client": minor
---

Add a `getCurrentResult` function to the observable returned by `client.watchFragment` and `cache.watchFragment` that returns the current value for the watched fragment.

```ts
const observable = client.watchFragment({
  fragment,
  from: { __typename: 'Item', id: 1 }
})

console.log(observable.getCurrentResult());
// {
//   data: {...},
//   dataState: "complete",
//   complete: true,
// }
```
