import {
  NetworkInterface,
  Request,
} from './networkInterface';

import {
  parseQuery,
  parseMutation,
} from './parser';

import forOwn = require('lodash.forown');

import {
  Store,
  ApolloStore,
} from './store';

import {
  SelectionSetWithRoot,
  QueryStoreValue,
} from './queries/store';

import {
  GraphQLResult,
} from 'graphql';

import {
  readSelectionSetFromStore,
} from './data/readFromStore';

import {
  diffSelectionSetAgainstStore,
} from './data/diffAgainstStore';

import {
  queryDefinition,
  printQueryFromDefinition,
} from './queryPrinting';

import {
  IdGetter,
} from './data/extensions';

import ObservableQuery from './queries/ObservableQuery';

export interface WatchQueryOptions {
  query: string;
  variables?: { [key: string]: any };
  forceFetch?: boolean;
  returnPartialData?: boolean;
}

export class QueryManager {
  private networkInterface: NetworkInterface;
  private store: ApolloStore;
  private reduxRootKey: string;
  private dataIdFromObject: IdGetter;

  private observedQueries: { [queryId: number]: ObservableQuery };

  private idCounter = 0;

  constructor({
    networkInterface,
    store,
    reduxRootKey,
    dataIdFromObject,
  }: {
    networkInterface: NetworkInterface,
    store: ApolloStore,
    reduxRootKey: string,
    dataIdFromObject?: IdGetter,
  }) {
    // XXX this might be the place to do introspection for inserting the `id` into the query? or
    // is that the network interface?
    this.networkInterface = networkInterface;
    this.store = store;
    this.reduxRootKey = reduxRootKey;
    this.dataIdFromObject = dataIdFromObject;

    this.observedQueries = {};

    // this.store is usually the fake store we get from the Redux middleware API
    // XXX for tests, we sometimes pass in a real Redux store into the QueryManager
    if (this.store['subscribe']) {
      this.store['subscribe'](() => {
        this.broadcastNewStore(this.store.getState());
      });
    }
  }

  public mutate({
    mutation,
    variables,
  }: {
    mutation: string,
    variables?: Object,
  }): Promise<GraphQLResult> {
    // Generate a query ID
    const mutationId = this.idCounter.toString();
    this.idCounter++;

    const mutationDef = parseMutation(mutation);

    const request = {
      query: mutation,
      variables,
    } as Request;

    this.store.dispatch({
      type: 'MUTATION_INIT',
      mutationString: mutation,
      mutation: {
        id: 'ROOT_MUTATION',
        typeName: 'Mutation',
        selectionSet: mutationDef.selectionSet,
      },
      variables,
      mutationId,
    });

    return this.networkInterface.query(request)
      .then((result) => {
        this.store.dispatch({
          type: 'MUTATION_RESULT',
          result,
          mutationId,
        });

        return result;
      });
  }

  public watchQuery(options: WatchQueryOptions): ObservableQuery {
    const queryId = this.generateQueryId();
    const observableQuery = new ObservableQuery(this, queryId, options);
    return observableQuery;
  }

  public query(options: WatchQueryOptions): Promise<GraphQLResult> {
    if (options.returnPartialData) {
      throw new Error('returnPartialData option only supported on watchQuery.');
    }

    return this.watchQuery(options).result();
  }

  public fetchQuery(query: ObservableQuery) {
    const queryId = query.queryId;
    const {
      query: queryString,
      variables,
      forceFetch = true,
      returnPartialData = false,
    } = query.options;

    const queryDef = parseQuery(queryString);

    // Parse the query passed in -- this could also be done by a build plugin or tagged
    // template string
    const querySS = {
      id: 'ROOT_QUERY',
      typeName: 'Query',
      selectionSet: queryDef.selectionSet,
    } as SelectionSetWithRoot;

    // If we don't use diffing, then these will be the same as the original query
    let minimizedQueryString = queryString;
    let minimizedQuery = querySS;

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
        dataIdFromObject: this.dataIdFromObject,
      });

      initialResult = result;

      if (missingSelectionSets.length) {
        const diffedQueryDef = queryDefinition({
          missingSelectionSets,
          variableDefinitions: queryDef.variableDefinitions,
          name: queryDef.name,
        });

        minimizedQuery = {
          id: 'ROOT_QUERY',
          typeName: 'Query',
          selectionSet: diffedQueryDef.selectionSet,
        };

        minimizedQueryString = printQueryFromDefinition(diffedQueryDef);
      } else {
        minimizedQuery = null;
        minimizedQueryString = null;
      }
    }

    // Initialize query in store
    this.store.dispatch({
      type: 'QUERY_INIT',
      queryString,
      query: querySS,
      minimizedQueryString,
      minimizedQuery,
      variables,
      forceFetch,
      returnPartialData,
      queryId,
    });

    if (minimizedQuery) {
      const request: Request = {
        query: minimizedQueryString,
        variables,
      };

      this.networkInterface.query(request)
        .then((result: GraphQLResult) => {
          // XXX handle multiple GraphQLResults
          this.store.dispatch({
            type: 'QUERY_RESULT',
            result,
            queryId,
          });
        }).catch((error: Error) => {
          this.store.dispatch({
            type: 'QUERY_ERROR',
            error,
            queryId,
          });
        });
    }

    if (! minimizedQuery || returnPartialData) {
      setTimeout(() => {
        // Make this async so that we have time to add a callback
        this.store.dispatch({
          type: 'QUERY_RESULT_CLIENT',
          result: {
            data: initialResult,
          },
          variables,
          query: querySS,
          complete: !! minimizedQuery,
          queryId,
        });
      }, 0);
    }
  }

  public registerObservedQuery(query: ObservableQuery) {
    this.observedQueries[query.queryId] = query;
  }

  public deregisterObservedQuery(query: ObservableQuery) {
    const queryId = query.queryId;

    delete this.observedQueries[queryId];

    this.store.dispatch({
      type: 'QUERY_STOP',
      queryId,
    });
  }

  public broadcastNewStore(store: any) {
    const apolloStore: Store = store[this.reduxRootKey];

    forOwn(apolloStore.queries, (queryStoreValue: QueryStoreValue, queryId: string) => {
      const observableQuery: ObservableQuery = this.observedQueries[queryId];

      if (!queryStoreValue.loading || queryStoreValue.returnPartialData) {
        // XXX Currently, returning errors and data is exclusive because we
        // don't handle partial results
        if (queryStoreValue.graphQLErrors) {
          observableQuery.didReceiveResult({
            errors: queryStoreValue.graphQLErrors,
          });
        } else if (queryStoreValue.networkError) {
          // XXX we might not want to re-broadcast the same error over and over if it didn't change
          observableQuery.didReceiveError(queryStoreValue.networkError);
        } else {
          const resultFromStore = readSelectionSetFromStore({
            store: apolloStore.data,
            rootId: queryStoreValue.query.id,
            selectionSet: queryStoreValue.query.selectionSet,
            variables: queryStoreValue.variables,
          });

          observableQuery.didReceiveResult({
            data: resultFromStore,
          });
        }
      }
    });
  }

  private generateQueryId() {
    const queryId = this.idCounter.toString();
    this.idCounter++;
    return queryId;
  }
}
