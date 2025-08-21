---
"@apollo/client": major
---

`operation.operationName` is now set as `string | undefined` where `undefined` represents an anonymous query. Previously `operationName` would return an empty string as the `operationName` for anonymous queries.
