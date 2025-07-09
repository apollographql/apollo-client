---
"@apollo/client": major
_tags:
  - removals
  - LocalState
  - ApolloClient
---

Apollo Client no longer ships with support for `@client` fields out-of-the-box and now must be opt-in. To opt in to use `@client` fields, pass an instantiated `LocalState` instance to the `localState` option. If a query contains `@client` and local state hasn't been configured, an error will be thrown.

```ts
import { LocalState } from "@apollo/client/local-state";

new ApolloClient({
  localState: new LocalState(),
});
```
