import { SelectionSetNode, FragmentDefinitionNode } from 'graphql';
import { ApolloAction, GraphDataAction } from '../actions';
import { Observable, Observer } from '../util/Observable';
import { GraphQLData, GraphQLObjectData } from '../graphql/data';
import { GraphReference } from './common';
import { writeToGraph, GetDataIDFn } from './write';
import { readFromGraph, GraphNodeReadPrimitives } from './read';

const DEFAULT_ID = 'ROOT_QUERY';

// Used to get a new transaction id for uncommit writes.
let nextTransactionID = 0;

/**
 * A `GraphStore` instance will allow you to save your GraphQL data in a
 * normalized form. This allows you to reactively respond to the changes in one
 * or more of your GraphQL nodes, and potentially fulfull GraphQL requests
 * from data you have queried before in a different shape. Avoiding server
 * requests entirely!
 *
 * Currently the `GraphStore` must integrate with a Redux store as long as
 * Apollo Client provides first class core support for Redux. It also has a
 * circular dependency with Redux so instantiation may be a little tricky. See
 * tests for an example of proper instantiation.
 */
export class ReduxGraphStore {
  /**
   * The empty state with which to initial a Redux store. If no state argument
   * is provided to the `reduxReduce` function then this state will be used as
   * the previous state.
   */
  public static initialState: ReduxState = {
    graphData: {},
    transactionIDs: [],
    transactionByID: {},
  };

  private readonly _getDataID: GetDataIDFn;
  private readonly _reduxDispatch: (action: ApolloAction) => void;
  private readonly _reduxGetState: () => ReduxState;
  private readonly _listeners: Array<() => void>;

  constructor ({
    reduxDispatch,
    reduxGetState,
    getDataID = () => null,
  }: {
    reduxDispatch: (action: ApolloAction) => void,
    reduxGetState: () => ReduxState,
    getDataID?: GetDataIDFn,
  }) {
    this._reduxDispatch = reduxDispatch;
    this._reduxGetState = reduxGetState;
    this._getDataID = getDataID;
    this._listeners = [];
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
    id: rootID = DEFAULT_ID,
    selectionSet,
    fragments,
    variables,
    data: rootData,
  }: {
    id?: string | null,
    data: GraphQLObjectData,
    selectionSet: SelectionSetNode,
    fragments?: { [fragmentName: string]: FragmentDefinitionNode },
    variables?: { [variableName: string]: GraphQLData },
  }): {
    data: GraphQLObjectData,
  } {
    // Set up our action. We will be pushing to the `patches` property when we
    // write.
    const action: GraphDataAction = {
      type: 'APOLLO_GRAPH_DATA',
      patches: [],
    };

    // Write our data to the graph and add the patches to be applied later in
    // our Redux reducer.
    const result = writeToGraph({
      graph: {
        getOrCreateNode: id => ({
          setScalar: (key, data) => action.patches.push({ id, key, value: { type: 'SCALAR', data } }),
          setReference: (key, reference) => action.patches.push({ id, key, value: { type: 'REFERENCE', reference } }),
        }),
      },
      // The root id is wrapped in parentheses to prevent accidental collisions
      // with generated keys.
      id: `(${rootID})`,
      data: rootData,
      selectionSet,
      fragments,
      variables,
      getDataID: this._getDataID,
    });

    // Dispatch the Redux action which will write to our store.
    this._reduxDispatch(action);

    return {
      data: result.data,
    };
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
    id: rootID = DEFAULT_ID,
    selectionSet,
    fragments,
    variables,
    data: rootData,
  }: {
    id?: string | null,
    data: GraphQLObjectData,
    selectionSet: SelectionSetNode,
    fragments?: { [fragmentName: string]: FragmentDefinitionNode },
    variables?: { [variableName: string]: GraphQLData },
  }): {
    data: GraphQLObjectData,
    commit: () => void,
    rollback: () => void,
  } {
    // Get the next transaction id.
    const transactionID = String(nextTransactionID++);

    // Set up our action. We will be pushing to the `patches` property when we
    // write.
    const action: GraphDataAction = {
      type: 'APOLLO_GRAPH_DATA',
      transactionID,
      patches: [],
    };

    // Write our data to the graph and add the patches to be applied later in
    // our Redux reducer.
    const result = writeToGraph({
      graph: {
        getOrCreateNode: id => ({
          setScalar: (key, data) => action.patches.push({ id, key, value: { type: 'SCALAR', data } }),
          setReference: (key, reference) => action.patches.push({ id, key, value: { type: 'REFERENCE', reference } }),
        }),
      },
      // The root id is wrapped in parentheses to prevent accidental collisions
      // with generated keys.
      id: `(${rootID})`,
      data: rootData,
      selectionSet,
      fragments,
      variables,
      getDataID: this._getDataID,
    });

    // Dispatch the Redux action which will write to our store.
    this._reduxDispatch(action);

    return {
      data: result.data,
      commit: () => { throw new Error('Unimplemented'); },
      rollback: () => this._reduxDispatch({ type: 'APOLLO_GRAPH_DATA_ROLLBACK', transactionID }),
    };
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
    id: rootID = DEFAULT_ID,
    selectionSet,
    fragments,
    variables,
    previousData,
    skipUncommitWrites,
  }: {
    id?: string,
    selectionSet: SelectionSetNode,
    fragments?: { [fragmentName: string]: FragmentDefinitionNode },
    variables?: { [variableName: string]: GraphQLData },
    previousData?: GraphQLObjectData,
    skipUncommitWrites?: boolean,
  }): {
    stale: boolean,
    data: GraphQLObjectData,
  } {
    const state = this._reduxGetState();

    // An array of all the graph data we will try to read from.
    //
    // We use this approach so that we can read from uncommit (or optimistic)
    // data.
    const graphs: Array<ReduxGraphData> = [
      state.graphData,
      ...(skipUncommitWrites ? [] : state.transactionIDs.map(id => state.transactionByID[id]!.graphData)),
    ];

    const graphPrimitives = {
      getNode: (id: string): GraphNodeReadPrimitives => {
        // Get all of the nodes corresponding to the provided id filtering out
        // any nodes which don’t exist.
        const nodes = graphs.map(graph => graph[id]).filter(node => typeof node !== 'undefined') as Array<ReduxGraphNodeData>;
        return {
          getScalar: (key: string): GraphQLData | undefined => {
            // Return the first scalar that is not undefined while iterating
            // backwards.
            for (let i = nodes.length - 1; i >= 0; i--) {
              const scalar = nodes[i].scalars[key];
              if (typeof scalar !== 'undefined') {
                return scalar;
              }
            }
            return;
          },
          getReference: (key: string): GraphReference | undefined => {
            // Return the first reference that is not undefined while iterating
            // backwards.
            for (let i = nodes.length - 1; i >= 0; i--) {
              const reference = nodes[i].references[key];
              if (typeof reference !== 'undefined') {
                return reference;
              }
            }

            return;
          },
        };
      },
    };

    const { stale, data } = readFromGraph({
      graph: graphPrimitives,
      // The root id is wrapped in parentheses to prevent accidental collisions
      // with generated keys.
      id: `(${rootID})`,
      selectionSet,
      fragments,
      variables,
      previousData,
    });

    return {
      stale,
      data,
    };
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
    id = DEFAULT_ID,
    selectionSet,
    fragments,
    variables,
    initialData,
    skipUncommitWrites,
  }: {
    id?: string,
    selectionSet: SelectionSetNode,
    fragments?: { [fragmentName: string]: FragmentDefinitionNode },
    variables?: { [variableName: string]: GraphQLData },
    initialData?: GraphQLObjectData,
    skipUncommitWrites?: boolean,
  }): Observable<{
    stale: boolean,
    data: GraphQLObjectData,
  }> {
    // We keep track of the previous result across *all* subscriptions so that
    // when we get a new subscription we can instantly push them the most recent
    // data.
    //
    // The initial result will use the `initialData` if provided, otherwise we
    // will do an initial read from the store.
    //
    // It is possible that a partial read error may be synchronously thrown
    // here.
    let previousResult = initialData ? { stale: false, data: initialData } : this.read({
      id,
      selectionSet,
      fragments,
      variables,
      skipUncommitWrites,
    });

    // An array of observers that will be called whenever we get some new data.
    const observers: Array<Observer<{ stale: boolean, data: GraphQLObjectData }>> = [];

    // Will get called whenever a write happens to our data.
    const listener = () => {
      try {
        // Since we got a new update, read from the graph to see if anything
        // changed.
        const nextResult = this.read({
          id,
          selectionSet,
          fragments,
          variables,
          previousData: previousResult.data,
          skipUncommitWrites,
        });

        // If something changed call all of our observers on the next tick and
        // update the `previousResult` variable.
        //
        // We call on the next tick so that if any errors are thrown then the
        // error will become an unhandled error allowing the user to deal with
        // it.
        if (nextResult.data !== previousResult.data || nextResult.stale !== previousResult.stale) {
          observers.forEach(observer => setTimeout(() => observer.next && observer.next(nextResult), 0));
          previousResult = nextResult;
        }
      } catch (error) {
        // If we caught an error then we must emit an error for all of our
        // observers.
        observers.forEach(observer => setTimeout(() => observer.error && observer.error(error), 0));
      }
    };

    return new Observable(observer => {
      // Instantly start the observable with the previous result on the next
      // tick.
      setTimeout(() => observer.next && observer.next(previousResult), 0);

      // Add the observer to our array of observers.
      observers.push(observer);

      // If our listener is not currently in the array of listeners then we need
      // to add it to the array.
      if (this._listeners.indexOf(listener) === -1) {
        this._listeners.push(listener);
      }

      return () => {
        // Remove the observer from our array of observers.
        const observerIndex = observers.indexOf(observer);
        if (observerIndex > -1) {
          observers.splice(observerIndex, 1);
        }

        // If there are no more observers in the observers then we want to
        // remove our listener. The listener will get added back if another
        // observable subscribes.
        if (observers.length === 0) {
          const listenerIndex = this._listeners.indexOf(listener);
          if (listenerIndex > -1) {
            this._listeners.splice(listenerIndex, 1);
          }
        }
      };
    });
  }

  /**
   * The redux reducer for this graph store.
   */
  public reduxReduce (previousState: ReduxState = ReduxGraphStore.initialState, action: ApolloAction) {
    if (action.type === 'APOLLO_GRAPH_DATA') {
      // If there were no patches then we can just return the data.
      if (action.patches.length === 0) {
        return previousState;
      }

      const state = { ...previousState };
      let previousGraph: ReduxGraphData;
      let graph: ReduxGraphData;

      // If this is not a transaction we should skip the commit phase and apply
      // the patches to the main graph data.
      if (typeof action.transactionID === 'undefined') {
        previousGraph = state.graphData;
        graph = { ...previousGraph };
        state.graphData = graph;
      }
      // Otherwise we want to write to a particular transaction’s graph data. If
      // no graph data exists for the transaction yet then we will need to
      // create some graph data.
      else {
        const transaction = state.transactionByID[action.transactionID];

        // If there is no transaction then we need to create a new transaction.
        // Otherwise use the graph data from the transaction.
        if (typeof transaction === 'undefined') {
          state.transactionIDs = [...previousState.transactionIDs, action.transactionID];
          previousGraph = {};
        } else {
          previousGraph = transaction.graphData;
        }

        // Clone the previous graph.
        graph = { ...previousGraph };

        // Set our new graph in the transaction graph data state.
        state.transactionByID = {
          ...state.transactionByID,
          [action.transactionID]: {
            ...transaction,
            graphData: graph,
          },
        };
      }

      // Apply every patch. We should only clone the nodes that we have to
      // clone, and we should only do that once.
      action.patches.forEach(patch => {
        const { id, key } = patch;

        const previousNode = previousGraph[id];
        let node = graph[id];
        // If there was no node in the graph then we create a node!
        if (!node) {
          node = { scalars: {}, references: {} };
          graph[id] = node;
        }
        // If the node is exactly the same as the previous node then we need to
        // clone the node before we mutate it.
        else if (previousNode && node === previousNode) {
          node = { ...previousNode };
          graph[id] = node;
        }

        switch (patch.value.type) {
          case 'SCALAR':
            // If the current scalars object is the same as the previous scalars
            // object then we need to clone it before mutating it.
            if (previousNode && node.scalars === previousNode.scalars) {
              node.scalars = { ...previousNode.scalars };
            }
            node.scalars[key] = patch.value.data;
            break;
          case 'REFERENCE':
            // If the current references object is the same as the previous
            // references object then we need to clone it before mutating it.
            if (previousNode && node.references === previousNode.references) {
              node.references = { ...previousNode.references };
            }
            node.references[key] = patch.value.reference;
            break;
          default:
            throw new Error(`Unrecognized patch type '${(patch as any).type}'.`);
        }
      });

      // Now that we have updated our state call all of our listeners on the
      // next tick because if we try to call `this._reduxGetState` on this tick
      // it will not return the correct data.
      setTimeout(() => this._callListeners(), 0);

      return state;
    }

    if (action.type === 'APOLLO_GRAPH_DATA_ROLLBACK') {
      const state = { ...previousState };

      // Remove the transaction id from the list of transaction ids.
      state.transactionIDs = state.transactionIDs.filter(transactionID => transactionID !== action.transactionID);

      // Remove the transaction id graph data from the transaction graph
      // data map.
      const { [action.transactionID]: _, ...nextTransactionByID } = state.transactionByID;
      state.transactionByID = nextTransactionByID;

      // Now that we have updated our state call all of our listeners on the
      // next tick because if we try to call `this._reduxGetState` on this tick
      // it will not return the correct data.
      setTimeout(() => this._callListeners(), 0);

      return state;
    }

    return previousState;
  }

  /**
   * Calls all of the listeners which have been registered. Most of the time
   * these listeners have been registered with `watch`.
   */
  private _callListeners () {
    this._listeners.forEach(listener => listener());
  }
}

/**
 * The state in Redux that the `ReduxGraphStore` interacts with. It contains a
 * canonical graph data object, but also it contains a list of graph data
 * objects that represent transactions which may be rolled back at any time.
 *
 * - `graphData` represents the canonical graph data state.
 * - `transactionIDs` is an ordered list of ids for transactions in the
 *   `transactionGraphData` map.
 * - `transactionGraphData` is a map of transaction ids to graph data objects.
 *   Transaction data is kept seperate so that it may be easily rolled back.
 */
export type ReduxState = {
  graphData: ReduxGraphData,
  transactionIDs: Array<string>,
  transactionByID: { [transactionID: string]: { graphData: ReduxGraphData } | undefined },
};

/**
 * The actual graph data object is a map of node ids to graph data nodes. The
 * nodes contain all of the actual data.
 */
export type ReduxGraphData = {
  [nodeID: string]: ReduxGraphNodeData | undefined,
};

/**
 * A graph node can contain some scalars (or attributes) and some
 * multi-dimensional references (or edges). Names were picked to resemble
 * GraphQL, but traditional graph nomenclature can easily apply as well.
 */
export type ReduxGraphNodeData = {
  scalars: { [scalarName: string]: GraphQLData | undefined },
  references: { [referenceName: string]: GraphReference | undefined },
};
