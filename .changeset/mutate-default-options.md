---
"@apollo/client": minor
---

Extend the `defaultOptions` type-safety work to `client.mutate` and `useMutation`.

The `errorPolicy` option now flows through to the result types for mutations in the same way it already does for queries:

- `ApolloClient.MutateResult<TData, TErrorPolicy>` maps `errorPolicy` to the concrete shape of `data` and `error`:
  - `"none"` → `{ data: TData; error?: never }`
  - `"all"` → `{ data: TData | undefined; error?: ErrorLike }`
  - `"ignore"` → `{ data: TData | undefined; error?: never }`
- `client.mutate` and `useMutation` pick up the declared `defaultOptions.mutate.errorPolicy` and the explicit `errorPolicy` on each call to narrow return types accordingly.
- `useMutation.Result.error` is narrowed to `undefined` when `errorPolicy` is `"ignore"`, since `client.mutate` never resolves with an error in that case.

`DeclareDefaultOptions.Mutate` already accepted `errorPolicy`; the new behavior is that once you declare it, hook and method return types reflect it:

```ts
// apollo.d.ts
import "@apollo/client";

declare module "@apollo/client" {
  namespace ApolloClient {
    namespace DeclareDefaultOptions {
      interface Mutate {
        errorPolicy: "all";
      }
    }
  }
}
```

```ts
const result = await client.mutate({ mutation: MUTATION });
result.data;
//     ^? TData | undefined
result.error;
//     ^? ErrorLike | undefined
```

Setting `errorPolicy` on an individual call overrides the default for that call's return type.
