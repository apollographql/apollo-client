---
"@apollo/client": minor
---

Extend the `defaultOptions` type-safety work to `preloadQuery` (returned from `createQueryPreloader`). Defaults declared in `DeclareDefaultOptions.WatchQuery` now flow through to the returned `PreloadedQueryRef`'s data states.

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
