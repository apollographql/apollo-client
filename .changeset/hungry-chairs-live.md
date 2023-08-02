---
'@apollo/client': minor
---

Add a new mechanism for Error Extraction to reduce bundle size by including
error message texts on an opt-in basis.
By default, errors will link to an error page with the entire error message.
This replaces "development" and "production" errors and works without
additional bundler configuration.
Bundling the text of error messages and development warnings can be enabled by
```js
import { loadErrorMessages, loadDevMessages } from "@apollo/client/dev";
if (process.env.NODE_ENV !== "production") {
  loadErrorMessages();
  loadDevMessages();
}
```
