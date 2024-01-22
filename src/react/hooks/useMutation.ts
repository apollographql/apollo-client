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

  const { current } = React.useRef({
    result,
    mutationId: 0,
    isMounted: true,
    client,
    mutation,
    options,
  });

  // TODO: Trying to assign these in a useEffect or useLayoutEffect breaks
  // higher-order components.
  {
    Object.assign(current, { client, options, mutation });
  }

  const execute = React.useCallback(
    (
      executeOptions: MutationFunctionOptions<
        TData,
        TVariables,
        TContext,
        TCache
      > = {}
    ) => {
      const { options, mutation } = current;
      const baseOptions = { ...options, mutation };
      const client = executeOptions.client || current.client;

      if (
        !current.result.loading &&
        !baseOptions.ignoreResults &&
        current.isMounted
      ) {
        setResult(
          (current.result = {
            loading: true,
            error: void 0,
            data: void 0,
            called: true,
            client,
          })
        );
      }

      const mutationId = ++current.mutationId;
      const clientOptions = mergeOptions(baseOptions, executeOptions);

      return client
        .mutate(clientOptions as MutationOptions<TData, OperationVariables>)
        .then((response) => {
          const { data, errors } = response;
          const error =
            errors && errors.length > 0 ?
              new ApolloError({ graphQLErrors: errors })
            : void 0;

          const onError = executeOptions.onError || current.options?.onError;

          if (error && onError) {
            onError(
              error,
              clientOptions as MutationOptions<TData, OperationVariables>
            );
          }

          if (
            mutationId === current.mutationId &&
            !clientOptions.ignoreResults
          ) {
            const result = {
              called: true,
              loading: false,
              data,
              error,
              client,
            };

            if (current.isMounted && !equal(current.result, result)) {
              setResult((current.result = result));
            }
          }

          const onCompleted =
            executeOptions.onCompleted || current.options?.onCompleted;

          if (!error) {
            onCompleted?.(
              response.data!,
              clientOptions as MutationOptions<TData, OperationVariables>
            );
          }

          return response;
        })
        .catch((error) => {
          if (mutationId === current.mutationId && current.isMounted) {
            const result = {
              loading: false,
              error,
              data: void 0,
              called: true,
              client,
            };

            if (!equal(current.result, result)) {
              setResult((current.result = result));
            }
          }

          const onError = executeOptions.onError || current.options?.onError;

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
    [current]
  );

  const reset = React.useCallback(() => {
    if (current.isMounted) {
      const result = { called: false, loading: false, client };
      Object.assign(current, { mutationId: 0, result });
      setResult(result);
    }
  }, [client, current]);

  React.useEffect(() => {
    current.isMounted = true;

    return () => {
      current.isMounted = false;
    };
  }, [current]);

  return [execute, { reset, ...result }];
}
