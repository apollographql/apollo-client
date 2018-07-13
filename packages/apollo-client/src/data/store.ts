import { ExecutionResult, DocumentNode } from 'graphql';
import { ApolloCache, Cache, DataProxy } from 'apollo-cache';

import { QueryStoreValue } from '../data/queries';
import {
  getOperationName,
  tryFunctionOrLogError,
  graphQLResultHasError,
} from 'apollo-utilities';
import {
  ExecutionPatchResult,
  isPatch,
  MutationQueryReducer,
} from '../core/types';

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

  private mergePatch(
    result: ExecutionResult,
    patch: ExecutionPatchResult,
  ): void {
    if (patch.errors) {
    }

    if (result) {
      let curKeyIndex = 0;
      let curKey: string | number;
      let curPointer: Record<string, {}> = result as Record<string, {}>;
      while (curKeyIndex !== patch.path.length) {
        curKey = patch.path[curKeyIndex++];
        const isLeaf = curKeyIndex === patch.path.length;
        if (isLeaf) {
          if (patch.data) {
            // Data may not exist if there is an error in the patch
            curPointer[curKey] = patch.data;
          }
        } else {
          if (curPointer[curKey] === undefined) {
            // This is indicative of a patch that is not ready to be merged, which
            // can happen if patches for inner objects arrive before its parent.
            // The graphql execution phase must make sure that this does not
            // happen.
            throw new Error(
              `Failed to merge patch with path '[${patch.path}]'`,
            );
          }
          if (curPointer[curKey] === null) {
            // Check whether it should be an array or an object by looking at the
            // next key, then create the object if it is not present.
            if (typeof patch.path[curKeyIndex] === 'string') {
              curPointer[curKey] = {};
            } else if (typeof patch.path[curKeyIndex] === 'number') {
              curPointer[curKey] = [];
            }
          }
          curPointer = curPointer[curKey];
        }
      }
    }
  }

  public markQueryResult(
    result: ExecutionResult | ExecutionPatchResult,
    document: DocumentNode,
    variables: any,
    fetchMoreForQueryId: string | undefined,
    ignoreErrors: boolean = false,
  ) {
    if (isPatch(result)) {
      const originalResult: ExecutionResult | null = this.cache.read({
        query: document,
        variables: variables,
        rootId: 'ROOT_QUERY',
        optimistic: false,
      });
      if (originalResult) {
        this.mergePatch(originalResult, result);
        result = { data: originalResult };
      } else {
        // Nothing may be written to cache if the first response had an error
        return;
      }
    }

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

        try {
          changeFn();
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
      const cacheWrites: Cache.WriteOptions[] = [];
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

      this.cache.performTransaction(c => {
        cacheWrites.forEach(write => c.write(write));
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
