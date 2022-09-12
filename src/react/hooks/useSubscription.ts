import '../../utilities/globals';
import { useState, useRef, useEffect } from 'react';
import { DocumentNode } from 'graphql';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { equal } from '@wry/equality';

import { DocumentType, verifyDocumentType } from '../parser';
import {
  SubscriptionHookOptions,
  SubscriptionResult
} from '../types/types';
import { OperationVariables } from '../../core';
import { useApolloClient } from './useApolloClient';

export function useSubscription<TData = any, TVariables = OperationVariables>(
  subscription: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: SubscriptionHookOptions<TData, TVariables>,
) {
  const client = useApolloClient(options?.client);
  verifyDocumentType(subscription, DocumentType.Subscription);
  const [result, setResult] = useState<SubscriptionResult<TData>>({
    loading: !options?.skip,
    error: void 0,
    data: void 0,
    variables: options?.variables,
  });

  const [observable, setObservable] = useState(() => {
    if (options?.skip) {
      return null;
    }

    return client.subscribe({
      query: subscription,
      variables: options?.variables,
      fetchPolicy: options?.fetchPolicy,
      context: options?.context,
    });
  });

  const canResetObservableRef = useRef(false);
  useEffect(() => {
    return () => {
      canResetObservableRef.current = true;
    };
  }, []);

  const ref = useRef({ client, subscription, options });
  useEffect(() => {
    let shouldResubscribe = options?.shouldResubscribe;
    if (typeof shouldResubscribe === 'function') {
      shouldResubscribe = !!shouldResubscribe(options!);
    }

    if (options?.skip) {
      if (!options?.skip !== !ref.current.options?.skip || canResetObservableRef.current) {
        setResult({
          loading: false,
          data: void 0,
          error: void 0,
          variables: options?.variables,
        });
        setObservable(null);
        canResetObservableRef.current = false;
      }
    } else if (
      (shouldResubscribe !== false &&
        (client !== ref.current.client ||
          subscription !== ref.current.subscription ||
          options?.fetchPolicy !== ref.current.options?.fetchPolicy ||
          !options?.skip !== !ref.current.options?.skip ||
          !equal(options?.variables, ref.current.options?.variables))) ||
      canResetObservableRef.current
    ) {
      setResult({
        loading: true,
        data: void 0,
        error: void 0,
        variables: options?.variables,
      });
      setObservable(client.subscribe({
        query: subscription,
        variables: options?.variables,
        fetchPolicy: options?.fetchPolicy,
        context: options?.context,
      }));
      canResetObservableRef.current = false;
    }

    Object.assign(ref.current, { client, subscription, options });
  }, [client, subscription, options, canResetObservableRef.current]);

  useEffect(() => {
    if (!observable) {
      return;
    }

    const subscription = observable.subscribe({
      next(fetchResult) {
        const result = {
          loading: false,
          // TODO: fetchResult.data can be null but SubscriptionResult.data
          // expects TData | undefined only
          data: fetchResult.data!,
          error: void 0,
          variables: options?.variables,
        };
        setResult(result);

        ref.current.options?.onSubscriptionData?.({
          client,
          subscriptionData: result
        });
      },
      error(error) {
        setResult({
          loading: false,
          data: void 0,
          error,
          variables: options?.variables,
        });
      },
      complete() {
        ref.current.options?.onSubscriptionComplete?.();
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [observable]);

  return result;
}
