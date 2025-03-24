import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { equal } from "@wry/equality";
import type { DocumentNode } from "graphql";
import * as React from "react";

import type {
  ApolloCache,
  ApolloClient,
  DefaultContext,
  ErrorLike,
  ErrorPolicy,
  FetchResult,
  InternalRefetchQueriesInclude,
  MaybeMasked,
  MutateResult,
  MutationFetchPolicy,
  MutationOptions,
  MutationQueryReducersMap,
  MutationUpdaterFunction,
  OnQueryUpdated,
  OperationVariables,
  Unmasked,
} from "@apollo/client/core";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { DocumentType, verifyDocumentType } from "@apollo/client/react/parser";
import type { NoInfer } from "@apollo/client/utilities";
import { mergeOptions } from "@apollo/client/utilities";

import type { IgnoreModifier } from "../../cache/core/types/common.js";

import { useIsomorphicLayoutEffect } from "./internal/useIsomorphicLayoutEffect.js";
import { useApolloClient } from "./useApolloClient.js";

export declare namespace useMutation {
  export interface Options<
    TData = unknown,
    TVariables = OperationVariables,
    TContext = DefaultContext,
    TCache extends ApolloCache = ApolloCache,
  > {
    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#optimisticResponse:member} */
    optimisticResponse?:
      | Unmasked<NoInfer<TData>>
      | ((
          vars: TVariables,
          { IGNORE }: { IGNORE: IgnoreModifier }
        ) => Unmasked<NoInfer<TData>> | IgnoreModifier);

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#updateQueries:member} */
    updateQueries?: MutationQueryReducersMap<TData>;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#refetchQueries:member} */
    refetchQueries?:
      | ((
          result: FetchResult<Unmasked<TData>>
        ) => InternalRefetchQueriesInclude)
      | InternalRefetchQueriesInclude;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#awaitRefetchQueries:member} */
    awaitRefetchQueries?: boolean;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#update:member} */
    update?: MutationUpdaterFunction<TData, TVariables, TContext, TCache>;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#onQueryUpdated:member} */
    onQueryUpdated?: OnQueryUpdated<any>;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#errorPolicy:member} */
    errorPolicy?: ErrorPolicy;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#variables:member} */
    variables?: TVariables;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#context:member} */
    context?: TContext;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#fetchPolicy:member} */
    fetchPolicy?: MutationFetchPolicy;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#keepRootFields:member} */
    keepRootFields?: boolean;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#client:member} */
    client?: ApolloClient;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#notifyOnNetworkStatusChange:member} */
    notifyOnNetworkStatusChange?: boolean;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#onCompleted:member} */
    onCompleted?: (
      data: MaybeMasked<TData>,
      clientOptions?: Options<TData, TVariables, TContext, TCache>
    ) => void;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#onError:member} */
    onError?: (
      error: ErrorLike,
      clientOptions?: Options<TData, TVariables, TContext, TCache>
    ) => void;
  }

  export interface Result<TData = unknown> {
    /** {@inheritDoc @apollo/client!MutationResultDocumentation#data:member} */
    data?: MaybeMasked<TData> | null;

    /** {@inheritDoc @apollo/client!MutationResultDocumentation#error:member} */
    error?: ErrorLike;

    /** {@inheritDoc @apollo/client!MutationResultDocumentation#loading:member} */
    loading: boolean;

    /** {@inheritDoc @apollo/client!MutationResultDocumentation#called:member} */
    called: boolean;

    /** {@inheritDoc @apollo/client!MutationResultDocumentation#client:member} */
    client: ApolloClient;

    /** {@inheritDoc @apollo/client!MutationResultDocumentation#reset:member} */
    reset: () => void;
  }

  export type ResultTuple<
    TData,
    TVariables,
    TContext = DefaultContext,
    TCache extends ApolloCache = ApolloCache,
  > = [
    mutate: (
      options?: MutationFunctionOptions<TData, TVariables, TContext, TCache>
    ) => Promise<MutateResult<MaybeMasked<TData>>>,
    result: Result<TData>,
  ];

  export interface MutationFunctionOptions<
    TData = unknown,
    TVariables = OperationVariables,
    TContext = DefaultContext,
    TCache extends ApolloCache = ApolloCache,
  > extends Options<TData, TVariables, TContext, TCache> {
    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#mutation:member} */
    // TODO: Remove this option. We shouldn't allow the mutation to be overridden
    // in the mutation function
    mutation?: DocumentNode | TypedDocumentNode<TData, TVariables>;
  }
}

/**
 *
 *
 * > Refer to the [Mutations](https://www.apollographql.com/docs/react/data/mutations/) section for a more in-depth overview of `useMutation`.
 *
 * @example
 * ```jsx
 * import { gql, useMutation } from '@apollo/client';
 *
 * const ADD_TODO = gql`
 *   mutation AddTodo($type: String!) {
 *     addTodo(type: $type) {
 *       id
 *       type
 *     }
 *   }
 * `;
 *
 * function AddTodo() {
 *   let input;
 *   const [addTodo, { data }] = useMutation(ADD_TODO);
 *
 *   return (
 *     <div>
 *       <form
 *         onSubmit={e => {
 *           e.preventDefault();
 *           addTodo({ variables: { type: input.value } });
 *           input.value = '';
 *         }}
 *       >
 *         <input
 *           ref={node => {
 *             input = node;
 *           }}
 *         />
 *         <button type="submit">Add Todo</button>
 *       </form>
 *     </div>
 *   );
 * }
 * ```
 * @since 3.0.0
 * @param mutation - A GraphQL mutation document parsed into an AST by `gql`.
 * @param options - Options to control how the mutation is executed.
 * @returns A tuple in the form of `[mutate, result]`
 */
export function useMutation<
  TData = unknown,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache = ApolloCache,
>(
  mutation: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: useMutation.Options<
    NoInfer<TData>,
    NoInfer<TVariables>,
    TContext,
    TCache
  >
): useMutation.ResultTuple<TData, TVariables, TContext, TCache> {
  const client = useApolloClient(options?.client);
  verifyDocumentType(mutation, DocumentType.Mutation);
  const [result, setResult] = React.useState<
    Omit<useMutation.Result<TData>, "reset">
  >({
    called: false,
    loading: false,
    client,
  });

  const ref = React.useRef({
    result,
    mutationId: 0,
    isMounted: true,
    client,
    mutation,
    options,
  });

  useIsomorphicLayoutEffect(() => {
    Object.assign(ref.current, { client, options, mutation });
  });

  const execute = React.useCallback(
    (
      executeOptions: useMutation.MutationFunctionOptions<
        TData,
        TVariables,
        TContext,
        TCache
      > = {}
    ) => {
      const { options, mutation } = ref.current;
      const baseOptions = { ...options, mutation };
      const client = executeOptions.client || ref.current.client;

      if (!ref.current.result.loading && ref.current.isMounted) {
        setResult(
          (ref.current.result = {
            loading: true,
            error: void 0,
            data: void 0,
            called: true,
            client,
          })
        );
      }

      const mutationId = ++ref.current.mutationId;
      const clientOptions = mergeOptions(baseOptions, executeOptions);

      return client
        .mutate(clientOptions as MutationOptions<TData, OperationVariables>)
        .then(
          (response) => {
            const { data, errors } = response;
            const error =
              errors && errors.length > 0 ?
                new CombinedGraphQLErrors(errors)
              : void 0;

            const onError =
              executeOptions.onError || ref.current.options?.onError;

            if (error && onError) {
              onError(error, clientOptions);
            }

            if (mutationId === ref.current.mutationId) {
              const result = {
                called: true,
                loading: false,
                data,
                error,
                client,
              };

              if (ref.current.isMounted && !equal(ref.current.result, result)) {
                setResult((ref.current.result = result));
              }
            }

            const onCompleted =
              executeOptions.onCompleted || ref.current.options?.onCompleted;

            if (!error) {
              onCompleted?.(response.data!, clientOptions);
            }

            return response;
          },
          (error) => {
            if (
              mutationId === ref.current.mutationId &&
              ref.current.isMounted
            ) {
              const result = {
                loading: false,
                error,
                data: void 0,
                called: true,
                client,
              };

              if (!equal(ref.current.result, result)) {
                setResult((ref.current.result = result));
              }
            }

            const onError =
              executeOptions.onError || ref.current.options?.onError;

            if (onError) {
              onError(error, clientOptions);

              // TODO(brian): why are we returning this here???
              return { data: void 0, errors: error };
            }

            throw error;
          }
        );
    },
    []
  );

  const reset = React.useCallback(() => {
    if (ref.current.isMounted) {
      const result = {
        called: false,
        loading: false,
        client: ref.current.client,
      };
      Object.assign(ref.current, { mutationId: 0, result });
      setResult(result);
    }
  }, []);

  React.useEffect(() => {
    const current = ref.current;
    current.isMounted = true;

    return () => {
      current.isMounted = false;
    };
  }, []);

  return [execute, { reset, ...result }];
}
