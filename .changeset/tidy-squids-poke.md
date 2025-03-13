---
"@apollo/client": major
---

Removes `ObservableQuery.result()` method. If you use this method and need similar functionality, create and resolve a promise with the first value emitted from the observable instead.

```ts
const result = await new Promise((resolve) => {
  const subscription = observableQuery.subscribe((value) => {
    resolve(value);
    subscription.unsubscribe();
  });
});
```
