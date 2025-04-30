import type {
  ApolloPayloadResult,
  ExecutionPatchResult,
} from "@apollo/client/link";
import {
  DeepMerger,
  isExecutionPatchIncrementalResult,
  isNonEmptyArray,
  isNonNullObject,
} from "@apollo/client/utilities/internal";

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
