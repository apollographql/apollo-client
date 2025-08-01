---
"@apollo/client": major
---

The context object returned from `operation.getContext()` is now frozen to prevent mutable changes to the object which could result in subtle bugs. This applies to the `previousContext` object passed to the `operation.setContext()` callback as well.
