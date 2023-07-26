---
"@apollo/client": patch
---

Fixes a bug in `useMutation` so that `onError` is called when `errorPolicy` is set to 'all'
