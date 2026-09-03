# @apollo/client-graphql-codegen

## 2.2.0-rc.1

### Minor Changes

- [#13447](https://github.com/apollographql/apollo-client/pull/13447) [`24133fe`](https://github.com/apollographql/apollo-client/commit/24133fe429af460fcfe44d529375ebb063a29326) Thanks [@jerelmiller](https://github.com/jerelmiller)! - The `@apollo/client-graphql-codegen/custom-scalars` plugin now emits GraphQL list syntax in `inputObjects` and `scalarTypePolicies` (for example `"[DateTime]"`).

## 2.2.0-rc.0

### Minor Changes

- [#13426](https://github.com/apollographql/apollo-client/pull/13426) [`a9beaff`](https://github.com/apollographql/apollo-client/commit/a9beaff117e6eae791b078e22ecdfc93b82ded8f) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Version bump only to `rc`.

## 2.2.0-alpha.0

### Minor Changes

- [#13310](https://github.com/apollographql/apollo-client/pull/13310) [`8ab63fc`](https://github.com/apollographql/apollo-client/commit/8ab63fc4bbf9f2c5b5f225ba2c54c2a255f0632e) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Introduce a new GraphQL Codegen plugin to generate the input object configuration needed to configure custom scalars for each field.

  ```ts
  // codegen.ts
  import type { CustomScalarsPluginConfig } from "@apollo/client-graphql-codegen/custom-scalars";

  const config: CodegenConfig = {
    // ...
    generates: {
      "./path/to/custom-scalars.ts": {
        plugins: ["@apollo/client-graphql-codegen/custom-scalars"],
        config: {
          // ...
        } satisfies CustomScalarsPluginConfig,
      },
    },
  };
  ```

  This will generate an `inputObjects` object in the generated file that can be used to configure the `inputObjects` option for `InMemoryCache`.

  ```ts
  import { inputObjects } from "./path/to/custom-scalars";

  const cache = new InMemoryCache({
    inputObjects,
  });
  ```

- [#13318](https://github.com/apollographql/apollo-client/pull/13318) [`01f255b`](https://github.com/apollographql/apollo-client/commit/01f255be684808c763664e84b4c2d5391ee807dd) Thanks [@jerelmiller](https://github.com/jerelmiller)! - The `@apollo/client-graphql-codegen/custom-scalars` GraphQL Codegen plugin now generates the type policy configuration needed to configure custom scalars for each field.

  ```ts
  // codegen.ts
  import type { CustomScalarsPluginConfig } from "@apollo/client-graphql-codegen/custom-scalars";

  const config: CodegenConfig = {
    // ...
    generates: {
      "./path/to/custom-scalars.ts": {
        plugins: ["@apollo/client-graphql-codegen/custom-scalars"],
        config: {
          // ...
        } satisfies CustomScalarsPluginConfig,
      },
    },
  };
  ```

  This will generate a `scalarTypePolicies` object in the generated file that can be used to configure type policies.

  ```ts
  import { scalarTypePolicies } from "./path/to/custom-scalars";

  const cache = new InMemoryCache();

  cache.policies.addTypePolicies(scalarTypePolicies);
  ```

## 2.1.1

### Patch Changes

- [#13308](https://github.com/apollographql/apollo-client/pull/13308) [`9e2c668`](https://github.com/apollographql/apollo-client/commit/9e2c6686563d47fa35b7ccc29c34556863a0bc61) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Fix accidentally omitted runtime files in latest minor.

## 2.1.0

### Minor Changes

- [#13301](https://github.com/apollographql/apollo-client/pull/13301) [`7e018e8`](https://github.com/apollographql/apollo-client/commit/7e018e8913c6d7443c0c088f8a082bb459fb3654) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Add support for latest GraphQL Codegen package major versions used in peer dependencies.

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
