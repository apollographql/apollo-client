import { QueryWithUpdater, DataWrite } from '../actions';

import { TransactionDataProxy, DataProxy } from '../data/proxy';

import { getOperationName } from '../queries/getFromAST';

import { ApolloReducerConfig, ApolloReducer } from '../store';

import { graphQLResultHasError } from './storeUtils';

import { tryFunctionOrLogError } from '../util/errorHandling';

import { ExecutionResult, DocumentNode } from 'graphql';

import { Cache, CacheWrite } from './cache';

import { InMemoryCache } from './inMemoryCache';

export class DataStore {
  private cache: Cache;
  private config: ApolloReducerConfig;

  constructor(
    config: ApolloReducerConfig,
    initialCache: Cache = new InMemoryCache(config, {}),
  ) {
    this.config = config;
    this.cache = initialCache;
  }

  public getCache(): Cache {
    return this.cache;
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
      this.cache.writeResult({
        result: result.data,
        dataId: 'ROOT_QUERY', // TODO: is this correct? what am I doing here? What is dataId for??
        document: document,
        variables: variables,
      });

      if (extraReducers) {
        const cache = this.cache;
        if (cache instanceof InMemoryCache) {
          extraReducers.forEach(reducer => {
            cache.applyTransformer(i => {
              return reducer(i, {
                type: 'APOLLO_QUERY_RESULT',
                result,
                document,
                operationName: getOperationName(document),
                variables,
                queryId,
                requestId,
              });
            });
          });
        } else {
          console.warn(
            'You supplied an reducer in your query, but are not using an in-memory cache.' +
              ' Reducers are not supported with caches that are not in-memory.',
          );
        }
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
      this.cache.writeResult({
        result: result.data,
        dataId: 'ROOT_SUBSCRIPTION',
        document: document,
        variables: variables,
      });

      if (extraReducers) {
        const cache = this.cache;
        if (cache instanceof InMemoryCache) {
          extraReducers.forEach(reducer => {
            cache.applyTransformer(i => {
              return reducer(i, {
                type: 'APOLLO_SUBSCRIPTION_RESULT',
                result,
                document,
                operationName: getOperationName(document),
                variables,
                subscriptionId,
              });
            });
          });
        } else {
          console.warn(
            'You supplied an reducer in your query, but are not using an in-memory cache.' +
              ' Reducers are not supported with caches that are not in-memory.',
          );
        }
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

      this.cache.performOptimisticTransaction(c => {
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
    extraReducers: ApolloReducer[];
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
            const { query, reducer } = mutation.updateQueries[queryId];
            // Read the current query result from the store.
            const {
              result: currentQueryResult,
              isMissing,
            } = this.cache.diffQuery({
              query: query.document,
              variables: query.variables,
              returnPartialData: true,
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
          const proxy = new TransactionDataProxy(c, this.config);

          tryFunctionOrLogError(() => update(proxy, mutation.result));
        });
      }

      if (mutation.extraReducers) {
        const cache = this.cache;
        if (cache instanceof InMemoryCache) {
          mutation.extraReducers.forEach(reducer => {
            cache.applyTransformer(i => {
              return reducer(i, {
                type: 'APOLLO_MUTATION_RESULT',
                mutationId: mutation.mutationId,
                result: mutation.result,
                document: mutation.document,
                operationName: getOperationName(mutation.document),
                variables: mutation.variables,
                mutation: mutation.mutationId,
              });
            });
          });
        } else {
          console.warn(
            'You supplied an reducer in your query, but are not using an in-memory cache.' +
              ' Reducers are not supported with caches that are not in-memory.',
          );
        }
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

  public executeWrites(writes: DataWrite[]) {
    this.cache.performTransaction(c => {
      writes.forEach(write => {
        this.cache.writeResult({
          result: write.result,
          dataId: write.rootId,
          document: write.document,
          variables: write.variables,
        });
      });
    });
  }
}
