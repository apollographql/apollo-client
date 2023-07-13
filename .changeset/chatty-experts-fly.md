---
'@apollo/client': patch
---

Add `SuspenseCache` as a lazy hidden property on ApolloClient.
This means that `SuspenseCache` is now an implementation details of Apollo Client
and you no longer need to manually instantiate it and no longer need to pass it
into `ApolloProvider`.
Trying to instantiate a `SuspenseCache` instance in your code will now throw an 
error.

Migration:
```diff
-import { SuspenseCache } from '@apollo/client';

-const suspenseCache = new SuspenseCache();

-<ApolloProvider client={client} suspenseCache={suspenseCache} />;
+<ApolloProvider client={client} />;
```