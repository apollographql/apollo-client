import {
  ExecutionPatchIncrementalResult,
  ExecutionPatchInitialResult,
  ExecutionPatchResult,
  ApolloPayloadResult,
  FetchResult,
} from "../../link/core";
import { isNonNullObject } from "./objects";
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

const get = (obj: Record<string, any>, path: (string | number)[]) => {
  // Check if path is string or array. Regex : ensure that we do not have '.' and brackets.
  // Regex explained: https://regexr.com/58j0k
  // const pathArray = Array.isArray(path) ? path : path.match(/([^[.\]])+/g)
  // Find value
  const result = path?.reduce((prevObj, key) => prevObj && prevObj[key], obj);
  // If found value is undefined return default value; otherwise return the value
  return result || undefined;
};

// This function detects an Apollo payload result before it is transformed
// into a FetchResult via HttpLink; it cannot detect an ApolloPayloadResult
// once it leaves the link chain.
export function isApolloPayloadResult(
  value: unknown
): value is ApolloPayloadResult {
  return isNonNullObject(value) && "payload" in value;
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
    result.incremental.forEach(({ data, items, path }) => {
      for (let i = path.length - 1; i >= 0; --i) {
        const key = path[i];
        const isNumericKey = !isNaN(+key);
        let parent: Record<string | number, any> = isNumericKey ? [] : {};
        const arrCopy = [...path];
        if (items && typeof key === "number" && i === path.length - 1) {
          // merge array at path
          const arrToMerge = get(prevResult, arrCopy.slice(0, -1)) || [];
          const newArr = [
            ...arrToMerge.slice(0, key),
            ...items,
            ...arrToMerge.slice(key, arrToMerge.length),
          ];
          parent = newArr;
        }
        if (data) {
          parent[key] = data;
        }
        data = parent as typeof data;
      }
      mergedData = merger.merge(mergedData, data);
    });
  }
  return mergedData as TData;
}
