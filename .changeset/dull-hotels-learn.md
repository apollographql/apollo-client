---
"@apollo/client": patch
---

Fix the deprecation for the classic signatures for function overloads that rely on type inference from a `TypedDocumentNode`. The deprecation now only applies to classic signatures that provide explicit type arguments to encourage the use of `TypedDocumentNode`.
