---
'@apollo/client': minor
---

(Batch)HttpLink: Previously, these links would swallow all `AbortErrors`, causing queries and mutations to potentially never resolve. Now, this will only apply for internal `AbortErrors` - and `AbortErrors` caused by a `signal` that is explicitly passed in will cause the error to be propagated, to be handled by the user.