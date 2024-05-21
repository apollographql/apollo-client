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
import type {
  ApolloClient,
  DefaultContext,
  FetchPolicy,
  FetchResult,
  OperationVariables,
} from "../../core/index.js";
import { Observable } from "../../core/index.js";
import { useApolloClient } from "./useApolloClient.js";
import { useDeepMemo } from "./internal/useDeepMemo.js";
import { useSyncExternalStore } from "./useSyncExternalStore.js";

/**
 * > Refer to the [Subscriptions](https://www.apollographql.com/docs/react/data/subscriptions/) section for a more in-depth overview of `useSubscription`.
 *
 * @example
 * ```jsx
 * const COMMENTS_SUBSCRIPTION = gql`
 *   subscription OnCommentAdded($repoFullName: String!) {
 *     commentAdded(repoFullName: $repoFullName) {
 *       id
 *       content
 *     }
 *   }
 * `;
 *
 * function DontReadTheComments({ repoFullName }) {
 *   const {
 *     data: { commentAdded },
 *     loading,
 *   } = useSubscription(COMMENTS_SUBSCRIPTION, { variables: { repoFullName } });
 *   return <h4>New comment: {!loading && commentAdded.content}</h4>;
 * }
 * ```
 * @remarks
 * #### Subscriptions and React 18 Automatic Batching
 *
 * With React 18's [automatic batching](https://react.dev/blog/2022/03/29/react-v18#new-feature-automatic-batching), multiple state updates may be grouped into a single re-render for better performance.
 *
 * If your subscription API sends multiple messages at the same time or in very fast succession (within fractions of a millisecond), it is likely that only the last message received in that narrow time frame will result in a re-render.
 *
 * Consider the following component:
 *
 * ```jsx
 * export function Subscriptions() {
 *   const { data, error, loading } = useSubscription(query);
 *   const [accumulatedData, setAccumulatedData] = useState([]);
 *
 *   useEffect(() => {
 *     setAccumulatedData((prev) => [...prev, data]);
 *   }, [data]);
 *
 *   return (
 *     <>
 *       {loading && <p>Loading...</p>}
 *       {JSON.stringify(accumulatedData, undefined, 2)}
 *     </>
 *   );
 * }
 * ```
 *
 * If your subscription back-end emits two messages with the same timestamp, only the last message received by Apollo Client will be rendered. This is because React 18 will batch these two state updates into a single re-render.
 *
 * Since the component above is using `useEffect` to push `data` into a piece of local state on each `Subscriptions` re-render, the first message will never be added to the `accumulatedData` array since its render was skipped.
 *
 * Instead of using `useEffect` here, we can re-write this component to use the `onData` callback function accepted in `useSubscription`'s `options` object:
 *
 * ```jsx
 * export function Subscriptions() {
 *   const [accumulatedData, setAccumulatedData] = useState([]);
 *   const { data, error, loading } = useSubscription(
 *     query,
 *     {
 *       onData({ data }) {
 *         setAccumulatedData((prev) => [...prev, data])
 *       }
 *     }
 *   );
 *
 *   return (
 *     <>
 *       {loading && <p>Loading...</p>}
 *       {JSON.stringify(accumulatedData, undefined, 2)}
 *     </>
 *   );
 * }
 * ```
 *
 * > ⚠️ **Note:** The `useSubscription` option `onData` is available in Apollo Client >= 3.7. In previous versions, the equivalent option is named `onSubscriptionData`.
 *
 * Now, the first message will be added to the `accumulatedData` array since `onData` is called _before_ the component re-renders. React 18 automatic batching is still in effect and results in a single re-render, but with `onData` we can guarantee each message received after the component mounts is added to `accumulatedData`.
 *
 * @since 3.0.0
 * @param subscription - A GraphQL subscription document parsed into an AST by `gql`.
 * @param options - Options to control how the subscription is executed.
 * @returns Query result object
 */
export function useSubscription<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
>(
  subscription: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SubscriptionHookOptions<NoInfer<TData>, NoInfer<TVariables>> = {}
) {
  const hasIssuedDeprecationWarningRef = React.useRef(false);
  const client = useApolloClient(options.client);
  verifyDocumentType(subscription, DocumentType.Subscription);

  if (!hasIssuedDeprecationWarningRef.current) {
    hasIssuedDeprecationWarningRef.current = true;

    if (options.onSubscriptionData) {
      invariant.warn(
        options.onData ?
          "'useSubscription' supports only the 'onSubscriptionData' or 'onData' option, but not both. Only the 'onData' option will be used."
        : "'onSubscriptionData' is deprecated and will be removed in a future major version. Please use the 'onData' option instead."
      );
    }

    if (options.onSubscriptionComplete) {
      invariant.warn(
        options.onComplete ?
          "'useSubscription' supports only the 'onSubscriptionComplete' or 'onComplete' option, but not both. Only the 'onComplete' option will be used."
        : "'onSubscriptionComplete' is deprecated and will be removed in a future major version. Please use the 'onComplete' option instead."
      );
    }
  }

  let { skip, fetchPolicy, variables, shouldResubscribe, context } = options;
  variables = useDeepMemo(() => variables, [variables]);

  let [observable, setObservable] = React.useState(() =>
    options.skip ? null : (
      createSubscription(client, subscription, variables, fetchPolicy, context)
    )
  );

  if (skip) {
    if (observable) {
      setObservable((observable = null));
    }
  } else if (
    !observable ||
    ((client !== observable.__.client ||
      subscription !== observable.__.query ||
      fetchPolicy !== observable.__.fetchPolicy ||
      !equal(variables, observable.__.variables)) &&
      (typeof shouldResubscribe === "function" ?
        !!shouldResubscribe(options!)
      : shouldResubscribe) !== false)
  ) {
    setObservable(
      (observable = createSubscription(
        client,
        subscription,
        variables,
        fetchPolicy,
        context
      ))
    );
  }

  const optionsRef = React.useRef(options);
  React.useEffect(() => {
    optionsRef.current = options;
  });

  const fallbackResult = React.useMemo<SubscriptionResult<TData, TVariables>>(
    () => ({
      loading: !skip,
      error: void 0,
      data: void 0,
      variables: variables,
    }),
    [skip, variables]
  );

  return useSyncExternalStore<SubscriptionResult<TData, TVariables>>(
    React.useCallback(
      (update) => {
        if (!observable) {
          return () => {};
        }

        let subscriptionStopped = false;
        const variables = observable.__.variables;
        const client = observable.__.client;
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
              variables,
            };
            observable.__.setResult(result);
            update();

            if (optionsRef.current.onData) {
              optionsRef.current.onData({
                client,
                data: result,
              });
            } else if (optionsRef.current.onSubscriptionData) {
              optionsRef.current.onSubscriptionData({
                client,
                subscriptionData: result,
              });
            }
          },
          error(error) {
            if (!subscriptionStopped) {
              observable.__.setResult({
                loading: false,
                data: void 0,
                error,
                variables,
              });
              update();
              optionsRef.current.onError?.(error);
            }
          },
          complete() {
            if (!subscriptionStopped) {
              if (optionsRef.current.onComplete) {
                optionsRef.current.onComplete();
              } else if (optionsRef.current.onSubscriptionComplete) {
                optionsRef.current.onSubscriptionComplete();
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
      },
      [observable]
    ),
    () => (observable && !skip ? observable.__.result : fallbackResult)
  );
}

function createSubscription<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
>(
  client: ApolloClient<any>,
  query: TypedDocumentNode<TData, TVariables>,
  variables?: TVariables,
  fetchPolicy?: FetchPolicy,
  context?: DefaultContext
) {
  const __ = {
    variables,
    client,
    query,
    fetchPolicy,
    result: {
      loading: true,
      data: void 0,
      error: void 0,
      variables,
    } as SubscriptionResult<TData, TVariables>,
    setResult(result: SubscriptionResult<TData, TVariables>) {
      __.result = result;
    },
  };

  let observable: Observable<FetchResult<TData>> | null = null;
  return Object.assign(
    new Observable<FetchResult<TData>>((observer) => {
      // lazily start the subscription when the first observer subscribes
      // to get around strict mode
      observable ||= client.subscribe({
        query,
        variables,
        fetchPolicy,
        context,
      });
      const sub = observable.subscribe(observer);
      return () => sub.unsubscribe();
    }),
    {
      /**
       * A tracking object to store details about the observable and the latest result of the subscription.
       */
      __,
    }
  );
}
