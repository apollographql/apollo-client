import {
  buildASTSchema,
  execute,
  FieldDefinitionNode,
  FormattedExecutionResult,
  GraphQLBoolean,
  GraphQLError,
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLUnionType,
  InputObjectTypeDefinitionNode,
  InputValueDefinitionNode,
  Kind,
  NamedTypeNode,
  ObjectTypeDefinitionNode,
  printSchema,
  UnionTypeDefinitionNode,
  visit,
} from "graphql";
import { AIAdapter } from "../AIAdapter.js";
import {
  BuiltInScalarType,
  GraphQLOperation,
  OperationSchema,
} from "./OperationSchema.js";
import {
  graphQLInputObjectTypeToInputObjectDefinitionNode,
  graphQLObjectTypeToObjectTypeDefinitionNode,
  graphQLUnionTypeToUnionTypeDefinitionNode,
  RootTypeName,
  sortASTNodes,
} from "../../utils.js";
import { PLACEHOLDER_QUERY_NAME } from "../consts.js";

/**
 * A schema that is progressively built as operations are added.
 */
export class GrowingSchema {
  /**
   * The schema that is progressively built as operations are added.
   *
   * We start with a schema containing an empty query type.
   * We will build the schema up as we go.
   */
  public schema = new GraphQLSchema({});

  // We need to track the seen queries with their variables to
  // accommodate changes to the input objects defined via the
  // variables.
  //
  // This will likely result in extra schema building attempts
  // that are mostly "skipped" but are necessary to ensure that
  // the input objects are correct.
  private seenQueries = new WeakSet<GraphQLOperation>();

  /**
   * The queue of schema merge tasks.
   * They must be treated as a queue to avoid race conditions.
   */
  private mergeTaskQueue: {
    operationSchema: OperationSchema;
    resolve: (value: void) => void;
    reject: (error: Error) => void;
  }[] = [];

  /**
   * Whether an operation is currently being merged into the schema.
   */
  private mergingOperation = false;

  /**
   * Adds an operation to the schema.
   * @param operationDocument — The operation to add to the schema.
   * @param response — The response to the operation.
   */
  public async add(
    operationDocument: GraphQLOperation,
    response: AIAdapter.Result
  ): Promise<void> {
    if (!this.seenQueries.has(operationDocument)) {
      // Return a promise that will be resolved when the operation is merged
      // into the schema
      return this.mergeOperationIntoSchema(operationDocument, response);
    }
    // If the operation has already been seen, resolve immediately
    return Promise.resolve();
  }

  /**
   * Merges an operation into the schema.
   * @param operationDocument — The operation to merge into the schema.
   * @param response — The response to the operation.
   */
  private async mergeOperationIntoSchema(
    operationDocument: GraphQLOperation,
    response: AIAdapter.Result
  ): Promise<void> {
    // Create a schema for the operation
    const operationSchema = new OperationSchema(operationDocument, response);

    return new Promise((resolve, reject) => {
      // Add to the merge task queue with its own promise handlers
      this.mergeTaskQueue.push({
        operationSchema,
        resolve,
        reject,
      });

      // Start processing the merge task queue if it is not already running
      this.processMergeTaskQueue();
    });
  }

  /**
   * Processes the merge task queue.
   */
  private processMergeTaskQueue() {
    // If already processing, return.
    // the queue will continue to be processed automatically.
    if (this.mergingOperation) {
      return;
    }

    // Process the next merge task in the queue
    const nextMergeTask = this.mergeTaskQueue.shift();
    if (!nextMergeTask) {
      // If the queue is empty, return
      return;
    }

    // Start merging the operation into the schema
    this.mergingOperation = true;
    this.mergeAndUpdateSchema(nextMergeTask.operationSchema)
      .then(() => {
        // Merging the operation into the schema succeeded :)
        nextMergeTask.resolve();
      })
      .catch((error) => {
        // Merging the operation into the schema failed :(
        nextMergeTask.reject(error);
      })
      .finally(() => {
        // Move on to the next merge task
        this.mergingOperation = false;

        // Process the next merge task in the queue
        if (this.mergeTaskQueue.length > 0) {
          this.processMergeTaskQueue();
        }
      });
  }

  /**
   * Merges an operation schema into the main schema.
   * @param operationSchema
   */
  private async mergeAndUpdateSchema(
    operationSchema: OperationSchema
  ): Promise<void> {
    // Save the previous schema to restore it if the operation fails
    const previousSchema = this.schema;

    try {
      // Merge the operation schema into the main schema
      const finalAst = visit(operationSchema.ast, {
        [Kind.OBJECT_TYPE_DEFINITION]: (node) => {
          const updatedNode = this.mergeObjectTypeDefinition(node);
          return updatedNode;
        },
        [Kind.UNION_TYPE_DEFINITION]: (node) => {
          return this.mergeUnionTypeDefinition(node);
        },
        [Kind.INPUT_OBJECT_TYPE_DEFINITION]: (node) => {
          return this.mergeInputObjectTypeDefinition(node);
        },
      });

      // Update the main schema with the merged operation schema
      this.schema = buildASTSchema(finalAst);

      // Validate that the operation and response are valid against the schema
      this.validateOperationAndResponseAgainstSchema(
        operationSchema.operationDocument,
        operationSchema.response
      );

      // Mark the operation as seen
      this.seenQueries.add(operationSchema.operationDocument);
    } catch (e) {
      // Restore the previous schema if the operation fails
      this.schema = previousSchema;
      throw e;
    }
  }

  /**
   * Merges a field definition into the schema.
   *
   * A field has been updated if:
   *
   * 1.  There is a new field
   * 2.  The arguments of the field have changed
   *
   * A change to a field return type should be skipped.
   * @param newField — The field definition to merge into the schema.
   * @param fields — The fields to merge into the schema.
   */
  private mergeFieldDefinition(
    newField: FieldDefinitionNode,
    fields: Map<string, FieldDefinitionNode>
  ) {
    const existingField = fields.get(newField.name.value);

    // If the field is new, add it to the fields map
    if (!existingField) {
      fields.set(newField.name.value, newField);
      return;
    }

    // Merge the arguments of the field
    const existingArgs = new Map(
      existingField.arguments?.map((arg) => [arg.name.value, arg]) || []
    );
    const mergedArgs =
      newField.arguments?.reduce((acc, arg) => {
        acc.set(arg.name.value, arg);
        return acc;
      }, new Map(existingArgs)) || existingArgs;

    if (mergedArgs.size > existingArgs.size) {
      // If the field has new arguments, update the field definition
      fields.set(newField.name.value, {
        ...existingField,
        arguments: [...mergedArgs.values()],
      } as FieldDefinitionNode);
    }

    // Return the updated fields map
    return fields;
  }

  /**
   * Merges an input value definition into the schema.
   * @param newField — The input value definition to merge into the schema.
   * @param fields — The input value definitions to merge into the schema.
   */
  private mergeInputValueDefinition(
    newField: InputValueDefinitionNode,
    fields: Map<string, InputValueDefinitionNode>
  ) {
    // A field is updated if it is a new field. A change to a field
    // return type should be skipped.
    const existingField = fields.get(newField.name.value);

    // If the field is new, add it to the fields map
    if (!existingField) {
      fields.set(newField.name.value, newField);
      return;
    }

    // Return the updated fields map
    return fields;
  }

  /**
   * Merges an input object type definition into the schema.
   * @param node — The input object type definition to merge into the schema.
   * @returns The merged input object type definition.
   */
  private mergeInputObjectTypeDefinition(node: InputObjectTypeDefinitionNode) {
    const existingType = this.schema.getType(node.name.value);

    // If the type does not exist, return the node
    if (!existingType) {
      return node;
    }

    // If the type is not an input object type, throw an error
    if (!(existingType instanceof GraphQLInputObjectType)) {
      throw new Error(
        `Expected ${
          node.name.value
        } to be an input object type. encountered ${existingType.toString()}`
      );
    }

    // Get the existing input object type definition AST node
    const existingTypeAstNode =
      existingType.astNode ||
      graphQLInputObjectTypeToInputObjectDefinitionNode(existingType);
    const updatedFields = this.collectUpdatedInputValueDefinitions(
      node,
      existingType
    );

    // If there are no updated fields, return the existing input object type
    // definition AST node
    if (updatedFields.length === 0) {
      return existingTypeAstNode;
    }

    // Return the updated input object type definition AST node
    return {
      ...existingTypeAstNode,
      fields: [...updatedFields],
    };
  }

  /**
   * Merges an object type definition into the schema.
   * @param node — The object type definition to merge into the schema.
   * @returns The merged object type definition.
   */
  private mergeObjectTypeDefinition(node: ObjectTypeDefinitionNode) {
    const existingType = this.schema.getType(node.name.value);

    // If the type does not exist, return the node
    if (!existingType) {
      return node;
    }

    // If the type is not an object type definition, throw an error
    if (!(existingType instanceof GraphQLObjectType)) {
      throw new Error(
        `Expected ${
          node.name.value
        } to be an object type. encountered ${existingType.toString()}`
      );
    }

    // Get the existing object type definition AST node
    const existingTypeAstNode =
      existingType.astNode ||
      graphQLObjectTypeToObjectTypeDefinitionNode(existingType);
    const updatedFields = this.collectUpdatedFieldDefinitions(
      node,
      existingType
    );

    // If there are no updated fields, return the existing object type
    // definition AST node
    if (updatedFields.length === 0) {
      return existingTypeAstNode;
    }

    // Return the updated object type definition AST node
    return {
      ...existingTypeAstNode,
      fields: [...updatedFields],
    };
  }

  /**
   * Merges a union type definition into the schema.
   * @param node — The union type definition to merge into the schema.
   * @returns The merged union type definition.
   */
  private mergeUnionTypeDefinition(node: UnionTypeDefinitionNode) {
    const existingType = this.schema.getType(node.name.value);

    // If the type does not exist, return the node
    if (!existingType) {
      return node;
    }

    // If the type is not a union type, throw an error
    if (!(existingType instanceof GraphQLUnionType)) {
      throw new Error(
        `Expected ${
          node.name.value
        } to be a union type. encountered ${existingType.toString()}`
      );
    }

    // Get the existing union type definition AST node
    const existingTypeAstNode =
      existingType.astNode ||
      graphQLUnionTypeToUnionTypeDefinitionNode(existingType);
    const updatedMembers = this.collectUpdatedUnionMembers(node, existingType);

    // Return the updated union type definition AST node
    return {
      ...existingTypeAstNode,
      types: [...updatedMembers],
    };
  }

  /**
   * Collects the updated field definitions for an object type definition.
   * @param node — The object type definition to collect the updated field
   * definitions for.
   * @param existingType — The existing object type definition.
   * @returns The updated field definitions.
   */
  private collectUpdatedFieldDefinitions(
    node: ObjectTypeDefinitionNode,
    existingType: GraphQLObjectType
  ): FieldDefinitionNode[] {
    // Create a map of the existing fields
    let fields = new Map(
      Object.values(existingType.getFields()).map((field) => [
        field.name,
        field.astNode as FieldDefinitionNode,
      ])
    );

    // Merge the field definitions from the new node with the existing fields
    node.fields?.forEach((field) => {
      this.mergeFieldDefinition(field, fields);
    });

    if (node.name.value === RootTypeName.QUERY) {
      // Remove the placeholder query field from the fields map if there are
      // real query fields present.
      //
      // The placeholder query field is only necessary when there are no real
      // query fields in the schema.
      const fieldsWithoutPlaceholder = new Map(fields);
      fieldsWithoutPlaceholder.delete(PLACEHOLDER_QUERY_NAME);
      if (fieldsWithoutPlaceholder.size > 0) {
        fields = fieldsWithoutPlaceholder;
      }
    }

    // Return the updated field definitions
    return sortASTNodes([...fields.values()]) as FieldDefinitionNode[];
  }

  /**
   * Collects the updated input value definitions for an input object type
   * definition.
   * @param node — The input object type definition to collect the updated input
   * value definitions for.
   * @param existingType — The existing input object type definition.
   * @returns The updated input value definitions.
   */
  private collectUpdatedInputValueDefinitions(
    node: InputObjectTypeDefinitionNode,
    existingType: GraphQLInputObjectType
  ): InputValueDefinitionNode[] {
    // Create a map of the existing fields
    const fields = new Map(
      Object.values(existingType.getFields()).map((field) => [
        field.name,
        field.astNode as InputValueDefinitionNode,
      ])
    );

    // Merge the input value definitions from the new node with the existing
    // fields
    node.fields?.forEach((field) => {
      this.mergeInputValueDefinition(field, fields);
    });

    // Return the updated input value definitions
    return sortASTNodes([...fields.values()]) as InputValueDefinitionNode[];
  }

  /**
   * Collects the updated union members for a union type definition.
   * @param node — The union type definition to collect the updated union
   * members for.
   * @param existingType — The existing union type definition.
   * @returns The updated union members.
   */
  private collectUpdatedUnionMembers(
    node: UnionTypeDefinitionNode,
    existingType: GraphQLUnionType
  ): NamedTypeNode[] {
    // Return the updated union members
    return sortASTNodes([
      ...new Set([
        ...(existingType.astNode?.types || []),
        ...(node.types || []),
      ]),
    ]);
  }

  /**
   * Validates an operation and response against the schema.
   * @param operation — The operation to validate.
   * @param response — The response to the operation.
   */
  private validateOperationAndResponseAgainstSchema(
    operation: GraphQLOperation,
    response: FormattedExecutionResult<Record<string, any>, Record<string, any>>
  ) {
    // Execute the operation against the schema
    const result = execute({
      schema: this.schema,
      document: operation.query,
      variableValues: operation.variables,
      fieldResolver: (source, args, context, info) => {
        const value = source[info.fieldName];

        // We use field resolvers to be more strict with the value types that
        // were returned by the AI.
        switch (info.returnType.toString()) {
          case BuiltInScalarType.STRING:
            if (typeof value !== "string") {
              throw new TypeError(
                `Value for scalar type ${BuiltInScalarType.STRING} is not string: ${value}`
              );
            }
            break;
          case BuiltInScalarType.FLOAT:
            if (typeof value !== "number") {
              throw new TypeError(
                `Value for scalar type ${BuiltInScalarType.FLOAT} is not number: ${value}`
              );
            }
            break;
          case BuiltInScalarType.INT:
            if (typeof value !== "number") {
              throw new TypeError(
                `Value for scalar type ${BuiltInScalarType.INT} is not number: ${value}`
              );
            }
            break;
          case BuiltInScalarType.BOOLEAN:
            if (typeof value !== "boolean") {
              throw new TypeError(
                `Value for scalar type ${BuiltInScalarType.BOOLEAN} is not boolean: ${value}`
              );
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

  /**
   * Returns a string representation of the schema.
   * @returns The string representation of the schema.
   */
  public toString(): string {
    return printSchema(this.schema);
  }
}
