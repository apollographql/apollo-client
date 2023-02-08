---
"@apollo/client": patch
---

Update `SingleExecutionResult` and `IncrementalPayload`'s `data` types such that they no longer include `undefined`, which was not a valid runtime value, to fix errors when TypeScript's `exactOptionalPropertyTypes` is enabled.
