import { useContext, useEffect, useRef, useState } from 'react';
import { DocumentNode } from 'graphql';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { invariant } from 'ts-invariant';

import {
  MutationDataOptions,
  MutationFunctionOptions,
  MutationHookOptions,
  MutationResult,
  MutationTuple
} from '../types/types';

import {
  ApolloCache,
  ApolloClient,
  DefaultContext,
  mergeOptions,
  OperationVariables,
} from '../../core';
import { getApolloContext } from '../context';
import { equal } from '@wry/equality';
import { DocumentType, verifyDocumentType } from '../parser';
import { ApolloError } from '../../errors';
import { FetchResult } from '../../link/core';

type MutationResultWithoutClient<TData = any> = Omit<MutationResult<TData>, 'client'>;

class MutationData<
  TData = any,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache<any> = ApolloCache<any>,
> {
  private mostRecentMutationId: number;
  private result: MutationResultWithoutClient<TData>;
  private previousResult?: MutationResultWithoutClient<TData>;
  private setResult: (result: MutationResultWithoutClient<TData>) => any;
  private isMounted: boolean;
  public client: ApolloClient<unknown>;
  public options: MutationDataOptions<TData, TVariables, TContext, TCache>;
  constructor({
    options,
    client,
    result,
    setResult
  }: {
    client: ApolloClient<unknown>,
    options: MutationDataOptions<TData, TVariables, TContext, TCache>;
    result: MutationResultWithoutClient<TData>;
    setResult: (result: MutationResultWithoutClient<TData>) => any;
  }) {
    this.result = result;
    this.setResult = setResult;
    this.mostRecentMutationId = 0;
    this.isMounted = false;
    this.client = client;
    this.options = options;
  }

  public execute(result: MutationResultWithoutClient<TData>): MutationTuple<TData, TVariables, TContext, TCache> {
    this.isMounted = true;
    return [
      this.runMutation,
      { ...result, client: this.client }
    ] as MutationTuple<TData, TVariables, TContext, TCache>;
  }

  public afterExecute() {
    this.isMounted = true;
    return () => {
      this.isMounted = false;
    };
  }

  private runMutation = (
    mutationFunctionOptions: MutationFunctionOptions<
      TData,
      TVariables,
      TContext,
      TCache
    > = {},
  ) => {
    if (!this.result.loading && !this.options.ignoreResults) {
      this.updateResult({
        loading: true,
        error: undefined,
        data: undefined,
        called: true
      });
    }

    const mutationId = ++this.mostRecentMutationId;
    const options = mergeOptions(
      this.options,
      mutationFunctionOptions as any,
    );

    return this.client.mutate(options)
      .then((response: FetchResult<TData>) => {
        const { onCompleted, ignoreResults } = this.options;
        const { data, errors } = response;
        const error =
          errors && errors.length > 0
            ? new ApolloError({ graphQLErrors: errors })
            : undefined;

        if (this.mostRecentMutationId === mutationId && !ignoreResults) {
          this.updateResult({
            called: true,
            loading: false,
            data,
            error
          });
        }

        if (onCompleted) {
          onCompleted(data!);
        }

        return response;
      })
      .catch((error: ApolloError) => {
        if (this.mostRecentMutationId === mutationId) {
          this.updateResult({
            loading: false,
            error,
            data: undefined,
            called: true
          });
        }

        const { onError } = this.options;
        if (onError) {
          onError(error);
          return {
            data: undefined,
            errors: error,
          };
        }

        throw error;
      });
  };

  private updateResult(result: MutationResultWithoutClient<TData>): MutationResultWithoutClient<TData> | undefined {
    if (
      this.isMounted &&
      (!this.previousResult || !equal(this.previousResult, result))
    ) {
      this.setResult(result);
      this.previousResult = result;
      return result;
    }
  }
}

export function useMutation<
  TData = any,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache<any> = ApolloCache<any>,
>(
  mutation: DocumentNode | TypedDocumentNode<TData, TVariables>,
  hookOptions?: MutationHookOptions<TData, TVariables, TContext>
): MutationTuple<TData, TVariables, TContext, TCache> {
  const context = useContext(getApolloContext());
  const client = hookOptions?.client || context.client;
  invariant(
    !!client,
    'Could not find "client" in the context or passed in as an option. ' +
    'Wrap the root component in an <ApolloProvider>, or pass an ApolloClient' +
    'ApolloClient instance in via options.',
  );
  verifyDocumentType(mutation, DocumentType.Mutation);

  const [result, setResult] = useState({ called: false, loading: false });
  const options = { ...hookOptions, mutation };

  const mutationDataRef = useRef<MutationData<TData, TVariables, TContext>>();
  function getMutationDataRef() {
    if (!mutationDataRef.current) {
      mutationDataRef.current = new MutationData<TData, TVariables, TContext>({
        client: client!,
        options,
        result,
        setResult
      });
    }

    return mutationDataRef.current;
  }

  const mutationData = getMutationDataRef();
  mutationData.options = options;
  mutationData.client = client;
  useEffect(() => mutationData.afterExecute());

  return mutationData.execute(result);
}
