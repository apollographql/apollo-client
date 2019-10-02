import { useContext, useState, useRef, useEffect } from 'react';
import { DocumentNode } from 'graphql';

import { getApolloContext } from '../context/ApolloContext';
import { SubscriptionHookOptions } from '../types/types';
import { SubscriptionData } from '../data/SubscriptionData';
import { OperationVariables } from '../../core/types';

export function useSubscription<TData = any, TVariables = OperationVariables>(
  subscription: DocumentNode,
  options?: SubscriptionHookOptions<TData, TVariables>
) {
  const context = useContext(getApolloContext());
  const updatedOptions = options
    ? { ...options, subscription }
    : { subscription };
  const [result, setResult] = useState({
    loading: !updatedOptions.skip,
    error: undefined,
    data: undefined
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

  useEffect(() => subscriptionData.afterExecute());
  useEffect(() => subscriptionData.cleanup.bind(subscriptionData), []);

  return subscriptionData.execute(result);
}
