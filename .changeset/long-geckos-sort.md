---
"@apollo/client": minor
---

Introduce `LocalResolversLink`. `LocalResolversLink` replaces the `resolvers` option passed to the `ApolloClient` constructor. `LocalResolversLink` handles `@client` fields.

`LocalResolversLink` fixes several issues from `resolvers`:
- Throwing errors in a resolver will set the field value as `null` and add an error to response's `errors` array.
- Remote results are dealiased before they are passed as the parent object to a resolver so that you can access fields by their schema name.
- You can now specify a `rootValue` which will be used as the `parent` value passed to any root resolvers. This can be a static value or a function that executes for each request.
- `LocalResolversLink` now accepts a `Resolvers` generic that provides autocompletion and type checking against your resolver types to ensure your resolvers are type-safe.
- `data: null` is now handled correctly when the server does not provide a result.
- Additional warnings have been added to provide hints when resolvers behave unexpectedly.

```ts
import { LocalResolversLink } from "@apollo/client/link/local-resolvers";

const localResolversLink = new LocalResolversLink({
  // rootValue can be of any type, not just an object
  rootValue: {
    // ...
  },
  resolvers: {
    // ...
  },
});
```
