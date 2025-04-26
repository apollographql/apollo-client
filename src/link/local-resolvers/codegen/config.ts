import type {
  EnumValuesMap,
  RawConfig,
} from "@graphql-codegen/visitor-plugin-common";

import { mergeDeep } from "@apollo/client/utilities";

const defaultConfig = {
  avoidOptionals: {
    field: true,
  },
  defaultScalarType: "unknown",
};

export function createLocalResolversLinkCodegenConfig(
  baseConfig: import("@graphql-codegen/plugin-helpers").Types.ConfiguredOutput
) {
  const plugins = baseConfig.plugins ?? [];

  return {
    ...baseConfig,
    plugins: [
      ...new Set(
        plugins.concat([
          "typescript",
          "@apollo/client/link/local-resolvers/codegen",
        ])
      ),
    ],
    config: mergeDeep(
      defaultConfig,
      // If `baseConfig.config` is `null` or `undefined`, it replaces
      // `defaultConfig` rather than using` defaultConfig` as the base. To
      // ensure `defaultConfig` is applied when `baseConfig.config` is not
      // provided, we use it as the default value here.
      baseConfig.config ?? defaultConfig,
      {
        avoidOptionals: {
          query: true,
          mutation: true,
          subscription: true,
        },
        customResolveInfo:
          "@apollo/client/link/local-resolvers/codegen#LocalResolversLinkResolveInfo",
        customResolverFn:
          "@apollo/client/link/local-resolvers/codegen#LocalResolversLinkResolverFn",
        contextType:
          "@apollo/client/link/local-resolvers/codegen#LocalResolversLinkContextType",
        makeResolverTypeCallable: true,
        nonOptionalTypename: true,
      }
    ),
  } satisfies import("@graphql-codegen/plugin-helpers").Types.ConfiguredOutput;
}

/**
 * @description This plugin generates TypeScript signature for `resolve` functions of your GraphQL API.
 * You can use this plugin to generate simple resolvers signature based on your GraphQL types, or you can change its behavior be providing custom model types (mappers).
 *
 * You can find a blog post explaining the usage of this plugin here: https://the-guild.dev/blog/better-type-safety-for-resolvers-with-graphql-codegen
 *
 */
export interface LocalResolversLinkPluginConfig extends RawConfig {
  /**
   * @description Adds `_` to generated `Args` types in order to avoid duplicate identifiers.
   *
   * @exampleMarkdown
   * ```ts filename="codegen.ts"
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
   *
   */
  addUnderscoreToArgsType?: boolean;
  /**
   * @description Use this configuration to set a custom type for your `context`, and it will
   * affect all the resolvers, without the need to override it using generics each time.
   * If you wish to use an external type and import it from another file, you can use `add` plugin
   * and add the required `import` statement, or you can use a `module#type` syntax.
   *
   * @exampleMarkdown
   * ## Custom Context Type
   *
   * ```ts filename="codegen.ts"
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file': {
   *        // plugins...
   *        config: {
   *          contextType: 'MyContext'
   *        },
   *      },
   *    },
   *  };
   *  export default config;
   * ```
   *
   * ## Custom Context Type by Path
   *
   * Note that the path should be relative to the generated file.
   *
   * ```ts filename="codegen.ts"
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file': {
   *        // plugins...
   *        config: {
   *          contextType: './my-types#MyContext'
   *        },
   *      },
   *    },
   *  };
   *  export default config;
   * ```
   */
  contextType?: string;
  /**
   * @description Use this to set a custom type for a specific field `context`.
   * It will only affect the targeted resolvers.
   * You can either use `Field.Path#ContextTypeName` or `Field.Path#ExternalFileName#ContextTypeName`
   *
   * @exampleMarkdown
   * ## Custom Field Context Types
   *
   * ```ts filename="codegen.ts"
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file': {
   *        // plugins...
   *        config: {
   *          fieldContextTypes: ['MyType.foo#CustomContextType', 'MyType.bar#./my-file#ContextTypeOne']
   *        },
   *      },
   *    },
   *  };
   *  export default config;
   * ```
   *
   */
  fieldContextTypes?: Array<string>;
  /**
   * @description Use this configuration to set a custom type for the `rootValue`, and it will
   * affect resolvers of all root types (Query, Mutation and Subscription), without the need to override it using generics each time.
   * If you wish to use an external type and import it from another file, you can use `add` plugin
   * and add the required `import` statement, or you can use both `module#type` or `module#namespace#type` syntax.
   *
   * @exampleMarkdown
   * ## Custom RootValue Type
   *
   * ```ts filename="codegen.ts"
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
   * ```ts filename="codegen.ts"
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
   * @description Use this to set a custom type for a specific field `context` decorated by a directive.
   * It will only affect the targeted resolvers.
   * You can either use `Field.Path#ContextTypeName` or `Field.Path#ExternalFileName#ContextTypeName`
   *
   * ContextTypeName should by a generic Type that take the context or field context type as only type parameter.
   *
   * @exampleMarkdown
   * ## Directive Context Extender
   *
   * ```ts filename="codegen.ts"
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file': {
   *        // plugins...
   *        config: {
   *          directiveContextTypes: ['myCustomDirectiveName#./my-file#CustomContextExtender']
   *        },
   *      },
   *    },
   *  };
   *  export default config;
   * ```
   *
   */
  directiveContextTypes?: Array<string>;
  /**
   * @description Adds a suffix to the imported names to prevent name clashes.
   *
   * @exampleMarkdown
   * ```ts filename="codegen.ts"
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
   * @description Replaces a GraphQL type usage with a custom type, allowing you to return custom object from
   * your resolvers.
   * You can use both `module#type` and `module#namespace#type` syntax.
   *
   * @exampleMarkdown
   * ## Custom Context Type
   *
   * ```ts filename="codegen.ts"
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
   * @description Allow you to set the default mapper when it's not being override by `mappers` or generics.
   * You can specify a type name, or specify a string in `module#type` or `module#namespace#type` format.
   * The default value of mappers is the TypeScript type generated by `typescript` package.
   *
   * @exampleMarkdown
   * ## Replace with any
   *
   * ```ts filename="codegen.ts"
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
   * ```ts filename="codegen.ts"
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
   * ```ts filename="codegen.ts"
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
   * ```ts filename="codegen.ts"
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file': {
   *        plugins: ['typescript', 'typescript-resolver', { add: { content: "import { DeepPartial } from 'utility-types';" } }],
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
   * @description Warns about unused mappers.
   * @default true
   *
   * @exampleMarkdown
   * ```ts filename="codegen.ts"
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file': {
   *        plugins: ['typescript', 'typescript-resolver'],
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
   * @description Overrides the default value of enum values declared in your GraphQL schema, supported
   * in this plugin because of the need for integration with `typescript` package.
   * See documentation under `typescript` plugin for more information and examples.
   */
  enumValues?: EnumValuesMap;
  /**
   * @default Promise<T> | T
   * @description Allow you to override `resolverTypeWrapper` definition.
   */
  resolverTypeWrapperSignature?: string;
  /**
   * @default true
   * @description Allow you to disable prefixing for generated enums, works in combination with `typesPrefix`.
   *
   * @exampleMarkdown
   * ## Disable enum prefixes
   *
   * ```ts filename="codegen.ts"
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file': {
   *        plugins: ['typescript', 'typescript-resolver'],
   *        config: {
   *          typesPrefix: 'I',
   *          enumPrefix: false
   *        },
   *      },
   *    },
   *  };
   *  export default config;
   * ```
   */
  enumPrefix?: boolean;
  /**
   * @default true
   * @description Allow you to disable suffixing for generated enums, works in combination with `typesSuffix`.
   *
   * @exampleMarkdown
   * ## Disable enum suffixes
   *
   * ```ts filename="codegen.ts"
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file': {
   *        plugins: ['typescript', 'typescript-resolver'],
   *        config: {
   *          typesSuffix: 'I',
   *          enumSuffix: false
   *        },
   *      },
   *    },
   *  };
   *  export default config;
   * ```
   */
  enumSuffix?: boolean;
  /**
   * @description Configures behavior for custom directives from various GraphQL libraries.
   * @exampleMarkdown
   * ## `@semanticNonNull`
   * First, install `graphql-sock` peer dependency:
   *
   * ```sh npm2yarn
   * npm install -D graphql-sock
   * ```
   *
   * Now, you can enable support for `@semanticNonNull` directive:
   *
   * ```ts filename="codegen.ts"
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file.ts': {
   *        plugins: ['@apollo/client/link/local-resolvers/codegen'],
   *        config: {
   *          customDirectives: {
   *            semanticNonNull: true
   *          }
   *        },
   *      },
   *    },
   *  };
   *  export default config;
   * ```
   */
  customDirectives?: {
    semanticNonNull?: boolean;
  };
  /**
   * @default false
   * @description Sets the `__resolveType` field as optional field.
   */
  optionalResolveType?: boolean;
  /**
   * @default false
   * @description Generates immutable types by adding `readonly` to properties and uses `ReadonlyArray`.
   */
  immutableTypes?: boolean;
  /**
   * @default ''
   * @description Prefixes all GraphQL related generated types with that value, as namespaces import.
   * You can use this feature to allow separation of plugins to different files.
   */
  namespacedImportName?: string;
  /**
   * @default Resolvers
   * @description Suffix we add to each generated type resolver.
   */
  resolverTypeSuffix?: string;
  /**
   * @default Resolvers
   * @description The type name to use when exporting all resolvers signature as unified type.
   */
  allResolversTypeName?: string;
  /**
   * @type boolean
   * @default false
   * @description Turning this flag to `true` will generate resolver signature that has only `resolveType` for interfaces, forcing developers to write inherited type resolvers in the type itself.
   */
  onlyResolveTypeForInterfaces?: boolean;
  /**
   * @type boolean
   * @default false
   * @description If true, recursively goes through all object type's fields, checks if they have abstract types and generates expected types correctly.
   * This may not work for cases where provided default mapper types are also nested e.g. `defaultMapper: DeepPartial<{T}>` or `defaultMapper: Partial<{T}>`.
   */
  avoidCheckingAbstractTypesRecursively?: boolean;
  /**
   * @description Allow you to override the `ParentType` generic in each resolver, by avoid enforcing the base type of the generated generic type.
   *
   * This will generate `ParentType = Type` instead of `ParentType extends Type = Type` in each resolver.
   *
   * @exampleMarkdown
   * ```ts filename="codegen.ts"
   *  import type { CodegenConfig } from '@graphql-codegen/cli';
   *
   *  const config: CodegenConfig = {
   *    // ...
   *    generates: {
   *      'path/to/file.ts': {
   *        plugins: ['typescript', '@apollo/client/link/local-resolvers/codegen'],
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
