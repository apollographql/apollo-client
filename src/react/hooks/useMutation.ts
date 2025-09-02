import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { equal } from "@wry/equality";
import * as React from "react";

import type {
  ApolloCache,
  ApolloClient,
  DefaultContext,
  DocumentNode,
  ErrorLike,
  ErrorPolicy,
  InternalRefetchQueriesInclude,
  MaybeMasked,
  MutationFetchPolicy,
  MutationQueryReducersMap,
  MutationUpdaterFunction,
  NormalizedExecutionResult,
  OnQueryUpdated,
  OperationVariables,
  Unmasked,
} from "@apollo/client";
import type { IgnoreModifier } from "@apollo/client/cache";
import type { NoInfer, Prettify } from "@apollo/client/utilities/internal";
import {
  mergeOptions,
  preventUnhandledRejection,
} from "@apollo/client/utilities/internal";

import { useIsomorphicLayoutEffect } from "./internal/useIsomorphicLayoutEffect.js";
import { useApolloClient } from "./useApolloClient.js";

type MakeRequiredVariablesOptional<
  TVariables extends OperationVariables,
  TConfiguredVariables extends Partial<TVariables>,
> = Prettify<
  {
    [K in keyof TVariables as K extends keyof TConfiguredVariables ? K
    : never]?: TVariables[K];
  } & Omit<TVariables, keyof TConfiguredVariables>
>;

export declare namespace useMutation {
  export interface Options<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
    TCache extends ApolloCache = ApolloCache,
    TConfiguredVariables extends Partial<TVariables> = Partial<TVariables>,
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
          result: NormalizedExecutionResult<Unmasked<TData>>
        ) => InternalRefetchQueriesInclude)
      | InternalRefetchQueriesInclude;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#awaitRefetchQueries:member} */
    awaitRefetchQueries?: boolean;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#update:member} */
    update?: MutationUpdaterFunction<TData, TVariables, TCache>;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#onQueryUpdated:member} */
    onQueryUpdated?: OnQueryUpdated<any>;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#errorPolicy:member} */
    errorPolicy?: ErrorPolicy;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#variables:member} */
    variables?: Partial<TVariables> & TConfiguredVariables;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#context:member} */
    context?: DefaultContext;

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
      clientOptions?: Options<TData, TVariables, TCache>
    ) => void;

    /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#onError:member} */
    onError?: (
      error: ErrorLike,
      clientOptions?: Options<TData, TVariables, TCache>
    ) => void;
  }

  export interface Result<TData = unknown> {
    /** {@inheritDoc @apollo/client!MutationResultDocumentation#data:member} */
    data: MaybeMasked<TData> | null | undefined;

    /** {@inheritDoc @apollo/client!MutationResultDocumentation#error:member} */
    error: ErrorLike | undefined;

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
    TVariables extends OperationVariables,
    TCache extends ApolloCache = ApolloCache,
  > = [
    mutate: MutationFunction<TData, TVariables, TCache>,
    result: Result<TData>,
  ];

  export type MutationFunction<
    TData,
    TVariables extends OperationVariables,
    TCache extends ApolloCache = ApolloCache,
  > = (
    ...[options]: {} extends TVariables ?
      [
        options?: MutationFunctionOptions<TData, TVariables, TCache> & {
          /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#variables:member} */
          variables?: TVariables;
        },
      ]
    : [
        options: MutationFunctionOptions<TData, TVariables, TCache> & {
          /** {@inheritDoc @apollo/client!MutationOptionsDocumentation#variables:member} */
          variables: TVariables;
        },
      ]
  ) => Promise<ApolloClient.MutateResult<MaybeMasked<TData>>>;

  export type MutationFunctionOptions<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
    TCache extends ApolloCache = ApolloCache,
  > = Options<TData, TVariables, TCache>;

  export namespace DocumentationTypes {
    /** {@inheritDoc @apollo/client/react!useMutation:function(1)} */
    export function useMutation<
      TData = unknown,
      TVariables extends OperationVariables = OperationVariables,
    >(
      mutation: DocumentNode | TypedDocumentNode<TData, TVariables>,
      options?: useMutation.Options<TData, TVariables>
    ): useMutation.ResultTuple<TData, TVariables>;
  }
}

/**
 * > Refer to the [Mutations](https://www.apollographql.com/docs/react/data/mutations/) section for a more in-depth overview of `useMutation`.
 *
 * @example
 *
 * ```jsx
 * import { gql, useMutation } from "@apollo/client";
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
 *         onSubmit={(e) => {
 *           e.preventDefault();
 *           addTodo({ variables: { type: input.value } });
 *           input.value = "";
 *         }}
 *       >
 *         <input
 *           ref={(node) => {
 *             input = node;
 *           }}
 *         />
 *         <button type="submit">Add Todo</button>
 *       </form>
 *     </div>
 *   );
 * }
 * ```
 *
 * @param mutation - A GraphQL mutation document parsed into an AST by `gql`.
 * @param options - Options to control how the mutation is executed.
 * @returns A tuple in the form of `[mutate, result]`
 */
export function useMutation<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
  TCache extends ApolloCache = ApolloCache,
  TConfiguredVariables extends Partial<TVariables> = {},
>(
  mutation: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: useMutation.Options<
    NoInfer<TData>,
    NoInfer<TVariables>,
    TCache,
    {
      [K in keyof TConfiguredVariables]: K extends keyof TVariables ?
        TConfiguredVariables[K]
      : never;
    }
  >
): useMutation.ResultTuple<
  TData,
  MakeRequiredVariablesOptional<TVariables, TConfiguredVariables>,
  TCache
> {
  const client = useApolloClient(options?.client);
  const [result, setResult] = React.useState<
    Omit<useMutation.Result<TData>, "reset">
  >(() => createInitialResult(client));

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
        TCache
      > = {} as useMutation.MutationFunctionOptions<TData, TVariables, TCache>
    ) => {
      const { options, mutation } = ref.current;
      const baseOptions = { ...options, mutation };
      const client = executeOptions.client || ref.current.client;

      if (!ref.current.result.loading && ref.current.isMounted) {
        setResult(
          (ref.current.result = {
            loading: true,
            error: undefined,
            data: undefined,
            called: true,
            client,
          })
        );
      }

      const mutationId = ++ref.current.mutationId;
      const clientOptions = mergeOptions(baseOptions, executeOptions as any);

      return preventUnhandledRejection(
        client
          .mutate(
            clientOptions as ApolloClient.MutateOptions<
              TData,
              OperationVariables
            >
          )
          .then(
            (response) => {
              const { data, error } = response;

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

                if (
                  ref.current.isMounted &&
                  !equal(ref.current.result, result)
                ) {
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
              }

              throw error;
            }
          )
      );
    },
    []
  );

  const reset = React.useCallback(() => {
    if (ref.current.isMounted) {
      const result = createInitialResult(ref.current.client);
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

  return [execute as any, { reset, ...result }];
}

function createInitialResult(client: ApolloClient) {
  return {
    data: undefined,
    error: undefined,
    called: false,
    loading: false,
    client,
  };
}
