import {
  ExecutionPatchIncrementalResult,
  ExecutionPatchInitialResult,
  ExecutionPatchResult,
  FetchResult,
} from "../../link/core";
import { isNonEmptyArray } from "./arrays";
import { DeepMerger } from "./mergeDeep";

export function isExecutionPatchIncrementalResult<T>(
  value: FetchResult<T>
): value is ExecutionPatchIncrementalResult {
  return "incremental" in value;
}

export function isExecutionPatchInitialResult<T>(
  value: FetchResult<T>
): value is ExecutionPatchInitialResult<T> {
  return "hasNext" in value && "data" in value;
}

export function isExecutionPatchResult<T>(
  value: FetchResult<T>
): value is ExecutionPatchResult<T> {
  return (
    isExecutionPatchIncrementalResult(value) ||
    isExecutionPatchInitialResult(value)
  );
}

export function mergeIncrementalData<TData extends object>(
  prevResult: TData,
  result: ExecutionPatchResult<TData>
) {
  let mergedData = prevResult;
  const merger = new DeepMerger();
  if (
    isExecutionPatchIncrementalResult(result) &&
    isNonEmptyArray(result.incremental)
  ) {
    result.incremental.forEach(({ data, path }) => {
      for (let i = path.length - 1; i >= 0; --i) {
        const key = path[i];
        const isNumericKey = !isNaN(+key);
        const parent: Record<string | number, any> = isNumericKey ? [] : {};
        parent[key] = data;
        data = parent as typeof data;
      }
      mergedData = merger.merge(mergedData, data);
    });
  }
  return mergedData as TData;
}
