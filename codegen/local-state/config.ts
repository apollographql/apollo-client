/**
 * Adapted from
 * https://github.com/dotansimha/graphql-code-generator/blob/master/packages/plugins/typescript/resolvers/src/config.ts
 *
 * https://github.com/dotansimha/graphql-code-generator/blob/master/LICENSE
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2016 Dotan Simha
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND ONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import type {
  AvoidOptionalsConfig,
  RawConfig,
} from "@graphql-codegen/visitor-plugin-common";

/**
 * This plugin generates TypeScript signature for `resolve` functions of your GraphQL API.
 * You can use this plugin to generate simple resolvers signature based on your GraphQL types, or you can change its behavior be providing custom model types (mappers).
 *
 * You can find a blog post explaining the usage of this plugin here: https://the-guild.dev/blog/better-type-safety-for-resolvers-with-graphql-codegen
 */
export interface LocalStatePluginConfig extends RawConfig {
  /**
   * Path to base schema types used to import schema type definitions for
   * extended types in your local schema. This is required if your schema type
   * definitions defines an extended type (i.e. `extend type User {...}`).
   *
   * @example
   *
   * ```ts
   * import type { CodegenConfig } from "@graphql-codegen/cli";
   *
   * const config: CodegenConfig = {
   *   // ...
   *   generates: {
   *     "path/to/file": {
   *       plugins: ["typescript", "@apollo/client/local-state/codegen"],
   *       config: {
   *         baseTypesPath: "./relative/path/to/schema/types",
   *       },
   *     },
   *   },
   * };
   * export default config;
   * ```
   */
  baseTypesPath?: string;

  /**
   * The import name for the base schema types.
   *
   * @defaultValue BaseSchemaTypes
   *
   * @example
   *
   * ```ts
   * import type { CodegenConfig } from "@graphql-codegen/cli";
   *
   * const config: CodegenConfig = {
   *   // ...
   *   generates: {
   *     "path/to/file": {
   *       plugins: ["typescript", "@apollo/client/local-state/codegen"],
   *       config: {
   *         baseSchemaTypesImportName: "MyBaseSchemaTypes",
   *       },
   *     },
   *   },
   * };
   * export default config;
   * ```
   */
  baseSchemaTypesImportName?: string;

  /**
   * This will cause the generator to avoid using optionals (`?`),
   * so all field resolvers must be implemented in order to avoid compilation errors.
   * @defaultValue false
   *
   * @example
   *
   * ## Override all definition types
   *
   * ```ts
   * import type { CodegenConfig } from "@graphql-codegen/cli";
   *
   * const config: CodegenConfig = {
   *   // ...
   *   generates: {
   *     "path/to/file": {
   *       plugins: ["typescript", "@apollo/client/local-state/codegen"],
   *       config: {
   *         avoidOptionals: true,
   *       },
   *     },
   *   },
   * };
   * export default config;
   * ```
   *
   * ## Override only specific definition types
   *
   * ```ts filename="codegen.ts"
   * import type { CodegenConfig } from "@graphql-codegen/cli";
   *
   * const config: CodegenConfig = {
   *   // ...
   *   generates: {
   *     "path/to/file": {
   *       plugins: ["typescript", "@apollo/client/local-state/codegen"],
   *       config: {
   *         avoidOptionals: {
   *           field: true,
   *           inputValue: true,
   *           object: true,
   *           defaultValue: true,
   *           query: true,
   *           mutation: true,
   *           subscription: true,
   *         },
   *       },
   *     },
   *   },
   * };
   * export default config;
   * ```
   */
  avoidOptionals?: boolean | AvoidOptionalsConfig;

  /**
   * Adds `_` to generated `Args` types in order to avoid duplicate identifiers.
   *
   * @example
   *
   * ```ts
   * import type { CodegenConfig } from "@graphql-codegen/cli";
   *
   * const config: CodegenConfig = {
   *   // ...
   *   generates: {
   *     "path/to/file": {
   *       // plugins...
   *       config: {
   *         addUnderscoreToArgsType: true,
   *       },
   *     },
   *   },
   * };
   * export default config;
   * ```
   */
  addUnderscoreToArgsType?: boolean;
  /**
   * Use this configuration to set a custom type for your `context`, and it will
   * affect all the resolvers, without the need to override it using generics each time.
   * If you wish to use an external type and import it from another file, you can use `add` plugin
   * and add the required `import` statement, or you can use a `module#type` syntax.
   *
   * @example
   *
   * ## Custom Context Type
   *
   * ```ts filename="codegen.ts"
   * import type { CodegenConfig } from "@graphql-codegen/cli";
   *
   * const config: CodegenConfig = {
   *   // ...
   *   generates: {
   *     "path/to/file": {
   *       // plugins...
   *       config: {
   *         contextType: "MyContext",
   *       },
   *     },
   *   },
   * };
   * export default config;
   * ```
   *
   * ## Custom Context Type by Path
   *
   * Note that the path should be relative to the generated file.
   *
   * ```ts filename="codegen.ts"
   * import type { CodegenConfig } from "@graphql-codegen/cli";
   *
   * const config: CodegenConfig = {
   *   // ...
   *   generates: {
   *     "path/to/file": {
   *       // plugins...
   *       config: {
   *         contextType: "./my-types#MyContext",
   *       },
   *     },
   *   },
   * };
   * export default config;
   * ```
   */
  contextType?: string;
  /**
   * Adds a suffix to the imported names to prevent name clashes.
   *
   * @example
   *
   * ```ts
   * import type { CodegenConfig } from "@graphql-codegen/cli";
   *
   * const config: CodegenConfig = {
   *   // ...
   *   generates: {
   *     "path/to/file": {
   *       // plugins...
   *       config: {
   *         mapperTypeSuffix: "Model",
   *       },
   *     },
   *   },
   * };
   * export default config;
   * ```
   */
  mapperTypeSuffix?: string;
  /**
   * Replaces a GraphQL type usage with a custom type, allowing you to return custom object from
   * your resolvers.
   * You can use both `module#type` and `module#namespace#type` syntax.
   *
   * @example
   *
   * ## Custom Context Type
   *
   * ```ts
   * import type { CodegenConfig } from "@graphql-codegen/cli";
   *
   * const config: CodegenConfig = {
   *   // ...
   *   generates: {
   *     "path/to/file": {
   *       // plugins...
   *       config: {
   *         mappers: {
   *           User: "./my-models#UserDbObject",
   *           Book: "./my-models#Collections",
   *         },
   *       },
   *     },
   *   },
   * };
   * export default config;
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
   *
   * ## Replace with any
   *
   * ```ts
   * import type { CodegenConfig } from "@graphql-codegen/cli";
   *
   * const config: CodegenConfig = {
   *   // ...
   *   generates: {
   *     "path/to/file": {
   *       // plugins...
   *       config: {
   *         defaultMapper: "any",
   *       },
   *     },
   *   },
   * };
   * export default config;
   * ```
   *
   * ## Custom Base Object
   *
   * ```ts
   * import type { CodegenConfig } from "@graphql-codegen/cli";
   *
   * const config: CodegenConfig = {
   *   // ...
   *   generates: {
   *     "path/to/file": {
   *       // plugins...
   *       config: {
   *         defaultMapper: "./my-file#BaseObject",
   *       },
   *     },
   *   },
   * };
   * export default config;
   * ```
   *
   * ## Wrap default types with Partial
   *
   * You can also specify a custom wrapper for the original type, without overriding the original generated types, use `{T}` to specify the identifier. (for flow, use `$Shape<{T}>`)
   *
   * ```ts
   * import type { CodegenConfig } from "@graphql-codegen/cli";
   *
   * const config: CodegenConfig = {
   *   // ...
   *   generates: {
   *     "path/to/file": {
   *       // plugins...
   *       config: {
   *         defaultMapper: "Partial<{T}>",
   *       },
   *     },
   *   },
   * };
   * export default config;
   * ```
   *
   * ## Allow deep partial with `utility-types`
   *
   * ```ts
   * import type { CodegenConfig } from "@graphql-codegen/cli";
   *
   * const config: CodegenConfig = {
   *   // ...
   *   generates: {
   *     "path/to/file": {
   *       plugins: [
   *         "typescript",
   *         "@apollo/client/local-state/codegen",
   *         { add: { content: "import { DeepPartial } from 'utility-types';" } },
   *       ],
   *       config: {
   *         defaultMapper: "DeepPartial<{T}>",
   *         avoidCheckingAbstractTypesRecursively: true, // required if you have complex nested abstract types
   *       },
   *     },
   *   },
   * };
   * export default config;
   * ```
   */
  defaultMapper?: string;
  /**
   * Warns about unused mappers.
   *
   * @defaultValue true
   *
   * @example
   *
   * ```ts
   * import type { CodegenConfig } from "@graphql-codegen/cli";
   *
   * const config: CodegenConfig = {
   *   // ...
   *   generates: {
   *     "path/to/file": {
   *       plugins: ["typescript", "@apollo/client/local-state/codegen"],
   *       config: {
   *         showUnusedMappers: true,
   *       },
   *     },
   *   },
   * };
   * export default config;
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
}
