import {
  ExecutionPatchIncrementalResult,
  ExecutionPatchInitialResult,
  ExecutionPatchResult,
  FetchResult,
} from "../../link/core";
import { isNonEmptyArray } from "./arrays";
import { DeepMerger } from "./mergeDeep";

export function isExecutionPatchIncrementalResult(
  value: FetchResult
): value is ExecutionPatchIncrementalResult {
  return "incremental" in value;
}

export function isExecutionPatchInitialResult(
  value: FetchResult
): value is ExecutionPatchInitialResult {
  return "hasNext" in value && "data" in value;
}

export function isExecutionPatchResult(
  value: FetchResult
): value is ExecutionPatchResult {
  return (
    isExecutionPatchIncrementalResult(value) ||
    isExecutionPatchInitialResult(value)
  );
}

export function mergeIncrementalData<TData>(
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
