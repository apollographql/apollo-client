---
"@apollo/client": minor
---

Extend the `defaultOptions` type-safety work to `preloadQuery` (returned from `createQueryPreloader`). Defaults declared in `DeclareDefaultOptions.WatchQuery` now work with `preloadQuery` to ensure the `PreloadedQueryRef`'s data states are correctly set.

```ts
// apollo.d.ts
import "@apollo/client";

declare module "@apollo/client" {
  namespace ApolloClient {
    namespace DeclareDefaultOptions {
      interface WatchQuery {
        errorPolicy: "all";
      }
    }
  }
}
```

```ts
const preloadQuery = createQueryPreloader(client);
const queryRef = preloadQuery(QUERY);
//    ^? PreloadedQueryRef<TData, TVariables, "complete" | "streaming" | "empty">
```
