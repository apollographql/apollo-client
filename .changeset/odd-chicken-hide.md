---
"@apollo/client": minor
---

Add the ability to detect if an error was an error was emitted from the link chain. This is useful if your application throws custom errors in other areas of the application and you'd like to differentiate them from errors emitted by the link chain itself.

To detect if an error was emitted from the link chain, use `LinkError.is`.

```ts
import { LinkError } from "@apollo/client";

client.query({ query }).catch((error) => {
  if (LinkError.is(error)) {
    // This error originated from the link chain
  }
});
```
