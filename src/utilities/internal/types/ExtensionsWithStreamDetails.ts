import type { streamInfoSymbol } from "../constants.js";

import type { StreamInfoTrie } from "./StreamInfoTrie.js";

/**
 * For use in Cache implementations only.
 * This should not be used in userland code.
 */
export interface ExtensionsWithStreamInfo extends Record<string, unknown> {
  [streamInfoSymbol]?: {
    deref(): StreamInfoTrie | undefined;
  };
}
