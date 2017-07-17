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

import { ExecutionResult, DocumentNode } from 'graphql';

import { assign } from '../util/assign';

import { cloneDeep } from '../util/cloneDeep';

export type OptimisticStoreItem = {
  mutationId: string;
  data: NormalizedCache;
  changeFn: () => void;
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

  public markQueryResult(
    queryId: string,
    requestId: number,
    result: ExecutionResult,
    document: DocumentNode,
    variables: any,
    extraReducers: ApolloReducer[],
    fetchMoreForQueryId: string | undefined,
  ) {
    // XXX handle partial result due to errors
    if (!fetchMoreForQueryId && !graphQLResultHasError(result)) {
      // TODO REFACTOR: is writeResultToStore a good name for something that doesn't actually
      // write to "the" store?
      writeResultToStore({
        result: result.data,
        dataId: 'ROOT_QUERY', // TODO: is this correct? what am I doing here? What is dataId for??
        document: document,
        variables: variables,
        store: this.store,
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

  public markSubscriptionResult(
    subscriptionId: number,
    result: ExecutionResult,
    document: DocumentNode,
    variables: any,
    extraReducers: ApolloReducer[],
  ) {
    // the subscription interface should handle not sending us results we no longer subscribe to.
    // XXX I don't think we ever send in an object with errors, but we might in the future...
    if (!graphQLResultHasError(result)) {
      // TODO REFACTOR: is writeResultToStore a good name for something that doesn't actually
      // write to "the" store?
      writeResultToStore({
        result: result.data,
        dataId: 'ROOT_SUBSCRIPTION',
        document: document,
        variables: variables,
        store: this.store,
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

  public markMutationInit(mutation: {
    mutationId: string;
    document: DocumentNode;
    variables: any;
    updateQueries: { [queryId: string]: QueryWithUpdater };
    update: ((proxy: DataProxy, mutationResult: Object) => void) | undefined;
    optimisticResponse: Object | Function | undefined;
    extraReducers: ApolloReducer[];
  }) {
    if (mutation.optimisticResponse) {
      let optimistic: Object;
      if (typeof mutation.optimisticResponse === 'function') {
        optimistic = mutation.optimisticResponse(mutation.variables);
      } else {
        optimistic = mutation.optimisticResponse;
      }

      const optimisticData = this.getDataWithOptimisticResults();

      const changeFn = () => {
        this.markMutationResult({
          mutationId: mutation.mutationId,
          result: { data: optimistic },
          document: mutation.document,
          variables: mutation.variables,
          updateQueries: mutation.updateQueries,
          update: mutation.update,
          extraReducers: mutation.extraReducers,
        });
      };

      const patch = this.collectPatch(optimisticData, changeFn);

      const optimisticState = {
        data: patch,
        mutationId: mutation.mutationId,
        changeFn,
      };

      this.optimistic.push(optimisticState);
    }
  }

  public markMutationResult(mutation: {
    mutationId: string;
    result: ExecutionResult;
    document: DocumentNode;
    variables: any;
    updateQueries: { [queryId: string]: QueryWithUpdater };
    update: ((proxy: DataProxy, mutationResult: Object) => void) | undefined;
    extraReducers: ApolloReducer[];
  }) {
    // Incorporate the result from this mutation into the store
    if (!mutation.result.errors) {
      const newState = { ...this.store } as NormalizedCache;
      writeResultToStore({
        result: mutation.result.data,
        dataId: 'ROOT_MUTATION',
        document: mutation.document,
        variables: mutation.variables,
        store: newState,
        dataIdFromObject: this.config.dataIdFromObject,
        fragmentMatcherFunction: this.config.fragmentMatcher,
      });

      if (mutation.updateQueries) {
        Object.keys(mutation.updateQueries)
          .filter(id => mutation.updateQueries[id])
          .forEach(queryId => {
            const { query, reducer } = mutation.updateQueries[queryId];

            // Read the current query result from the store.
            const {
              result: currentQueryResult,
              isMissing,
            } = diffQueryAgainstStore({
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
            const nextQueryResult = tryFunctionOrLogError(() =>
              reducer(currentQueryResult, {
                mutationResult: mutation.result,
                queryName: getOperationName(query.document),
                queryVariables: query.variables,
              }),
            );

            // Write the modified result back into the store if we got a new result.
            if (nextQueryResult) {
              writeResultToStore({
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
      const update = mutation.update;
      if (update) {
        const proxy = new TransactionDataProxy(newState, this.config);

        tryFunctionOrLogError(() => update(proxy, mutation.result));
        const writes = proxy.finish();
        this.executeWrites(writes);
      }

      if (mutation.extraReducers) {
        mutation.extraReducers.forEach(reducer => {
          this.store = reducer(this.store, {
            type: 'APOLLO_MUTATION_RESULT',
            mutationId: mutation.mutationId,
            result: mutation.result,
            document: mutation.document,
            operationName: getOperationName(mutation.document),
            variables: mutation.variables,
            mutation: mutation.mutationId,
          });
        });
      }
    }
  }

  public markMutationComplete(mutationId: string) {
    // Throw away optimistic changes of that particular mutation
    this.optimistic = this.optimistic.filter(
      item => item.mutationId !== mutationId,
    );

    // Re-run all of our optimistic data actions on top of one another.
    this.optimistic.forEach(change => {
      change.data = this.collectPatch(this.store, change.changeFn);
    });
  }

  public markUpdateQueryResult(
    document: DocumentNode,
    variables: any,
    newResult: any,
  ) {
    replaceQueryResults(
      this.store,
      { document, variables, newResult },
      this.config,
    );
  }

  public reset() {
    this.store = {};
  }

  public executeWrites(writes: DataWrite[]) {
    writes.forEach(write => {
      writeResultToStore({
        result: write.result,
        dataId: write.rootId,
        document: write.document,
        variables: write.variables,
        store: this.store,
        dataIdFromObject: this.config.dataIdFromObject,
        fragmentMatcherFunction: this.config.fragmentMatcher,
      });
    });
  }

  private collectPatch(before: NormalizedCache, fn: () => void): any {
    const orig = this.store;
    this.store = before;
    fn();
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
