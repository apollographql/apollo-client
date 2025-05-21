import { TypeScriptOperationVariablesToObject } from "@graphql-codegen/typescript";
import type {
  DeclarationKind,
  ParsedMapper,
  ParsedResolversConfig,
  ResolverTypes,
  RootResolver,
} from "@graphql-codegen/visitor-plugin-common";
import {
  BaseResolversVisitor,
  DeclarationBlock,
  getBaseTypeNode,
  getConfigValue,
  indent,
  normalizeAvoidOptionals,
  parseMapper,
} from "@graphql-codegen/visitor-plugin-common";
import type {
  DirectiveDefinitionNode,
  EnumTypeDefinitionNode,
  FieldDefinitionNode,
  GraphQLNamedType,
  GraphQLSchema,
  InterfaceTypeDefinitionNode,
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
  ObjectTypeDefinitionNode,
  ScalarTypeDefinitionNode,
  UnionTypeDefinitionNode,
} from "graphql";
import {
  isEnumType,
  isInterfaceType,
  isObjectType,
  isUnionType,
} from "graphql";

import type { LocalStatePluginConfig } from "./config.js";

type FieldDefinitionPrintFn = (
  parentName: string,
  avoidResolverOptionals: boolean
) => string | null;

const ENUM_RESOLVERS_SIGNATURE =
  "export type EnumResolverSignature<T, AllowedValues = any> = { [key in keyof T]?: AllowedValues };";

interface ParsedTypeScriptResolversConfig extends ParsedResolversConfig {
  allowParentTypeOverride: boolean;
  extendedTypes: Set<string>;
  baseSchemaTypesImportName: string;
  contextType: ParsedMapper;
  rootValueType: never;
}

export class LocalStateVisitor extends BaseResolversVisitor<
  LocalStatePluginConfig,
  ParsedTypeScriptResolversConfig
> {
  constructor(
    pluginConfig: LocalStatePluginConfig,
    schema: GraphQLSchema,
    extendedTypes: Set<string>
  ) {
    super(
      pluginConfig,
      {
        avoidOptionals: normalizeAvoidOptionals(pluginConfig.avoidOptionals),
        allowParentTypeOverride: false,
        contextType: parseMapper(
          pluginConfig.contextType || "DefaultContext",
          "DefaultContext"
        ),
        baseSchemaTypesImportName: getConfigValue(
          pluginConfig.baseSchemaTypesImportName,
          "BaseSchemaTypes"
        ),
        extendedTypes,
      } as ParsedTypeScriptResolversConfig,
      schema
    );
    this.setVariablesTransformer(
      new TypeScriptOperationVariablesToObject(
        this.scalars,
        this.convertName,
        this.config.avoidOptionals,
        this.config.immutableTypes,
        this.config.namespacedImportName,
        [],
        this.config.enumPrefix,
        this.config.enumSuffix,
        this.config.enumValues
      )
    );
  }

  protected applyResolverTypeWrapper(str: string): string {
    return str;
  }

  protected createResolversFields({
    applyWrapper,
    clearWrapper,
    getTypeToUse,
    currentType,
    shouldInclude,
  }: {
    applyWrapper: (str: string) => string;
    clearWrapper: (str: string) => string;
    getTypeToUse: (str: string) => string;
    currentType: "ResolversTypes" | "ResolversParentTypes";
    shouldInclude?: (type: GraphQLNamedType) => boolean;
  }): ResolverTypes {
    if (currentType === "ResolversTypes") {
      return super.createResolversFields({
        applyWrapper,
        clearWrapper,
        getTypeToUse,
        currentType,
        shouldInclude,
      });
    }

    const allSchemaTypes = this.schema.getTypeMap();
    const typeNames = this._federation.filterTypeNames(
      Object.keys(allSchemaTypes)
    );

    // avoid checking all types recursively if we have no `mappers` defined
    if (Object.keys(this.config.mappers).length > 0) {
      for (const typeName of typeNames) {
        if (this["_shouldMapType"][typeName] === undefined) {
          const schemaType = allSchemaTypes[typeName];
          this["_shouldMapType"][typeName] = this.shouldMapType(schemaType);
        }
      }
    }

    return typeNames.reduce((prev: ResolverTypes, typeName: string) => {
      const schemaType = allSchemaTypes[typeName];

      if (
        typeName.startsWith("__") ||
        (shouldInclude && !shouldInclude(schemaType))
      ) {
        return prev;
      }

      const isRootType = this._rootTypeNames.has(typeName);
      const isMapped = this.config.mappers[typeName];
      const isScalar = this.config.scalars[typeName];
      const hasDefaultMapper = !!this.config.defaultMapper?.type;

      if (isRootType) {
        this._globalDeclarations.add(
          `${
            this.config.useTypeImports ? "import type" : "import"
          } { DeepPartial } from '@apollo/client/utilities';`
        );

        prev[typeName] = applyWrapper(
          `DeepPartial<${this.config.baseSchemaTypesImportName}.${typeName}>`
        );

        return prev;
      }
      if (
        isMapped &&
        this.config.mappers[typeName].type &&
        !hasPlaceholder(this.config.mappers[typeName].type)
      ) {
        this.markMapperAsUsed(typeName);
        prev[typeName] = applyWrapper(this.config.mappers[typeName].type);
      } else if (isEnumType(schemaType) && this.config.enumValues[typeName]) {
        const isExternalFile = !!this.config.enumValues[typeName].sourceFile;
        prev[typeName] =
          isExternalFile ?
            this.convertName(this.config.enumValues[typeName].typeIdentifier, {
              useTypesPrefix: false,
              useTypesSuffix: false,
            })
          : this.config.enumValues[typeName].sourceIdentifier!;
      } else if (
        hasDefaultMapper &&
        !hasPlaceholder(this.config.defaultMapper!.type)
      ) {
        prev[typeName] = applyWrapper(this.config.defaultMapper!.type);
      } else if (isScalar) {
        prev[typeName] = applyWrapper(this._getScalar(typeName));
      } else if (isInterfaceType(schemaType)) {
        this._hasReferencedResolversInterfaceTypes = true;
        const type = this.convertName("ResolversInterfaceTypes");
        const generic = this.convertName(currentType);
        prev[typeName] = applyWrapper(`${type}<${generic}>['${typeName}']`);
        return prev;
      } else if (isUnionType(schemaType)) {
        this._hasReferencedResolversUnionTypes = true;
        const type = this.convertName("ResolversUnionTypes");
        const generic = this.convertName(currentType);
        prev[typeName] = applyWrapper(`${type}<${generic}>['${typeName}']`);
      } else if (isEnumType(schemaType)) {
        prev[typeName] = this.convertName(
          typeName,
          {
            useTypesPrefix: this.config.enumPrefix,
            useTypesSuffix: this.config.enumSuffix,
          },
          true
        );
      } else {
        prev[typeName] = this.convertName(typeName, {}, true);

        if (prev[typeName] !== "any" && isObjectType(schemaType)) {
          const relevantFields = this["getRelevantFieldsToOmit"]({
            schemaType,
            getTypeToUse,
            shouldInclude,
          });

          // If relevantFields, puts ResolverTypeWrapper on top of an entire type
          let internalType =
            relevantFields.length > 0 ?
              this.replaceFieldsInType(prev[typeName], relevantFields)
            : prev[typeName];

          if (isMapped) {
            // replace the placeholder with the actual type
            if (hasPlaceholder(internalType)) {
              internalType = replacePlaceholder(internalType, typeName);
            }
            if (
              this.config.mappers[typeName].type &&
              hasPlaceholder(this.config.mappers[typeName].type)
            ) {
              internalType = replacePlaceholder(
                this.config.mappers[typeName].type,
                internalType
              );
            }
          }

          if (this.config.extendedTypes.has(typeName)) {
            prev[typeName] =
              `${this.config.baseSchemaTypesImportName}.${typeName}`;
          } else {
            prev[typeName] = applyWrapper(internalType);
          }
        }
      }

      if (
        !isMapped &&
        hasDefaultMapper &&
        hasPlaceholder(this.config.defaultMapper!.type)
      ) {
        const originalTypeName =
          isScalar ? this._getScalar(typeName) : prev[typeName];

        if (isUnionType(schemaType)) {
          // Don't clear ResolverTypeWrapper from Unions
          prev[typeName] = replacePlaceholder(
            this.config.defaultMapper!.type,
            originalTypeName
          );
        } else {
          const name = clearWrapper(originalTypeName);
          const replaced = replacePlaceholder(
            this.config.defaultMapper!.type,
            name
          );
          prev[typeName] = applyWrapper(replaced);
        }
      }

      return prev;
    }, {} as ResolverTypes);
  }

  protected formatRootResolver(
    schemaTypeName: string,
    resolverType: string,
    declarationKind: DeclarationKind
  ): string {
    const avoidOptionals = this.config.avoidOptionals.resolvers;

    return `${schemaTypeName}${
      avoidOptionals ? "" : "?"
    }: ${resolverType}${this.getPunctuation(declarationKind)}`;
  }

  private clearOptional(str: string): string {
    if (str.startsWith("Maybe")) {
      return str.replace(/Maybe<(.*?)>$/, "$1");
    }

    return str;
  }

  ListType(node: ListTypeNode): string {
    return `Maybe<${super.ListType(node)}>`;
  }

  DirectiveDefinition(
    _node: DirectiveDefinitionNode,
    _key: string | number,
    _parent: any
  ): string {
    return "";
  }

  EnumTypeDefinition(node: EnumTypeDefinitionNode): string {
    const rawTypeName = node.name as any;

    // If we have enumValues set, and it's point to an external enum - we need to allow internal values resolvers
    // In case we have enumValues set but as explicit values, no need to to do mapping since it's already
    // have type validation (the original enum has been modified by base types plugin).
    // If we have mapper for that type - we can skip
    if (
      !this.config.mappers[rawTypeName] &&
      !this.config.enumValues[rawTypeName]
    ) {
      return "";
    }

    const name = this.convertName(node, {
      suffix: this.config.resolverTypeSuffix,
    });
    this._collectedResolvers[rawTypeName] = {
      typename: name,
      baseGeneratedTypename: name,
    };
    const hasExplicitValues = this.config.enumValues[rawTypeName]?.mappedValues;

    return new DeclarationBlock(this._declarationBlockConfig)
      .export()
      .asKind("type")
      .withName(name)
      .withContent(
        hasExplicitValues ?
          this.buildEnumResolversExplicitMappedValues(
            node,
            this.config.enumValues[rawTypeName].mappedValues!
          )
        : this.buildEnumResolverContentBlock(
            node,
            this.getTypeToUse(rawTypeName)
          )
      ).string;
  }

  ObjectTypeDefinition(node: ObjectTypeDefinitionNode): string {
    const declarationKind = "type";
    const name = this.convertName(node, {
      suffix: this.config.resolverTypeSuffix,
    });
    const typeName = node.name as any as string;
    const parentType = this.getParentTypeToUse(typeName);

    const rootType = ((): false | "query" | "mutation" | "subscription" => {
      if (this.schema.getQueryType()?.name === typeName) {
        return "query";
      }
      if (this.schema.getMutationType()?.name === typeName) {
        return "mutation";
      }
      if (this.schema.getSubscriptionType()?.name === typeName) {
        return "subscription";
      }
      return false;
    })();

    const fieldsContent = (
      node.fields as unknown as FieldDefinitionPrintFn[]
    ).map((f) => {
      return f(
        typeName,
        (rootType === "query" && this.config.avoidOptionals.query) ||
          (rootType === "mutation" && this.config.avoidOptionals.mutation) ||
          (rootType === "subscription" &&
            this.config.avoidOptionals.subscription) ||
          (rootType === false && this.config.avoidOptionals.resolvers)
      );
    });

    const block = new DeclarationBlock(this._declarationBlockConfig)
      .export()
      .asKind(declarationKind)
      .withName(name)
      .withBlock(fieldsContent.join("\n"));

    this._collectedResolvers[node.name as any] = {
      typename: name,
      baseGeneratedTypename: name,
    };

    return block.string;
  }

  UnionTypeDefinition(
    _node: UnionTypeDefinitionNode,
    _key: string | number,
    _parent: any
  ): string {
    return "";
  }

  FieldDefinition(
    node: FieldDefinitionNode,
    key: string | number,
    parent: any
  ): FieldDefinitionPrintFn {
    const hasArguments = node.arguments && node.arguments.length > 0;
    const declarationKind = "type";

    return (parentName, avoidResolverOptionals) => {
      const original: FieldDefinitionNode = parent[key];

      let argsType =
        hasArguments ?
          this.convertName(
            parentName +
              (this.config.addUnderscoreToArgsType ? "_" : "") +
              this.convertName(node.name, {
                useTypesPrefix: false,
                useTypesSuffix: false,
              }) +
              "Args",
            {
              useTypesPrefix: true,
            },
            true
          )
        : null;

      if (argsType !== null) {
        const argsToForceRequire = original.arguments!.filter(
          (arg) => !!arg.defaultValue || arg.type.kind === "NonNullType"
        );

        if (argsToForceRequire.length > 0) {
          argsType = this.applyRequireFields(argsType, argsToForceRequire);
        } else if (original.arguments!.length > 0) {
          argsType = this.applyOptionalFields(argsType, original.arguments!);
        }
      }
      const { mappedTypeKey, resolverType } = ((): {
        mappedTypeKey: string;
        resolverType: string;
      } => {
        const baseType = getBaseTypeNode(original.type);
        const realType = baseType.name.value;
        const typeToUse = this.getTypeToUse(realType);
        /**
         * Turns GraphQL type to TypeScript types (`mappedType`) e.g.
         * - String!  -> ResolversTypes['String']>
         * - String   -> Maybe<ResolversTypes['String']>
         * - [String] -> Maybe<Array<Maybe<ResolversTypes['String']>>>
         * - [String!]! -> Array<ResolversTypes['String']>
         */
        const mappedType = this._variablesTransformer.wrapAstTypeWithModifiers(
          typeToUse,
          original.type
        );

        return {
          mappedTypeKey: mappedType,
          resolverType: "LocalState.Resolver",
        };
      })();

      const signature: {
        name: string;
        modifier: string;
        type: string;
        genericTypes: string[];
      } = {
        name: node.name as any,
        modifier: avoidResolverOptionals ? "" : "?",
        type: resolverType,
        genericTypes: [
          mappedTypeKey,
          this.getParentTypeToUse(parentName),
          this.config.contextType.type,
          argsType!,
        ].filter((f) => f),
      };

      return indent(
        `${signature.name}${signature.modifier}: ${
          signature.type
        }<${signature.genericTypes.join(", ")}>${this.getPunctuation(
          declarationKind
        )}`
      );
    };
  }

  InterfaceTypeDefinition(_node: InterfaceTypeDefinitionNode): string {
    return "";
  }

  public getRootResolver(): RootResolver {
    const name = this.convertName(this.config.allResolversTypeName);
    const declarationKind = "type";

    const userDefinedTypes: RootResolver["generatedResolverTypes"]["userDefined"] =
      {};
    const content = [
      new DeclarationBlock(this._declarationBlockConfig)
        .export()
        .asKind(declarationKind)
        .withName(name)
        .withBlock(
          Object.keys(this._collectedResolvers)
            .map((schemaTypeName) => {
              const resolverType = this._collectedResolvers[schemaTypeName];

              if (resolverType.baseGeneratedTypename) {
                userDefinedTypes[schemaTypeName] = {
                  name: resolverType.baseGeneratedTypename,
                };
              }

              return indent(
                this.formatRootResolver(
                  schemaTypeName,
                  resolverType.typename,
                  declarationKind
                )
              );
            })
            .join("\n")
        ).string,
    ].join("\n");

    return {
      content,
      generatedResolverTypes: {
        resolversMap: { name },
        userDefined: userDefinedTypes,
      },
    };
  }

  protected wrapWithListType(str: string): string {
    return `${this.config.immutableTypes ? "ReadonlyArray" : "Array"}<${str}>`;
  }

  protected getParentTypeForSignature(_node: FieldDefinitionNode) {
    return "ParentType";
  }

  NamedType(node: NamedTypeNode): string {
    return `Maybe<${super.NamedType(node)}>`;
  }

  NonNullType(node: NonNullTypeNode): string {
    const baseValue = super.NonNullType(node);

    return this.clearOptional(baseValue);
  }

  ScalarTypeDefinition(node: ScalarTypeDefinitionNode): string {
    console.warn(
      `Custom scalars type '${node.name.value}' is ignored and cannot be resolved with \`LocalState\`. Please map the scalar type to a primitive with the \`scalars\` config.`
    );
    this._hasScalars = true;
    return "";
  }

  protected getPunctuation(_declarationKind: DeclarationKind): string {
    return ";";
  }

  protected buildEnumResolverContentBlock(
    node: EnumTypeDefinitionNode,
    mappedEnumType: string
  ): string {
    const valuesMap = `{ ${(node.values || [])
      .map(
        (v) =>
          `${v.name as any as string}${
            this.config.avoidOptionals.resolvers ? "" : "?"
          }: any`
      )
      .join(", ")} }`;

    this._globalDeclarations.add(ENUM_RESOLVERS_SIGNATURE);

    return `EnumResolverSignature<${valuesMap}, ${mappedEnumType}>`;
  }

  protected buildEnumResolversExplicitMappedValues(
    node: EnumTypeDefinitionNode,
    valuesMapping: { [valueName: string]: string | number }
  ): string {
    return `{ ${(node.values || [])
      .map((v) => {
        const valueName = v.name as any as string;
        const mappedValue = valuesMapping[valueName];

        return `${valueName}: ${
          typeof mappedValue === "number" ? mappedValue : `'${mappedValue}'`
        }`;
      })
      .join(", ")} }`;
  }
}

function replacePlaceholder(pattern: string, typename: string): string {
  return pattern.replace(/\{T\}/g, typename);
}

function hasPlaceholder(pattern: string): boolean {
  return pattern.includes("{T}");
}
