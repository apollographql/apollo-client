import {
  ExecutionPatchIncrementalResult,
  ExecutionPatchInitialResult,
  ExecutionPatchResult,
} from "../../link/core";
import { isNonEmptyArray } from "./arrays";
import { DeepMerger } from "./mergeDeep";

export function isExecutionPatchIncrementalResult(
  value: any
): value is ExecutionPatchIncrementalResult {
  return !!(value as ExecutionPatchIncrementalResult).incremental;
}

export function isExecutionPatchInitialResult(
  value: any
): value is ExecutionPatchInitialResult {
  return (
    !!(value as ExecutionPatchInitialResult).hasNext &&
    !!(value as ExecutionPatchInitialResult).data
  );
}

export function isExecutionPatchResult(
  value: any
): value is ExecutionPatchResult {
  return (
    isExecutionPatchIncrementalResult(value) ||
    isExecutionPatchInitialResult(value)
  );
}

export function mergeIncrementalData<TData>(
  prevResult: TData,
  result: ExecutionPatchResult<TData, Record<string, any>>
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
