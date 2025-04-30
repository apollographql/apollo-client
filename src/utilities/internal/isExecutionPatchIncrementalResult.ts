import type {
  ExecutionPatchIncrementalResult,
  FetchResult,
} from "@apollo/client/link";

export function isExecutionPatchIncrementalResult<T>(
  value: FetchResult<T>
): value is ExecutionPatchIncrementalResult {
  return "incremental" in value;
}
