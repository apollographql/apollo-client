import { ExecutionPatchIncrementalResult } from '../../link/core';

export function isExecutionPatchIncrementalResult(value: any): value is ExecutionPatchIncrementalResult {
  return !!(value as ExecutionPatchIncrementalResult).incremental;
}
