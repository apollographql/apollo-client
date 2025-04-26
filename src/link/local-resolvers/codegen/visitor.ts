import { TypeScriptOperationVariablesToObject } from "@graphql-codegen/typescript";
import type {
  DeclarationKind,
  ParsedResolversConfig,
} from "@graphql-codegen/visitor-plugin-common";
import {
  BaseResolversVisitor,
  getConfigValue,
  normalizeAvoidOptionals,
} from "@graphql-codegen/visitor-plugin-common";
import autoBind from "auto-bind";
import type {
  EnumTypeDefinitionNode,
  FieldDefinitionNode,
  GraphQLSchema,
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
} from "graphql";

import type { TypeScriptResolversPluginConfig } from "./config.js";

export const ENUM_RESOLVERS_SIGNATURE =
  "export type EnumResolverSignature<T, AllowedValues = any> = { [key in keyof T]?: AllowedValues };";

export interface ParsedTypeScriptResolversConfig extends ParsedResolversConfig {
  useIndexSignature: boolean;
  wrapFieldDefinitions: boolean;
  allowParentTypeOverride: boolean;
  optionalInfoArgument: boolean;
}

export class TypeScriptResolversVisitor extends BaseResolversVisitor<
  TypeScriptResolversPluginConfig,
  ParsedTypeScriptResolversConfig
> {
  constructor(
    pluginConfig: TypeScriptResolversPluginConfig,
    schema: GraphQLSchema
  ) {
    super(
      pluginConfig,
      {
        avoidOptionals: normalizeAvoidOptionals(pluginConfig.avoidOptionals),
        useIndexSignature: getConfigValue(
          pluginConfig.useIndexSignature,
          false
        ),
        wrapFieldDefinitions: getConfigValue(
          pluginConfig.wrapFieldDefinitions,
          false
        ),
        allowParentTypeOverride: getConfigValue(
          pluginConfig.allowParentTypeOverride,
          false
        ),
        optionalInfoArgument: getConfigValue(
          pluginConfig.optionalInfoArgument,
          false
        ),
      } as ParsedTypeScriptResolversConfig,
      schema
    );
    autoBind(this);
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

    if (this.config.useIndexSignature) {
      this._declarationBlockConfig = {
        blockTransformer(block) {
          return `ResolversObject<${block}>`;
        },
      };
    }
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

  protected wrapWithListType(str: string): string {
    return `${this.config.immutableTypes ? "ReadonlyArray" : "Array"}<${str}>`;
  }

  protected getParentTypeForSignature(node: FieldDefinitionNode) {
    if (
      this._federation.isResolveReferenceField(node) &&
      this.config.wrapFieldDefinitions
    ) {
      return "UnwrappedObject<ParentType>";
    }
    return "ParentType";
  }

  NamedType(node: NamedTypeNode): string {
    return `Maybe<${super.NamedType(node)}>`;
  }

  NonNullType(node: NonNullTypeNode): string {
    const baseValue = super.NonNullType(node);

    return this.clearOptional(baseValue);
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
