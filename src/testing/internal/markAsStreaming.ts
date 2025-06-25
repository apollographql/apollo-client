import type { TData } from "@apollo/client";

export function markAsStreaming<TData>(data: TData) {
  return data as TData.Streaming<TData>;
}
