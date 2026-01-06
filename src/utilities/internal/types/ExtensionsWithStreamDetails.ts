import type { Trie } from "@wry/trie";

import type { Incremental } from "@apollo/client/incremental";

import type { streamInfoSymbol } from "../constants.js";

/** @internal */
export interface ExtensionsWithStreamInfo extends Record<string, unknown> {
  [streamInfoSymbol]?: {
    current: Trie<{
      current: Incremental.StreamFieldInfo;
      previous?: {
        incoming: unknown;
        streamFieldInfo: Incremental.StreamFieldInfo;
        result: unknown;
      };
    }>;
  };
}

/** @internal */
export interface WithExtensionsWithStreamInfo {
  extensions?: ExtensionsWithStreamInfo;
}
