import { useEffect, useState } from "react";
import { equal } from "@wry/equality";

import { mergeDeepArray } from "../../utilities";
import {
  Cache,
  Reference,
  StoreObject,
  MissingTree,
} from "../../cache";

import { useApolloClient } from "./useApolloClient";

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

  const preDiff = cache.diff<TData>(diffOptions);
  const setDiff = useState(preDiff)[1];

  useEffect(() => {
    let immediate = true;
    return cache.watch({
      ...diffOptions,
      immediate,
      callback(newDiff) {
        if (!immediate || !equal(newDiff, preDiff)) {
          setDiff(newDiff);
        }
        immediate = false;
      },
    });
  }, [preDiff]);

  const result: UseFragmentResult<TData> = {
    data: preDiff.result,
    complete: !!preDiff.complete,
  };

  if (preDiff.missing) {
    result.missing = mergeDeepArray(
      preDiff.missing.map(error => error.missing)
    );
  }

  return result;
}
