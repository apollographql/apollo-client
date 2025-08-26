import type {
  ASTNode,
  DefinitionNode,
  DocumentNode,
  FieldDefinitionNode,
  FieldNode,
  FormattedExecutionResult,
  GraphQLCompositeType,
  InputValueDefinitionNode,
  TypeNode,
  VariableDefinitionNode,
} from "graphql";
import {
  execute,
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

import type { AIAdapter } from "./AIAdapter.js";

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

const isSingle = <T>(item: T | readonly T[]): item is T => !Array.isArray(item);

type OperationVariableDefinitions = Record<string, TypeNode>;

export class GrowingSchema {
  public schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: "Query",
      fields: {},
    }),
  });

  private seenQueries = new WeakSet<DocumentNode>();

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

    const previousSchema = this.schema;

    try {
      if (!this.seenQueries.has(query)) {
        this.mergeQueryIntoSchema(operation, response);
      }

      this.validateResponseAgainstSchema(query, operation, response);
      this.seenQueries.add(query);
    } catch (e) {
      this.schema = previousSchema;
      throw e;
    }
  }

  public mergeQueryIntoSchema(
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

    const mergeExtensions = ({
      assumeValidSDL = false,
      revisitAtPath,
    }: {
      assumeValidSDL?: boolean;
      revisitAtPath?: ReadonlyArray<string | number>;
    } = {}) => {
      this.schema = extendSchema(this.schema, accumulatedExtensions, {
        assumeValidSDL,
      });

      if (revisitAtPath) {
        Object.assign(typeInfo, new TypeInfo(this.schema));
        revisitAtPath.reduce((node: any, key: any) => {
          const child = node[key];
          typeInfo.enter(child);
          return child;
        }, query);
      }

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

            const operationVariableDefinitions =
              this.getVariableDefinitionsFromAncestors(ancestors);

            let newFieldDef = this.getFieldDefinition(
              node,
              isList,
              actualValue,
              typename,
              type,
              operationVariableDefinitions
            );

            const existingFieldDef = typeInfo.getFieldDef()?.astNode;
            if (existingFieldDef) {
              const existingArguments = new Map(
                existingFieldDef.arguments?.map((arg) => [arg.name.value, arg])
              );
              const additionalArgs =
                newFieldDef.arguments?.filter(
                  (arg) => !existingArguments.has(arg.name.value)
                ) || [];

              if (!additionalArgs.length) {
                // The existing field definition is sufficient, so we
                // can skip adding the new field definition to the schema.
                return;
              }

              accumulatedExtensions.definitions.push({
                kind: Kind.OBJECT_TYPE_EXTENSION,
                name: { kind: Kind.NAME, value: type.name },
                fields: [
                  {
                    ...existingFieldDef,
                    arguments: [
                      ...(existingFieldDef.arguments || []),
                      ...additionalArgs,
                    ],
                  },
                ],
              });
              mergeExtensions({ assumeValidSDL: true, revisitAtPath: path });
              return;
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
              mergeExtensions({ revisitAtPath: path });
            } else {
              mergeExtensions();
            }
          },
        },
      })
    );
    mergeExtensions();
  }

  private validateResponseAgainstSchema(
    query: DocumentNode,
    operation: { query: DocumentNode; variables?: Record<string, unknown> },
    response: FormattedExecutionResult<Record<string, any>, Record<string, any>>
  ) {
    const result = execute({
      schema: this.schema,
      document: query,
      variableValues: operation.variables,
      fieldResolver: (source, args, context, info) => {
        const value = source[info.fieldName];
        switch (info.returnType.toString()) {
          case "String":
            if (typeof value !== "string") {
              throw new TypeError(`Value is not string: ${value}`);
            }
            break;
          case "Float":
            if (typeof value !== "number") {
              throw new TypeError(`Value is not number: ${value}`);
            }
            break;
          case "Boolean":
            if (typeof value !== "boolean") {
              throw new TypeError(`Value is not boolean: ${value}`);
            }
            break;
        }

        return value;
      },
      rootValue: response.data,
    }) as FormattedExecutionResult;

    if (result.errors?.length) {
      throw new GraphQLError(
        `Error executing query against grown schema: ${result.errors
          .map((e) => e.message)
          .join(", ")}`
      );
    }
  }

  private getVariableDefinitionsFromAncestors(
    ancestors: readonly (ASTNode | readonly ASTNode[])[]
  ): OperationVariableDefinitions {
    const operationDefinition = ancestors.find(
      (ancestor) =>
        isSingle(ancestor) && ancestor.kind === Kind.OPERATION_DEFINITION
    );
    if (!operationDefinition) {
      return {};
    }
    return (
      operationDefinition.variableDefinitions?.reduce(
        (acc, variable) => ({
          ...acc,
          [variable.variable.name.value]: variable.type,
        }),
        {}
      ) ?? {}
    );
  }

  private getFieldArguments(
    node: FieldNode,
    operationVariableDefinitions: OperationVariableDefinitions
  ): InputValueDefinitionNode[] {
    return (
      node.arguments?.map((arg) => {
        let valueType: TypeNode;
        switch (arg.value.kind) {
          case Kind.VARIABLE:
            const variableDefinition =
              operationVariableDefinitions[arg.value.name.value];
            if (!variableDefinition) {
              throw new GraphQLError(
                `Variable \`${arg.value.name.value}\` is not defined`
              );
            }
            valueType = variableDefinition;
            break;
          case Kind.STRING:
            valueType = {
              kind: Kind.NAMED_TYPE,
              name: { kind: Kind.NAME, value: "String" },
            };
            break;
          case Kind.INT:
            valueType = {
              kind: Kind.NAMED_TYPE,
              name: { kind: Kind.NAME, value: "Int" },
            };
            break;
          case Kind.FLOAT:
            valueType = {
              kind: Kind.NAMED_TYPE,
              name: { kind: Kind.NAME, value: "Float" },
            };
            break;
          case Kind.BOOLEAN:
            valueType = {
              kind: Kind.NAMED_TYPE,
              name: { kind: Kind.NAME, value: "Boolean" },
            };
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
          type: valueType,
        };
      }) ?? []
    );
  }

  private getFieldDefinition(
    node: FieldNode,
    isList: boolean,
    actualValue: any,
    typename: string,
    type: GraphQLCompositeType,
    operationVariableDefinitions: OperationVariableDefinitions
  ): FieldDefinitionNode {
    const name = node.name.value;
    const args = this.getFieldArguments(node, operationVariableDefinitions);

    // Handle fields not in schema
    if (node.selectionSet) {
      // Handle object or list types
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
        name: { kind: Kind.NAME, value: name },
        type: fieldReturnType,
        arguments: args,
      };
    }

    // Handle scalar types
    let valueType: string;
    switch (typeof actualValue) {
      case "string":
        valueType = name === "id" ? "ID" : "String";
        break;
      case "number":
        valueType = "Float";
        break;
      case "boolean":
        valueType = "Boolean";
        break;
      default:
        throw new GraphQLError(
          `Scalar responses are not supported for field ${name} on type ${
            type.name
          } - received ${JSON.stringify(actualValue)}`
        );
    }
    return {
      kind: Kind.FIELD_DEFINITION,
      name: { kind: Kind.NAME, value: name },
      type: {
        kind: Kind.NAMED_TYPE,
        name: { kind: Kind.NAME, value: valueType },
      },
      arguments: args,
    };
  }

  public toString() {
    return printSchema(this.schema);
  }
}
