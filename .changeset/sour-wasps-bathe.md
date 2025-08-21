---
"@apollo/client-codemod-migrate-3-to-4": patch
---

adjust the `clientSetup` codemod so that it removes the `TCacheShape` type argument from all `ApolloClient` usages (types and constructor calls).
