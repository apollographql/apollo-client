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

  const visitor = new LocalStateVisitor(config, schema);
  const astNode = getCachedDocumentNodeFromSchema(schema);

  // runs visitor
  const visitorResult = oldVisit(astNode, { leave: visitor as any });

  const resolversTypeMapping = visitor.buildResolversTypes();
  const resolversParentTypeMapping = visitor.buildResolversParentTypes();
  const resolversUnionTypesMapping = visitor.buildResolversUnionTypes();
  const resolversInterfaceTypesMapping = visitor.buildResolversInterfaceTypes();
  const {
    getRootResolver,
    getAllDirectiveResolvers,
    mappersImports,
    unusedMappers,
  } = visitor;

  if (showUnusedMappers && unusedMappers.length) {
    console.warn(`Unused mappers: ${unusedMappers.join(",")}`);
  }

  if (imports.length) {
    prepend.push(`${importType} { ${imports.join(", ")} } from 'graphql';`);
  }

  prepend.push(
    `${importType} { LocalState } from '@apollo/client/local-state'`
  );

  prepend.push(...mappersImports, ...visitor.globalDeclarations);

  const rootResolver = getRootResolver();

  return {
    prepend,
    content: [
      resolversUnionTypesMapping,
      resolversInterfaceTypesMapping,
      resolversTypeMapping,
      resolversParentTypeMapping,
      ...visitorResult.definitions.filter(
        (d: unknown) => typeof d === "string"
      ),
      rootResolver.content,
      getAllDirectiveResolvers(),
    ].join("\n"),
    meta: {
      generatedResolverTypes: rootResolver.generatedResolverTypes,
    },
  };
};
