import {
  ApolloAction,
  isQueryResultAction,
  isMutationResultAction,
  isUpdateQueryResultAction,
  isStoreResetAction,
  isSubscriptionResultAction,
  isWriteAction,
} from '../actions';

import {
  writeResultToStore,
} from './writeToStore';

import {
  TransactionDataProxy,
} from '../data/proxy';

import {
  QueryStore,
} from '../queries/store';

import {
  getOperationName,
} from '../queries/getFromAST';

import {
  MutationStore,
} from '../mutations/store';

import {
  ApolloReducerConfig,
} from '../store';

import {
  graphQLResultHasError,
  NormalizedCache,
} from './storeUtils';

import {
  replaceQueryResults,
} from './replaceQueryResults';

import {
  readQueryFromStore,
  diffQueryAgainstStore,
} from './readFromStore';

import {
  tryFunctionOrLogError,
} from '../util/errorHandling';

export function data(
  previousState: NormalizedCache = {},
  action: ApolloAction,
  queries: QueryStore,
  mutations: MutationStore,
  config: ApolloReducerConfig,
): NormalizedCache {
  // XXX This is hopefully a temporary binding to get around
  // https://github.com/Microsoft/TypeScript/issues/7719
  const constAction = action;

  if (isQueryResultAction(action)) {
    if (!queries[action.queryId]) {
      return previousState;
    }

    // Ignore results from old requests
    // XXX this means that if you have a refetch interval which is shorter than your roundtrip time,
    // your query will be in the loading state forever!
    if (action.requestId < queries[action.queryId].lastRequestId) {
      return previousState;
    }

    // XXX handle partial result due to errors
    if (! graphQLResultHasError(action.result)) {
      const queryStoreValue = queries[action.queryId];

      // XXX use immutablejs instead of cloning
      const clonedState = { ...previousState } as NormalizedCache;

      // TODO REFACTOR: is writeResultToStore a good name for something that doesn't actually
      // write to "the" store?
      let newState = writeResultToStore({
        result: action.result.data,
        dataId: 'ROOT_QUERY', // TODO: is this correct? what am I doing here? What is dataId for??
        document: action.document,
        variables: queryStoreValue.variables,
        store: clonedState,
        dataIdFromObject: config.dataIdFromObject,
        fragmentMatcherFunction: config.fragmentMatcher,
      });

      // XXX each reducer gets the state from the previous reducer.
      // Maybe they should all get a clone instead and then compare at the end to make sure it's consistent.
      if (action.extraReducers) {
        action.extraReducers.forEach( reducer => {
          newState = reducer(newState, constAction);
        });
      }

      return newState;
    }
  } else if (isSubscriptionResultAction(action)) {
    // the subscription interface should handle not sending us results we no longer subscribe to.
    // XXX I don't think we ever send in an object with errors, but we might in the future...
    if (! graphQLResultHasError(action.result)) {

      // XXX use immutablejs instead of cloning
      const clonedState = { ...previousState } as NormalizedCache;

      // TODO REFACTOR: is writeResultToStore a good name for something that doesn't actually
      // write to "the" store?
      let newState = writeResultToStore({
        result: action.result.data,
        dataId: 'ROOT_SUBSCRIPTION',
        document: action.document,
        variables: action.variables,
        store: clonedState,
        dataIdFromObject: config.dataIdFromObject,
        fragmentMatcherFunction: config.fragmentMatcher,
      });

      // XXX each reducer gets the state from the previous reducer.
      // Maybe they should all get a clone instead and then compare at the end to make sure it's consistent.
      if (action.extraReducers) {
        action.extraReducers.forEach( reducer => {
          newState = reducer(newState, constAction);
        });
      }

      return newState;
    }
  } else if (isMutationResultAction(constAction)) {
    // Incorporate the result from this mutation into the store
    if (!constAction.result.errors) {
      const queryStoreValue = mutations[constAction.mutationId];

      // XXX use immutablejs instead of cloning
      const clonedState = { ...previousState } as NormalizedCache;

      let newState = writeResultToStore({
        result: constAction.result.data,
        dataId: 'ROOT_MUTATION',
        document: constAction.document,
        variables: queryStoreValue.variables,
        store: clonedState,
        dataIdFromObject: config.dataIdFromObject,
        fragmentMatcherFunction: config.fragmentMatcher,
      });

      // If this action wants us to update certain queries. Let’s do it!
      const { updateQueries } = constAction;
      if (updateQueries) {
        Object.keys(updateQueries).forEach(queryId => {
          const query = queries[queryId];
          if (!query) {
            return;
          }


          // Read the current query result from the store.
          const { result: currentQueryResult, isMissing } = diffQueryAgainstStore({
            store: previousState,
            query: query.document,
            variables: query.variables,
            returnPartialData: true,
            fragmentMatcherFunction: config.fragmentMatcher,
            config,
          });

          if (isMissing) {
            return;
          }

          const reducer = updateQueries[queryId];

          // Run our reducer using the current query result and the mutation result.
          const nextQueryResult = tryFunctionOrLogError(() => reducer(currentQueryResult, {
            mutationResult: constAction.result,
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
              dataIdFromObject: config.dataIdFromObject,
              fragmentMatcherFunction: config.fragmentMatcher,
            });
          }
        });
      }

      // If the mutation has some writes associated with it then we need to
      // apply those writes to the store by running this reducer again with a
      // write action.
      if (constAction.update) {
        const update = constAction.update;
        const proxy = new TransactionDataProxy(
          newState,
          config,
        );
        tryFunctionOrLogError(() => update(proxy, constAction.result));
        const writes = proxy.finish();
        newState = data(
          newState,
          { type: 'APOLLO_WRITE', writes },
          queries,
          mutations,
          config,
        );
      }

      // XXX each reducer gets the state from the previous reducer.
      // Maybe they should all get a clone instead and then compare at the end to make sure it's consistent.
      if (constAction.extraReducers) {
        constAction.extraReducers.forEach( reducer => {
          newState = reducer(newState, constAction);
        });
      }

      return newState;
    }
  } else if (isUpdateQueryResultAction(constAction)) {
    return replaceQueryResults(previousState, constAction, config) as NormalizedCache;
  } else if (isStoreResetAction(action)) {
    // If we are resetting the store, we no longer need any of the data that is currently in
    // the store so we can just throw it all away.
    return {};
  } else if (isWriteAction(action)) {
    // Simply write our result to the store for this action for all of the
    // writes that were specified.
    return action.writes.reduce(
      (currentState, write) => writeResultToStore({
        result: write.result,
        dataId: write.rootId,
        document: write.document,
        variables: write.variables,
        store: currentState,
        dataIdFromObject: config.dataIdFromObject,
        fragmentMatcherFunction: config.fragmentMatcher,
      }),
      { ...previousState } as NormalizedCache,
    );
  }

  return previousState;
}
