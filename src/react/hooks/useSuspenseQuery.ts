import { useMemo, useState } from 'react';
import {
  DocumentNode,
  OperationVariables,
  TypedDocumentNode
} from "../../core";
import { useApolloClient } from './useApolloClient';
import { SuspenseQueryHookOptions } from "../types/types";

export interface UseSuspenseQueryResult<
  TData = any,
  TVariables = OperationVariables
> {
  data: TData;
  variables: TVariables;
}

export function useSuspenseQuery_experimental<
  TData = any,
  TVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<TData, TVariables> = Object.create(null)
): UseSuspenseQueryResult<TData, TVariables> {
  const client = useApolloClient(options?.client);
  const [observable] = useState(() => {
    return client.watchQuery<TData>({ ...options, query })
  });

  const result = observable.getCurrentResult();

  if (result.loading) {
    const promise = observable.reobserve();

    throw promise;
  }

  return useMemo(() => {
    return {
      data: result.data,
      variables: observable.variables as TVariables
    };
  }, [result, observable]);
}
