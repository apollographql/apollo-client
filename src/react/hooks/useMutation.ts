import * as React from "rehackt";
import type { DocumentNode } from "graphql";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import type {
  MutationFunctionOptions,
  MutationHookOptions,
  MutationResult,
  MutationTuple,
  NoInfer,
} from "../types/types.js";

import type {
  ApolloCache,
  DefaultContext,
  MutationOptions,
  OperationVariables,
} from "../../core/index.js";
import { mergeOptions } from "../../utilities/index.js";
import { equal } from "@wry/equality";
import { DocumentType, verifyDocumentType } from "../parser/index.js";
import { ApolloError } from "../../errors/index.js";
import { useApolloClient } from "./useApolloClient.js";
import { useIsomorphicLayoutEffect } from "./internal/useIsomorphicLayoutEffect.js";

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
  TData = any,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache<any> = ApolloCache<any>,
>(
  mutation: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: MutationHookOptions<
    NoInfer<TData>,
    NoInfer<TVariables>,
    TContext,
    TCache
  >
): MutationTuple<TData, TVariables, TContext, TCache> {
  const client = useApolloClient(options?.client);
  verifyDocumentType(mutation, DocumentType.Mutation);
  const [result, setResult] = React.useState<Omit<MutationResult, "reset">>({
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
      executeOptions: MutationFunctionOptions<
        TData,
        TVariables,
        TContext,
        TCache
      > = {}
    ) => {
      const { options, mutation } = ref.current;
      const baseOptions = { ...options, mutation };
      const client = executeOptions.client || ref.current.client;

      if (
        !ref.current.result.loading &&
        !baseOptions.ignoreResults &&
        ref.current.isMounted
      ) {
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
        .then((response) => {
          const { data, errors } = response;
          const error =
            errors && errors.length > 0 ?
              new ApolloError({ graphQLErrors: errors })
            : void 0;

          const onError =
            executeOptions.onError || ref.current.options?.onError;

          if (error && onError) {
            onError(
              error,
              clientOptions as MutationOptions<TData, OperationVariables>
            );
          }

          if (
            mutationId === ref.current.mutationId &&
            !clientOptions.ignoreResults
          ) {
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
            onCompleted?.(
              response.data!,
              clientOptions as MutationOptions<TData, OperationVariables>
            );
          }

          return response;
        })
        .catch((error) => {
          if (mutationId === ref.current.mutationId && ref.current.isMounted) {
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
            onError(
              error,
              clientOptions as MutationOptions<TData, OperationVariables>
            );

            // TODO(brian): why are we returning this here???
            return { data: void 0, errors: error };
          }

          throw error;
        });
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
