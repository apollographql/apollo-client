import { invariant } from "../../utilities/globals/index.js";
import * as React from "rehackt";
import type { DocumentNode } from "graphql";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { equal } from "@wry/equality";

import { DocumentType, verifyDocumentType } from "../parser/index.js";
import type {
  NoInfer,
  SubscriptionHookOptions,
  SubscriptionResult,
} from "../types/types.js";
import type { OperationVariables } from "../../core/index.js";
import { useApolloClient } from "./useApolloClient.js";

export function useSubscription<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
>(
  subscription: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: SubscriptionHookOptions<NoInfer<TData>, NoInfer<TVariables>>
) {
  const hasIssuedDeprecationWarningRef = React.useRef(false);
  const client = useApolloClient(options?.client);
  verifyDocumentType(subscription, DocumentType.Subscription);
  const [result, setResult] = React.useState<
    SubscriptionResult<TData, TVariables>
  >({
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

  const [observable, setObservable] = React.useState(() => {
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

  const canResetObservableRef = React.useRef(false);
  React.useEffect(() => {
    return () => {
      canResetObservableRef.current = true;
    };
  }, []);

  const ref = React.useRef({ client, subscription, options });
  React.useEffect(() => {
    let shouldResubscribe = options?.shouldResubscribe;
    if (typeof shouldResubscribe === "function") {
      shouldResubscribe = !!shouldResubscribe(options!);
    }

    if (options?.skip) {
      if (
        !options?.skip !== !ref.current.options?.skip ||
        canResetObservableRef.current
      ) {
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
      setObservable(
        client.subscribe({
          query: subscription,
          variables: options?.variables,
          fetchPolicy: options?.fetchPolicy,
          context: options?.context,
        })
      );
      canResetObservableRef.current = false;
    }

    Object.assign(ref.current, { client, subscription, options });
  }, [client, subscription, options, canResetObservableRef.current]);

  React.useEffect(() => {
    if (!observable) {
      return;
    }

    let subscriptionStopped = false;
    const subscription = observable.subscribe({
      next(fetchResult) {
        if (subscriptionStopped) {
          return;
        }

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
            data: result,
          });
        } else if (ref.current.options?.onSubscriptionData) {
          ref.current.options.onSubscriptionData({
            client,
            subscriptionData: result,
          });
        }
      },
      error(error) {
        if (!subscriptionStopped) {
          setResult({
            loading: false,
            data: void 0,
            error,
            variables: options?.variables,
          });
          ref.current.options?.onError?.(error);
        }
      },
      complete() {
        if (!subscriptionStopped) {
          if (ref.current.options?.onComplete) {
            ref.current.options.onComplete();
          } else if (ref.current.options?.onSubscriptionComplete) {
            ref.current.options.onSubscriptionComplete();
          }
        }
      },
    });

    return () => {
      // immediately stop receiving subscription values, but do not unsubscribe
      // until after a short delay in case another useSubscription hook is
      // reusing the same underlying observable and is about to subscribe
      subscriptionStopped = true;
      setTimeout(() => {
        subscription.unsubscribe();
      });
    };
  }, [observable]);

  return result;
}
