import type { ExecutionPatchResult, FetchResult } from "@apollo/client/link";

import { isExecutionPatchIncrementalResult } from "./isExecutionPatchIncrementalResult.js";
import { isExecutionPatchInitialResult } from "./isExecutionPatchIninitialResult.js";

/** @internal */
export function isExecutionPatchResult<T>(
  value: FetchResult<T>
): value is ExecutionPatchResult<T> {
  return (
    isExecutionPatchIncrementalResult(value) ||
    isExecutionPatchInitialResult(value)
  );
}
