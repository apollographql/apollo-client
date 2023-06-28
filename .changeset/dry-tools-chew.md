---
'@apollo/client': patch
---

Make private fields `inFlightLinkObservables` and `fetchCancelFns` protected in QueryManager in order to make types available in [`@apollo/experimental-nextjs-app-support`](https://www.npmjs.com/package/@apollo/experimental-nextjs-app-support) package when extending the `ApolloClient` class.
