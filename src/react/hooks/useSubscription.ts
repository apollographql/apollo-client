import '../../utilities/globals';
import { useState, useRef, useEffect } from 'react';
import { DocumentNode } from 'graphql';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { invariant } from '../../utilities/globals'
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
  const hasIssuedDeprecationWarningRef = useRef(false);
  const client = useApolloClient(options?.client);
  verifyDocumentType(subscription, DocumentType.Subscription);
  const [result, setResult] = useState<SubscriptionResult<TData>>({
    loading: !options?.skip,
    error: void 0,
    data: void 0,
    variables: options?.variables,
  });

  if (!hasIssuedDeprecationWarningRef.current) {
    hasIssuedDeprecationWarningRef.current = true;

    if (options?.onSubscriptionData) {
      invariant.warn(
        options.onData
          ? "'useSubscription' supports only the 'onSubscriptionData' or 'onData' option, but not both. Only the 'onData' option will be used."
          : "'onSubscriptionData' is deprecated and will be removed in a future major version. Please use the 'onData' option instead."
      );
    }

    if (options?.onSubscriptionComplete) {
      invariant.warn(
        options.onComplete
          ? "'useSubscription' supports only the 'onSubscriptionComplete' or 'onComplete' option, but not both. Only the 'onComplete' option will be used."
          : "'onSubscriptionComplete' is deprecated and will be removed in a future major version. Please use the 'onComplete' option instead."
      );
    }
  }

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

        if (ref.current.options?.onData) {
          ref.current.options.onData({
            client,
            data: result
          });
        } else if (ref.current.options?.onSubscriptionData) {
          ref.current.options.onSubscriptionData({
            client,
            subscriptionData: result
          });
        }
      },
      error(error) {
        setResult({
          loading: false,
          data: void 0,
          error,
          variables: options?.variables,
        });
        ref.current.options?.onError?.(error);
      },
      complete() {
        if (ref.current.options?.onComplete) {
          ref.current.options.onComplete();
        } else if (ref.current.options?.onSubscriptionComplete) {
          ref.current.options.onSubscriptionComplete();
        }
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [observable]);

  return result;
}
