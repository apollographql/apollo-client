import type { Incremental } from "@apollo/client/incremental";

import type { streamInfoSymbol } from "../constants.js";

import type { StreamInfoTrie } from "./StreamInfoTrie.js";

/**
 * Information about an in-flight incremental delivery request, provided by the
 * incremental handler to the cache alongside every result it produces.
 *
 * @internal
 */
export interface IncrementalInfo {
  streamInfo?: StreamInfoTrie;
  /**
   * Whether data for the `@defer` boundary applied to the object at `path`
   * (and carrying `label`, if any) might still arrive.
   */
  isDeferPending(path: Incremental.Path, label: string | undefined): boolean;
}

/**
 * For use in Cache implementations only.
 * This should not be used in userland code.
 */
export interface ExtensionsWithStreamInfo extends Record<string, unknown> {
  [streamInfoSymbol]?: {
    deref(): IncrementalInfo | undefined;
  };
}
