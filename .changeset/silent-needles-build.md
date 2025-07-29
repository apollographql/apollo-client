---
"@apollo/client": major
---

`transformOperation` and `validateOperation` have been removed and are no longer exported from `@apollo/client/link/utils`. These utilities have been merged into the implementation of `createOperation`. As a result, `createOperation` now returns a well-formed `Operation` object. Previously `createOperation` relied on an external call to `transformOperation` to provide a well-formed `Operation` type. If you use `createOperation` directly, remove the calls to `transformOperation` and `validateOperation` and pass the request directly. 
