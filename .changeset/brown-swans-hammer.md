---
"@apollo/client": patch
---

Fix an issue where `useLazyQuery` did not rerender with new `variables` until the network request had completed when calling `execute` with new variables while a request was already in-flight.
