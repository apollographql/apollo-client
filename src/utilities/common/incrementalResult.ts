import {
  ExecutionPatchIncrementalResult,
  ExecutionPatchInitialResult,
  ExecutionPatchResult,
} from "../../link/core";

export function isExecutionPatchIncrementalResult(
  value: any
): value is ExecutionPatchIncrementalResult {
  return (
    !!(value as ExecutionPatchIncrementalResult).incremental
  );
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
