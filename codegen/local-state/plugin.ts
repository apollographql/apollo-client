/**
 * Adapted from
 * https://github.com/dotansimha/graphql-code-generator/blob/master/packages/plugins/typescript/resolvers/src/index.ts
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
import type { PluginFunction, Types } from "@graphql-codegen/plugin-helpers";
import {
  getCachedDocumentNodeFromSchema,
  oldVisit,
} from "@graphql-codegen/plugin-helpers";
import type { RootResolver } from "@graphql-codegen/visitor-plugin-common";
import type { GraphQLSchema } from "graphql";

import type { LocalStatePluginConfig } from "./config.js";
import { LocalStateVisitor } from "./visitor.js";

export const plugin: PluginFunction<
  LocalStatePluginConfig,
  Types.ComplexPluginOutput<{
    generatedResolverTypes: RootResolver["generatedResolverTypes"];
  }>
> = async (
  schema: GraphQLSchema,
  _documents: Types.DocumentFile[],
  config: LocalStatePluginConfig
) => {
  const imports: string[] = [];
  const showUnusedMappers =
    typeof config.showUnusedMappers === "boolean" ?
      config.showUnusedMappers
    : true;

  const importType = config.useTypeImports ? "import type" : "import";
  const prepend: string[] = [];

  // Extended types are types that extend existing schema types (i.e. `extend type User {...}`)
  const extendedTypes = Object.entries(schema.getTypeMap()).reduce(
    (memo, [typename, type]) => {
      return type.astNode?.loc?.startToken.value === "extend" ?
          memo.add(typename)
        : memo;
    },
    new Set<string>()
  );

  if (extendedTypes.size > 0) {
    if (!config.baseTypesPath) {
      throw new Error(
        "`baseTypesPath` must be defined when your local schema extends existing schema types."
      );
    }

    prepend.push(
      `import * as ${
        config.baseSchemaTypesImportName ?? "BaseSchemaTypes"
      } from '${config.baseTypesPath}';`
    );
  }

  const visitor = new LocalStateVisitor(config, schema, extendedTypes);
  const astNode = getCachedDocumentNodeFromSchema(schema);

  // runs visitor
  const visitorResult = oldVisit(astNode, { leave: visitor as any });

  const resolversTypeMapping = visitor.buildResolversTypes();
  const resolversParentTypeMapping = visitor.buildResolversParentTypes();
  const resolversUnionTypeMapping = visitor.buildResolversUnionTypes();
  const resolversInterfaceTypeMapping = visitor.buildResolversInterfaceTypes();
  const { getRootResolver, mappersImports, unusedMappers } = visitor;

  if (showUnusedMappers && unusedMappers.length) {
    console.warn(`Unused mappers: ${unusedMappers.join(",")}`);
  }

  if (imports.length) {
    prepend.push(`${importType} { ${imports.join(", ")} } from 'graphql';`);
  }

  prepend.push(
    `${importType} { LocalState } from '@apollo/client/local-state'`,
    `${importType} { DeepPartial } from '@apollo/client/utilities';`
  );

  prepend.push(...mappersImports, ...visitor.globalDeclarations);

  const rootResolver = getRootResolver();

  return {
    prepend,
    content: [
      resolversTypeMapping,
      resolversParentTypeMapping,
      resolversInterfaceTypeMapping,
      resolversUnionTypeMapping,
      ...visitorResult.definitions.filter(
        (d: unknown) => typeof d === "string"
      ),
      rootResolver.content,
    ].join("\n"),
    meta: {
      generatedResolverTypes: rootResolver.generatedResolverTypes,
    },
  };
};
