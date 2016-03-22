/// <reference path="../typings/main.d.ts" />

import {
  SelectionSet,
} from 'graphql';

export interface Store {
  [dataId: string]: StoreObject;
}

export interface StoreObject {
  __typename?: string;
  [storeFieldKey: string]: StoreValue;
}

// any is here because it's the only way to express null...
export type StoreValue = number | string | string[] | any;

export const QUERY_RESULT_ACTION = 'QUERY_RESULT';

export function createQueryResultAction({
  result,
  selectionSet,
}: {
  result: any,
  selectionSet: SelectionSet,
}): QueryResultAction {
  return {
    type: QUERY_RESULT_ACTION,
    result,
    selectionSet,
  };
}

export interface QueryResultAction {
  type: string;
  result: any;
  selectionSet: SelectionSet;
}
