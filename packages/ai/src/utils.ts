import {
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLUnionType,
  InputObjectTypeDefinitionNode,
  isListType,
  isWrappingType,
  Kind,
  ObjectTypeDefinitionNode,
  TypeNode,
  UnionTypeDefinitionNode,
} from "graphql";

export type NamedNode = { name: { value: string } };

/**
 * The names of the root types in the GraphQLSchema.
 */
export enum RootTypeName {
  MUTATION = "Mutation",
  QUERY = "Query",
  SUBSCRIPTION = "Subscription",
}

/**
 * The sort order of the root types in the schema.
 */
const ROOT_TYPE_ORDER: { [key: string]: number } = {
  [RootTypeName.QUERY]: 0,
  [RootTypeName.MUTATION]: 1,
  [RootTypeName.SUBSCRIPTION]: 2,
};

/**
 * Check if a number is a float (i.e. 9.5).
 *
 * @param num - The number to check.
 * @returns True if the number is a float, false otherwise.
 */
export function isFloat(num: number) {
  return typeof num === "number" && !Number.isInteger(num);
}

/**
 * Convert a plural word to its singular form.
 *
 * @param str - The plural word to convert.
 * @returns The singular form of the word.
 */
export function singularize(str: string) {
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
}

/**
 * Convert the first letter of a string to uppercase.
 *
 * @param str - The string to convert.
 * @returns The string with the first letter capitalized.
 */
export function ucFirst(str: string) {
  if (!str) {
    return "";
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Sorts object-level AST nodes by their name.
 *
 * AST Nodes named after a root type (like Query, Mutation, Subscription) are
 * sorted to the beginning of the list based on their defined order.
 *
 * All other AST Nodes are sorted alphabetically regardless of kind.
 * @param list — The list of AST Nodes to sort.
 * @returns The sorted list of AST Nodes.
 */
export function sortObjectASTNodes<T extends NamedNode>(list: T[]): T[] {
  return list.sort((a, b) => {
    const aName = a.name.value;
    const bName = b.name.value;

    const aOrder = ROOT_TYPE_ORDER[aName];
    const bOrder = ROOT_TYPE_ORDER[bName];

    // If both are root types, sort by their defined order
    if (aOrder !== undefined && bOrder !== undefined) {
      return aOrder - bOrder;
    }

    // If only a is a root type, it goes first
    if (aOrder !== undefined) {
      return -1;
    }

    // If only b is a root type, it goes first
    if (bOrder !== undefined) {
      return 1;
    }

    // Neither is a root type, sort alphabetically
    return aName.localeCompare(bName);
  });
}

/**
 * Sorts union member names alphabetically.
 * @param members — The list of union member names to sort.
 * @returns The sorted list of union member names.
 */
export function sortUnionMembers(members: string[]): string[] {
  return members.sort((a, b) => {
    return a.localeCompare(b);
  });
}

/**
 * Sorts AST nodes by their name alphabetically.
 *
 * Unlike `sortObjectASTNodes`, this function sorts alphabetically regardless
 * of kind or name.
 * @param nodes — The list of AST nodes to sort.
 * @returns The sorted list of AST nodes.
 */
export function sortASTNodes<T extends NamedNode>(nodes: T[]): T[] {
  return nodes.sort((a, b) => {
    return a.name.value.localeCompare(b.name.value);
  });
}

/**
 * Transforms a GraphQL Input/Output type to an AST TypeNode.
 * @param type — The GraphQL Input/Output type to transform
 * @returns The AST TypeNode
 */
export function graphQLTypeToTypeNode(
  type: GraphQLOutputType | GraphQLInputType
): TypeNode {
  if (isWrappingType(type)) {
    // Recursively transform the wrapped type
    const returnType = graphQLTypeToTypeNode(type.ofType);

    // If the type is a non-null type, return the non-null type to avoid
    // unnecessary wrapping (but this also shouldn't actually happen)
    if (returnType.kind === Kind.NON_NULL_TYPE) {
      return returnType;
    }

    // Return the wrapped type
    return {
      kind: isListType(type) ? Kind.LIST_TYPE : Kind.NON_NULL_TYPE,
      type: returnType,
    };
  }
  return {
    kind: Kind.NAMED_TYPE,
    name: { kind: Kind.NAME, value: type.name },
  };
}

/**
 * Transforms a GraphQL Object type to an AST ObjectTypeDefinitionNode.
 * @param type — The GraphQL Object type to transform
 * @returns The AST ObjectTypeDefinitionNode
 */
export function graphQLObjectTypeToObjectTypeDefinitionNode(
  type: GraphQLObjectType
): ObjectTypeDefinitionNode {
  return {
    kind: Kind.OBJECT_TYPE_DEFINITION,
    name: { kind: Kind.NAME, value: type.name },
    fields: sortASTNodes(
      Object.values(type.getFields()).map((field) => ({
        kind: Kind.FIELD_DEFINITION,
        name: { kind: Kind.NAME, value: field.name },
        type: graphQLTypeToTypeNode(field.type),
      }))
    ),
  };
}

/**
 * Transforms a GraphQL Input type to an AST InputObjectTypeDefinitionNode.
 * @param type — The GraphQL Input type to transform
 * @returns The AST InputObjectTypeDefinitionNode
 */
export function graphQLInputObjectTypeToInputObjectDefinitionNode(
  type: GraphQLInputObjectType
): InputObjectTypeDefinitionNode {
  return {
    kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
    name: { kind: Kind.NAME, value: type.name },
    fields: sortASTNodes(
      Object.values(type.getFields()).map((field) => ({
        kind: Kind.INPUT_VALUE_DEFINITION,
        name: { kind: Kind.NAME, value: field.name },
        type: graphQLTypeToTypeNode(field.type),
      }))
    ),
  };
}

/**
 * Transforms a GraphQL Union type to an AST UnionTypeDefinitionNode.
 * @param type — The GraphQL Union type to transform
 * @returns The AST UnionTypeDefinitionNode
 */
export function graphQLUnionTypeToUnionTypeDefinitionNode(
  type: GraphQLUnionType
): UnionTypeDefinitionNode {
  return {
    kind: Kind.UNION_TYPE_DEFINITION,
    name: { kind: Kind.NAME, value: type.name },
    types: sortASTNodes(
      Object.values(type.getTypes()).map((memberType) => ({
        kind: Kind.NAMED_TYPE,
        name: { kind: Kind.NAME, value: memberType.name },
      }))
    ),
  };
}

/**
 * Deep merge utility function to preserve nested properties.
 *
 * @param target - The target object to merge into.
 * @param source - The source object to merge from.
 * @returns The merged object.
 */
export function deepMerge(target: any, source: any): any {
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

/**
 * Converts a value to a formattedJSON string.
 * This handles Map and Set instances by converting them to objects/arrays.
 * @param value — The value to convert to a JSON string
 * @returns The JSON string
 */
export function toJSON(value: any) {
  return JSON.stringify(
    value,
    (key: string, value: any) => {
      if (value instanceof Map) {
        return {
          dataType: "Map",
          value: Object.fromEntries(value.entries()),
        };
      } else if (value instanceof Set) {
        return {
          dataType: "Set",
          value: [...value],
        };
      } else {
        return value;
      }
    },
    2
  );
}
