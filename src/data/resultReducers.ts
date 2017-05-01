import {
  DocumentNode,
} from 'graphql';

import {
  diffQueryAgainstStore,
} from './readFromStore';

import {
  writeResultToStore,
} from './writeToStore';

import {
  NormalizedCache,
} from './storeUtils';

import {
  ApolloReducer,
  ApolloReducerConfig,
} from '../store';

import {
  ApolloAction,
} from '../actions';

import {
  OperationResultReducer,
} from './mutationResults';

/**
 * This function takes a result reducer and all other necessary information to obtain a proper
 * redux store reducer.
 * note: we're just passing the config to access dataIdFromObject, which writeToStore needs.
 */
export function createStoreReducer(
  resultReducer: OperationResultReducer,
  document: DocumentNode,
  variables: Object,
  config: ApolloReducerConfig,
): ApolloReducer {

  return (store: NormalizedCache, action: ApolloAction) => {

    const { result, isMissing } = diffQueryAgainstStore({
      store,
      query: document,
      variables,
      returnPartialData: true,
      fragmentMatcherFunction: config.fragmentMatcher,
      config,
    });

    if (isMissing) {
      // If there is data missing, the query most likely isn't done loading yet. If there's an actual problem
      // with the query's data, the error would surface on that query, so we don't need to throw here.
      // It would be very hard for people to deal with missing data in reducers, so we opt not to invoke them.
      return store;
    }

    let nextResult;
    try {
      nextResult = resultReducer(result, action, variables); // action should include operation name
    } catch (err) {
      console.warn('Unhandled error in result reducer', err);
      throw err;
    }

    if (result !== nextResult) {
      return writeResultToStore({
        dataId: 'ROOT_QUERY',
        result: nextResult,
        store,
        document,
        variables,
        dataIdFromObject: config.dataIdFromObject,
        fragmentMatcherFunction: config.fragmentMatcher,
      });
    }
    return store;
  };
}
