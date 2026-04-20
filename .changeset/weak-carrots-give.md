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

While these types are generally correct, if you were to set `errorPolicy: 'all'` as a default option, the type of `result.data` for the first query would remain `TData` instead of changing to `TData | undefined` to match the runtime behavior.

We are now enforcing that certain `defaultOptions` types need to be registered globally. This means that if you want to use `errorPolicy: 'all'` as a default option for a query, you will need to register its type like this:

```ts
// apollo.d.ts
import "@apollo/client";

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

Once this type declaration is in place, the type of `result.data` in the above example will correctly be changed to `TData | undefined`, reflecting the possibility that if an error occurs, `data` might be `undefined`. Manually specifying `useSuspenseQuery(MY_QUERY, { errorPolicy: "none" });` changes `result.data` to `TData` to reflect the local override.

This change means that you will need to declare your default options types in order to use `defaultOptions` with `ApolloClient`, otherwise you will see a TypeScript error.

Without the type declaration, the following (previously valid) code will now error:

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

If you are creating multiple instances of Apollo Client with conflicting default options and you cannot register a single `defaultOptions` value as a result, you can relax the constraints by declaring those options as union types covering all values used by all clients. The properties can be required (to enforce them in `defaultOptions`) or optional (if some constructor calls won't pass a value):

```ts
// apollo.d.ts
import "@apollo/client";

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

With this declaration, the `ApolloClient` constructor accepts any of those values in `defaultOptions`. The tradeoff is that hook and method return types become more generic. For example, calling `useSuspenseQuery` without an explicit `errorPolicy` will return a result typed as if all error policies are possible, since TypeScript can't know which specific value your instance uses at runtime.

Note that making a property optional (`errorPolicy?:`) is equivalent to adding the TypeScript default value (`"none"`) to the union. So `errorPolicy?: "all" | "ignore"` has the same effect on return types as `errorPolicy: "none" | "all" | "ignore"`, because TypeScript assumes the option could also be absent (i.e., `"none"`).

You can also use a **partial union** that only lists the values you actually use. For example, if you only ever use `"all"` or `"ignore"`, declare `errorPolicy: "all" | "ignore"` (required) to keep the union narrow and avoid unused values broadening your signatures unnecessarily.
