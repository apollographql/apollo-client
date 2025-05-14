import type { Reference } from "@apollo/client/utilities";

/** @internal */
export function makeReference(id: string): Reference {
  return { __ref: String(id) };
}
