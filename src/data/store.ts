import {
  ApolloAction,
  isQueryResultAction,
  isMutationResultAction,
  isUpdateQueryResultAction,
  isStoreResetAction,
  isSubscriptionResultAction,
  isWriteAction,
  QueryWithUpdater,
  DataWrite,
} from '../actions';

import { writeResultToStore } from './writeToStore';

import { TransactionDataProxy, DataProxy } from '../data/proxy';

import { QueryStore } from '../queries/store';

import { getOperationName } from '../queries/getFromAST';

import { MutationStore } from '../mutations/store';

import { ApolloReducerConfig, ApolloReducer } from '../store';

import { graphQLResultHasError, NormalizedCache } from './storeUtils';

import { replaceQueryResults } from './replaceQueryResults';

import { readQueryFromStore, diffQueryAgainstStore } from './readFromStore';

import { tryFunctionOrLogError } from '../util/errorHandling';

import {
  ExecutionResult,
  DocumentNode,
} from 'graphql';

import { assign } from '../util/assign';

export type OptimisticStoreItem = {
  mutationId: string,
  data: NormalizedCache,
  changeFn: () => void,
};

export class DataStore {
  private store: NormalizedCache;
  private optimistic: OptimisticStoreItem[] = [];
  private config: ApolloReducerConfig;

  constructor(config: ApolloReducerConfig, initialStore: NormalizedCache = {}) {
    this.config = config;
    this.store = initialStore;
  }

  public getStore(): NormalizedCache {
    return this.store;
  }

  public getOptimisticQueue(): OptimisticStoreItem[] {
    return this.optimistic;
  }

  public getDataWithOptimisticResults(): NormalizedCache {
    if (this.optimistic.length === 0) {
      return this.store;
    }

    const patches = this.optimistic.map(opt => opt.data);
    return assign({}, this.store, ...patches) as NormalizedCache;
  }

  public markQueryResult(queryId: string, requestId: number, result: ExecutionResult, document: DocumentNode, variables: any, extraReducers: ApolloReducer[], fetchMoreForQueryId?: string) {
    if (fetchMoreForQueryId) {
      return;
    }

    // XXX handle partial result due to errors
    if (!graphQLResultHasError(result)) {
      // TODO REFACTOR: is writeResultToStore a good name for something that doesn't actually
      // write to "the" store?
      this.store = writeResultToStore({
        result: result.data,
        dataId: 'ROOT_QUERY', // TODO: is this correct? what am I doing here? What is dataId for??
        document: document,
        variables: variables,
        store: {...this.store} as NormalizedCache,
        dataIdFromObject: this.config.dataIdFromObject,
        fragmentMatcherFunction: this.config.fragmentMatcher,
      });

      if (extraReducers) {
        extraReducers.forEach(reducer => {
          this.store = reducer(this.store, {
            type: 'APOLLO_QUERY_RESULT',
            result,
            document,
            operationName: getOperationName(document),
            variables,
            queryId,
            requestId,
          });
        });
      }
    }
  }

  public markSubscriptionResult(subscriptionId: number, result: ExecutionResult, document: DocumentNode, variables: any, extraReducers: ApolloReducer[]) {
    // the subscription interface should handle not sending us results we no longer subscribe to.
    // XXX I don't think we ever send in an object with errors, but we might in the future...
    if (!graphQLResultHasError(result)) {
      // TODO REFACTOR: is writeResultToStore a good name for something that doesn't actually
      // write to "the" store?
      this.store = writeResultToStore({
        result: result.data,
        dataId: 'ROOT_SUBSCRIPTION',
        document: document,
        variables: variables,
        store: {...this.store} as NormalizedCache,
        dataIdFromObject: this.config.dataIdFromObject,
        fragmentMatcherFunction: this.config.fragmentMatcher,
      });

      if (extraReducers) {
        extraReducers.forEach(reducer => {
          this.store = reducer(this.store, {
            type: 'APOLLO_SUBSCRIPTION_RESULT',
            result,
            document,
            operationName: getOperationName(document),
            variables,
            subscriptionId,
          });
        });
      }
    }
  }

  public markMutationInit(mutationId: string, mutation: DocumentNode, variables: any, updateQueries: { [queryId: string]: QueryWithUpdater }, update: ((proxy: DataProxy, mutationResult: Object) => void) | undefined, optimisticResponse: Object | Function | undefined, extraReducers: ApolloReducer[]) {
    if (optimisticResponse) {
      if (typeof optimisticResponse === 'function') {
        optimisticResponse = optimisticResponse(variables);
      }

      const optimisticData = this.getDataWithOptimisticResults();

      const changeFn = () => {
        this.markMutationResult(
          mutationId,
          { data: optimisticResponse },
          mutation,
          variables,
          updateQueries,
          update,
          extraReducers,
        );
      };

      const patch = this.collectPatch(
        optimisticData,
        changeFn
      );

      const optimisticState = {
        data: patch,
        mutationId: mutationId,
        changeFn,
      };

      this.optimistic.push(optimisticState);
    }
  }

  public markMutationResult(mutationId: string, result: ExecutionResult, document: DocumentNode, variables: any, updateQueries: { [queryId: string]: QueryWithUpdater }, update: ((proxy: DataProxy, mutationResult: Object) => void) | undefined, extraReducers: ApolloReducer[]) {
    // Incorporate the result from this mutation into the store
    if (!result.errors) {
      let newState = writeResultToStore({
        result: result.data,
        dataId: 'ROOT_MUTATION',
        document: document,
        variables: variables,
        store: {...this.store} as NormalizedCache,
        dataIdFromObject: this.config.dataIdFromObject,
        fragmentMatcherFunction: this.config.fragmentMatcher,
      });

      if (updateQueries) {
        Object.keys(updateQueries).filter(id => updateQueries[id]).forEach(queryId => {
          const { query, reducer } = updateQueries[queryId];

          // Read the current query result from the store.
          const { result: currentQueryResult, isMissing } = diffQueryAgainstStore({
            store: this.store,
            query: query.document,
            variables: query.variables,
            returnPartialData: true,
            fragmentMatcherFunction: this.config.fragmentMatcher,
            config: this.config,
          });

          if (isMissing) {
            return;
          }

          // Run our reducer using the current query result and the mutation result.
          const nextQueryResult = tryFunctionOrLogError(() => reducer(currentQueryResult, {
            mutationResult: result,
            queryName: getOperationName(query.document),
            queryVariables: query.variables,
          }));

          // Write the modified result back into the store if we got a new result.
          if (nextQueryResult) {
            newState = writeResultToStore({
              result: nextQueryResult,
              dataId: 'ROOT_QUERY',
              document: query.document,
              variables: query.variables,
              store: newState,
              dataIdFromObject: this.config.dataIdFromObject,
              fragmentMatcherFunction: this.config.fragmentMatcher,
            });
          }
        });

        this.store = newState;
      }

      // If the mutation has some writes associated with it then we need to
      // apply those writes to the store by running this reducer again with a
      // write action.
      if (update) {
        const proxy = new TransactionDataProxy(
          newState,
          this.config,
        );

        tryFunctionOrLogError(() => update(proxy, result));
        const writes = proxy.finish();
        this.executeWrites(writes);
      }

      if (extraReducers) {
        extraReducers.forEach(reducer => {
          this.store = reducer(this.store, {
            type: 'APOLLO_MUTATION_RESULT',
            result,
            document,
            operationName: getOperationName(document),
            variables,
            mutationId,
          });
        });
      }
    }
  }

  public markMutationComplete(mutationId: string) {
    // Create a shallow copy of the data in the store.
    const optimisticData = assign({}, this.store);

    const newState = this.optimistic
      // Throw away optimistic changes of that particular mutation
      .filter(item => item.mutationId !== mutationId)
      // Re-run all of our optimistic data actions on top of one another.
      .map(change => {
        const patch = this.collectPatch(
          optimisticData,
          change.changeFn,
        );

        assign(optimisticData, patch);

        return {
          ...change,
          data: patch,
        };
      });

    this.optimistic = newState;
  }

  public markUpdateQueryResult(document: DocumentNode, variables: any, newResult: any) {
    this.store = replaceQueryResults(
      this.store,
      { document, variables, newResult },
      this.config,
    );
  }

  public reset() {
    this.store = {};
  }

  public executeWrites(writes: DataWrite[]) {
    this.store = writes.reduce(
      (currentState, write) => writeResultToStore({
        result: write.result,
        dataId: write.rootId,
        document: write.document,
        variables: write.variables,
        store: currentState,
        dataIdFromObject: this.config.dataIdFromObject,
        fragmentMatcherFunction: this.config.fragmentMatcher,
      }),
      { ...this.store } as NormalizedCache,
    );
  }

  private collectPatch(before: NormalizedCache, fn: () => void): any {
    const orig = this.store
    this.store = before;
    fn()
    const after = this.store;
    this.store = orig;

    const patch: any = {};

    Object.keys(after).forEach(key => {
      if (after[key] !== before[key]) {
        patch[key] = after[key];
      }
    });

    return patch;
  }
}
