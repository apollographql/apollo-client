---
"@apollo/client": patch
---

Make `protocolErrors` from multipart subscriptions available to the error link with the `protocolErrors` property.

```js
const errorLink = onError(({ protocolErrors }) => {
  if (protocolErrors) {
    console.log(protocolErrors);
  }
});
```
