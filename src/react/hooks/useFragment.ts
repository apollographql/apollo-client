import { useRef } from "react";
import { equal } from "@wry/equality";

import { DeepPartial, mergeDeepArray } from "../../utilities";
import {
  Cache,
  Reference,
  StoreObject,
  MissingTree,
} from "../../cache";

import { useApolloClient } from "./useApolloClient";
import { useSyncExternalStore } from "./useSyncExternalStore";
import { OperationVariables } from "../../core";
import { NoInfer } from "../types/types";

export interface UseFragmentOptions<TData, TVars>
extends Omit<
  Cache.DiffOptions<NoInfer<TData>, NoInfer<TVars>>,
  | "id"
  | "query"
  | "optimistic"
  | "previousResult"
  | "returnPartialData"
>, Omit<Cache.ReadFragmentOptions<TData, TVars>,
  | "id"
  | "variables"
  | "returnPartialData"
> {
  from: StoreObject | Reference | string;
  // Override this field to make it optional (default: true).
  optimistic?: boolean;
}

export type UseFragmentResult<TData> =
  | {
      data: TData;
      complete: true;
      missing?: never;
    }
  | {
      data: DeepPartial<TData>;
      complete: false;
      missing?: MissingTree;
    };

export function useFragment_experimental<
  TData = any,
  TVars = OperationVariables
>(
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
    returnPartialData: true,
    id: typeof from === "string" ? from : cache.identify(from),
    query: cache["getFragmentDoc"](fragment, fragmentName),
    optimistic
  };

  const resultRef = useRef<UseFragmentResult<TData>>();
  let latestDiff = cache.diff<TData>(diffOptions);

  // Used for both getSnapshot and getServerSnapshot
  const getSnapshot = () => {
    const latestDiffToResult = diffToResult(latestDiff);
    return resultRef.current &&
      equal(resultRef.current.data, latestDiffToResult.data)
      ? resultRef.current
      : (resultRef.current = latestDiffToResult);
  };

  return useSyncExternalStore(
    (forceUpdate) => {
      return cache.watch({
        ...diffOptions,
        immediate: true,
        callback(diff) {
          if (!equal(diff, latestDiff)) {
            resultRef.current = diffToResult((latestDiff = diff));
            forceUpdate();
          }
        },
      });
    },
    getSnapshot,
    getSnapshot
  );
}

function diffToResult<TData>(
  diff: Cache.DiffResult<TData>,
): UseFragmentResult<TData> {
  const result = {
    data: diff.result!,
    complete: !!diff.complete,
  } as UseFragmentResult<TData>;

  if (diff.missing) {
    result.missing = mergeDeepArray(
      diff.missing.map(error => error.missing),
    );
  }

  return result;
}
