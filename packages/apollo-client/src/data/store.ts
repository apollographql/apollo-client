import { ExecutionResult, DocumentNode } from 'graphql';
import { Cache, CacheWrite, DataProxy } from 'apollo-cache-core';

import { QueryStoreValue } from '../queries/store';
import { getOperationName } from '../queries/getFromAST';

import { tryFunctionOrLogError } from '../util/errorHandling';

import { MutationQueryReducer } from './types';

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

export function graphQLResultHasError(result: ExecutionResult) {
  return result.errors && result.errors.length;
}

export class DataStore {
  private cache: Cache;

  constructor(initialCache: Cache) {
    this.cache = initialCache;
  }

  public getCache(): Cache {
    return this.cache;
  }

  public markQueryResult(
    result: ExecutionResult,
    document: DocumentNode,
    variables: any,
    fetchMoreForQueryId: string | undefined,
  ) {
    // XXX handle partial result due to errors
    if (!fetchMoreForQueryId && !graphQLResultHasError(result)) {
      this.cache.writeResult({
        result: result.data,
        dataId: 'ROOT_QUERY',
        document: document,
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
      this.cache.writeResult({
        result: result.data,
        dataId: 'ROOT_SUBSCRIPTION',
        document: document,
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

      this.cache.recordOptimisticTransaction(c => {
        const orig = this.cache;
        this.cache = c;

        changeFn();

        this.cache = orig;
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
    if (!mutation.result.errors) {
      const cacheWrites: CacheWrite[] = [];
      cacheWrites.push({
        result: mutation.result.data,
        dataId: 'ROOT_MUTATION',
        document: mutation.document,
        variables: mutation.variables,
      });

      if (mutation.updateQueries) {
        Object.keys(mutation.updateQueries)
          .filter(id => mutation.updateQueries[id])
          .forEach(queryId => {
            const { query, updater } = mutation.updateQueries[queryId];
            // Read the current query result from the store.
            const {
              result: currentQueryResult,
              isMissing,
            } = this.cache.diffQuery({
              query: query.document,
              variables: query.variables,
              returnPartialData: true,
              optimistic: false,
            });

            if (isMissing) {
              return;
            }

            // Run our reducer using the current query result and the mutation result.
            const nextQueryResult = tryFunctionOrLogError(() =>
              updater(currentQueryResult, {
                mutationResult: mutation.result,
                queryName: getOperationName(query.document),
                queryVariables: query.variables,
              }),
            );

            // Write the modified result back into the store if we got a new result.
            if (nextQueryResult) {
              cacheWrites.push({
                result: nextQueryResult,
                dataId: 'ROOT_QUERY',
                document: query.document,
                variables: query.variables,
              });
            }
          });
      }

      this.cache.performTransaction(c => {
        cacheWrites.forEach(write => {
          c.writeResult(write);
        });
      });

      // If the mutation has some writes associated with it then we need to
      // apply those writes to the store by running this reducer again with a
      // write action.
      const update = mutation.update;
      if (update) {
        this.cache.performTransaction(c => {
          tryFunctionOrLogError(() => update(c, mutation.result));
        });
      }
    }
  }

  public markMutationComplete(mutationId: string) {
    this.cache.removeOptimistic(mutationId);
  }

  public markUpdateQueryResult(
    document: DocumentNode,
    variables: any,
    newResult: any,
  ) {
    this.cache.writeResult({
      result: newResult,
      dataId: 'ROOT_QUERY',
      variables,
      document,
    });
  }

  public reset(): Promise<void> {
    return this.cache.reset();
  }
}
