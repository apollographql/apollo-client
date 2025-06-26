import type { DataValue } from "@apollo/client";

export function markAsStreaming<TData>(data: TData) {
  return data as DataValue.Streaming<TData>;
}
