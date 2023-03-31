---
'@apollo/client': patch
---

Changes the behavior of `useLazyQuery` introduced in [#10427](https://github.com/apollographql/apollo-client/pull/10427) where unmounting a component before a query was resolved would reject the promise with an abort error. Instead, the promise will now resolve naturally with the result from the request.

Other notable fixes:
- Kicking off multiple requests in parallel with the execution function will now ensure each returned promise is resolved with the data from its request. Previously, each promise was resolved with data from the last execution.
- Re-rendering `useLazyQuery` with a different query document will now ensure the execution function uses the updated query document. Previously, only the query document rendered the first time would be used for the request. 
