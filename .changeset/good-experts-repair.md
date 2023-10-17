---
"@apollo/client": patch
---

Add an explicit return type for the `useReadQuery` hook called `UseReadQueryResult`. Previously the return type of this hook was inferred from the return value.
