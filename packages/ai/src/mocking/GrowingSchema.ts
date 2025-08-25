import type {
  DefinitionNode,
  DocumentNode,
  FieldDefinitionNode,
  FieldNode,
  FormattedExecutionResult,
  GraphQLCompositeType,
  InputValueDefinitionNode,
  TypeNode,
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

            let newFieldDef = this.getFieldDefinition(
              node,
              isList,
              actualValue,
              typename,
              type
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

  public toString() {
    return printSchema(this.schema);
  }
}
