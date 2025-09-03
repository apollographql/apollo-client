import type {
  ASTNode,
  DefinitionNode,
  DocumentNode,
  FieldDefinitionNode,
  FieldNode,
  FormattedExecutionResult,
  GraphQLCompositeType,
  GraphQLNamedType,
  InputObjectTypeDefinitionNode,
  InputObjectTypeExtensionNode,
  InputValueDefinitionNode,
  NamedTypeNode,
  TypeNode,
  VariableDefinitionNode,
} from "graphql";
import {
  execute,
  extendSchema,
  FieldsOnCorrectTypeRule,
  GraphQLError,
  GraphQLInputObjectType,
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

const rulesToIgnore = [FieldsOnCorrectTypeRule];

const enforcedRules = specifiedRules.filter(
  (rule) => !rulesToIgnore.includes(rule)
);

/**
 * Type guard for checking if an item is a single item.
 *
 * @param item - The item to check.
 * @returns True if the item is a single item, false otherwise.
 */
const isSingle = <T>(item: T | readonly T[]): item is T => !Array.isArray(item);

/**
 * Get the leaf type of a type node.
 *
 * @param typeNode - The type node to get the leaf type of.
 * @returns The leaf type of the type node.
 */
const getLeafType = (typeNode: TypeNode): NamedTypeNode => {
  return typeNode.kind === Kind.NAMED_TYPE ?
      typeNode
    : getLeafType(typeNode.type);
};

/**
 * Convert the first letter of a string to uppercase.
 *
 * @param str - The string to convert.
 * @returns The string with the first letter capitalized.
 */
const ucFirst = (str: string) => {
  if (!str) {
    return "";
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Convert a plural word to its singular form.
 *
 * @param str - The plural word to convert.
 * @returns The singular form of the word.
 */
const singularize = (str: string) => {
  if (!str) {
    return "";
  }

  // Handle common pluralization patterns
  if (str.endsWith("ies")) {
    return str.slice(0, -3) + "y";
  } else if (str.endsWith("ves")) {
    return str.slice(0, -3) + "f";
  } else if (str.endsWith("es")) {
    // Special cases for -es endings
    if (str.endsWith("ches") || str.endsWith("shes") || str.endsWith("xes")) {
      return str.slice(0, -2);
    } else if (str.endsWith("ses")) {
      return str.slice(0, -2);
    } else {
      return str.slice(0, -1);
    }
  } else if (str.endsWith("s") && str.length > 1) {
    return str.slice(0, -1);
  }

  return str;
};

/**
 * Check if a number is a float (i.e. 9.5).
 *
 * @param num - The number to check.
 * @returns True if the number is a float, false otherwise.
 */
function isFloat(num: number) {
  return typeof num === "number" && !Number.isInteger(num);
}

/**
 * Deep merge utility function to preserve nested properties.
 *
 * @param target - The target object to merge into.
 * @param source - The source object to merge from.
 * @returns The merged object.
 */
function deepMerge(target: any, source: any): any {
  if (source === null || typeof source !== "object") {
    return source;
  }

  if (Array.isArray(source)) {
    return source;
  }

  if (target === null || typeof target !== "object" || Array.isArray(target)) {
    target = {};
  }

  const result = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (
        typeof source[key] === "object" &&
        source[key] !== null &&
        !Array.isArray(source[key])
      ) {
        result[key] = deepMerge(result[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }

  return result;
}

const ScalarTypes = ["String", "Int", "Float", "Boolean", "ID"];

export type OperationVariableDefinitions = Record<string, TypeNode>;

type GraphQLOperation = {
  query: DocumentNode;
  variables?: Record<string, unknown>;
};

type InputObject = InputObjectTypeDefinitionNode | InputObjectTypeExtensionNode;
type InputObjectsList = InputObject[];

export class GrowingSchema {
  public schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: "Query",
      fields: {},
    }),
  });

  // We need to track the seen queries with their variables to
  // accommodate changes to the input objects defined via the
  // variables.
  //
  // This will likely result in extra schema building attempts
  // that are mostly "skipped" but are necessary to ensure that
  // the input objects are correct.
  private seenQueries = new WeakSet<GraphQLOperation>();

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

  public add(operation: GraphQLOperation, response: AIAdapter.Result) {
    const previousSchema = this.schema;

    try {
      if (!this.seenQueries.has(operation)) {
        this.mergeQueryIntoSchema(operation, response);
      }

      this.validateResponseAgainstSchema(operation, response);
      this.seenQueries.add(operation);
    } catch (e) {
      this.schema = previousSchema;
      throw e;
    }
  }

  public mergeQueryIntoSchema(
    operation: GraphQLOperation,
    response: AIAdapter.Result
  ) {
    const query = operation.query;

    const variables = operation.variables;
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

    const variableDefinitions: VariableDefinitionNode[] = [];

    query.definitions.forEach((definition) => {
      if (definition.kind !== Kind.OPERATION_DEFINITION) {
        return;
      }
      variableDefinitions.push(...(definition.variableDefinitions ?? []));
    });

    // Create all input objects from the operation's variable definitions.
    // By doing this here, we _may_ create unused input objects, but this
    // helps us avoid complexity in tying input objects to field definitions.
    const inputObjects = this.mergeRepeatedInputObjects(
      variableDefinitions.reduce(
        (acc, variableDefinition) => {
          const leafType = getLeafType(variableDefinition.type);
          const relatedVariable =
            variables?.[variableDefinition.variable.name.value];

          if (relatedVariable === undefined) {
            throw new GraphQLError(
              `Variable \`${variableDefinition.variable.name.value}\` is not defined`
            );
          }

          if (!ScalarTypes.includes(leafType.name.value)) {
            // Create the input object for this variable and any other
            // input objects from its fields.
            const inputObjects = this.getInputObjectsForVariableValue(
              leafType.name.value,
              relatedVariable
            );
            acc.push(...inputObjects);
          }
          return acc;
        },
        [] as (InputObjectTypeDefinitionNode | InputObjectTypeExtensionNode)[]
      ) || []
    );

    accumulatedExtensions.definitions.push(...inputObjects);

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
    operation: GraphQLOperation,
    response: FormattedExecutionResult<Record<string, any>, Record<string, any>>
  ) {
    const result = execute({
      schema: this.schema,
      document: operation.query,
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
      const operationName = operation.query.definitions.find(
        (def) => def.kind === Kind.OPERATION_DEFINITION
      )?.name?.value;
      throw new GraphQLError(
        `Error executing query \`${
          operationName ? operationName : "unnamed query"
        }\` against grown schema: ${result.errors
          .map((e) => e.message)
          .join(", ")}`
      );
    }
  }

  private getType<T extends GraphQLNamedType>(name: string): T | undefined {
    if (!name) {
      return undefined;
    }
    return this.schema.getType(name) as T;
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

  private getInputObjectsForVariableValue(
    name: string,
    variableValue: any
  ): InputObjectsList {
    const { fields, inputObjects } = this.getInputValueDefinitionsFromVariables(
      name,
      variableValue
    );
    // Return this input object and any other input objects
    // created from its fields.
    return [
      {
        kind:
          this.getType(name) ?
            Kind.INPUT_OBJECT_TYPE_EXTENSION
          : Kind.INPUT_OBJECT_TYPE_DEFINITION,
        name: { kind: Kind.NAME, value: name },
        fields,
      },
      ...inputObjects,
    ];
  }

  getInputValueDefinitionsFromVariables(
    inputObjectName: string,
    valuesInScope: any
  ): {
    fields: InputValueDefinitionNode[];
    inputObjects: InputObjectsList;
  } {
    const existingInputObject =
      this.getType<GraphQLInputObjectType>(inputObjectName);
    const existingInputObjectFields =
      existingInputObject?.astNode?.fields?.map((field) => field.name.value) ||
      [];
    const inputObjects: InputObjectsList = [];

    let valuesToHandle = valuesInScope;
    if (Array.isArray(valuesInScope)) {
      valuesToHandle = valuesInScope.reduce((acc, item) => {
        return deepMerge(acc, item);
      }, {});
    }

    const fields = Object.entries(valuesToHandle)
      .map(([fieldName, fieldVariableValue]) => {
        let valueType: TypeNode;
        switch (typeof fieldVariableValue) {
          case "object":
            if (fieldVariableValue === null) {
              valueType = {
                kind: Kind.NAMED_TYPE,
                name: { kind: Kind.NAME, value: "String" },
              };
            } else {
              // Create a name for the input object based on the singular
              // form of the field name + "Input".
              const inputObjectName = `${ucFirst(singularize(fieldName))}Input`;

              // Create a type node for the input object.
              valueType = {
                kind: Kind.NAMED_TYPE,
                name: { kind: Kind.NAME, value: inputObjectName },
              };

              // If the field value is an array, then we need to create a list
              // type node for the input object and merge the array items
              // into a single object for creating the input object.
              let variableValueToHandle = fieldVariableValue;
              if (Array.isArray(fieldVariableValue)) {
                valueType = {
                  kind: Kind.LIST_TYPE,
                  type: valueType,
                };
                variableValueToHandle = fieldVariableValue.reduce(
                  (acc, item) => {
                    return deepMerge(acc, item);
                  },
                  {}
                );
              }

              // Create the input object and any other input objects from its
              // fields.
              const inputObject = this.getInputObjectsForVariableValue(
                inputObjectName,
                variableValueToHandle
              );
              inputObjects.push(...inputObject);
            }
            break;
          case "string":
            valueType = {
              kind: Kind.NAMED_TYPE,
              name: {
                kind: Kind.NAME,
                value: fieldName === "id" ? "ID" : "String",
              },
            };
            break;
          case "number":
            valueType = {
              kind: Kind.NAMED_TYPE,
              name: {
                kind: Kind.NAME,
                value: isFloat(fieldVariableValue) ? "Float" : "Int",
              },
            };
            break;
          case "boolean":
            valueType = {
              kind: Kind.NAMED_TYPE,
              name: { kind: Kind.NAME, value: "Boolean" },
            };
            break;
          default:
            throw new GraphQLError(
              `Scalar responses are not supported for field ${fieldName} - received ${JSON.stringify(
                fieldVariableValue
              )}`
            );
        }
        return {
          kind: Kind.INPUT_VALUE_DEFINITION,
          name: { kind: Kind.NAME, value: fieldName },
          type: valueType,
        } as InputValueDefinitionNode;
      })
      .filter(
        (field) => !existingInputObjectFields?.includes(field.name.value)
      );
    return { fields, inputObjects };
  }

  mergeRepeatedInputObjects(inputObjects: InputObjectsList): InputObjectsList {
    return Object.values(
      inputObjects.reduce(
        (acc, inputObject) => {
          const existingInputObject = acc[inputObject.name.value];
          if (existingInputObject) {
            acc[inputObject.name.value] = {
              ...existingInputObject,
              fields: [
                ...(existingInputObject?.fields || []),
                ...(inputObject.fields || []),
              ],
            };
          } else {
            acc[inputObject.name.value] = inputObject;
          }
          return acc;
        },
        {} as Record<string, InputObject>
      )
    );
  }

  public toString() {
    return printSchema(this.schema);
  }
}
