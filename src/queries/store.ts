import {
  ApolloAction,
} from '../actions';

import {
  OperationDefinition,
} from 'graphql';

export interface QueryStore {
  [queryId: string]: QueryStoreValue;
}

export interface QueryStoreValue {
  queryString: string;
  queryAst: OperationDefinition;
  minimizedQueryString: string;
  minimizedQueryAST: OperationDefinition;
  variables: Object;
  status: QueryStatus;
  error: Error;
}

export type QueryStatus =
  // Query has been sent to server, waiting for response
  "LOADING" |

  // Network error occurred, we didn't get any result
  "ERROR" |

  // We got a GraphQL result from the server, and it's in the store
  "DONE";

export function queries(
  previousState: QueryStore = {},
  action: ApolloAction
): QueryStore {
  return previousState;
}
