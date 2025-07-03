---
"@apollo/client": major
---

Subscriptions are no longer eagerly started after calling `client.subscribe`. To kick off the subscription, you will now need to subscribe to the returned observable.

```ts
// Subscriptions are no longer started when calling subscribe on its own.
const subscriptionObservable = client.subscribe(...);

// Instead, subscribe to the returned observable to kick off the subscription.
subscriptionObservable.subscribe({
  next: (value) => console.log(value)
});
```
