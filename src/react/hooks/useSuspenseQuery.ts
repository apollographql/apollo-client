import { useState } from 'react';
import {
  DocumentNode,
  OperationVariables,
  TypedDocumentNode
} from "../../core";
import { useApolloClient } from './useApolloClient';
import { SuspenseQueryHookOptions } from "../types/types";

export interface UseSuspenseQueryResult<TData> {
  data: TData;
}

export function useSuspenseQuery<TData = any, TVariables = OperationVariables>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<TData, TVariables> = Object.create(null)
): UseSuspenseQueryResult<TData> {
  const client = useApolloClient(options?.client);
  const [observable] = useState(() => {
    return client.watchQuery<TData>({ ...options, query })
  });

  const result = observable.getCurrentResult();

  if (result.loading) {
    const promise = observable.reobserve();

    throw promise;
  }

  return result;
}
