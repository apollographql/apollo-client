import {
  SelectionSet,
} from 'graphql';

export const QUERY_RESULT_ACTION = 'QUERY_RESULT';

export function createQueryResultAction({
  result,
  selectionSet,
  variables,
}: {
  result: any,
  selectionSet: SelectionSet,
  variables: Object
}): QueryResultAction {
  return {
    type: QUERY_RESULT_ACTION,
    result,
    selectionSet,
    variables,
  };
}

export interface QueryResultAction {
  type: string;
  result: any;
  selectionSet: SelectionSet;
  variables: Object;
}

export type ApolloAction = QueryResultAction;
