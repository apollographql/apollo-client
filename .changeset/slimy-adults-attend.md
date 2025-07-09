---
"@apollo/client": patch

_tags:
  - defer
---

The incremental delivery (`@defer` support) implementation is now pluggable.

`ApolloClient` now per default ships without an incremental format implementation
and allows you to swap in the format that you want to use.

Usage looks like this:

```ts
import {
  // this is the default
  NotImplementedHandler,
  // this implements the `@defer` transport format that ships with Apollo Router
  Defer20220824Handler,
  // this implements the `@defer` transport format that ships with GraphQL 17.0.0-alpha.2
  GraphQL17Alpha2Handler,
} from "@apollo/client/incremental";

const client = new ApolloClient({
  cache: new InMemoryCache({ /*...*/ }),
  link: new HttpLink({ /*...*/ }),
  incrementalHandler: new Defer20220824Handler(),
});
```

We will add handlers for other response formats that can be swapped this way
during the lifetime of Apollo Client 4.0.
