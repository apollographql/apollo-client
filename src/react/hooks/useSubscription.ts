import { useContext, useState, useRef, useEffect } from 'react';
import { DocumentNode } from 'graphql';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { invariant } from 'ts-invariant';
import { DocumentType, verifyDocumentType } from '../parser';

import {
  SubscriptionHookOptions,
  SubscriptionResult
} from '../types/types';

import { OperationVariables } from '../../core';
import { getApolloContext } from '../context';

import { equal } from '@wry/equality';

export function useSubscription<TData = any, TVariables = OperationVariables>(
  subscription: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: SubscriptionHookOptions<TData, TVariables>,
) {
  const context = useContext(getApolloContext());
  const client = options?.client || context.client;
  invariant(
    !!client,
    'Could not find "client" in the context or passed in as an option. ' +
    'Wrap the root component in an <ApolloProvider>, or pass an ApolloClient' +
    'ApolloClient instance in via options.',
  );
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

  const ref = useRef({ client, subscription, options, observable });
  useEffect(() => {
    let shouldResubscribe = options?.shouldResubscribe;
    if (typeof shouldResubscribe === 'function') {
      shouldResubscribe = !!shouldResubscribe(options!);
    }

    if (options?.skip && !options?.skip !== !ref.current.options?.skip) {
      setResult({
        loading: false,
        data: void 0,
        error: void 0,
        variables: options?.variables,
      });
      setObservable(null);
    } else if (
      shouldResubscribe !== false && (
        client !== ref.current.client ||
        subscription !== ref.current.subscription ||
        options?.fetchPolicy !== ref.current.options?.fetchPolicy ||
        !options?.skip !== !ref.current.options?.skip ||
        !equal(options?.variables, ref.current.options?.variables)
      )
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
    }

    Object.assign(ref.current, { client, subscription, options });
  }, [client, subscription, options]);

  useEffect(() => {
    if (!observable) {
      return;
    }

    const subscription = observable.subscribe({
      next(fetchResult) {
        const result = {
          loading: false,
          data: fetchResult.data!,
          error: void 0,
          variables: options?.variables,
        };
        setResult(result);

        options?.onSubscriptionData?.({
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
        options?.onSubscriptionComplete?.();
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [observable]);

  return result;
}
