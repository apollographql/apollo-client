---
"@apollo/client": minor
---

Support the newer incremental delivery format for the `@defer` directive implemented in `graphql@17.0.0-alpha.9`. Import the `GraphQL17Alpha9Handler` to use the newer incremental delivery format with `@defer`.

```ts
import { GraphQL17Alpha9Handler } from "@apollo/client/incremental";

const client = new ApolloClient({
  // ...
  incrementalHandler: new GraphQL17Alpha9Handler(),
});
```

> [!NOTE]
> In order to use the `GraphQL17Alpha9Handler`, the GraphQL server MUST implement the newer incremental delivery format. You may see errors or unusual behavior if you use the wrong handler. If you are using Apollo Router, continue to use the `Defer20220824Handler` because Apollo Router does not yet support the newer incremental delivery format.
