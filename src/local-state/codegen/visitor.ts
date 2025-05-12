import { TypeScriptOperationVariablesToObject } from "@graphql-codegen/typescript";
import type {
  DeclarationKind,
  ParsedResolversConfig,
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
  GraphQLSchema,
  InterfaceTypeDefinitionNode,
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
  ObjectTypeDefinitionNode,
  ScalarTypeDefinitionNode,
  UnionTypeDefinitionNode,
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
}

export class LocalStateVisitor extends BaseResolversVisitor<
  LocalStatePluginConfig,
  ParsedTypeScriptResolversConfig
> {
  constructor(pluginConfig: LocalStatePluginConfig, schema: GraphQLSchema) {
    super(
      pluginConfig,
      {
        avoidOptionals: normalizeAvoidOptionals(pluginConfig.avoidOptionals),
        allowParentTypeOverride: getConfigValue(
          pluginConfig.allowParentTypeOverride,
          false
        ),
        rootValueType: parseMapper(
          pluginConfig.rootValueType || "undefined",
          "RootValueType"
        ),
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

  protected transformParentGenericType(parentType: string): string {
    if (this.config.allowParentTypeOverride) {
      return `ParentType = ${parentType}`;
    }

    return `ParentType extends ${parentType} = ${parentType}`;
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
    throw new Error(
      "Custom directives are not supported with `LocalResolversLink`"
    );
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
      .withName(name, `<${this.transformParentGenericType(parentType)}>`)
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
    throw new Error("Unions are not supported with `LocalResolversLink`");
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
      const parentTypeSignature = this.getParentTypeForSignature(node);

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

        const subscriptionType = this.schema.getSubscriptionType();
        const isSubscriptionType =
          subscriptionType && subscriptionType.name === parentName;

        if (isSubscriptionType) {
          return {
            mappedTypeKey: `${mappedType}, "${node.name}"`,
            resolverType: "SubscriptionResolver",
          };
        }

        return {
          mappedTypeKey: mappedType,
          resolverType: "Resolver",
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
        genericTypes: [mappedTypeKey, parentTypeSignature, argsType!].filter(
          (f) => f
        ),
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
    throw new Error("Interfaces are not supported by `LocalResolversLink`");
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
      `Custom scalars type '${node.name.value}' is ignored and cannot be resolved with \`LocalResolversLink\`. Please map the scalar type to a primitive with the \`scalars\` config.`
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
