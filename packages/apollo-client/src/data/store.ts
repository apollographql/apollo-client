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
    // the subscription interface should handle not sending us results we no longer subscribe to.
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

  public markMutationInit(mutation: {
    mutationId: string;
    document: DocumentNode;
    variables: any;
    updateQueries: { [queryId: string]: QueryWithUpdater };
    update: ((proxy: DataProxy, mutationResult: Object) => void) | undefined;
    optimisticResponse: Object | Function | undefined;
  }) {
    if (mutation.optimisticResponse) {
      let optimistic: Object;
      if (typeof mutation.optimisticResponse === 'function') {
        optimistic = mutation.optimisticResponse(mutation.variables);
      } else {
        optimistic = mutation.optimisticResponse;
      }

      this.cache.recordOptimisticTransaction(c => {
        const orig = this.cache;
        this.cache = c;

        try {
          this.markMutationResult({
            mutationId: mutation.mutationId,
            result: { data: optimistic },
            document: mutation.document,
            variables: mutation.variables,
            updateQueries: mutation.updateQueries,
            update: mutation.update,
          });
        } finally {
          this.cache = orig;
        }
      }, mutation.mutationId);
    }
  }

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
      const cacheWrites: Cache.WriteOptions[] = [{
        result: mutation.result.data,
        dataId: 'ROOT_MUTATION',
        query: mutation.document,
        variables: mutation.variables,
      }];

      const { updateQueries } = mutation;
      if (updateQueries) {
        Object.keys(updateQueries).forEach(id => {
          const { query, updater } = updateQueries[id];

          // Read the current query result from the store.
          const { result: currentQueryResult, complete } = this.cache.diff({
            query: query.document,
            variables: query.variables,
            returnPartialData: true,
            optimistic: false,
          });

          if (complete) {
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
          }
        });
      }

      this.cache.performTransaction(c => {
        cacheWrites.forEach(write => c.write(write));

        // If the mutation has some writes associated with it then we need to
        // apply those writes to the store by running this reducer again with a
        // write action.
        const { update } = mutation;
        if (update) {
          tryFunctionOrLogError(() => update(c, mutation.result));
        }
      });
    }
  }

  public markMutationComplete({
    mutationId,
    optimisticResponse,
  }: {
    mutationId: string;
    optimisticResponse?: any;
  }) {
    if (optimisticResponse) {
      this.cache.removeOptimistic(mutationId);
    }
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
