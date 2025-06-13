import type { ExecutionPatchResult } from "@apollo/client/link";

import { DeepMerger } from "./DeepMerger.js";
import { isExecutionPatchIncrementalResult } from "./isExecutionPatchIncrementalResult.js";
import { isNonEmptyArray } from "./isNonEmptyArray.js";

/** @internal */
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
