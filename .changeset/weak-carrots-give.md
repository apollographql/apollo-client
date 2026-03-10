---
"@apollo/client": minor
---

Synchronize method and hook return types with `defaultOptions`.

Prior to this change, the following code snippet would always apply:

```ts
declare const MY_QUERY: TypedDocumentNode<TData, TVariables>;
const result1 = useSuspenseQuery(MY_QUERY);
result1.data;
//      ^? TData
const result2 = useSuspenseQuery(MY_QUERY, { errorPolicy: "all" });
result2.data;
//      ^? TData | undefined
```

While this was generally correct, if you were to register `errorPolicy: 'all'` as a default option for `MY_QUERY`, the type of `result.data` in the first case would still be `TData`, which is not correct - in reality it could also be `undefined`.

Now, with this change, we are now enforcing that certain `defaultOptions` need to be registered globally on a type level.
This means that if you want to use `errorPolicy: 'all'` as a default option for a query, you will need to register it globally like this:

```ts
// apollo.d.ts
import type {} from "@apollo/client";
declare module "@apollo/client" {
  namespace ApolloClient {
    namespace DeclareDefaultOptions {
      interface WatchQuery {
        // possible global-registered values:
        // * `errorPolicy`
        // * `returnPartialData`
        errorPolicy: "all";
      }
      interface Query {
        // possible global-registered values:
        // * `errorPolicy`
      }
      interface Mutate {
        // possible global-registered values:
        // * `errorPolicy`
      }
    }
  }
}
```

Once this is in place, the type of `result.data` in the first case will correctly be `TData | undefined`, reflecting the fact that if an error occurs, `data` will be `undefined`.
If you were to manually call `useSuspenseQuery(MY_QUERY, { errorPolicy: 'none' });`, it would become `TData` again.

This change means that you are now forced to register these default options globally, or TypeScript will error out.

Without this global registration, the following (previously valid) code will now error:

```ts
new ApolloClient({
  link: ApolloLink.empty(),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      // results in a type error:
      // Type '"all"' is not assignable to type '"A default option for watchQuery.errorPolicy must be declared in ApolloClient.DeclareDefaultOptions before usage. See https://www.apollographql.com/docs/react/data/typescript#declaring-default-options-for-type-safety."'.
      errorPolicy: "all",
    },
  },
});
```

If you are creating multiple instances of Apollo Client with conflicting default options and you cannot register a single `defaultOptions` value as a result, you can opt out of this change by declaring those options as optional union types covering all values you use:

```ts
// apollo.d.ts
import type {} from "@apollo/client";
declare module "@apollo/client" {
  export namespace ApolloClient {
    export namespace DeclareDefaultOptions {
      interface WatchQuery {
        errorPolicy?: "none" | "all" | "ignore";
        returnPartialData?: boolean;
      }
      interface Query {
        errorPolicy?: "none" | "all" | "ignore";
      }
      interface Mutate {
        errorPolicy?: "none" | "all" | "ignore";
      }
    }
  }
}
```

With this declaration, the `ApolloClient` constructor accepts any of those values in `defaultOptions`, and the `defaultOptions` object becomes optional entirely. The tradeoff is that hook and method return types become more generic—for example, calling `useSuspenseQuery` without an explicit `errorPolicy` will return a result typed as if all error policies are possible, since TypeScript can't know which specific value your instance uses at runtime.
