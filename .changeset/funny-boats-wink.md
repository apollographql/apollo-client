---
"@apollo/client": minor
---

Revamp local resolvers and fix several issues from the existing `resolvers` option.
- Throwing errors in a resolver will set the field value as `null` and add an error to the response's `errors` array.
- Remote results are dealiased before they are passed as the parent object to a resolver so that you can access fields by their field name.
- You can now specify a `context` function that you can use to customize the `requestContext` given to resolvers.
- The `LocalState` class accepts a `Resolvers` generic that provides autocompletion and type checking against your resolver types to ensure your resolvers are type-safe.
- `data: null` is now handled correctly and does not call your local resolvers when the server does not provide a result.
- Additional warnings have been added to provide hints when resolvers behave unexpectedly.

```ts
import { LocalState } from "@apollo/client/local-state";

import { Resolvers } from "./path/to/local-resolvers-types.ts";

// LocalState now accepts a `Resolvers` generic.
const localState = new LocalState<Resolvers>({
  // The return value of this funciton
  context: (options) => ({
    // ...
  }),
  resolvers: {
    // ...
  }
});

// You may also pass a `ContextValue` generic used to ensure the `context`
// function returns the correct type. This type is inferred from your resolvers
// if not provided.
new LocalState<Resolvers, ContextValue>({
  // ...
});
```
