---
"@apollo/client": patch
---

Allow `RetryLink` to retry an operation when fatal [transport-level errors](https://www.apollographql.com/docs/graphos/routing/operations/subscriptions/multipart-protocol#message-and-error-format) are emitted from multipart subscriptions.

```js
const retryLink = new RetryLink({
  attempts: (count, operation, error) => {
    if (error instanceof ApolloError) {
      // errors available on the `protocolErrors` field in `ApolloError`
      console.log(error.protocolErrors)
    }

    return true;
  }
});
```
