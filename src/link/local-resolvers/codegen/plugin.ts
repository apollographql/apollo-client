import type { PluginFunction, Types } from "@graphql-codegen/plugin-helpers";
import {
  addFederationReferencesToSchema,
  getCachedDocumentNodeFromSchema,
  oldVisit,
} from "@graphql-codegen/plugin-helpers";
import type { RootResolver } from "@graphql-codegen/visitor-plugin-common";
import { parseMapper } from "@graphql-codegen/visitor-plugin-common";
import type { GraphQLSchema } from "graphql";

import type { TypeScriptResolversPluginConfig } from "./config.js";
import { TypeScriptResolversVisitor } from "./visitor.js";

const capitalize = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1);

export const plugin: PluginFunction<
  TypeScriptResolversPluginConfig,
  Types.ComplexPluginOutput<{
    generatedResolverTypes: RootResolver["generatedResolverTypes"];
  }>
> = async (
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  config: TypeScriptResolversPluginConfig
) => {
  const imports = [];
  if (!config.customResolveInfo) {
    imports.push("GraphQLResolveInfo");
  }
  const showUnusedMappers =
    typeof config.showUnusedMappers === "boolean" ?
      config.showUnusedMappers
    : true;
  const noSchemaStitching =
    typeof config.noSchemaStitching === "boolean" ?
      config.noSchemaStitching
    : true;

  const indexSignature =
    config.useIndexSignature ?
      [
        "export type WithIndex<TObject> = TObject & Record<string, any>;",
        "export type ResolversObject<TObject> = WithIndex<TObject>;",
      ].join("\n")
    : "";
  const importType = config.useTypeImports ? "import type" : "import";
  const prepend: string[] = [];
  const defsToInclude: string[] = [];
  const directiveResolverMappings = {} as Record<string, string>;

  if (config.directiveResolverMappings) {
    for (const [directiveName, mapper] of Object.entries(
      config.directiveResolverMappings
    )) {
      const parsedMapper = parseMapper(mapper);
      const capitalizedDirectiveName = capitalize(directiveName);
      const resolverFnName = `ResolverFn${capitalizedDirectiveName}`;
      const resolverFnUsage = `${resolverFnName}<TResult, TParent, TContext, TArgs>`;
      const resolverWithResolveUsage = `Resolver${capitalizedDirectiveName}WithResolve<TResult, TParent, TContext, TArgs>`;
      const resolverWithResolve = `
export type Resolver${capitalizedDirectiveName}WithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ${resolverFnName}<TResult, TParent, TContext, TArgs>;
};`;
      const resolverTypeName = `Resolver${capitalizedDirectiveName}`;
      const resolverType = `export type ${resolverTypeName}<TResult, TParent = {}, TContext = {}, TArgs = {}> =`;

      if (parsedMapper.isExternal) {
        if (parsedMapper.default) {
          prepend.push(
            `${importType} ${resolverFnName} from '${parsedMapper.source}';`
          );
        } else {
          prepend.push(
            `${importType} { ${parsedMapper.import} ${
              parsedMapper.import === resolverFnName ?
                ""
              : `as ${resolverFnName} `
            }} from '${parsedMapper.source}';`
          );
        }
        prepend.push(
          `export${config.useTypeImports ? " type" : ""} { ${resolverFnName} };`
        );
      } else {
        defsToInclude.push(
          `export type ${resolverFnName}<TResult, TParent, TContext, TArgs> = ${parsedMapper.type}`
        );
      }

      if (config.makeResolverTypeCallable) {
        defsToInclude.push(`${resolverType} ${resolverFnUsage};`);
      } else {
        defsToInclude.push(
          resolverWithResolve,
          `${resolverType} ${resolverFnUsage} | ${resolverWithResolveUsage};`
        );
      }

      directiveResolverMappings[directiveName] = resolverTypeName;
    }
  }

  let transformedSchema =
    config.federation ? addFederationReferencesToSchema(schema) : schema;

  const visitor = new TypeScriptResolversVisitor(
    { ...config, directiveResolverMappings },
    transformedSchema
  );
  const namespacedImportPrefix =
    visitor.config.namespacedImportName ?
      `${visitor.config.namespacedImportName}.`
    : "";

  const astNode = getCachedDocumentNodeFromSchema(transformedSchema);

  // runs visitor
  const visitorResult = oldVisit(astNode, { leave: visitor });

  const optionalSignForInfoArg = visitor.config.optionalInfoArgument ? "?" : "";
  const legacyStitchingResolverType = `
export type LegacyStitchingResolver<TResult, TParent, TContext, TArgs> = {
  fragment: string;
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};`;
  const newStitchingResolverType = `
export type NewStitchingResolver<TResult, TParent, TContext, TArgs> = {
  selectionSet: string | ((fieldNode: FieldNode) => SelectionSetNode);
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};`;
  const stitchingResolverType = `export type StitchingResolver<TResult, TParent, TContext, TArgs> = LegacyStitchingResolver<TResult, TParent, TContext, TArgs> | NewStitchingResolver<TResult, TParent, TContext, TArgs>;`;
  const resolverWithResolve = `
export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};`;
  const resolverType = `export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> =`;
  const resolverFnUsage = `ResolverFn<TResult, TParent, TContext, TArgs>`;
  const resolverWithResolveUsage = `ResolverWithResolve<TResult, TParent, TContext, TArgs>`;
  const stitchingResolverUsage = `StitchingResolver<TResult, TParent, TContext, TArgs>`;

  if (visitor.hasFederation()) {
    if (visitor.config.wrapFieldDefinitions) {
      defsToInclude.push(`export type UnwrappedObject<T> = {
        [P in keyof T]: T[P] extends infer R | Promise<infer R> | (() => infer R2 | Promise<infer R2>)
          ? R & R2 : T[P]
      };`);
    }

    defsToInclude.push(
      `export type ReferenceResolver<TResult, TReference, TContext> = (
      reference: TReference,
      context: TContext,
      info${optionalSignForInfoArg}: GraphQLResolveInfo
    ) => Promise<TResult> | TResult;`,
      `
      type ScalarCheck<T, S> = S extends true ? T : NullableCheck<T, S>;
      type NullableCheck<T, S> = ${namespacedImportPrefix}Maybe<T> extends T ? ${namespacedImportPrefix}Maybe<ListCheck<NonNullable<T>, S>> : ListCheck<T, S>;
      type ListCheck<T, S> = T extends (infer U)[] ? NullableCheck<U, S>[] : GraphQLRecursivePick<T, S>;
      export type GraphQLRecursivePick<T, S> = { [K in keyof T & keyof S]: ScalarCheck<T[K], S[K]> };
    `
    );
  }

  if (!config.makeResolverTypeCallable) {
    defsToInclude.push(resolverWithResolve);
  }

  if (noSchemaStitching) {
    const defs =
      config.makeResolverTypeCallable ?
        // Resolver = ResolverFn
        `${resolverType} ${resolverFnUsage};`
        // Resolver = ResolverFn | ResolverWithResolve
      : `${resolverType} ${resolverFnUsage} | ${resolverWithResolveUsage};`;
    defsToInclude.push(defs);
  } else {
    // StitchingResolver
    // Resolver =
    // | ResolverFn
    // | ResolverWithResolve
    // | StitchingResolver;
    defsToInclude.push(
      [
        legacyStitchingResolverType,
        newStitchingResolverType,
        stitchingResolverType,
        resolverType,
        `  | ${resolverFnUsage}`,
        config.makeResolverTypeCallable ? `` : (
          `  | ${resolverWithResolveUsage}`
        ),
        `  | ${stitchingResolverUsage};`,
      ].join("\n")
    );
    imports.push("SelectionSetNode", "FieldNode");
  }

  if (config.customResolverFn) {
    const parsedMapper = parseMapper(config.customResolverFn);
    if (parsedMapper.isExternal) {
      if (parsedMapper.default) {
        prepend.push(`${importType} ResolverFn from '${parsedMapper.source}';`);
      } else {
        prepend.push(
          `${importType} { ${parsedMapper.import} ${
            parsedMapper.import === "ResolverFn" ? "" : "as ResolverFn "
          }} from '${parsedMapper.source}';`
        );
      }
      prepend.push(
        `export${config.useTypeImports ? " type" : ""} { ResolverFn };`
      );
    } else {
      prepend.push(
        `export type ResolverFn<TResult, TParent, TContext, TArgs> = ${parsedMapper.type}`
      );
    }
  } else {
    const defaultResolverFn = `
export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info${optionalSignForInfoArg}: GraphQLResolveInfo
) => Promise<TResult> | TResult;`;

    defsToInclude.push(defaultResolverFn);
  }

  const header = `${indexSignature}

${visitor.getResolverTypeWrapperSignature()}

${defsToInclude.join("\n")}

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info${optionalSignForInfoArg}: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info${optionalSignForInfoArg}: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info${optionalSignForInfoArg}: GraphQLResolveInfo
) => ${namespacedImportPrefix}Maybe<TTypes> | Promise<${namespacedImportPrefix}Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info${optionalSignForInfoArg}: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info${optionalSignForInfoArg}: GraphQLResolveInfo
) => TResult | Promise<TResult>;
`;

  const resolversTypeMapping = visitor.buildResolversTypes();
  const resolversParentTypeMapping = visitor.buildResolversParentTypes();
  const resolversUnionTypesMapping = visitor.buildResolversUnionTypes();
  const resolversInterfaceTypesMapping = visitor.buildResolversInterfaceTypes();
  const {
    getRootResolver,
    getAllDirectiveResolvers,
    mappersImports,
    unusedMappers,
    hasScalars,
  } = visitor;

  if (hasScalars()) {
    imports.push("GraphQLScalarType", "GraphQLScalarTypeConfig");
  }

  if (showUnusedMappers && unusedMappers.length) {
    console.warn(`Unused mappers: ${unusedMappers.join(",")}`);
  }

  if (imports.length) {
    prepend.push(`${importType} { ${imports.join(", ")} } from 'graphql';`);
  }

  if (config.customResolveInfo) {
    const parsedMapper = parseMapper(config.customResolveInfo);
    if (parsedMapper.isExternal) {
      if (parsedMapper.default) {
        prepend.push(
          `${importType} GraphQLResolveInfo from '${parsedMapper.source}'`
        );
      }
      prepend.push(
        `${importType} { ${parsedMapper.import} ${
          parsedMapper.import === "GraphQLResolveInfo" ?
            ""
          : "as GraphQLResolveInfo"
        } } from '${parsedMapper.source}';`
      );
    } else {
      prepend.push(`type GraphQLResolveInfo = ${parsedMapper.type}`);
    }
  }

  prepend.push(...mappersImports, ...visitor.globalDeclarations);

  const rootResolver = getRootResolver();

  return {
    prepend,
    content: [
      header,
      resolversUnionTypesMapping,
      resolversInterfaceTypesMapping,
      resolversTypeMapping,
      resolversParentTypeMapping,
      ...visitorResult.definitions.filter((d) => typeof d === "string"),
      rootResolver.content,
      getAllDirectiveResolvers(),
    ].join("\n"),
    meta: {
      generatedResolverTypes: rootResolver.generatedResolverTypes,
    },
  };
};

export type { TypeScriptResolversPluginConfig };
export { TypeScriptResolversVisitor };
