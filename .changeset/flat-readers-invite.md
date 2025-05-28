---
"@apollo/client-graphql-codegen": major
---

Introduce a new GraphQL Codegen plugin aimed at creating resolver types for `LocalState`. This plugin is similar to `@graphql-codegen/typescript-resolvers` but tailored to provide types that work with `LocalState`.

To use the plugin, install `@apollo/client-graphql-codegen` and add the following to your codegen config:

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
        "@apollo/client-graphql-codegen/local-state",
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
import type { LocalStatePluginConfig } from "@apollo/client-graphql-codegen/local-state";

const config: CodegenConfig = {
  // ...
  generates: {
    "./path/to/local/resolvers.ts": {
      config: {
        // Ensures you return a `__typename` for any `@client` fields that
        // return object or array types
        nonOptionalTypename: true,

        // Required if your localSchema extends existing schema types.
        baseTypesPath: "./relative/path/to/base/schema/types",

        // If you provide a `context` function to customize the context value,
        // provide the path or type here.
        contextType: "./path/to/contextValue#ContextValue",
      } satisfies LocalStatePluginConfig
    }
  }
}
```

NOTE: It is recommended that the schema file passed to the `schema` option is your local schema, not your entire app schema in order to only generate resolver types for your local fields, otherwise the plugin will generate resolver types for your entire remote schema as well.
