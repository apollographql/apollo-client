---
'@apollo/client': minor
---

(Batch)HttpLink: Previously, these links would swallow all `AbortErrors`, causing queries and mutations to potentially never resolve.
As `AbortError`s caused by an internally used `AbortSignal` would never propagate in the first place, and `AbortError`s caused by user-provided `AbortSignal` instances should not cause a "hanging" result, this behaviour has been removed and those queries/mutations will instead error as a consequence.