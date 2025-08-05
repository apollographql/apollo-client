---
"@apollo/client": major
---

The `serializeFetchParameter` helper is no longer exported and `JSON.stringify` is used directly. As such, the `ClientParseError` type has also been removed in favor of throwing any JSON serialize errors directly.
