import { useContext, useState, useRef, useEffect, useReducer } from 'react';
import { DocumentNode } from 'graphql';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';

import { SubscriptionHookOptions } from '../types/types';
import { SubscriptionData } from '../data';
import { OperationVariables } from '../../core';
import { getApolloContext } from '../context';
import { useAfterFastRefresh } from './utils/useAfterFastRefresh';

export function useSubscription<TData = any, TVariables = OperationVariables>(
  subscription: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: SubscriptionHookOptions<TData, TVariables>
) {
  const [, forceUpdate] = useReducer(x => x + 1, 0);
  const context = useContext(getApolloContext());
  const updatedOptions = options
    ? { ...options, subscription }
    : { subscription };
  const [result, setResult] = useState({
    loading: !updatedOptions.skip,
    error: void 0,
    data: void 0,
  });

  const subscriptionDataRef = useRef<SubscriptionData<TData, TVariables>>();
  function getSubscriptionDataRef() {
    if (!subscriptionDataRef.current) {
      subscriptionDataRef.current = new SubscriptionData<TData, TVariables>({
        options: updatedOptions,
        context,
        setResult
      });
    }
    return subscriptionDataRef.current;
  }

  const subscriptionData = getSubscriptionDataRef();
  subscriptionData.setOptions(updatedOptions, true);
  subscriptionData.context = context;

  if (__DEV__) {
    // ensure we run an update after refreshing so that we can resubscribe
    useAfterFastRefresh(forceUpdate);
  }

  useEffect(() => subscriptionData.afterExecute());
  useEffect(() => {
    return () => {
      subscriptionData.cleanup();
      subscriptionDataRef.current = void 0;
    };
  }, []);

  return subscriptionData.execute(result);
}
