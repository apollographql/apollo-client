import { useRef } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";
import { equal } from "@wry/equality";

import { mergeDeepArray } from "../../utilities";
import {
  Cache,
  Reference,
  StoreObject,
  MissingTree,
} from "../../cache";

import { useApolloClient } from "./useApolloClient";
import { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { DocumentNode } from "graphql";

export interface UseFragmentOptions<TData, TVars>
extends Omit<
  Cache.DiffOptions<TData, TVars>,
  | "id"
  | "query"
  | "optimistic"
>, Omit<
  Cache.ReadFragmentOptions<TData, TVars>,
  | "id"
> {
  from: StoreObject | Reference | string;
  // Override this field to make it optional (default: true).
  optimistic?: boolean;
}

export interface UseFragmentOptions<TData, TVars> {
  from: string | StoreObject | Reference;
  fragment: DocumentNode | TypedDocumentNode<TData, TVars>;
  fragmentName?: string;
  optimistic?: boolean;
  variables?: TVars;
  previousResult?: any;
  returnPartialData?: boolean;
  canonizeResults?: boolean;
}

export interface UseFragmentResult<TData> {
  data: TData | undefined;
  complete: boolean;
  missing?: MissingTree;
  previousResult?: UseFragmentResult<TData>;
  lastCompleteResult?: UseFragmentResult<TData>;
}

export function useFragment<TData, TVars>(
  options: UseFragmentOptions<TData, TVars>,
): UseFragmentResult<TData> {
  const { cache } = useApolloClient();

  const {
    fragment,
    fragmentName,
    from,
    optimistic = true,
    ...rest
  } = options;

  const diffOptions: Cache.DiffOptions<TData, TVars> = {
    ...rest,
    id: typeof from === "string" ? from : cache.identify(from),
    query: cache["getFragmentDoc"](fragment, fragmentName),
    optimistic,
  };

  const resultRef = useRef<UseFragmentResult<TData>>();
  let latestDiff = cache.diff<TData>(diffOptions);

  return useSyncExternalStore(
    forceUpdate => {
      let immediate = true;
      return cache.watch({
        ...diffOptions,
        immediate,
        callback(diff) {
          if (!immediate && !equal(diff, latestDiff)) {
            resultRef.current = diffToResult(latestDiff = diff, resultRef.current)
            forceUpdate();
          }
          immediate = false;
        },
      });
    },

    () => {
      return resultRef.current || (
        resultRef.current = diffToResult(latestDiff, resultRef.current)
      );
    },
  );
}

function diffToResult<TData>(
  diff: Cache.DiffResult<TData>,
  previousResult?: UseFragmentResult<TData>,
): UseFragmentResult<TData> {
  const result: UseFragmentResult<TData> = {
    data: diff.result,
    complete: !!diff.complete,
  };

  if (diff.missing) {
    result.missing = mergeDeepArray(
      diff.missing.map(error => error.missing),
    );
  }

  if (previousResult) {
    result.previousResult = previousResult;
  }

  const lastCompleteResult = result.complete ? result : (
    previousResult && (
      previousResult.complete
        ? previousResult
        : previousResult.lastCompleteResult
    )
  );

  if (lastCompleteResult) {
    result.lastCompleteResult = lastCompleteResult;
  }

  return result;
}
