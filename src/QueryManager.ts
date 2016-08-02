import {
  NetworkInterface,
  Request,
} from './networkInterface';

import forOwn = require('lodash.forown');
import isEqual = require('lodash.isequal');

import {
  ApolloStore,
  Store,
  getDataWithOptimisticResults,
} from './store';

import {
  SelectionSetWithRoot,
  QueryStoreValue,
} from './queries/store';

import {
  getMutationDefinition,
  getQueryDefinition,
  getFragmentDefinitions,
  createFragmentMap,
  getOperationName,
  addFragmentsToDocument,
  FragmentMap,
} from './queries/getFromAST';

import {
  QueryTransformer,
  applyTransformers,
} from './queries/queryTransform';

import {
  NormalizedCache,
} from './data/store';

import {
  GraphQLResult,
  Document,
  OperationDefinition,
  FragmentDefinition,
  // We need to import this here to allow TypeScript to include it in the definition file even
  // though we don't use it. https://github.com/Microsoft/TypeScript/issues/5711
  // We need to disable the linter here because TSLint rightfully complains that this is unused.
  /* tslint:disable */
  SelectionSet,
  /* tslint:enable */
} from 'graphql';

import { print } from 'graphql-tag/printer';

import {
  readSelectionSetFromStore,
} from './data/readFromStore';

import {
  diffSelectionSetAgainstStore,
} from './data/diffAgainstStore';

import {
  MutationBehavior,
  MutationQueryReducersMap,
} from './data/mutationResults';

import {
  queryDocument,
} from './queryPrinting';

import {
  QueryFetchRequest,
  QueryBatcher,
} from './batching';

import {
  QueryScheduler,
} from './scheduler';

import {
  ApolloQueryResult,
} from './index';

import { Observer, Subscription } from './util/Observable';

import {
  ApolloError,
} from './errors';

import { WatchQueryOptions } from './watchQueryOptions';

import { ObservableQuery } from './ObservableQuery';

export type QueryListener = (queryStoreValue: QueryStoreValue) => void;

export class QueryManager {
  public pollingTimers: {[queryId: string]: NodeJS.Timer | any}; //oddity in Typescript
  public scheduler: QueryScheduler;
  public store: ApolloStore;

  private networkInterface: NetworkInterface;
  private reduxRootKey: string;
  private queryTransformer: QueryTransformer;
  private queryListeners: { [queryId: string]: QueryListener };

  // A map going from queryId to the last result/state that the queryListener was told about.
  private queryResults: { [queryId: string]: ApolloQueryResult };

  private idCounter = 0;

  private batcher: QueryBatcher;
  private batchInterval: number;

  // A map going from a requestId to a promise that has not yet been resolved. We use this to keep
  // track of queries that are inflight and reject them in case some
  // destabalizing action occurs (e.g. reset of the Apollo store).
  private fetchQueryPromises: { [requestId: string]: {
    promise: Promise<ApolloQueryResult>;
    resolve: (result: ApolloQueryResult) => void;
    reject: (error: Error) => void;
  } };

  // A map going from queryId to an observer for a query issued by watchQuery. We use
  // these to keep track of queries that are inflight and error on the observers associated
  // with them in case of some destabalizing action (e.g. reset of the Apollo store).
  private observableQueries: { [queryId: string]:  {
    observableQuery: ObservableQuery;
    subscriptions: Subscription[];
  } };

  constructor({
    networkInterface,
    store,
    reduxRootKey,
    queryTransformer,
    shouldBatch = false,
    batchInterval = 10,
  }: {
    networkInterface: NetworkInterface,
    store: ApolloStore,
    reduxRootKey: string,
    queryTransformer?: QueryTransformer,
    shouldBatch?: Boolean,
    batchInterval?: number,
  }) {
    // XXX this might be the place to do introspection for inserting the `id` into the query? or
    // is that the network interface?
    this.networkInterface = networkInterface;
    this.store = store;
    this.reduxRootKey = reduxRootKey;
    this.queryTransformer = queryTransformer;
    this.pollingTimers = {};
    this.batchInterval = batchInterval;
    this.queryListeners = {};
    this.queryResults = {};

    this.scheduler = new QueryScheduler({
      queryManager: this,
    });

    this.batcher = new QueryBatcher({
      shouldBatch,
      networkInterface: this.networkInterface,
    });

    this.batcher.start(this.batchInterval);
    this.fetchQueryPromises = {};
    this.observableQueries = {};

    // this.store is usually the fake store we get from the Redux middleware API
    // XXX for tests, we sometimes pass in a real Redux store into the QueryManager
    if (this.store['subscribe']) {
      let currentStoreData;
      this.store['subscribe'](() => {
        let previousStoreData = currentStoreData || {};
        const previousStoreHasData = Object.keys(previousStoreData).length;
        currentStoreData = this.getApolloState();
        if (isEqual(previousStoreData, currentStoreData) && previousStoreHasData) {
          return;
        }
        this.broadcastQueries();
      });
    }
  }

  // Called from middleware
  public broadcastNewStore(store: any) {
    this.broadcastQueries();
  }

  public mutate({
    mutation,
    variables,
    resultBehaviors = [],
    fragments = [],
    optimisticResponse,
    updateQueries,
  }: {
    mutation: Document,
    variables?: Object,
    resultBehaviors?: MutationBehavior[],
    fragments?: FragmentDefinition[],
    optimisticResponse?: Object,
    updateQueries?: MutationQueryReducersMap,
  }): Promise<ApolloQueryResult> {
    const mutationId = this.generateQueryId();

    // Add the fragments that were passed in to the mutation document and then
    // construct the fragment map.
    mutation = addFragmentsToDocument(mutation, fragments);

    if (this.queryTransformer) {
      mutation = applyTransformers(mutation, [this.queryTransformer]);
    }

    let mutationDef = getMutationDefinition(mutation);
    const mutationString = print(mutation);
    const queryFragmentMap = createFragmentMap(getFragmentDefinitions(mutation));
    const request = {
      query: mutation,
      variables,
      operationName: getOperationName(mutation),
    } as Request;

    // Right now the way `updateQueries` feature is implemented relies on using
    // `resultBehaviors`, another feature that accomplishes the same goal but
    // provides more verbose syntax.
    // In the future we want to re-factor this part of code to avoid using
    // `resultBehaviors` so we can remove `resultBehaviors` entirely.
    const updateQueriesResultBehaviors = !optimisticResponse ? [] :
      this.collectResultBehaviorsFromUpdateQueries(updateQueries, { data: optimisticResponse }, true);

    this.store.dispatch({
      type: 'APOLLO_MUTATION_INIT',
      mutationString,
      mutation: {
        id: 'ROOT_MUTATION',
        typeName: 'Mutation',
        selectionSet: mutationDef.selectionSet,
      },
      variables,
      mutationId,
      fragmentMap: queryFragmentMap,
      optimisticResponse,
      resultBehaviors: [...resultBehaviors, ...updateQueriesResultBehaviors],
    });

    return new Promise((resolve, reject) => {
      this.networkInterface.query(request)
        .then((result) => {
          if (result.errors) {
            reject(new ApolloError({
              graphQLErrors: result.errors,
            }));
          }

          this.store.dispatch({
            type: 'APOLLO_MUTATION_RESULT',
            result,
            mutationId,
            resultBehaviors: [
                ...resultBehaviors,
                ...this.collectResultBehaviorsFromUpdateQueries(updateQueries, result),
            ],
          });

          resolve(result);
        })
        .catch((err) => {
          this.store.dispatch({
            type: 'APOLLO_MUTATION_ERROR',
            error: err,
            mutationId,
          });

          reject(new ApolloError({
            networkError: err,
          }));
        });
    });
  }

  // Returns a query listener that will update the given observer based on the
  // results (or lack thereof) for a particular query.
  public queryListenerForObserver(
    queryId: string,
    options: WatchQueryOptions,
    observer: Observer<ApolloQueryResult>
  ): QueryListener {
    return (queryStoreValue: QueryStoreValue) => {
      // The query store value can be undefined in the event of a store
      // reset.
      if (!queryStoreValue) {
        return;
      }

      if (!queryStoreValue.loading || queryStoreValue.returnPartialData) {
        // XXX Currently, returning errors and data is exclusive because we
        // don't handle partial results

        // If we have either a GraphQL error or a network error, we create
        // an error and tell the observer about it.
        if (queryStoreValue.graphQLErrors || queryStoreValue.networkError) {
          const apolloError = new ApolloError({
            graphQLErrors: queryStoreValue.graphQLErrors,
            networkError: queryStoreValue.networkError,
          });
          if (observer.error) {
            observer.error(apolloError);
          } else {
            console.error('Unhandled error', apolloError, apolloError.stack);
          }
        } else {
          try {
            const resultFromStore = {
              data: readSelectionSetFromStore({
                store: this.getDataWithOptimisticResults(),
                rootId: queryStoreValue.query.id,
                selectionSet: queryStoreValue.query.selectionSet,
                variables: queryStoreValue.variables,
                returnPartialData: options.returnPartialData || options.noFetch,
                fragmentMap: queryStoreValue.fragmentMap,
              }),
              loading: queryStoreValue.loading,
            };

            if (observer.next) {
              if (this.isDifferentResult(queryId, resultFromStore )) {
                this.queryResults[queryId] = resultFromStore;
                observer.next(resultFromStore);
              }
            }
          } catch (error) {
            if (observer.error) {
              observer.error(error);
            }
          }
        }
      }
    };
  }

  // The shouldSubscribe option is a temporary fix that tells us whether watchQuery was called
  // directly (i.e. through ApolloClient) or through the query method within QueryManager.
  // Currently, the query method uses watchQuery in order to handle non-network errors correctly
  // but we don't want to keep track observables issued for the query method since those aren't
  // supposed to be refetched in the event of a store reset. Once we unify error handling for
  // network errors and non-network errors, the shouldSubscribe option will go away.

  // The fragments option within WatchQueryOptions specifies a list of fragments that can be
  // referenced by the query.
  // These fragments are used to compose queries out of a bunch of fragments for UI components.
  public watchQuery(options: WatchQueryOptions, shouldSubscribe = true): ObservableQuery {
    // Call just to get errors synchronously
    getQueryDefinition(options.query);

    let observableQuery = new ObservableQuery({
      scheduler: this.scheduler,
      options: options,
      shouldSubscribe: shouldSubscribe,
    });

    return observableQuery;
  }

  public query(options: WatchQueryOptions): Promise<ApolloQueryResult> {
    if (options.returnPartialData) {
      throw new Error('returnPartialData option only supported on watchQuery.');
    }

    if (options.query.kind !== 'Document') {
      throw new Error('You must wrap the query string in a "gql" tag.');
    }

    const requestId = this.idCounter;
    const resPromise = new Promise((resolve, reject) => {
      this.addFetchQueryPromise(requestId, resPromise, resolve, reject);

      return this.watchQuery(options, false).result().then((result) => {
        this.removeFetchQueryPromise(requestId);
        resolve(result);
      }).catch((error) => {
        this.removeFetchQueryPromise(requestId);
        reject(error);
      });
    });

    return resPromise;
  }

  public fetchQuery(queryId: string, options: WatchQueryOptions): Promise<ApolloQueryResult> {
    return this.fetchQueryOverInterface(queryId, options, this.networkInterface);
  }

  public generateQueryId() {
    const queryId = this.idCounter.toString();
    this.idCounter++;
    return queryId;
  }

  public stopQueryInStore(queryId: string) {
    this.store.dispatch({
      type: 'APOLLO_QUERY_STOP',
      queryId,
    });
  };

  public getApolloState(): Store {
    return this.store.getState()[this.reduxRootKey];
  }

  public getDataWithOptimisticResults(): NormalizedCache {
    return getDataWithOptimisticResults(this.getApolloState());
  }

  public addQueryListener(queryId: string, listener: QueryListener) {
    this.queryListeners[queryId] = listener;
  };

  public removeQueryListener(queryId: string) {
    delete this.queryListeners[queryId];
  }

  // Adds a promise to this.fetchQueryPromises for a given request ID.
  public addFetchQueryPromise(requestId: number, promise: Promise<ApolloQueryResult>,
    resolve: (result: ApolloQueryResult) => void,
    reject: (error: Error) => void) {
    this.fetchQueryPromises[requestId.toString()] = { promise, resolve, reject };
  }


  // Removes the promise in this.fetchQueryPromises for a particular request ID.
  public removeFetchQueryPromise(requestId: number) {
    delete this.fetchQueryPromises[requestId.toString()];
  }

  // Adds an ObservableQuery to this.observableQueries
  public addObservableQuery(queryId: string, observableQuery: ObservableQuery) {
    this.observableQueries[queryId] = { observableQuery, subscriptions: [] };
  }

  // Associates a query subscription with an ObservableQuery in this.observableQueries
  public addQuerySubscription(queryId: string, querySubscription: Subscription) {
    if (this.observableQueries.hasOwnProperty(queryId)) {
      this.observableQueries[queryId].subscriptions.push(querySubscription);
    } else {
      this.observableQueries[queryId] = {
        observableQuery: null,
        subscriptions: [querySubscription],
      };
    }
  }

  public removeObservableQuery(queryId: string) {
    delete this.observableQueries[queryId];
  }

  public resetStore(): void {
    // Before we have sent the reset action to the store,
    // we can no longer rely on the results returned by in-flight
    // requests since these may depend on values that previously existed
    // in the data portion of the store. So, we cancel the promises and observers
    // that we have issued so far and not yet resolved (in the case of
    // queries).
    Object.keys(this.fetchQueryPromises).forEach((key) => {
      const { reject } = this.fetchQueryPromises[key];
      reject(new Error('Store reset while query was in flight.'));
    });

    this.store.dispatch({
      type: 'APOLLO_STORE_RESET',
      observableQueryIds: Object.keys(this.observableQueries),
    });

    // Similarly, we have to have to refetch each of the queries currently being
    // observed. We refetch instead of error'ing on these since the assumption is that
    // resetting the store doesn't eliminate the need for the queries currently being
    // watched. If there is an existing query in flight when the store is reset,
    // the promise for it will be rejected and its results will not be written to the
    // store.
    Object.keys(this.observableQueries).forEach((queryId) => {
      if (! this.observableQueries[queryId].observableQuery.options.noFetch) {
        this.observableQueries[queryId].observableQuery.refetch();
      }
    });
  }

  public startQuery(queryId: string, options: WatchQueryOptions, listener: QueryListener) {
    this.queryListeners[queryId] = listener;

    // If the pollInterval is present, the scheduler has already taken care of firing the first
    // fetch so we don't have to worry about it here.
    if (!options.pollInterval) {
      this.fetchQuery(queryId, options);
    }

    return queryId;
  }

  public stopQuery(queryId: string) {
    // XXX in the future if we should cancel the request
    // so that it never tries to return data
    delete this.queryListeners[queryId];
    this.stopQueryInStore(queryId);
  }

  public getQueryWithPreviousResult(queryId: string, isOptimistic = false) {
    if (!this.observableQueries[queryId]) {
      throw new Error(`ObservableQuery with this id doesn't exist: ${queryId}`);
    }

    const observableQuery = this.observableQueries[queryId].observableQuery;

    const queryOptions = observableQuery.options;

    let fragments = queryOptions.fragments;
    let queryDefinition = getQueryDefinition(queryOptions.query);

    if (this.queryTransformer) {
      const doc = {
        kind: 'Document',
        definitions: [
          queryDefinition,
            ...(fragments || []),
        ],
      };

      const transformedDoc = applyTransformers(doc, [this.queryTransformer]);

      queryDefinition = getQueryDefinition(transformedDoc);
      fragments = getFragmentDefinitions(transformedDoc);
    }

    const previousResult = readSelectionSetFromStore({
      // In case of an optimistic change, apply reducer on top of the
      // results including previous optimistic updates. Otherwise, apply it
      // on top of the real data only.
      store: isOptimistic ? this.getDataWithOptimisticResults() : this.getApolloState().data,
      rootId: 'ROOT_QUERY',
      selectionSet: queryDefinition.selectionSet,
      variables: queryOptions.variables,
      returnPartialData: queryOptions.returnPartialData || queryOptions.noFetch,
      fragmentMap: createFragmentMap(fragments || []),
    });

    return {
      previousResult,
      queryVariables: queryOptions.variables,
      querySelectionSet: queryDefinition.selectionSet,
      queryFragments: fragments,
    };
  }

  private collectResultBehaviorsFromUpdateQueries(
    updateQueries: MutationQueryReducersMap,
    mutationResult: Object,
    isOptimistic = false
  ): MutationBehavior[] {
    if (!updateQueries) {
      return [];
    }
    const resultBehaviors = [];

    const queryIdsByName: { [name: string]: string[] } = {};
    Object.keys(this.observableQueries).forEach((queryId) => {
      const observableQuery = this.observableQueries[queryId].observableQuery;
      const queryName = getQueryDefinition(observableQuery.options.query).name.value;

      queryIdsByName[queryName] =
        queryIdsByName[queryName] || [];
      queryIdsByName[queryName].push(queryId);
    });

    Object.keys(updateQueries).forEach((queryName) => {
      const reducer = updateQueries[queryName];
      const queries = queryIdsByName[queryName];
      if (!queries) {
        // XXX should throw an error?
        return;
      }

      queries.forEach((queryId) => {
        const {
          previousResult,
          queryVariables,
          querySelectionSet,
          queryFragments,
        } = this.getQueryWithPreviousResult(queryId, isOptimistic);

        resultBehaviors.push({
          type: 'QUERY_RESULT',
          newResult: reducer(previousResult, {
            mutationResult,
            queryName,
            queryVariables,
          }),
          queryVariables,
          querySelectionSet,
          queryFragments,
        });
      });
    });

    return resultBehaviors;
  }

  // Takes a set of WatchQueryOptions and transforms the query document
  // accordingly. Specifically, it does the following:
  // 1. Adds the fragments to the document
  // 2. Applies the queryTransformer (if there is one defined)
  // 3. Creates a fragment map out of all of the fragment definitions within the query
  //    document.
  // 4. Returns the final query document and the fragment map associated with the
  //    query.
  private transformQueryDocument(options: WatchQueryOptions): {
    queryDoc: Document,
    fragmentMap: FragmentMap,
    queryDef: OperationDefinition,
    queryString: string,
    querySS: SelectionSetWithRoot,
  } {
    const {
      query,
      fragments = [],
    } = options;
    let queryDoc = addFragmentsToDocument(query, fragments);

    // Apply the query transformer if one has been provided
    if (this.queryTransformer) {
      queryDoc = applyTransformers(queryDoc, [ this.queryTransformer ]);
    }

    const queryDef = getQueryDefinition(queryDoc);
    return {
      queryDoc,
      fragmentMap: createFragmentMap(getFragmentDefinitions(queryDoc)),
      queryDef,
      queryString: print(queryDoc),
      querySS: {
        id: 'ROOT_QUERY',
        typeName: 'Query',
        selectionSet: queryDef.selectionSet,
      } as SelectionSetWithRoot,
    };
  }

  private fetchQueryOverInterface(
    queryId: string,
    options: WatchQueryOptions,
    network: NetworkInterface
  ): Promise<ApolloQueryResult> {
    const {
      variables,
      forceFetch = false,
      returnPartialData = false,
      noFetch = false,
    } = options;

    const {
      queryDoc,
      fragmentMap,
      queryDef,
      queryString,
      querySS,
    } = this.transformQueryDocument(options);
    // If we don't use diffing, then these will be the same as the original query, other than
    // the queryTransformer that could have been applied.
    let minimizedQueryString = queryString;
    let minimizedQuery = querySS;
    let minimizedQueryDoc = queryDoc;
    let initialResult;

    if (!forceFetch) {
      // If the developer has specified they want to use the existing data in the store for this
      // query, use the query diff algorithm to get as much of a result as we can, and identify
      // what data is missing from the store
      const { missingSelectionSets, result } = diffSelectionSetAgainstStore({
        selectionSet: querySS.selectionSet,
        store: this.store.getState()[this.reduxRootKey].data,
        throwOnMissingField: false,
        rootId: querySS.id,
        variables,
        fragmentMap,
      });

      initialResult = result;

      if (missingSelectionSets && missingSelectionSets.length && !noFetch) {
        const diffedQuery = queryDocument({
          missingSelectionSets,
          variableDefinitions: queryDef.variableDefinitions,
          name: queryDef.name,
          fragmentMap,
        });
        const diffedQueryDef = getQueryDefinition(diffedQuery);

        minimizedQuery = {
          id: 'ROOT_QUERY',
          typeName: 'Query',
          selectionSet: diffedQueryDef.selectionSet,
        };

        minimizedQueryString = print(diffedQuery);
        minimizedQueryDoc = diffedQuery;
      } else {
        minimizedQuery = null;
        minimizedQueryString = null;
        minimizedQueryDoc = null;
      }
    }

    const requestId = this.generateRequestId();

    // Initialize query in store with unique requestId
    this.store.dispatch({
      type: 'APOLLO_QUERY_INIT',
      queryString,
      query: querySS,
      minimizedQueryString,
      minimizedQuery,
      variables,
      forceFetch,
      returnPartialData: returnPartialData || noFetch,
      queryId,
      requestId,
      fragmentMap,
    });

    if (! minimizedQuery || returnPartialData || noFetch) {
      this.store.dispatch({
        type: 'APOLLO_QUERY_RESULT_CLIENT',
        result: {
          data: initialResult,
        },
        variables,
        query: querySS,
        complete: !! minimizedQuery,
        queryId,
      });
    }

    if (minimizedQuery) {
      const request: Request = {
        query: minimizedQueryDoc,
        variables,
        operationName: getOperationName(minimizedQueryDoc),
      };

      const fetchRequest: QueryFetchRequest = {
        options: { query: minimizedQueryDoc, variables },
        queryId: queryId,
        operationName: request.operationName,
      };

      const retPromise = new Promise<ApolloQueryResult>((resolve, reject) => {
        this.addFetchQueryPromise(requestId, retPromise, resolve, reject);

        return this.batcher.enqueueRequest(fetchRequest)
          .then((result: GraphQLResult) => {
            // XXX handle multiple ApolloQueryResults
            this.store.dispatch({
              type: 'APOLLO_QUERY_RESULT',
              result,
              queryId,
              requestId,
            });

            this.removeFetchQueryPromise(requestId);
            return result;
          }).then(() => {

            let resultFromStore;
            try {
              // ensure result is combined with data already in store
              // this will throw an error if there are missing fields in
              // the results if returnPartialData is false.
              resultFromStore = readSelectionSetFromStore({
                store: this.getApolloState().data,
                rootId: querySS.id,
                selectionSet: querySS.selectionSet,
                variables,
                returnPartialData: returnPartialData || noFetch,
                fragmentMap,
              });
              // ensure multiple errors don't get thrown
              /* tslint:disable */
            } catch (e) {}
            /* tslint:enable */

            // return a chainable promise
            this.removeFetchQueryPromise(requestId);
            resolve({ data: resultFromStore, loading: false });
          }).catch((error: Error) => {
            this.store.dispatch({
              type: 'APOLLO_QUERY_ERROR',
              error,
              queryId,
              requestId,
            });

            this.removeFetchQueryPromise(requestId);

          });
      });
      return retPromise;
    }

    // return a chainable promise
    return new Promise((resolve) => {
      resolve({ data: initialResult });
    });
  }

  // Given a query id and a new result, this checks if the old result is
  // the same as the last result for that particular query id.
  private isDifferentResult(queryId: string, result: ApolloQueryResult): boolean {
    return !isEqual(this.queryResults[queryId], result);
  }

  private broadcastQueries() {
    const queries = this.getApolloState().queries;
    forOwn(this.queryListeners, (listener: QueryListener, queryId: string) => {
      // it's possible for the listener to be undefined if the query is being stopped
      // See here for more detail: https://github.com/apollostack/apollo-client/issues/231
      if (listener) {
        const queryStoreValue = queries[queryId];
        listener(queryStoreValue);
      }
    });
  }

  private generateRequestId() {
    const requestId = this.idCounter;
    this.idCounter++;
    return requestId;
  }
}
