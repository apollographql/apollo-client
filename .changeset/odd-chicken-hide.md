---
"@apollo/client": minor
---

Add the ability to detect if an error was a network error emitted from the link chain. This is useful if your application throws custom errors in other areas of the application and you'd like to differentiate them from errors emitted by the link chain itself.

To detect if an error was emitted from the link chain, use `NetworkError.is`.

```ts
import { NetworkError } from "@apollo/client";

client.query({ query }).catch((error) => {
  if (NetworkError.is(error)) {
    // This error originated from the link chain
  }
});
```
