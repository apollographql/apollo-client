---
"@apollo/client": major
---

Removes the `throwServerError` utility function. Now that `ServerError` is an
`Error` subclass, you can throw these errors directly:

```js
import { ServerError } from '@apollo/client';

// instead of
throwServerError(response, result, 'error message')

// Use
throw new ServerError('error message', { response, result })
```
