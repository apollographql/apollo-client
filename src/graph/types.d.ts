import { GraphQLData, GraphQLObjectData } from '../graphql/types';

/**
 * The normalized representation of a data graph where the key is an id, and the
 * value is a `NormalizedGraphNode`.
 */
export interface GraphData {
  [id: string]: GraphDataNode;
}

/**
 * A node in the normalized data graph. It contains some attributes (called
 * `scalars` to match GraphQL), and references to other nodes in the graph.
 *
 * For references there may be one reference, or a deeply nested array of
 * references. Any reference may also be null. When reading back from the store,
 * the same array structure should be used.
 */
export interface GraphDataNode {
  readonly scalars: { [key: string]: GraphQLData };
  readonly references: { [key: string]: GraphReference };
}

/**
 * A reference to zero, one, or many nodes in the data graph.
 */
export type GraphReference = string | null | GraphReferenceArray;

/**
 * An array of `GraphReference`s. Used recursively.
 */
export interface GraphReferenceArray extends Array<GraphReference> {}

/**
 * The type for the `dataIdFromObject` function.
 */
export interface GetDataIDFn {
  (data: GraphQLObjectData): string | null | undefined;
}
