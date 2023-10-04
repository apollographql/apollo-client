---
"@apollo/client": patch
---

Fixes a race condition in asyncMap that caused issues in React Native when errors were returned in the response payload along with a data property that was null.
