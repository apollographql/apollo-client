import equal from "@wry/equality";

import type {
  ApolloCache,
  Cache,
  DefaultContext,
  FetchResult,
  GraphQLRequest,
  HttpLink,
  InternalRefetchQueriesInclude,
  MutationUpdaterFunction,
  OnQueryUpdated,
  OperationVariables,
} from "@apollo/client";
import { DeepMerger, hasDirectives } from "@apollo/client/utilities/internal";
import {
  isNonEmptyArray,
  mergeIncrementalData,
} from "@apollo/client/utilities/internal";

import type { OperationInfo, UpdateQueries } from "./MergeStrategy.js";
import { CacheWriteBehavior, MergeStrategy } from "./MergeStrategy.js";

export class MergeStrategy20220824 extends MergeStrategy {
  prepareRequest(request: GraphQLRequest) {
    if (hasDirectives(["defer"], request.query)) {
      const context = request.context as HttpLink.ContextOptions;
      const http = (context.http ??= {});
      http.accept = [
        "multipart/mixed;deferSpec=20220824",
        ...(http.accept || []),
      ];
    }
  }

  private lastDiff?: {
    diff: Cache.DiffResult<any>;
    options: Cache.DiffOptions;
  };

  public markQueryResult<TData, TVariables extends OperationVariables>(
    result: FetchResult<TData>,
    options: OperationInfo<TData, TVariables>
  ) {
    const diffOptions = {
      query: options.document,
      variables: options.variables,
      returnPartialData: true,
      optimistic: true,
    };

    // Cancel the pending notify timeout (if it exists) to prevent extraneous network
    // requests. To allow future notify timeouts, diff and dirty are reset as well.
    this.observableQuery?.["resetNotifications"]();

    if (options.cacheWriteBehavior === CacheWriteBehavior.FORBID) {
      const lastDiff =
        this.lastDiff && equal(diffOptions, this.lastDiff.options) ?
          this.lastDiff.diff
        : { result: null, complete: false };
      handleIncrementalResult(result, lastDiff);

      this.lastDiff = {
        diff: { result: result.data, complete: true },
        options: diffOptions,
      };
    } else {
      const lastDiff = this.cache.diff<any>(diffOptions);
      handleIncrementalResult(result, lastDiff);
    }

    super.markQueryResult(result, options);
  }

  public markMutationResult<
    TData,
    TVariables extends OperationVariables,
    TCache extends ApolloCache,
  >(
    result: FetchResult<TData>,
    mutation: OperationInfo<
      TData,
      TVariables,
      CacheWriteBehavior.FORBID | CacheWriteBehavior.MERGE
    > & {
      context?: DefaultContext;
      updateQueries: UpdateQueries<TData>;
      update?: MutationUpdaterFunction<TData, TVariables, TCache>;
      awaitRefetchQueries?: boolean;
      refetchQueries?: InternalRefetchQueriesInclude;
      removeOptimistic?: string;
      onQueryUpdated?: OnQueryUpdated<any>;
      keepRootFields?: boolean;
    },
    cache = this.cache
  ): Promise<FetchResult<TData>> {
    return super.markMutationResult(result, mutation, cache);
  }
}

function handleIncrementalResult<T>(
  result: FetchResult<T>,
  lastDiff: Cache.DiffResult<any>
) {
  if ("incremental" in result && isNonEmptyArray(result.incremental)) {
    const mergedData = mergeIncrementalData(lastDiff.result, result);
    result.data = mergedData;

    // Detect the first chunk of a deferred query and merge it with existing
    // cache data. This ensures a `cache-first` fetch policy that returns
    // partial cache data or a `cache-and-network` fetch policy that already
    // has full data in the cache does not complain when trying to merge the
    // initial deferred server data with existing cache data.
  } else if ("hasNext" in result && result.hasNext) {
    const merger = new DeepMerger();
    result.data = merger.merge(lastDiff.result, result.data);
  }
}
