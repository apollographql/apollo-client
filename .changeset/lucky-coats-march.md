---
"@apollo/client": patch
---

`MockedProvider`: default `connectToDevTools` to `false` in created `ApolloClient` instance.

This will prevent the mocked `ApolloClient` instance from trying to connect to the DevTools, which would start a `setTimeout` that might keep running after a test has finished.
