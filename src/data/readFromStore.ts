import {
  diffQueryAgainstStore,
} from './diffAgainstStore';

import {
  Document,
} from 'graphql';

import {
  NormalizedCache,
} from './store';

// import {
//   printAST,
// } from './debug';

/**
 * Resolves the result of a query solely from the store (i.e. never hits the server).
 *
 * @param store The {@link NormalizedCache} used by Apollo for the `data` portion of the store.
 *
 * @param query The query document to resolve from the data available in the store.
 *
 * @param variables A map from the name of a variable to its value. These variables can be
 * referenced by the query document.
 *
 * @param returnPartialData If set to true, the query will be resolved even if all of the data
 * needed to resolve the query is not found in the store. The data keys that are not found will not
 * be present in the returned object. If set to false, an error will be thrown if there are fields
 * that cannot be resolved from the store.
 *
 * @param fragmentMap A map from the name of a fragment to its fragment definition. These fragments
 * can be referenced within the query document.
 */
export function readQueryFromStore({
  store,
  query,
  variables,
  returnPartialData = false,
}: {
  store: NormalizedCache,
  query: Document,
  variables?: Object,
  returnPartialData?: boolean,
}): Object {
  const {
    result,
  } = diffQueryAgainstStore({
    query,
    store,
    throwOnMissingField: !returnPartialData,
    variables,
  });

  return result;
}
