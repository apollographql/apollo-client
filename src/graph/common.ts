/**
 * Common constants, types, and utility functions between the graph read and
 * write implementations.
 */

import { FieldNode, ValueNode } from 'graphql';
import { GraphQLData, GraphQLObjectData } from '../graphql/data';

/**
 * A key that we add to data written and read from the store to represent what
 * the id of that data is in the store. This key is private and should not be
 * used by Apollo client users.
 *
 * Uses a symbol if available in the environment.
 *
 * @private
 */
export const ID_KEY = typeof Symbol !== 'undefined' ? Symbol('id') : '@@id';

/**
 * A reference to zero, one, or many nodes in the data graph.
 */
export type GraphReference = string | null | GraphReferenceArray;

/**
 * An array of `GraphReference`s. Used recursively.
 */
export interface GraphReferenceArray extends Array<GraphReference> {}

/**
 * Gets the key for a given field.
 */
export function getFieldKey (
  field: FieldNode,
  variables: { [variableName: string]: GraphQLData },
) {
  let key = field.name.value;

  // If the field has arguments then add them to the key.
  if (field.arguments && field.arguments.length > 0) {
    key += `({${field.arguments.map(arg => `"${arg.name.value}":${valueIntoJSON(arg.value, variables)}`).join(',')}})`;
  }

  return key;
}

/**
 * Transforms a GraphQL AST `ValueNode` into a JSON string.
 */
export function valueIntoJSON (
  value: ValueNode,
  variables: { [variableName: string]: GraphQLData },
): string {
  switch (value.kind) {
    case 'Variable':
      const variableName = value.name.value;
      const variableValue = variables[variableName];
      if (typeof variableValue === 'undefined') {
        throw new Error(`Could not find variable named '${variableName}'.`);
      }
      return JSON.stringify(variableValue);
    case 'IntValue':
    case 'FloatValue':
      return value.value;
    case 'StringValue':
    case 'BooleanValue':
    case 'EnumValue':
      return JSON.stringify(value.value);
    case 'NullValue':
      return 'null';
    case 'ListValue':
      return `[${value.values.map(item => valueIntoJSON(item, variables)).join(',')}]`;
    case 'ObjectValue':
      return `{${value.fields.map(field => `"${field.name.value}":${valueIntoJSON(field.value, variables)}`).join(',')}}`;
    default:
      throw new Error(`Unrecognized value '${(value as any).kind}'.`);
  }
}
