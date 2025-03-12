---
"@apollo/client": major
---

Updates the `ServerError` and `ServerParseError` types to be proper `Error` subclasses. Perviously these were plain `Error` intances with additional properties added at runtime. All properties are retained, but `instanceof` checks now work correctly.

```js
import { ServerError, ServerParseError } from '@apollo/client';

if (error instanceof ServerError) {
  // ...
}

if (error instanceof ServerParseError) {
  // ...
}
```
