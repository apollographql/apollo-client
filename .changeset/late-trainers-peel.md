---
"@apollo/client": patch
---

* dropped the deprecated `DEV` export from `@apollo/client/utilities` and `@apollo/client/utilities/globals`
* moved the `__DEV__` export from `@apollo/client/utilities/globals` to `@apollo/client/utilities/environment`
* moved the `invariant`, `newInvariantError` and `InvariantError` exports from `@apollo/client/utilities/globals` to `@apollo/client/utilities/invariant`
