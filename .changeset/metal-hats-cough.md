---
'@apollo/client': patch
---

Prefer the `onError` and `onCompleted` callback functions passed to the execute function returned from `useMutation` instead of calling both callback handlers.
