import { useRef } from "react";
import { equal } from "@wry/equality";

import type { DeepPartial} from "../../utilities";
import { mergeDeepArray } from "../../utilities";
import type {
  Cache,
  Reference,
  StoreObject,
  MissingTree,
} from "../../cache";

import { useApolloClient } from "./useApolloClient";
import { useSyncExternalStore } from "./useSyncExternalStore";
import type { OperationVariables } from "../../core";
import type { NoInfer } from "../types/types";

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

  /**
   * Whether to return incomplete data rather than null.
   * Defaults to `true`.
   * @deprecated This option will be removed in Apollo Client 3.8.
   * Please check `result.missing` instead.
   */
  returnPartialData?: boolean;
}

// Since the above definition of UseFragmentOptions can be hard to parse without
// help from TypeScript/VSCode, here are the intended fields and their types.
// Uncomment this code to check that it's consistent with the definition above.
//
// export interface UseFragmentOptions<TData, TVars> {
//   from: string | StoreObject | Reference;
//   fragment: DocumentNode | TypedDocumentNode<TData, TVars>;
//   fragmentName?: string;
//   optimistic?: boolean;
//   variables?: TVars;
//   returnPartialData?: boolean;
//   canonizeResults?: boolean;
// }

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
    id: typeof from === "string" ? from : cache.identify(from),
    query: cache["getFragmentDoc"](fragment, fragmentName),
    optimistic,
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
