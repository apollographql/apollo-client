import type {
  AvoidOptionalsConfig,
  RawConfig,
} from "@graphql-codegen/visitor-plugin-common";

/**
 * This plugin generates TypeScript signature for `resolve` functions of your GraphQL API.
 * You can use this plugin to generate simple resolvers signature based on your GraphQL types, or you can change its behavior be providing custom model types (mappers).
 *
 * You can find a blog post explaining the usage of this plugin here: https://the-guild.dev/blog/better-type-safety-for-resolvers-with-graphql-codegen
 *
 */
export interface LocalStatePluginConfig extends RawConfig {
  /**
   * Path to base schema types used to import schema type definitions for
   * extended types in your local schema. This is required if your schema type
   * definitions defines an extended type (i.e. `extend type User {...}`).
   *
   * @example
   * ```ts
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file': {
   *        plugins: ['typescript', '@apollo/client/local-state/codegen'],
   *        config: {
   *          baseTypesPath: "./relative/path/to/schema/types"
   *        },
   *      },
   *    },
   *  };
   *  export default config;
   * ```
   */
  baseTypesPath?: string;

  /**
   * The import name for the base schema types.
   *
   * @defaultValue BaseSchemaTypes
   *
   * @example
   * ```ts
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file': {
   *        plugins: ['typescript', '@apollo/client/local-state/codegen'],
   *        config: {
   *          baseSchemaTypesImportName: "MyBaseSchemaTypes"
   *        },
   *      },
   *    },
   *  };
   *  export default config;
   * ```
   */
  baseSchemaTypesImportName?: string;

  /**
   * This will cause the generator to avoid using optionals (`?`),
   * so all field resolvers must be implemented in order to avoid compilation errors.
   * @defaultValue false
   *
   * @example
   * ## Override all definition types
   *
   * ```ts
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file': {
   *        plugins: ['typescript', '@apollo/client/local-state/codegen'],
   *        config: {
   *          avoidOptionals: true
   *        },
   *      },
   *    },
   *  };
   *  export default config;
   * ```
   *
   * ## Override only specific definition types
   *
   * ```ts filename="codegen.ts"
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file': {
   *        plugins: ['typescript', '@apollo/client/local-state/codegen'],
   *        config: {
   *          avoidOptionals: {
   *            field: true,
   *            inputValue: true,
   *            object: true,
   *            defaultValue: true,
   *            query: true,
   *            mutation: true,
   *            subscription: true,
   *          }
   *        },
   *      },
   *    },
   *  };
   *  export default config;
   * ```
   */
  avoidOptionals?: boolean | AvoidOptionalsConfig;

  /**
   * Adds `_` to generated `Args` types in order to avoid duplicate identifiers.
   *
   * @example
   * ```ts
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file': {
   *        // plugins...
   *        config: {
   *          addUnderscoreToArgsType: true
   *        },
   *      },
   *    },
   *  };
   *  export default config;
   * ```
   */
  addUnderscoreToArgsType?: boolean;
  /**
   * Use this configuration to set a custom type for the `rootValue`, and it will
   * affect resolvers of all root types (Query, Mutation and Subscription), without the need to override it using generics each time.
   * If you wish to use an external type and import it from another file, you can use `add` plugin
   * and add the required `import` statement, or you can use both `module#type` or `module#namespace#type` syntax.
   *
   * @example
   * ## Custom RootValue Type
   *
   * ```ts
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file': {
   *        // plugins...
   *        config: {
   *          rootValueType: 'MyRootValue'
   *        },
   *      },
   *    },
   *  };
   *  export default config;
   * ```
   *
   * ## Custom RootValue Type
   *
   * ```ts
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file': {
   *        // plugins...
   *        config: {
   *          rootValueType: './my-types#MyRootValue'
   *        },
   *      },
   *    },
   *  };
   *  export default config;
   * ```
   */
  rootValueType?: string;
  /**
   * Adds a suffix to the imported names to prevent name clashes.
   *
   * @example
   * ```ts
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file': {
   *        // plugins...
   *        config: {
   *          mapperTypeSuffix: 'Model'
   *        },
   *      },
   *    },
   *  };
   *  export default config;
   * ```
   */
  mapperTypeSuffix?: string;
  /**
   * Replaces a GraphQL type usage with a custom type, allowing you to return custom object from
   * your resolvers.
   * You can use both `module#type` and `module#namespace#type` syntax.
   *
   * @example
   * ## Custom Context Type
   *
   * ```ts
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file': {
   *        // plugins...
   *        config: {
   *          mappers: {
   *            User: './my-models#UserDbObject',
   *            Book: './my-models#Collections',
   *          }
   *        },
   *      },
   *    },
   *  };
   *  export default config;
   * ```
   */
  mappers?: {
    [typeName: string]: string;
  };
  /**
   * Allow you to set the default mapper when it's not being override by `mappers` or generics.
   * You can specify a type name, or specify a string in `module#type` or `module#namespace#type` format.
   * The default value of mappers is the TypeScript type generated by `typescript` package.
   *
   * @example
   * ## Replace with any
   *
   * ```ts
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file': {
   *        // plugins...
   *        config: {
   *          defaultMapper: 'any',
   *        },
   *      },
   *    },
   *  };
   *  export default config;
   * ```
   *
   * ## Custom Base Object
   *
   * ```ts
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file': {
   *        // plugins...
   *        config: {
   *          defaultMapper: './my-file#BaseObject',
   *        },
   *      },
   *    },
   *  };
   *  export default config;
   * ```
   *
   * ## Wrap default types with Partial
   *
   * You can also specify a custom wrapper for the original type, without overriding the original generated types, use `{T}` to specify the identifier. (for flow, use `$Shape<{T}>`)
   *
   * ```ts
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file': {
   *        // plugins...
   *        config: {
   *          defaultMapper: 'Partial<{T}>',
   *        },
   *      },
   *    },
   *  };
   *  export default config;
   * ```
   *
   * ## Allow deep partial with `utility-types`
   *
   * ```ts
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file': {
   *        plugins: ['typescript', '@apollo/client/local-state/codegen', { add: { content: "import { DeepPartial } from 'utility-types';" } }],
   *        config: {
   *          defaultMapper: 'DeepPartial<{T}>',
   *          avoidCheckingAbstractTypesRecursively: true // required if you have complex nested abstract types
   *        },
   *      },
   *    },
   *  };
   *  export default config;
   * ```
   */
  defaultMapper?: string;
  /**
   * Warns about unused mappers.
   *
   * @defaultValue true
   *
   * @example
   * ```ts
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file': {
   *        plugins: ['typescript', '@apollo/client/local-state/codegen'],
   *        config: {
   *          showUnusedMappers: true,
   *        },
   *      },
   *    },
   *  };
   *  export default config;
   * ```
   */
  showUnusedMappers?: boolean;
  /**
   * Generates immutable types by adding `readonly` to properties and uses `ReadonlyArray`.
   *
   * @defaultValue false
   */
  immutableTypes?: boolean;
  /**
   * Prefixes all GraphQL related generated types with that value, as namespaces import.
   * You can use this feature to allow separation of plugins to different files.
   *
   * @defaultValue ''
   */
  namespacedImportName?: string;
  /**
   * Suffix we add to each generated type resolver.
   *
   * @defaultValue Resolvers
   */
  resolverTypeSuffix?: string;
  /**
   * The type name to use when exporting all resolvers signature as unified type.
   *
   * @defaultValue Resolvers
   */
  allResolversTypeName?: string;
  /**
   * Allow you to override the `ParentType` generic in each resolver, by avoid enforcing the base type of the generated generic type.
   *
   * This will generate `ParentType = Type` instead of `ParentType extends Type = Type` in each resolver.
   *
   * @example
   * ```ts
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file.ts': {
   *        plugins: ['typescript', '@apollo/client/local-state/codegen'],
   *        config: {
   *          allowParentTypeOverride: true
   *        },
   *      },
   *    },
   *  };
   *  export default config;
   * ```
   *
   */
  allowParentTypeOverride?: boolean;
}
