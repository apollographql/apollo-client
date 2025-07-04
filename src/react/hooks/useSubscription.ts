import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { equal } from "@wry/equality";
import type { DocumentNode } from "graphql";
import * as React from "react";

import type {
  ApolloClient,
  DefaultContext,
  ErrorLike,
  ErrorPolicy,
  FetchPolicy,
  OperationVariables,
  SubscriptionOptions,
} from "@apollo/client";
import type { MaybeMasked } from "@apollo/client/masking";
import type {
  NoInfer,
  VariablesOption,
} from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

import { useDeepMemo } from "./internal/useDeepMemo.js";
import { useIsomorphicLayoutEffect } from "./internal/useIsomorphicLayoutEffect.js";
import { useApolloClient } from "./useApolloClient.js";
import { useSyncExternalStore } from "./useSyncExternalStore.js";

export declare namespace useSubscription {
  export namespace Base {
    export interface Options<
      TData = unknown,
      TVariables extends OperationVariables = OperationVariables,
    > {
      /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#fetchPolicy:member} */
      fetchPolicy?: FetchPolicy;

      /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#errorPolicy:member} */
      errorPolicy?: ErrorPolicy;

      /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#shouldResubscribe:member} */
      shouldResubscribe?:
        | boolean
        | ((options: Options<TData, TVariables>) => boolean);

      /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#client:member} */
      client?: ApolloClient;

      /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#skip:member} */
      skip?: boolean;

      /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#context:member} */
      context?: DefaultContext;

      /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#extensions:member} */
      extensions?: Record<string, any>;

      /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#onComplete:member} */
      onComplete?: () => void;

      /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#onData:member} */
      onData?: (options: OnDataOptions<TData>) => any;

      /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#onError:member} */
      onError?: (error: ErrorLike) => void;

      /**
       * {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#ignoreResults:member}
       * @defaultValue `false`
       */
      ignoreResults?: boolean;
    }
  }

  export type Options<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  > = Base.Options<TData, TVariables> & VariablesOption<TVariables>;

  export namespace DocumentationTypes {
    export interface Result<
      TData = unknown,
      TVariables extends OperationVariables = OperationVariables,
    > extends Base.Options<TData, TVariables> {
      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
      variables?: TVariables;
    }
  }

  export interface Result<TData = unknown> {
    /** {@inheritDoc @apollo/client!SubscriptionResultDocumentation#loading:member} */
    loading: boolean;

    /** {@inheritDoc @apollo/client!SubscriptionResultDocumentation#data:member} */
    data?: MaybeMasked<TData>;

    /** {@inheritDoc @apollo/client!SubscriptionResultDocumentation#error:member} */
    error?: ErrorLike;

    restart: () => void;
  }

  export type OnDataResult<TData = unknown> = Omit<Result<TData>, "restart">;

  export interface OnDataOptions<TData = unknown> {
    client: ApolloClient;
    data: OnDataResult<TData>;
  }

  export interface OnSubscriptionDataOptions<TData = unknown> {
    client: ApolloClient;
    subscriptionData: OnDataResult<TData>;
  }
}

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
 * #### Consider using `onData` instead of `useEffect`
 *
 * If you want to react to incoming data, please use the `onData` option instead of `useEffect`.
 * State updates you make inside a `useEffect` hook might cause additional rerenders, and `useEffect` is mostly meant for side effects of rendering, not as an event handler.
 * State updates made in an event handler like `onData` might - depending on the React version - be batched and cause only a single rerender.
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
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  subscription: DocumentNode | TypedDocumentNode<TData, TVariables>,
  ...[options = {} as useSubscription.Options<TData, TVariables>]: {} extends (
    TVariables
  ) ?
    [options?: useSubscription.Options<NoInfer<TData>, NoInfer<TVariables>>]
  : [options: useSubscription.Options<NoInfer<TData>, NoInfer<TVariables>>]
): useSubscription.Result<TData> {
  const client = useApolloClient(options.client);

  const {
    skip,
    fetchPolicy,
    errorPolicy,
    shouldResubscribe,
    context,
    extensions,
    ignoreResults,
  } = options;
  const variables = useDeepMemo(() => options.variables, [options.variables]);

  const recreate = () =>
    createSubscription(
      client,
      subscription,
      variables,
      fetchPolicy,
      errorPolicy,
      context,
      extensions
    );

  let [observable, setObservable] = React.useState(
    options.skip ? null : recreate
  );

  const recreateRef = React.useRef(recreate);
  useIsomorphicLayoutEffect(() => {
    recreateRef.current = recreate;
  });

  if (skip) {
    if (observable) {
      setObservable((observable = null));
    }
  } else if (
    !observable ||
    ((client !== observable.__.client ||
      subscription !== observable.__.query ||
      fetchPolicy !== observable.__.fetchPolicy ||
      errorPolicy !== observable.__.errorPolicy ||
      !equal(variables, observable.__.variables)) &&
      (typeof shouldResubscribe === "function" ?
        !!shouldResubscribe(options!)
      : shouldResubscribe) !== false)
  ) {
    setObservable((observable = recreate()));
  }

  const optionsRef = React.useRef(options);
  React.useEffect(() => {
    optionsRef.current = options;
  });

  const fallbackLoading = !skip && !ignoreResults;
  const fallbackResult = React.useMemo(
    () => ({
      loading: fallbackLoading,
      error: void 0,
      data: void 0,
    }),
    [fallbackLoading]
  );

  const ignoreResultsRef = React.useRef(ignoreResults);
  useIsomorphicLayoutEffect(() => {
    // We cannot reference `ignoreResults` directly in the effect below
    // it would add a dependency to the `useEffect` deps array, which means the
    // subscription would be recreated if `ignoreResults` changes
    // As a result, on resubscription, the last result would be re-delivered,
    // rendering the component one additional time, and re-triggering `onData`.
    // The same applies to `fetchPolicy`, which results in a new `observable`
    // being created. We cannot really avoid it in that case, but we can at least
    // avoid it for `ignoreResults`.
    ignoreResultsRef.current = ignoreResults;
  });

  const ret = useSyncExternalStore(
    React.useCallback(
      (update) => {
        if (!observable) {
          return () => {};
        }

        let subscriptionStopped = false;
        const client = observable.__.client;
        const subscription = observable.subscribe({
          next(value) {
            if (subscriptionStopped) {
              return;
            }

            const result = {
              loading: false,
              data: value.data,
              error: value.error,
            };

            observable.__.setResult(result);
            if (!ignoreResultsRef.current) update();

            if (result.error) {
              optionsRef.current.onError?.(result.error);
            } else if (optionsRef.current.onData) {
              optionsRef.current.onData({
                client,
                data: result,
              });
            }
          },
          complete() {
            observable.__.completed = true;
            if (!subscriptionStopped && optionsRef.current.onComplete) {
              optionsRef.current.onComplete();
            }
          },
        });

        return () => {
          // immediately stop receiving subscription values, but do not unsubscribe
          // until after a short delay in case another useSubscription hook is
          // reusing the same underlying observable and is about to subscribe
          subscriptionStopped = true;

          setTimeout(() => subscription.unsubscribe());
        };
      },
      [observable]
    ),
    () =>
      observable && !skip && !ignoreResults ?
        observable.__.result
      : fallbackResult,
    () => fallbackResult
  );

  const restart = React.useCallback(() => {
    invariant(
      !optionsRef.current.skip,
      "A subscription that is skipped cannot be restarted."
    );
    if (observable?.__.completed) {
      setObservable(recreateRef.current());
    } else {
      observable?.restart();
    }
  }, [optionsRef, recreateRef, observable]);

  return React.useMemo(() => ({ ...ret, restart }), [ret, restart]);
}

type SubscriptionResult<TData> = Omit<useSubscription.Result<TData>, "restart">;

function createSubscription<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  client: ApolloClient,
  query: TypedDocumentNode<TData, TVariables>,
  variables: TVariables | undefined,
  fetchPolicy: FetchPolicy | undefined,
  errorPolicy: ErrorPolicy | undefined,
  context: DefaultContext | undefined,
  extensions: Record<string, any> | undefined
) {
  const options = {
    query,
    variables,
    fetchPolicy,
    errorPolicy,
    context,
    extensions,
  } as SubscriptionOptions<TVariables, TData>;
  const __ = {
    ...options,
    client,
    completed: false,
    result: {
      loading: true,
      data: void 0,
      error: void 0,
    } as SubscriptionResult<TData>,
    setResult(result: SubscriptionResult<TData>) {
      __.result = result;
    },
  };

  return Object.assign(client.subscribe(options), {
    /**
     * A tracking object to store details about the observable and the latest result of the subscription.
     */
    __,
  });
}
