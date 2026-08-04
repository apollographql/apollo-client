---
"@apollo/client": patch
---

Fix result types widened when a query's variables had constant types (e.g. `TypedDocumentNode<Data, { type: "main" }>`). This caused options such as `returnPartialData` or `errorPolicy` to be reported as their widened types (e.g. `boolean`, `ErrorPolicy`) instead of the value that was passed which returned the wrong `data` and `dataState` types.
