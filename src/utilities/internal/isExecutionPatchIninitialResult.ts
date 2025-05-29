import type {
  ExecutionPatchInitialResult,
  FetchResult,
} from "@apollo/client/link";

/** @internal */
export function isExecutionPatchInitialResult<T>(
  value: FetchResult<T>
): value is ExecutionPatchInitialResult<T> {
  return "hasNext" in value && "data" in value;
}
