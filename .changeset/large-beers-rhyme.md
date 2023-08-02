---
'@apollo/client': patch
---

Use `import * as React` everywhere. This prevents an error when importing `@apollo/client` in a React Server component. (see [#10974](https://github.com/apollographql/apollo-client/issues/10974))
