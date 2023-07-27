---
"@apollo/client": patch
---

Fixes a bug in `useMutation` so that `onError` is called when an error is returned from the request with `errorPolicy` set to 'all' .
