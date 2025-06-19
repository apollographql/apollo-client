import type { Streaming } from "@apollo/client";

export function markAsStreaming<TData>(data: TData) {
  return data as Streaming<TData>;
}
