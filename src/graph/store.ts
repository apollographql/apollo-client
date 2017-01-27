import { SelectionSetNode, FragmentDefinitionNode } from 'graphql';
import { Observable } from '../util/Observable';
import { GraphQLData, GraphQLObjectData } from '../graphql/types';
import { GetDataIDFn } from './types';

/**
 * A `GraphStore` instance will allow you to save your GraphQL data in a
 * normalized form. This allows you to reactively respond to the changes in one
 * or more of your GraphQL nodes, and potentially fulfull GraphQL requests
 * from data you have queried before in a different shape. Avoiding server
 * requests entirely!
 *
 * Currently the `GraphStore` must integrate with a Redux store as long as
 * Apollo Client provides first class core support for Redux.
 */
export class GraphStore {
  private _getDataId: GetDataIDFn;

  constructor ({
    getDataId,
  }: {
    getDataId?: GetDataIDFn,
  }) {
    this._getDataId = getDataId || (() => null);
  }

  /**
   * Writes data to the store using a given selection set, and starts at a given
   * id. The object that is written to the store will then be returned.
   *
   * If the `id` is null than root keys will not be written to the store.
   * Instead, as soon as a node with its own id is found then the data starts to
   * be written to the store.
   *
   * To write data to the store that may be easily rolled back, use the
   * `GraphStore#writeWithoutCommit` method.
   */
  public write ({
    selectionSet,
    fragments,
    variables,
    id,
    data,
  }: {
    selectionSet: SelectionSetNode,
    fragments: { [fragmentName: string]: FragmentDefinitionNode },
    variables: { [variableName: string]: GraphQLData },
    id: string | null,
    data: GraphQLObjectData,
  }): {
    data: GraphQLObjectData,
  }

  /**
   * Writes some data to the store while also providing a mechanism to rollback
   * the write. Returns the object that was written.
   *
   * This method is used to implement optimistic updates as while the uncommit
   * data will be visible to reads, it will not be persisted and may easily be
   * rolled back if a mutation fails.
   */
  public writeWithoutCommit ({
    selectionSet,
    fragments,
    variables,
    id,
    data,
  }: {
    selectionSet: SelectionSetNode,
    fragments: { [fragmentName: string]: FragmentDefinitionNode },
    variables: { [variableName: string]: GraphQLData },
    id: string | null,
    data: GraphQLObjectData,
  }): {
    data: GraphQLObjectData,
    commit: () => void,
    rollback: () => void,
  }

  /**
   * Reads data from the store at the current point in time.
   *
   * If a `previousData` value is provided then an attempt will be made to
   * preserve referential equality wherever an object is equal to itself. Also,
   * if the store does not contain enough information to fulfill a selection set
   * then we will try to use the id of the previous data to fetch stale data
   * instead of returning partial data.
   *
   * Uncommit data will be returned unless `skipUncommitWrites` is defined.
   */
  public read ({
    selectionSet,
    fragments,
    id,
    previousData,
    skipUncommitWrites,
  }: {
    selectionSet: SelectionSetNode,
    fragments: { [fragmentName: string]: FragmentDefinitionNode },
    variables: { [variableName: string]: GraphQLData },
    id: string,
    previousData?: GraphQLObjectData,
    skipUncommitWrites?: boolean,
  }): {
    partial: boolean,
    stale: boolean,
    data: GraphQLObjectData,
  }

  /**
   * Creates a hot observable that watches for changes in the store to a
   * selection set at a given id. Whenever a change of data in that position
   * occurs an update will be pushed to the observable.
   *
   * Referential equality will be attempted to be preserved over time when
   * nothing changes, and stale data from previous results will be preferred to
   * partial data where appropriate.
   *
   * When the observable is first subscribed to, an initial read from the store
   * will be returned.
   */
  public watch ({
    selectionSet,
    fragments,
    variables,
    id,
    initialData,
    skipUncommitWrites,
  }: {
    selectionSet: SelectionSetNode,
    fragments: { [fragmentName: string]: FragmentDefinitionNode },
    variables: { [variableName: string]: GraphQLData },
    id: string,
    initialData?: GraphQLObjectData,
    skipUncommitWrites?: boolean,
  }): Observable<{
    partial: boolean,
    stale: boolean,
    data: GraphQLObjectData,
  }>
}
