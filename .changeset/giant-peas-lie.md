---
"@apollo/client": patch
---

Make fatal [tranport-level errors](https://www.apollographql.com/docs/graphos/routing/operations/subscriptions/multipart-protocol#message-and-error-format) from multipart subscriptions available to the error link with the `protocolErrors` property.

```js
const errorLink = onError(({ protocolErrors }) => {
  if (protocolErrors) {
    console.log(protocolErrors);
  }
});
```
