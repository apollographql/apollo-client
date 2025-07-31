---
"@apollo/client": major
---

`operation.operationType` is now a non-null `OperationTypeNode`. It is now safe to compare this value without having to check for `undefined`.
