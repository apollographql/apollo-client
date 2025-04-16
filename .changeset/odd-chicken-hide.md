---
"@apollo/client": minor
---

Introduce a new `wrapErrorsWithNetworkError` link that can be used to wrap errors emitted in the link chain in a `NetworkError` instance. This is useful if your application throws custom errors in other areas of the application and you'd like to differentiate them from errors returned by the link chain.

It is recommended to add this link at the beginning of the link chain to ensure it wraps all errors from downstream links.

```ts
import { ApolloLink } from "@apollo/client/link/core";
import { wrapErrorsWithNetworkError } from "@apollo/client/link/network-error";
import { createHttpLink } from "@apollo/client/link/http";

const link = ApolloLink.from([
  // This will wrap all emitted errors in a `NetworkError` instance
  wrapErrorsWithNetworkError(),
  createHttpLink({ uri: "https://example.com/graphql" })
]);
```
