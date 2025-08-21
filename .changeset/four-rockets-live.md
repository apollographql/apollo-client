---
"@apollo/client": major
---

If you use an incremental delivery handler, you now have to explicitly opt into adding the chunk types to the `ApolloLink.Result` type.


```ts title="apollo-client.d.ts
import { Defer20220824Handler } from "@apollo/client/incremental";

declare module "@apollo/client" {
  export interface TypeOverrides extends Defer20220824Handler.TypeOverrides {}
}
```
