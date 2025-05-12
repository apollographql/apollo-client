---
"@apollo/client": minor
---

Introduce a new GraphQL Codegen plugin aimed at creating resolver types for `LocalState`. This plugin is similar to `@graphql-codegen/typescript-resolvers` but tailored to provide types that work with `LocalState`.

To use the plugin, add the following to your codegen config:

```ts
// codegen.ts

const config: CodegenConfig = {
  // ...
  generates: {
    "./path/to/local/resolvers.ts": {
      schema: [
        "./path/to/localSchema.graphql",
      ],
      plugins: [
        "typescript",
        "@apollo/client/local-state/codegen",
      ],
      // ...
    }
  }
}
```

This will generate a `Resolvers` type in the generated file that can be used to provide type information to `LocalState`.

```ts
import type { Resolvers } from "./path/to/resolvers-types.ts";

const localState = new LocalState<Resolvers>({
  // ...
});
```

It is also recommended to add the following config:
```ts
// codegen.ts

const config: CodegenConfig = {
  // ...
  generates: {
    "./path/to/local/resolvers.ts": {
      config: {
        // Ensures you return a `__typename` for any `@client` fields that
        // return object or array types
        nonOptionalTypename: true,

        // If you use the `rootValue` option, provide the path to it here
        rootValueType: "./path/to/rootValue#RootValue",
      }
    }
  }
}
```
