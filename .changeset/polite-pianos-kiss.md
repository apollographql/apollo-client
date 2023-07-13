---
'@apollo/client': minor
---

(Batch)HttpLink: Propagate `AbortError`s to the user when a user-provided `signal` is passed to the link. Previously, these links would swallow all `AbortErrors`, potentially causing queries and mutations to never resolve. As a result of this change, users are now expected to handle `AbortError`s when passing in a user-provided `signal`.