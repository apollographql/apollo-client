import {
  Document,
} from 'graphql';

import {
  readQueryFromStore,
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
  document: Document,
  variables: Object,
  config: ApolloReducerConfig,
  // TODO: maybe turn the arguments into a single object argument
): ApolloReducer {

  return (store: NormalizedCache, action: ApolloAction) => {
    const currentResult = readQueryFromStore({
      store,
      query: document,
      variables,
      returnPartialData: true,
      config,
    });
    // TODO add info about networkStatus

    const nextResult = resultReducer(currentResult, action, variables); // action should include operation name

    if (currentResult !== nextResult) {
      return writeResultToStore({
        dataId: 'ROOT_QUERY',
        result: nextResult,
        store,
        document,
        variables,
        dataIdFromObject: config.dataIdFromObject,
      });
    }
    return store;
  };
}
