---
"@apollo/client": major
---

If the `execute` function of `useLazyQuery` is executed, previously started queries
from the same `useLazyQuery` usage will be rejected with an `AbortError` unless
`.retain()` is called on the promise returned by previous `execute` calls.

Please keep in mind that `useLazyQuery` is primarily meant as a means to synchronize
your component to the status of a query and that it's purpose it not to make a
series of network calls.
If you plan on making a series of network calls without the need to synchronize
the result with your component, consider using `ApolloClient.query` instead.
