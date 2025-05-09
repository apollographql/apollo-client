---
"@apollo/client": minor
---

Revamp local resolvers and fix several issues from the existing `resolvers` option.
- Throwing errors in a resolver will set the field value as `null` and add an error to the response's `errors` array.
- Remote results are dealiased before they are passed as the parent object to a resolver so that you can access fields by their field name.
- You can now specify a `rootValue` with `LocalState` which will be used as the `parent` value passed to root resolvers. This value can be any static value or a function that returns a root value which executes for each request.
- The `LocalState` class now accepts a `Resolvers` generic that provides autocompletion and type checking against your resolver types to ensure your resolvers are type-safe.
- `data: null` is now handled correctly when the server does not provide a result.
- Additional warnings have been added to provide hints when resolvers behave unexpectedly.

```ts
import { LocalState } from "@apollo/client/local-state";

import { Resolvers } from "./path/to/local-resolvers-types.ts";

// LocalState now accepts a `Resolvers` generic.
const localState = new LocalState<Resolvers>({
  // rootValue can be of any type, not just an object
  rootValue: {
    // ...
  },
  resolvers: {
    // ...
  }
});

// You may also pass a `RootValue` generic used to type-check the `rootValue` option.
// This type is inferred from your root resolvers parent type if not provided.
new LocalState<Resolvers, RootValue>({
  // ...
});
```
