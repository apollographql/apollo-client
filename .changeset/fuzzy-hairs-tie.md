---
"@apollo/client": minor
---

Add the ability to define the cache type for the client. `client.cache` currently returns `ApolloCache` as the cache type regardless of what cache you've provided to `ApolloClient`.

Declare the cache type using the `cache` property in the `TypeOverrides` interface to set the cache implementation used for the client.

```ts
// apollo.d.ts
import type { InMemoryCache } from "@apollo/client";

declare module "@apollo/client" {
  export interface TypeOverrides {
    cache: InMemoryCache;
  }
}
```

Now anywhere `cache` is accessible, the type is the declared cache type:

```ts
client.cache;
//     ^?InMemoryCache

client.mutate({
  update: (cache) => {
    //     ^?InMemoryCache
  },
});
```

> [!NOTE]
> Setting a cache type enforces that cache type in the `cache` option for
> the `ApolloClient` constructor.
