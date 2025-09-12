import {
  DocumentNode,
  OperationDefinitionNode,
  OperationTypeNode,
  Kind,
  GraphQLError,
  GraphQLErrorOptions,
  TypeNode,
  ObjectTypeDefinitionNode,
  UnionTypeDefinitionNode,
  InputObjectTypeDefinitionNode,
  SelectionSetNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  GraphQLSchema,
  buildASTSchema,
  printSchema,
  ValueNode,
  VariableDefinitionNode,
  NamedTypeNode,
  ObjectFieldNode,
  FieldNode,
  InlineFragmentNode,
  FragmentDefinitionNode,
  visit,
  ScalarTypeDefinitionNode,
  DirectiveDefinitionNode,
} from "graphql";
import { AIAdapter } from "../AIAdapter.js";
import {
  deepMerge,
  isFloat,
  RootTypeName,
  singularize,
  sortASTNodes,
  sortObjectASTNodes,
  sortUnionMembers,
  ucFirst,
} from "../../utils.js";
import { PLACEHOLDER_QUERY_NAME } from "../consts.js";

/**
 * The mapping of the operation field name to the root type name.
 */
const OPERATION_FIELD_TO_TYPE_NAME = {
  [OperationTypeNode.MUTATION]: RootTypeName.MUTATION,
  [OperationTypeNode.QUERY]: RootTypeName.QUERY,
  [OperationTypeNode.SUBSCRIPTION]: RootTypeName.SUBSCRIPTION,
};

export type GraphQLOperation = {
  query: DocumentNode;
  variables?: Record<string, unknown>;
};

export enum BuiltInScalarType {
  ID = "ID",
  INT = "Int",
  FLOAT = "Float",
  BOOLEAN = "Boolean",
  STRING = "String",
}

enum FieldReturnType {
  OBJECT = "object",
  UNION = "union",
  SCALAR = "scalar",
}

type ObjectReturnType = {
  type: TypeNode;
  kind: FieldReturnType.OBJECT;
  typeName: string;
};

type UnionReturnType = {
  type: TypeNode;
  kind: FieldReturnType.UNION;
  typeNames: string[];
};

type ScalarReturnType = {
  type: TypeNode;
  kind: FieldReturnType.SCALAR;
  scalarType: BuiltInScalarType;
};

type ReturnType = ObjectReturnType | UnionReturnType | ScalarReturnType;

export const BUILT_IN_SCALAR_TYPES = Object.values(BuiltInScalarType);

/**
 * A schema that is built from an operation and response.
 */
export class OperationSchema {
  /**
   * The type of the operation.
   */
  public readonly type: OperationTypeNode;
  /**
   * The name of the type of the operation.
   */
  public readonly typeName: string;
  /**
   * The name of the operation.
   */
  public readonly operationName: string;
  /**
   * The operation document's AST node.
   */
  private readonly operationNode: OperationDefinitionNode;
  /**
   * The variable definitions extracted from the operation document.
   */
  private readonly variableDefinitions = new Map<
    string,
    VariableDefinitionNode
  >();
  /**
   * The operation's variables.
   */
  private readonly variables: Record<string, unknown>;
  /**
   * A map of paths to return types metadata.
   */
  private paths = new Map<string, ReturnType | ReturnType[]>();
  /**
   * A map of fragment definitions extracted from the operation document.
   */
  private readonly fragmentDefinitions = new Map<
    string,
    FragmentDefinitionNode
  >();
  /**
   * A map of object type definitions extracted from the operation document.
   */
  public objectTypeDefinitions = new Map<string, ObjectTypeDefinitionNode>();
  /**
   * A map of union type definitions extracted from the operation document.
   */
  public unionTypeDefinitions = new Map<string, UnionTypeDefinitionNode>();
  /**
   * A map of input object type definitions extracted from the operation
   * document.
   */
  public inputObjectTypeDefinitions = new Map<
    string,
    InputObjectTypeDefinitionNode
  >();
  /**
   * A map of scalar type definitions extracted from the operation document.
   */
  public scalarTypeDefinitions = new Map<string, ScalarTypeDefinitionNode>();
  /**
   * A map of directive definitions extracted from the operation document.
   */
  public directiveDefinitions = new Map<string, DirectiveDefinitionNode>();
  /**
   * The schema that has been built for the operation.
   */
  private _schema: GraphQLSchema | undefined;
  /**
   * The AST of the built schema.
   */
  private _ast: DocumentNode | undefined;
  /**
   * The string representation of the built schema.
   */
  private _schemaString: string | undefined;

  constructor(
    public readonly operationDocument: GraphQLOperation,
    public readonly response: AIAdapter.Result,
    baseSchema?: DocumentNode | null
  ) {
    const { query: queryDocument, variables } = operationDocument;
    const operationNodes = queryDocument.definitions.filter(
      (definition) => definition.kind === Kind.OPERATION_DEFINITION
    );

    if (operationNodes.length === 0) {
      this.throwError("No operation definition found in operation document", {
        nodes: queryDocument,
      });
    }

    if (operationNodes.length > 1) {
      this.throwError(
        "No operation definition found in operation document. Only single operation definitions are supported.",
        {
          nodes: queryDocument,
        }
      );
    }

    if (baseSchema) {
      this.seedSchema(baseSchema);
    }

    this.operationNode = operationNodes[0];
    this.variableDefinitions = new Map(
      this.operationNode.variableDefinitions?.map((variable) => [
        variable.variable.name.value,
        variable,
      ])
    );
    this.variables = variables || {};
    this.type = this.operationNode.operation;
    this.typeName = OPERATION_FIELD_TO_TYPE_NAME[this.type];
    this.operationName = this.operationNode.name?.value ?? "Unnamed Operation";

    // Collect all the fragment definitions
    queryDocument.definitions.forEach((selection) => {
      if (selection.kind === Kind.FRAGMENT_DEFINITION) {
        this.fragmentDefinitions.set(selection.name.value, selection);
      }
    });

    // Crawl the variables, response, and selection set
    // to create the schema
    this.crawlVariables();
    this.crawlResponse();
    this.crawlSelectionSet(
      [this.typeName],
      this.typeName,
      this.operationNode.selectionSet
    );
    this.ensureQueryExists();
  }

  /**
   * Seeds the schema with the base schema.
   * @param baseSchema
   */
  private seedSchema(baseSchema: DocumentNode) {
    visit(baseSchema, {
      [Kind.OBJECT_TYPE_DEFINITION]: (node) => {
        this.objectTypeDefinitions.set(node.name.value, node);
      },
      [Kind.UNION_TYPE_DEFINITION]: (node) => {
        this.unionTypeDefinitions.set(node.name.value, node);
      },
      [Kind.INPUT_OBJECT_TYPE_DEFINITION]: (node) => {
        this.inputObjectTypeDefinitions.set(node.name.value, node);
      },
      [Kind.SCALAR_TYPE_DEFINITION]: (node) => {
        this.scalarTypeDefinitions.set(node.name.value, node);
      },
      [Kind.DIRECTIVE_DEFINITION]: (node) => {
        this.directiveDefinitions.set(node.name.value, node);
      },
    });
  }

  private ensureQueryExists() {
    if (!this.objectTypeDefinitions.has(RootTypeName.QUERY)) {
      this.objectTypeDefinitions.set(RootTypeName.QUERY, {
        kind: Kind.OBJECT_TYPE_DEFINITION,
        name: { kind: Kind.NAME, value: RootTypeName.QUERY },
        fields: [
          {
            type: {
              kind: Kind.NAMED_TYPE,
              name: { kind: Kind.NAME, value: BuiltInScalarType.BOOLEAN },
            },
            kind: Kind.FIELD_DEFINITION,
            name: { kind: Kind.NAME, value: PLACEHOLDER_QUERY_NAME },
          },
        ],
      });
    }
  }

  /**
   * Crawl the variable definitions to create the input objects.
   */
  private crawlVariables() {
    // Create all input objects from the operation's variable definitions.
    // By doing this here, we _may_ create unused input objects, but this
    // helps us avoid complexity in tying input objects to field definitions.
    this.variableDefinitions.forEach((variableDefinition, variableName) => {
      // Find the variable value that is related to the variable definition.
      const relatedVariableValue = this.variables[variableName];

      if (relatedVariableValue === undefined) {
        // If the variable value is not defined, then we have an error.
        this.throwError(`Variable '${variableName}' is not defined`);
      }

      // Get the leaf type of the variable definition.
      const variableType = OperationSchema.getLeafType(variableDefinition.type);

      // If the variable type is not a built-in scalar type, then we need to
      // create an input object for it.
      //
      // The user _may_ mean to use a custom scalar, but we don't support that
      // yet.
      if (
        !BUILT_IN_SCALAR_TYPES.includes(
          variableType.name.value as BuiltInScalarType
        )
      ) {
        // Create the input object for this variable and any other
        // input objects from its fields.
        this.getInputObjectsForVariableValue(
          variableType.name.value,
          relatedVariableValue
        );
      }
    });
  }

  /**
   * Crawl the response to create the return types.
   */
  private crawlResponse() {
    if (!this.response.data) {
      throw new GraphQLError("No 'data' found in operation response");
    }
    Object.entries(this.response.data).forEach(([key, value]) => {
      this.crawlValue([this.typeName], key, value);
    });
  }

  /**
   * Crawl the value to create the return types.
   * @param previousPath — The path to the parent of the current value.
   * @param name — The name of the value.
   * @param value — The value to crawl.
   * @returns The return type.
   */
  private crawlValue(previousPath: string[], name: string, value: any) {
    if (name === "__typename") {
      // Skip __typename fields. They're implicit in the schema.
      return;
    }
    // Create the path to the current value.
    const currentPath = [...previousPath, name];

    // Add the path the paths map along with its return type metadata.
    this.addPath(currentPath, name, value);

    if (typeof value === "object") {
      // If the value is an object, then we need to crawl it.
      if (Array.isArray(value)) {
        // If the value is an array, then we need to crawl it.
        this.crawlResponseArray(currentPath, name, value);
        return;
      }
      // Otherwise, this is an object and we need to crawl it another way.
      this.crawlResponseObject(currentPath, value);
    }
  }

  /**
   * Crawl the array to create the return types.
   * @param currentPath — The path to the parent of the current value.
   * @param name — The name of the current value.
   * @param value — The array to crawl.
   */
  private crawlResponseArray(
    currentPath: string[],
    name: string,
    value: any[]
  ) {
    // Get the type of all the items in the array so we can handle divergence.
    value.forEach((member) => {
      // Get the return type name for the member.
      this.getFieldReturnTypeName(name, member);
      if (Array.isArray(member)) {
        // If the member is an array, then we need to crawl it.
        this.crawlResponseArray(currentPath, name, member);
        return;
      }
      if (typeof member === "object") {
        // If the member is an object, then we need to crawl it.
        this.crawlResponseObject(currentPath, member);
        return;
      }
    });
  }

  /**
   * Crawl the object to create the return types.
   * @param currentPath — The path to the parent of the current value.
   * @param value — The object to crawl.
   */
  private crawlResponseObject(currentPath: string[], value: any) {
    Object.entries(value).forEach(([childKey, childValue]) =>
      this.crawlValue(currentPath, childKey, childValue)
    );
  }

  /**
   * Crawl the selection set to create the return types.
   * @param previousPath — The path to the parent of the current value.
   * @param currentTypeName — The name of the current type.
   * @param selectionSet — The selection set to crawl.
   */
  private crawlSelectionSet(
    previousPath: string[],
    currentTypeName: string,
    selectionSet: SelectionSetNode
  ) {
    // Either get the existing object type definition so we can update it if
    // it already exists, or create a new one.
    let objectTypeDefinition = this.objectTypeDefinitions.get(
      currentTypeName
    ) || {
      kind: Kind.OBJECT_TYPE_DEFINITION,
      name: { kind: Kind.NAME, value: currentTypeName },
      fields: [],
    };

    // Get the fields from the object type definition.
    const fields = new Map<string, FieldDefinitionNode>(
      objectTypeDefinition.fields?.map((field) => [field.name.value, field])
    );

    // Crawl the selection set.
    selectionSet.selections.forEach((selection) => {
      switch (selection.kind) {
        case Kind.FIELD:
          const field = this.handleFieldSelection(
            selection,
            previousPath,
            objectTypeDefinition
          );
          if (field) {
            fields.set(selection.name.value, field);
          }
          break;
        case Kind.INLINE_FRAGMENT:
          this.handleInlineFragmentSelection(selection, previousPath);
          break;
        case Kind.FRAGMENT_SPREAD:
          const fragmentDefinition = this.fragmentDefinitions.get(
            selection.name.value
          );
          if (fragmentDefinition) {
            this.crawlSelectionSet(
              previousPath,
              fragmentDefinition.typeCondition.name.value,
              fragmentDefinition.selectionSet
            );
          }
          break;
      }
    });

    if (fields.size === 0) {
      // If there are no fields, then we don't need to add anything to the schema
      return;
    }

    // Add or update the object type definition
    this.objectTypeDefinitions.set(objectTypeDefinition.name.value, {
      ...objectTypeDefinition,
      fields: sortASTNodes([...fields.values()]),
    });
  }

  /**
   * Handle the field selection.
   * @param selection — The field selection.
   * @param previousPath — The path to the parent of the current value.
   * @param objectTypeDefinition — The object type definition.
   * @returns The field definition.
   */
  private handleFieldSelection(
    selection: FieldNode,
    previousPath: string[],
    objectTypeDefinition: ObjectTypeDefinitionNode
  ): FieldDefinitionNode | undefined {
    // skip __typename fields. They're implicit in the schema.
    if (selection.name.value === "__typename") {
      return;
    }

    // Get the existing field definition
    const existingField = objectTypeDefinition?.fields?.find(
      (field) => field.name.value === selection.name.value
    );

    // Get the existing field arguments or create an empty map for tracking
    // the field's arguments
    const fieldArgs = new Map(
      existingField?.arguments?.map((obj) => [obj.name.value, obj])
    );

    // Collect the arguments from the field selection
    if (selection.arguments?.length) {
      selection.arguments?.forEach((arg) => {
        if (fieldArgs.has(arg.name.value)) {
          return;
        }
        fieldArgs.set(arg.name.value, {
          kind: Kind.INPUT_VALUE_DEFINITION,
          name: {
            kind: Kind.NAME,
            value: arg.name.value,
          },
          type: this.getArgumentTypeNode(arg.name.value, arg.value),
        });
      });
    }

    // Get the return type for the field
    let returnType = existingField?.type;

    // Create the path to the current value.
    const currentPath = [...previousPath, selection.name.value];

    // Get the return type from the paths map.
    let matchedReturnType = this.paths.get(currentPath.join("."));

    // If there is no return type for the field, we have an error
    if (!matchedReturnType) {
      this.throwError(
        `No return type found for field '${selection.name.value}'`,
        {
          extensions: {
            name: selection.name.value,
            matchedReturnType,
          },
        }
      );
    }

    // If the return type is an array, we need to create a union type for it.
    //
    // This happens when a field is nested in a list — a field on a type  in
    // the list — that has inconsistent return types. For example:
    // [
    //   {
    //     __typename: "User",
    //     name: "John",
    //     occupation: { __typename: "Doctor", type: "Dentist"}
    //   },
    //   {
    //     __typename: "User",
    //     name: "Jane",
    //     occupation: { __typename: "Finance", type: "Banker"}
    //   },
    // ]
    // This would handle the "occupation" field on the "User" type.
    if (Array.isArray(matchedReturnType)) {
      if (selection.selectionSet) {
        const typeNames = [
          ...new Set(
            matchedReturnType.flatMap((type) => {
              if (type.kind === FieldReturnType.UNION) {
                return type.typeNames;
              }
              if (type.kind === FieldReturnType.OBJECT) {
                return [type.typeName];
              }
              return [];
            })
          ),
        ];
        matchedReturnType = this.createUnionReturnType(typeNames);
      }
    }

    if (Array.isArray(matchedReturnType)) {
      // If the return type is still an array, we have an error.
      this.throwError("Matched return type is an array.", {
        extensions: {
          matchedReturnType,
        },
      });
    }

    if (
      matchedReturnType.kind === FieldReturnType.UNION &&
      selection.selectionSet
    ) {
      // If the field return type is a union, we need to crawl its selection set
      // to add any additional fields to the schema.
      matchedReturnType.typeNames.forEach((typeName) => {
        this.crawlSelectionSet(currentPath, typeName, selection.selectionSet!);
      });
    }

    if (
      matchedReturnType.kind === FieldReturnType.OBJECT &&
      selection.selectionSet
    ) {
      // If the field return type is an object, we need to crawl its
      // selection set to add any additional fields to the schema
      this.crawlSelectionSet(
        currentPath,
        matchedReturnType.typeName,
        selection.selectionSet
      );
    }

    // Get the return type from the matched return type.
    returnType = matchedReturnType.type;

    // Create the field definition.
    return {
      kind: Kind.FIELD_DEFINITION,
      name: { kind: Kind.NAME, value: selection.name.value },
      type: returnType,
      arguments: sortASTNodes([...fieldArgs.values()]),
    };
  }

  /**
   * Handle the inline fragment selection.
   * @param selection — The inline fragment selection.
   * @param previousPath — The path to the parent of the current value.
   * @returns The field definition.
   */
  private handleInlineFragmentSelection(
    selection: InlineFragmentNode,
    previousPath: string[]
  ): FieldDefinitionNode | undefined {
    if (!selection.typeCondition) {
      this.throwError("Inline fragment must have a type condition", {
        extensions: {
          selection,
        },
      });
    }
    const typeCondition = selection.typeCondition.name.value;
    this.crawlSelectionSet(previousPath, typeCondition, selection.selectionSet);
    return;
  }

  /**
   * Add a path to the paths map.
   * @param path — The path to the parent of the current value.
   * @param name — The name of the current value.
   * @param value — The value to add to the paths map.
   * @returns The field definition.
   */
  private addPath(path: string[], name: string, value: any) {
    const typeNode = this.getFieldReturnTypeNode(name, value);
    const pathString = path.join(".");
    const existingPathEntry = this.paths.get(pathString);
    if (!existingPathEntry || typeNode.kind === FieldReturnType.SCALAR) {
      // If there is no existing path entry or the type node is a scalar,
      // then we can just set the path entry to the type node.
      this.paths.set(pathString, typeNode);
      return;
    }
    if (Array.isArray(existingPathEntry)) {
      // If the existing path entry is an array, then we can just push the type
      // node to the array.
      existingPathEntry.push(typeNode);
      return;
    }
    // If there is an existing path entry, then we can create a new array with
    // the existing path entry and the new type node.
    this.paths.set(pathString, [existingPathEntry, typeNode]);
  }

  /**
   * Get the return type node for the field.
   * @param name — The name of the field.
   * @param value — The value of the field.
   * @returns The return type node.
   */
  private getFieldReturnTypeNode(name: string, value: any): ReturnType {
    if (typeof value === "undefined") {
      this.throwError(`No value provided for ${name}`, {
        extensions: {
          name,
          value,
        },
      });
    }

    if (typeof value === "object") {
      // If the value is an object, we need to determine the return type node.
      if (Array.isArray(value)) {
        // If the value is an array, we need to determine whether the return
        // type is a consistent list or a union of types.
        const uniqueMembers = this.getUniqueMembers(name, value);

        // If there are multiple unique members, we need to create a union type.
        if (uniqueMembers.size > 1) {
          const unionName = this.createUnionTypeDefinition([
            ...uniqueMembers.keys(),
          ]);
          const unionReturnType = this.createUnionReturnType(
            [...uniqueMembers.keys()],
            unionName
          );
          return {
            ...unionReturnType,
            type: {
              kind: Kind.LIST_TYPE,
              type: unionReturnType.type,
            },
          };
        }
        // If there are no multiple unique members, we can just return the
        // return type for the first member.
        return {
          type: {
            kind: Kind.LIST_TYPE,
            type: this.getFieldReturnTypeNode(name, value[0]).type,
          },
          kind: FieldReturnType.OBJECT,
          typeName: value[0].__typename,
        };
      }

      if (!value.__typename) {
        // If the object does not have a __typename, we have an error.
        this.throwError("Objects must include a __typename", {
          extensions: {
            value,
          },
        });
      }

      // Create the named type (object reference) return type.
      return {
        type: {
          kind: Kind.NAMED_TYPE,
          name: { kind: Kind.NAME, value: value.__typename },
        },
        kind: FieldReturnType.OBJECT,
        typeName: value.__typename,
      };
    }

    if (name === "id") {
      // If the name is "id", we need to return the ID scalar type.
      return {
        type: {
          kind: Kind.NON_NULL_TYPE,
          type: {
            kind: Kind.NAMED_TYPE,
            name: { kind: Kind.NAME, value: BuiltInScalarType.ID },
          },
        },
        kind: FieldReturnType.SCALAR,
        scalarType: BuiltInScalarType.ID,
      };
    }

    // Determine the return type based on the value type.
    switch (typeof value) {
      case "number":
        const scalarType =
          isFloat(value) ? BuiltInScalarType.FLOAT : BuiltInScalarType.INT;
        return {
          type: {
            kind: Kind.NAMED_TYPE,
            name: { kind: Kind.NAME, value: scalarType },
          },
          kind: FieldReturnType.SCALAR,
          scalarType,
        };
      case "boolean":
        return {
          type: {
            kind: Kind.NAMED_TYPE,
            name: { kind: Kind.NAME, value: BuiltInScalarType.BOOLEAN },
          },
          kind: FieldReturnType.SCALAR,
          scalarType: BuiltInScalarType.BOOLEAN,
        };
      case "string":
        return {
          type: {
            kind: Kind.NAMED_TYPE,
            name: { kind: Kind.NAME, value: BuiltInScalarType.STRING },
          },
          kind: FieldReturnType.SCALAR,
          scalarType: BuiltInScalarType.STRING,
        };
      default:
        this.throwError(
          `Custom scalar responses are not supported for field ${name}`,
          {
            extensions: value,
          }
        );
    }
  }

  /**
   * Get the return type name for the field.
   * @param name — The name of the field.
   * @param value — The value of the field.
   * @returns The return type name.
   */
  private getFieldReturnTypeName(name: string, value: any): string {
    if (!value) {
      this.throwError("No value provided");
    }
    if (typeof value === "object") {
      // If the value is an object, we need to determine the return type name.
      if (Array.isArray(value)) {
        // If the value is an array, we have an error.
        this.throwError("Array of objects is not supported", {
          extensions: {
            name,
            value,
          },
        });
      }
      if (!value.__typename) {
        // If the object does not have a __typename, we have an error.
        this.throwError("Objects must include a __typename", {
          extensions: {
            name,
            value,
          },
        });
      }
      // Return the __typename of the object.
      return value.__typename;
    }
    if (name === "id") {
      // If the name is "id", we need to return the ID scalar type.
      return BuiltInScalarType.ID;
    }

    // Determine the return type name based on the value type.
    switch (typeof value) {
      case "number":
        return isFloat(value) ? BuiltInScalarType.FLOAT : BuiltInScalarType.INT;
      case "boolean":
        return BuiltInScalarType.BOOLEAN;
      case "string":
        return BuiltInScalarType.STRING;
      default:
        this.throwError(
          `Custom scalar responses are not supported for field ${name}`,
          {
            extensions: {
              value,
            },
          }
        );
    }
  }

  /**
   * Get the argument type node for the field.
   * @param name — The name of the field.
   * @param valueNode — The value node.
   * @returns The argument type node.
   */
  private getArgumentTypeNode(name: string, valueNode: ValueNode): TypeNode {
    if (!valueNode) {
      this.throwError("No value provided");
    }

    // Determine the argument type based on the value node kind.
    switch (valueNode.kind) {
      case Kind.LIST:
        // If the value node is a list, we need to create a list type node for
        // the argument.
        let typeNode;

        // It's possible for each value in the list to be an input object of the
        // same type, but with different fields. To accommodate this, we need to
        // generate the type node for each value in the list to ensure we add
        // all the fields to the input object. We only use the last type node
        // generated because they will all be the same (a named type node or a
        // scalar type node).
        valueNode.values.forEach((value) => {
          typeNode = this.getArgumentTypeNode(name, value);
        });

        if (!typeNode) {
          this.throwError(`No type node created for list argument ${name}`, {
            nodes: valueNode,
            extensions: {
              name,
            },
          });
        }

        // Create the list type node.
        return {
          kind: Kind.LIST_TYPE,
          type: typeNode,
        };
      case Kind.OBJECT:
        // If the value node is an object, we need to create an input object
        // type node for the argument.
        const inputObjectName = OperationSchema.createInputObjectName(name);
        this.createInputObject(
          inputObjectName,
          this.getInputValueDefinitionsFromObjectFieldNodes(
            inputObjectName,
            valueNode.fields
          )
        );
        return {
          kind: Kind.NAMED_TYPE,
          name: {
            kind: Kind.NAME,
            value: inputObjectName,
          },
        };
      case Kind.ENUM:
        // We can't tell the difference between an enum and a string, so we
        // have to throw an error.
        this.throwError("Enums are not supported for argument", {
          extensions: {
            name,
            valueNode,
          },
        });
      case Kind.VARIABLE:
        // If the value node is a variable, we need to get the related variable
        // definition so we can use it as the argument type.
        const variableDefinition = this.variableDefinitions.get(
          valueNode.name.value
        );
        if (!variableDefinition) {
          this.throwError(
            `No definition found for variable "${valueNode.name.value}.`
          );
        }
        return variableDefinition.type;
      // Handle all the scalar types
      case Kind.BOOLEAN:
        return {
          kind: Kind.NAMED_TYPE,
          name: {
            kind: Kind.NAME,
            value: BuiltInScalarType.BOOLEAN,
          },
        };
      case Kind.FLOAT:
        return {
          kind: Kind.NAMED_TYPE,
          name: {
            kind: Kind.NAME,
            value: BuiltInScalarType.FLOAT,
          },
        };
      case Kind.INT:
        return {
          kind: Kind.NAMED_TYPE,
          name: {
            kind: Kind.NAME,
            value: BuiltInScalarType.INT,
          },
        };
      case Kind.STRING:
      case Kind.NULL:
        return {
          kind: Kind.NAMED_TYPE,
          name: {
            kind: Kind.NAME,
            value:
              name === "id" ? BuiltInScalarType.ID : BuiltInScalarType.STRING,
          },
        };
      default:
        this.throwError(
          `Custom scalar responses are not supported for field ${name}`,
          {
            nodes: valueNode,
          }
        );
    }
  }

  /**
   * Get the unique members of a value array.
   * @param name — The name of the field.
   * @param value — The value array.
   * @returns The unique members of the value array.
   */
  private getUniqueMembers(name: string, value: any[]): Map<string, any> {
    return new Map<string, any>(
      value.map((item) => [this.getFieldReturnTypeName(name, item), item])
    );
  }

  /**
   * Create a union type definition.
   * @param memberTypeNames — The names of the member types.
   * @returns The name of the union type definition.
   */
  private createUnionTypeDefinition(memberTypeNames: string[]): string {
    const name = OperationSchema.createUnionTypeDefinitionName(memberTypeNames);
    this.unionTypeDefinitions.set(name, {
      kind: Kind.UNION_TYPE_DEFINITION,
      name: { kind: Kind.NAME, value: name },
      types: sortASTNodes(
        memberTypeNames.map((item) => ({
          kind: Kind.NAMED_TYPE,
          name: { kind: Kind.NAME, value: item },
        }))
      ),
    });
    return name;
  }

  /**
   * Create a union return type.
   * @param memberTypeNames — The names of the member types.
   * @param unionName — The name of the union type definition. If not provided,
   * a union name will be generated from the member types.
   * @returns The union return type.
   */
  private createUnionReturnType(
    memberTypeNames: string[],
    unionName?: string
  ): UnionReturnType {
    return {
      type: {
        kind: Kind.NAMED_TYPE,
        name: {
          kind: Kind.NAME,
          value: unionName || this.createUnionTypeDefinition(memberTypeNames),
        },
      },
      kind: FieldReturnType.UNION,
      typeNames: memberTypeNames,
    };
  }

  /**
   * Create a name for the union type definition.
   * @param memberTypes — The names of the member types.
   * @returns The name of the union type definition.
   */
  private static createUnionTypeDefinitionName(memberTypes: string[]) {
    return `${sortUnionMembers([...new Set(memberTypes)]).join("")}Union`;
  }

  /**
   * Create a name for the input object based on the singular form of the
   * argument name + "Input".
   * @param argName — The argument name
   * @returns The input object name
   */
  private static createInputObjectName(argName: string) {
    return `${ucFirst(singularize(argName))}Input`;
  }

  /**
   * Get the input objects for a variable value.
   * @param name — The name of the input object.
   * @param variableValue — The variable value.
   * @returns The input objects for the variable value.
   */
  private getInputObjectsForVariableValue(
    name: string,
    variableValue: any
  ): void {
    this.createInputObject(
      name,
      this.getInputValueDefinitionsFromVariables(name, variableValue)
    );
  }

  /**
   * Create an input object type definition.
   * @param name — The name of the input object.
   * @param fields — The fields of the input object.
   * @returns The input object type definition.
   */
  private createInputObject(
    name: string,
    fields: InputValueDefinitionNode[]
  ): void {
    this.inputObjectTypeDefinitions.set(name, {
      kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
      name: { kind: Kind.NAME, value: name },
      fields: sortASTNodes(fields),
    });
  }

  /**
   * Get the input value definitions from variables.
   * @param inputObjectName — The name of the input object.
   * @param valuesInScope — The values in scope.
   * @returns The input value definitions.
   */
  getInputValueDefinitionsFromVariables(
    inputObjectName: string,
    valuesInScope: any
  ): InputValueDefinitionNode[] {
    // Get the existing input object type definition.
    const existingInputObject =
      this.inputObjectTypeDefinitions.get(inputObjectName);

    // Get the fields from the existing input object type definition.
    const fields = new Map(
      existingInputObject?.fields?.map((field) => [field.name.value, field])
    );

    // Initialize the values to handle.
    let valuesToHandle = valuesInScope;
    if (Array.isArray(valuesInScope)) {
      // If the values in scope is an array, then we need to merge the values
      // into a single object.
      valuesToHandle = valuesInScope.reduce((acc, item) => {
        return deepMerge(acc, item);
      }, {});
    }

    // Iterate over the values to handle and create the input value definitions.
    Object.entries(valuesToHandle).forEach(
      ([fieldName, fieldVariableValue]) => {
        let valueType: TypeNode;

        // Determine the value type based on the field variable value type.
        switch (typeof fieldVariableValue) {
          case "object":
            // If the field variable value is an object, then we need to create
            // a named type node for the input object.
            if (fieldVariableValue === null) {
              valueType = {
                kind: Kind.NAMED_TYPE,
                name: { kind: Kind.NAME, value: "String" },
              };
            } else {
              // Create the input object name.
              const inputObjectName =
                OperationSchema.createInputObjectName(fieldName);

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
              this.getInputObjectsForVariableValue(
                inputObjectName,
                variableValueToHandle
              );
            }
            break;
          case "string":
            valueType = {
              kind: Kind.NAMED_TYPE,
              name: {
                kind: Kind.NAME,
                value:
                  fieldName === "id" ?
                    BuiltInScalarType.ID
                  : BuiltInScalarType.STRING,
              },
            };
            break;
          case "number":
            valueType = {
              kind: Kind.NAMED_TYPE,
              name: {
                kind: Kind.NAME,
                value:
                  isFloat(fieldVariableValue) ?
                    BuiltInScalarType.FLOAT
                  : BuiltInScalarType.INT,
              },
            };
            break;
          case "boolean":
            valueType = {
              kind: Kind.NAMED_TYPE,
              name: { kind: Kind.NAME, value: BuiltInScalarType.BOOLEAN },
            };
            break;
          default:
            this.throwError(
              `Scalar responses are not supported for field ${fieldName}`,
              {
                extensions: {
                  fieldVariableValue,
                },
              }
            );
        }
        fields.set(fieldName, {
          kind: Kind.INPUT_VALUE_DEFINITION,
          name: { kind: Kind.NAME, value: fieldName },
          type: valueType,
        });
      }
    );
    return [...fields.values()];
  }

  /**
   * Get the input value definitions from object field nodes.
   * @param inputObjectName — The name of the input object.
   * @param objectFieldNodes — The object field nodes.
   * @returns The input value definitions.
   */
  getInputValueDefinitionsFromObjectFieldNodes(
    inputObjectName: string,
    objectFieldNodes: readonly ObjectFieldNode[]
  ): InputValueDefinitionNode[] {
    // Get the existing input object type definition.
    const existingInputObject =
      this.inputObjectTypeDefinitions.get(inputObjectName);

    // Get the fields from the existing input object type definition.
    const fields = new Map(
      existingInputObject?.fields?.map((field) => [field.name.value, field])
    );

    // Iterate over the object field nodes and create the input value
    // definitions.
    objectFieldNodes.forEach((node) => {
      const name = node.name.value;
      fields.set(name, {
        kind: Kind.INPUT_VALUE_DEFINITION,
        name: { kind: Kind.NAME, value: name },
        type: this.getArgumentTypeNode(node.name.value, node.value),
      });
    });
    return [...fields.values()];
  }

  /**
   * Get the leaf type of a type node.
   *
   * @param typeNode - The type node to get the leaf type of.
   * @returns The leaf type of the type node.
   */
  private static getLeafType(typeNode: TypeNode): NamedTypeNode {
    return typeNode.kind === Kind.NAMED_TYPE ?
        typeNode
      : OperationSchema.getLeafType(typeNode.type);
  }

  /**
   * Throw a GraphQL error.
   * @param message — The error message.
   * @param options — The error options.
   */
  private throwError(
    message: string,
    options: GraphQLErrorOptions = {}
  ): never {
    const nodes = options.nodes || this.operationNode;
    throw new GraphQLError(message, {
      ...options,
      nodes,
      extensions: {
        ...(options.extensions || {}),
        variables: this.variables,
        response: this.response,
      },
    });
  }

  /**
   * Get the GraphQL schema.
   * @returns The GraphQL schema.
   */
  public get schema(): GraphQLSchema {
    if (this._schema) {
      return this._schema;
    }
    this._schema = buildASTSchema(this.ast);
    return this._schema;
  }

  /**
   * Get the GraphQL AST.
   * @returns The GraphQL AST.
   */
  public get ast(): DocumentNode {
    if (this._ast) {
      return this._ast;
    }
    this._ast = {
      kind: Kind.DOCUMENT,
      definitions: sortObjectASTNodes([
        ...this.objectTypeDefinitions.values(),
        ...this.unionTypeDefinitions.values(),
        ...this.inputObjectTypeDefinitions.values(),
        ...this.scalarTypeDefinitions.values(),
        ...this.directiveDefinitions.values(),
      ]),
    };
    return this._ast;
  }

  /**
   * Get the GraphQL schema string.
   * @returns The GraphQL schema string.
   */
  public get schemaString(): string {
    if (this._schemaString) {
      return this._schemaString;
    }
    this._schemaString = printSchema(this.schema);
    return this._schemaString;
  }
}
