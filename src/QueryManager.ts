import {
  NetworkInterface,
  Request,
} from './networkInterface';

import {
  parseQuery,
  parseMutation,
} from './parser';

import {
  forOwn,
} from 'lodash';

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

import ObservableQuery from './queries/ObservableQuery';

export interface WatchQueryOptions {
  query: string;
  // variableValues?
  variables?: { [key:string]:any };
  forceFetch?: boolean;
  returnPartialData?: boolean;
}

export class QueryManager {
  private networkInterface: NetworkInterface;
  private store: ApolloStore;
  private reduxRootKey: string;

  private observedQueries: { [queryId: number]: ObservableQuery };

  private idCounter = 0;

  constructor({
    networkInterface,
    store,
    reduxRootKey,
  }: {
    networkInterface: NetworkInterface,
    store: ApolloStore,
    reduxRootKey: string,
  }) {
    // XXX this might be the place to do introspection for inserting the `id` into the query? or
    // is that the network interface?
    this.networkInterface = networkInterface;
    this.store = store;
    this.reduxRootKey = reduxRootKey;

    this.observedQueries = {};

    this.store.subscribe(() => {
      this.broadcastNewStore(this.store.getState()[this.reduxRootKey]);
    });
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

  private generateQueryId() {
    const queryId = this.idCounter.toString();
    this.idCounter++;
    return queryId;
  }

  public fetchQuery(query: ObservableQuery) {
    const queryId = query.queryId;
    const {
      query: queryString,
      variables,
      forceFetch = true,
      returnPartialData = false,
    } = query.options;

    // Parse the query passed in -- this could also be done by a build plugin or tagged
    // template string
    const querySS = {
      id: 'ROOT_QUERY',
      typeName: 'Query',
      selectionSet: parseQuery(queryString).selectionSet,
    } as SelectionSetWithRoot;

    query.selectionSetWithRoot = querySS;

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
      });

      initialResult = result;

      if (missingSelectionSets.length) {
        const diffedQueryDef = queryDefinition(missingSelectionSets);

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
          query.isLoading = false;
          query.lastResult = result;
          this.store.dispatch({
            type: 'QUERY_RESULT',
            result,
            queryId,
          });
        }).catch((error: Error) => {
          query.didReceiveError(error);
        });
    }

    if (! minimizedQuery || returnPartialData) {
      query.isLoading = !!minimizedQuery;
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

  public broadcastNewStore(store: Store) {
    forOwn(this.observedQueries, (query: ObservableQuery) => {
      if (!query.isLoading) {
        if (query.lastResult && query.lastResult.errors) {
          query.didReceiveResult({ errors: query.lastResult.errors });
        } else {
          const resultFromStore = readSelectionSetFromStore({
            store: store.data,
            rootId: query.selectionSetWithRoot.id,
            selectionSet: query.selectionSetWithRoot.selectionSet,
            variables: query.options.variables,
          });

          query.didReceiveResult({ data: resultFromStore });
        }
      }
    });
  }
}
