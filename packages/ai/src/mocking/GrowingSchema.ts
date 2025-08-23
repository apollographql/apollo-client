import type {
  DefinitionNode,
  DocumentNode,
  FieldDefinitionNode,
  FieldNode,
  GraphQLCompositeType,
  InputValueDefinitionNode,
  TypeNode,
} from "graphql";
import {
  extendSchema,
  FieldsOnCorrectTypeRule,
  GraphQLError,
  GraphQLObjectType,
  GraphQLSchema,
  Kind,
  printSchema,
  specifiedRules,
  TypeInfo,
  validate,
  visit,
  visitWithTypeInfo,
} from "graphql";
import { Maybe } from "graphql/jsutils/Maybe.js";
import { AIAdapter } from "./AIAdapter.js";

const rulesToIgnore = [
  FieldsOnCorrectTypeRule,
  // KnownArgumentNamesOnDirectivesRule,
  // KnownArgumentNamesRule,
  // KnownDirectivesRule,
  // KnownFragmentNamesRule,
  // KnownTypeNamesRule,
];

const enforcedRules = specifiedRules.filter(
  (rule) => !rulesToIgnore.includes(rule)
);

export class GrowingSchema {
  public schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: "Query",
      fields: {},
    }),
  });

  public validateQuery(query: DocumentNode) {
    const errors = validate(this.schema, query, enforcedRules);
    if (errors.length > 0) {
      throw new Error(
        `Query is inconsistent with existing schema: ${errors
          .map((e) => e.message)
          .join(", ")}`
      );
    }
  }

  public add(
    operation: {
      query: DocumentNode;
      variables?: Record<string, unknown>;
    },
    response: AIAdapter.Result
  ) {
    const query = operation.query;
    // @todo handle variables
    // const variables = operation.variables;

    const typeInfo = new TypeInfo(this.schema);
    const responsePath = [response.data];

    let accumulatedExtensions: {
      kind: Kind.DOCUMENT;
      definitions: DefinitionNode[];
    } = {
      kind: Kind.DOCUMENT,
      definitions: [],
    } satisfies DocumentNode;

    const mergeExtensions = () => {
      this.schema = extendSchema(this.schema, accumulatedExtensions, {
        assumeValidSDL: true,
      });
      accumulatedExtensions = {
        kind: Kind.DOCUMENT,
        definitions: [],
      };
      return this.schema;
    };

    visit(
      query,
      visitWithTypeInfo(typeInfo, {
        Field: {
          leave() {
            responsePath.pop();
          },
          enter: (node, key, parent, path, ancestors) => {
            const valueAtPath =
              responsePath.at(-1)![node.alias?.value || node.name.value];
            const isList = Array.isArray(valueAtPath);
            const actualValue = isList ? valueAtPath[0] : valueAtPath;
            const typename = actualValue?.__typename;
            responsePath.push(actualValue);

            const type = typeInfo.getParentType();
            if (!type) {
              throw new GraphQLError(
                `No parent type found for field ${node.name.value}`
              );
            }

            let newFieldDef = this.getFieldDefinition(
              node,
              isList,
              actualValue,
              typename,
              type
            );

            const existingFieldDef = typeInfo.getFieldDef();
            if (existingFieldDef) {
              if (
                this.newFieldDefinitionMatchesExistingFieldDefinition(
                  newFieldDef,
                  existingFieldDef.astNode
                )
              ) {
                // The new and existing field definitions match, so we
                // can skip adding the new field definition to the schema.
                return;
              }
              // The new and existing field definitions don't match, so we
              // need to attempt to merge them.
              newFieldDef = this.mergeFieldDefinitions(
                newFieldDef,
                existingFieldDef.astNode,
                type.name
              );
            }

            if (node.name.value === "__typename") {
              return;
            }

            accumulatedExtensions.definitions.push({
              kind: Kind.OBJECT_TYPE_EXTENSION,
              name: { kind: Kind.NAME, value: type.name },
              fields: [newFieldDef],
            });

            // field not in schema
            if (node.selectionSet) {
              if (!this.schema.getType(typename)) {
                accumulatedExtensions.definitions.push({
                  kind: Kind.OBJECT_TYPE_DEFINITION,
                  name: { kind: Kind.NAME, value: typename },
                  fields: [],
                });
              }
              // this selection set couldn't be entered correctly before, so we
              // need to merge the schema now, and have the type info start
              // from the top to navigate to the current node
              mergeExtensions();
              Object.assign(typeInfo, new TypeInfo(this.schema));
              path.reduce((node: any, key: any) => {
                const child = node[key];
                typeInfo.enter(child);
                return child;
              }, query);
            }
          },
        },
      })
    );
    mergeExtensions();
  }

  private getFieldArguments(node: FieldNode): InputValueDefinitionNode[] {
    // @todo we need to handle named input object arguments
    // For now, we'll only handle build-in scalar arguments
    return (
      node.arguments?.map((arg) => {
        let valueType: string;
        switch (arg.value.kind) {
          case Kind.STRING:
            valueType = "String";
            break;
          case Kind.INT:
            valueType = "Int";
            break;
          case Kind.FLOAT:
            valueType = "Float";
            break;
          case Kind.BOOLEAN:
            valueType = "Boolean";
            break;
          default:
            throw new GraphQLError(
              `Scalar responses are not supported for field ${
                node.name.value
              } on type ${node.name.value} - received ${JSON.stringify(
                arg.value.kind
              )}`
            );
        }
        return {
          kind: Kind.INPUT_VALUE_DEFINITION,
          name: arg.name,
          type: {
            kind: Kind.NAMED_TYPE,
            name: { kind: Kind.NAME, value: valueType },
          },
        };
      }) ?? []
    );
  }

  private getFieldDefinition(
    node: FieldNode,
    isList: boolean,
    actualValue: any,
    typename: string,
    type: GraphQLCompositeType
  ): FieldDefinitionNode {
    const args = this.getFieldArguments(node);

    // field not in schema
    if (node.selectionSet) {
      // either an object or a list type
      if (!typename) {
        throw new GraphQLError(
          `Field ${node.name.value} on type ${type.name} is missing __typename in response data`
        );
      }
      let fieldReturnType: TypeNode = {
        kind: Kind.NAMED_TYPE,
        name: { kind: Kind.NAME, value: typename },
      };
      if (isList) {
        fieldReturnType = {
          kind: Kind.LIST_TYPE,
          type: fieldReturnType,
        };
      }
      return {
        kind: Kind.FIELD_DEFINITION,
        name: { kind: Kind.NAME, value: node.name.value },
        type: fieldReturnType,
        arguments: args,
      };
    } else {
      // scalar type
      let valueType: string;
      switch (typeof actualValue) {
        case "string":
          valueType = "String";
          break;
        case "number":
          valueType = "Float";
          break;
        case "boolean":
          valueType = "Boolean";
          break;
        default:
          throw new GraphQLError(
            `Scalar responses are not supported for field ${
              node.name.value
            } on type ${type.name} - received ${JSON.stringify(actualValue)}`
          );
      }
      return {
        kind: Kind.FIELD_DEFINITION,
        name: { kind: Kind.NAME, value: node.name.value },
        type: {
          kind: Kind.NAMED_TYPE,
          name: { kind: Kind.NAME, value: valueType },
        },
      };
    }
  }

  /**
   * Helper function to compare two TypeNode objects for equality
   */
  private typeNodesEqual(type1: TypeNode, type2: TypeNode): boolean {
    if (type1.kind !== type2.kind) {
      return false;
    }

    switch (type1.kind) {
      case Kind.NAMED_TYPE:
        return type1.name.value === (type2 as typeof type1).name.value;
      case Kind.LIST_TYPE:
        return this.typeNodesEqual(type1.type, (type2 as typeof type1).type);
      case Kind.NON_NULL_TYPE:
        return this.typeNodesEqual(type1.type, (type2 as typeof type1).type);
      default:
        return false;
    }
  }

  /**
   * Helper function to convert TypeNode to human-readable string
   */
  private static typeNodeToString(type: TypeNode): string {
    switch (type.kind) {
      case Kind.NAMED_TYPE:
        return type.name.value;
      case Kind.LIST_TYPE:
        return `[${GrowingSchema.typeNodeToString(type.type)}]`;
      case Kind.NON_NULL_TYPE:
        return `${GrowingSchema.typeNodeToString(type.type)}!`;
      default:
        return "Unknown";
    }
  }

  private newFieldDefinitionMatchesExistingFieldDefinition(
    newFieldDef: FieldDefinitionNode,
    existingFieldDef: Maybe<FieldDefinitionNode>
  ): boolean {
    if (!existingFieldDef) {
      return false;
    }
    if (existingFieldDef.name.value !== newFieldDef.name.value) {
      return false;
    }

    // Check arguments
    const newArgs = newFieldDef.arguments || [];
    const existingArgs = existingFieldDef.arguments || [];

    // Check argument count
    if (newArgs.length !== existingArgs.length) {
      return false;
    }

    // Check each argument by name and type
    for (const newArg of newArgs) {
      const existingArg = existingArgs.find(
        (arg) => arg.name.value === newArg.name.value
      );

      if (!existingArg) {
        return false; // Argument name not found
      }

      // Check argument types
      if (!this.typeNodesEqual(newArg.type, existingArg.type)) {
        return false;
      }
    }

    // Check field return types
    if (!this.typeNodesEqual(newFieldDef.type, existingFieldDef.type)) {
      return false;
    }

    return true;
  }

  /**
   * @todo handle existing field definition that doesn't match the new field definition
   * We need to:
   *
   * - merge arguments
   * - check return type
   *   - If the return type is different, we need to throw an error
   */
  private mergeFieldDefinitions(
    newFieldDef: FieldDefinitionNode,
    existingFieldDef: Maybe<FieldDefinitionNode>,
    parentTypeName: string
  ): FieldDefinitionNode {
    if (!existingFieldDef) {
      return newFieldDef;
    }

    if (!this.typeNodesEqual(newFieldDef.type, existingFieldDef.type)) {
      const existingReturnTypeString = GrowingSchema.typeNodeToString(
        existingFieldDef.type
      );
      const newReturnTypeString = GrowingSchema.typeNodeToString(
        newFieldDef.type
      );
      throw new GraphQLError(
        `Field \`${parentTypeName}.${newFieldDef.name.value}\` return type mismatch. Previously defined return type: \`${existingReturnTypeString}\`, new return type: \`${newReturnTypeString}\``
      );
    }

    const newArgs = newFieldDef.arguments || [];
    const existingArgs = existingFieldDef.arguments || [];
    const mergedArgs = [...existingArgs, ...newArgs];

    return {
      ...existingFieldDef,
      arguments: mergedArgs,
    };
  }

  public toString() {
    return printSchema(this.schema);
  }
}
