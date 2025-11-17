# @apollo/client-graphql-codegen

## 2.0.0

### Major Changes

- [#13014](https://github.com/apollographql/apollo-client/pull/13014) [`b9a1964`](https://github.com/apollographql/apollo-client/commit/b9a19647442842d1192a67bfded3bd8b27952832) Thanks [@phryneas](https://github.com/phryneas)! - bump upstream dependencies by major version

## 1.0.0

### Major Changes

- [#12617](https://github.com/apollographql/apollo-client/pull/12617) [`ea633a1`](https://github.com/apollographql/apollo-client/commit/ea633a110b7ffa138a33f68a0b41b0437aee61d8) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Introduce a new GraphQL Codegen plugin aimed at creating resolver types for `LocalState`. This plugin is similar to `@graphql-codegen/typescript-resolvers` but tailored to provide types that work with `LocalState`.

  To use the plugin, install `@apollo/client-graphql-codegen` and add the following to your codegen config:

  ```ts
  // codegen.ts

  const config: CodegenConfig = {
    // ...
    generates: {
      "./path/to/local/resolvers.ts": {
        schema: ["./path/to/localSchema.graphql"],
        plugins: ["typescript", "@apollo/client-graphql-codegen/local-state"],
        // ...
      },
    },
  };
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
        } satisfies LocalStatePluginConfig,
      },
    },
  };
  ```

  NOTE: It is recommended that the schema file passed to the `schema` option is your local schema, not your entire app schema in order to only generate resolver types for your local fields, otherwise the plugin will generate resolver types for your entire remote schema as well.

- [#12723](https://github.com/apollographql/apollo-client/pull/12723) [`1f9ed72`](https://github.com/apollographql/apollo-client/commit/1f9ed7200a249676e3efec6b61814376f47ce596) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Version bump only for codegen to release as `rc`.

## 1.0.0-rc.0

### Major Changes

- [#12723](https://github.com/apollographql/apollo-client/pull/12723) [`1f9ed72`](https://github.com/apollographql/apollo-client/commit/1f9ed7200a249676e3efec6b61814376f47ce596) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Version bump only for codegen to release as `rc`.

## 1.0.0-alpha.0

### Major Changes

- [#12617](https://github.com/apollographql/apollo-client/pull/12617) [`ea633a1`](https://github.com/apollographql/apollo-client/commit/ea633a110b7ffa138a33f68a0b41b0437aee61d8) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Introduce a new GraphQL Codegen plugin aimed at creating resolver types for `LocalState`. This plugin is similar to `@graphql-codegen/typescript-resolvers` but tailored to provide types that work with `LocalState`.

  To use the plugin, install `@apollo/client-graphql-codegen` and add the following to your codegen config:

  ```ts
  // codegen.ts

  const config: CodegenConfig = {
    // ...
    generates: {
      "./path/to/local/resolvers.ts": {
        schema: ["./path/to/localSchema.graphql"],
        plugins: ["typescript", "@apollo/client-graphql-codegen/local-state"],
        // ...
      },
    },
  };
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
        } satisfies LocalStatePluginConfig,
      },
    },
  };
  ```

  NOTE: It is recommended that the schema file passed to the `schema` option is your local schema, not your entire app schema in order to only generate resolver types for your local fields, otherwise the plugin will generate resolver types for your entire remote schema as well.
