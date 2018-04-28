import { ExecutionResult, DocumentNode } from 'graphql';
import { ApolloCache, Cache, DataProxy } from 'apollo-cache';

import { QueryStoreValue } from '../data/queries';
import {
  getOperationName,
  tryFunctionOrLogError,
  graphQLResultHasError,
} from 'apollo-utilities';
import { MutationQueryReducer } from '../core/types';

export type QueryWithUpdater = {
  updater: MutationQueryReducer<Object>;
  query: QueryStoreValue;
};

export interface DataWrite {
  rootId: string;
  result: any;
  document: DocumentNode;
  operationName: string | null;
  variables: Object;
}

export class DataStore<TSerialized> {
  private cache: ApolloCache<TSerialized>;

  constructor(initialCache: ApolloCache<TSerialized>) {
    this.cache = initialCache;
  }

  public getCache(): ApolloCache<TSerialized> {
    return this.cache;
  }

  public markQueryResult(
    result: ExecutionResult,
    document: DocumentNode,
    variables: any,
    fetchMoreForQueryId: string | undefined,
    ignoreErrors: boolean = false,
  ) {
    let writeWithErrors = !graphQLResultHasError(result);
    if (ignoreErrors && graphQLResultHasError(result) && result.data) {
      writeWithErrors = true;
    }
    if (!fetchMoreForQueryId && writeWithErrors) {
      this.cache.write({
        result: result.data,
        dataId: 'ROOT_QUERY',
        query: document,
        variables: variables,
      });
    }
  }

  public markSubscriptionResult(
    result: ExecutionResult,
    document: DocumentNode,
    variables: any,
  ) {
    // the subscription interface  should handle not sending us results we no longer subscribe to.
    // XXX I don't think we ever send in an object with errors, but we might in the future...
    if (!graphQLResultHasError(result)) {
      this.cache.write({
        result: result.data,
        dataId: 'ROOT_SUBSCRIPTION',
        query: document,
        variables: variables,
      });
    }
  }

  /**
   * KAMIL: has an effect only if we use optimisticResponse
   * It creates a transaction function (it's this.markMutationResult)
   * It calls cache.recordOptimisticTransaction
   */
  public markMutationInit(mutation: {
    mutationId: string;
    document: DocumentNode;
    variables: any;
    updateQueries: { [queryId: string]: QueryWithUpdater };
    update: ((proxy: DataProxy, mutationResult: Object) => void) | undefined;
    optimisticResponse: Object | Function | undefined;
  }) {
    if (mutation.optimisticResponse) {
      // M04
      let optimistic: Object;
      if (typeof mutation.optimisticResponse === 'function') {
        optimistic = mutation.optimisticResponse(mutation.variables);
      } else {
        optimistic = mutation.optimisticResponse;
      }

      const changeFn = () => {
        this.markMutationResult({
          mutationId: mutation.mutationId,
          result: { data: optimistic },
          document: mutation.document,
          variables: mutation.variables,
          updateQueries: mutation.updateQueries,
          update: mutation.update,
        });
      };

      // M05

      // KAMIL: see definition
      this.cache.recordOptimisticTransaction(c => {
        const orig = this.cache;
        this.cache = c;

        // KAMIL: oh boy, this code is messy
        // KAMIL: we perform a changeFn on a snapshot of a cache since we swapped this.cache again
        try {
          changeFn();
        } finally {
          this.cache = orig;
        }
      }, mutation.mutationId);
    }
  }

  /**
   * KAMIL:
   */
  public markMutationResult(mutation: {
    mutationId: string;
    result: ExecutionResult;
    document: DocumentNode;
    variables: any;
    updateQueries: { [queryId: string]: QueryWithUpdater };
    update: ((proxy: DataProxy, mutationResult: Object) => void) | undefined;
  }) {
    // Incorporate the result from this mutation into the store
    if (!graphQLResultHasError(mutation.result)) {
      // KAMIL: creates an array of cache writes objects
      const cacheWrites: Cache.WriteOptions[] = [];

      // KAMIL: pushes a write object to update ROOT_MUTATION
      cacheWrites.push({
        result: mutation.result.data,
        dataId: 'ROOT_MUTATION',
        query: mutation.document,
        variables: mutation.variables,
      });

      if (mutation.updateQueries) {
        Object.keys(mutation.updateQueries)
          .filter(id => mutation.updateQueries[id])
          .forEach(queryId => {
            const { query, updater } = mutation.updateQueries[queryId];
            // Read the current query result from the store.
            const { result: currentQueryResult, complete } = this.cache.diff({
              query: query.document,
              variables: query.variables,
              returnPartialData: true,
              optimistic: false,
            });

            if (!complete) {
              return;
            }

            // Run our reducer using the current query result and the mutation result.
            const nextQueryResult = tryFunctionOrLogError(() =>
              updater(currentQueryResult, {
                mutationResult: mutation.result,
                queryName: getOperationName(query.document) || undefined,
                queryVariables: query.variables,
              }),
            );

            // Write the modified result back into the store if we got a new result.
            if (nextQueryResult) {
              cacheWrites.push({
                result: nextQueryResult,
                dataId: 'ROOT_QUERY',
                query: query.document,
                variables: query.variables,
              });
            }
          });
      }

      // KAMIL: it performs transaction for every pushed cache write
      this.cache.performTransaction(c => {
        // KAMIL: it just writes the value it received to the cache
        cacheWrites.forEach(write => c.write(write));
      });

      // KAMIL: now the store is updated, the real one that can be persisted.

      // If the mutation has some writes associated with it then we need to
      // apply those writes to the store by running this reducer again with a
      // write action.
      const update = mutation.update;

      if (update) {
        // KAMIL: if there was an update function applied
        // KAMIL: it performs also that update function
        // KAMIL: c is a DataProxy that we get in mutation.update function
        // KAMIL: so it's basically an ApolloCache
        this.cache.performTransaction(c => {
          tryFunctionOrLogError(() => update(c, mutation.result));
        });
      }
    }
  }

  /**
   * KAMIL: It only calls cache.removeOptimistic if an optimistic response is included
   */
  public markMutationComplete({
    mutationId,
    optimisticResponse,
  }: {
    mutationId: string;
    optimisticResponse?: any;
  }) {
    if (!optimisticResponse) return;

    this.cache.removeOptimistic(mutationId);
  }

  public markUpdateQueryResult(
    document: DocumentNode,
    variables: any,
    newResult: any,
  ) {
    this.cache.write({
      result: newResult,
      dataId: 'ROOT_QUERY',
      variables,
      query: document,
    });
  }

  public reset(): Promise<void> {
    return this.cache.reset();
  }
}
