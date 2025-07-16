---
"@apollo/client": minor
---

Subscriptions created by `client.subscribe()` can now be restarted. Restarting a subscription will terminate the connection with the link chain and recreate the request. Restarts also work across deduplicated subscriptions so calling `restart` on an `observable` who's request is deduplicated will restart the connection for each observable.

```ts
const observable = client.subscribe({ query: subscription });

// Restart the connection to the link
observable.restart();
```
