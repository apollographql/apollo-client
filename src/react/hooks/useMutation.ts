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

  const ref = React.useRef({
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
    Object.assign(ref.current, { client, options, mutation });
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
      const clientOptions = mergeOptions(baseOptions, executeOptions as any);

      return client
        .mutate(clientOptions)
        .then((response) => {
          const { data, errors } = response;
          const error =
            errors && errors.length > 0
              ? new ApolloError({ graphQLErrors: errors })
              : void 0;

          const onError =
            executeOptions.onError || ref.current.options?.onError;

          if (error && onError) {
            onError(error, clientOptions);
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
            onCompleted?.(response.data!, clientOptions);
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
            onError(error, clientOptions);

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
      setResult({ called: false, loading: false, client });
    }
  }, []);

  React.useEffect(() => {
    ref.current.isMounted = true;

    return () => {
      ref.current.isMounted = false;
    };
  }, []);

  return [execute, { reset, ...result }];
}
