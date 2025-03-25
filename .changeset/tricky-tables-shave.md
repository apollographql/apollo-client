---
"@apollo/client": major
---

GraphQL errors or network errors emitted while using an `errorPolicy` of `ignore` in subscriptions will no longer emit a result if there is no `data` emitted along with the error.
