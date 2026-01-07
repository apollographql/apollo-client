import type { streamInfoSymbol } from "../constants.js";

import type { StreamInfoTrie } from "./StreamInfoTrie.js";

/** @internal */
export interface ExtensionsWithStreamInfo extends Record<string, unknown> {
  [streamInfoSymbol]?: {
    deref(): StreamInfoTrie | undefined;
  };
}
