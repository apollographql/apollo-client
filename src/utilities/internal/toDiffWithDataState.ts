import type { Cache } from "@apollo/client/cache";

/** @internal */
export function toDiffWithDataState<TData>(
  diff: Cache.DiffResult<TData> | Cache.InternalDiffResultWithDataState<TData>
): Cache.InternalDiffResultWithDataState<TData> {
  if ("dataState" in diff) {
    return diff;
  }

  return {
    ...diff,
    dataState:
      diff.complete ? "complete"
      : diff.result === null ? "empty"
      : "partial",
  } as Cache.InternalDiffResultWithDataState<TData>;
}
