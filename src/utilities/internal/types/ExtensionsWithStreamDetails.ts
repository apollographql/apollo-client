import type { Trie } from "@wry/trie";

import type { Incremental } from "@apollo/client/incremental";

import type { streamDetailsSymbol } from "../constants.js";

/** @internal */
export interface ExtensionsWithStreamDetails extends Record<string, unknown> {
  [streamDetailsSymbol]?: {
    current: Trie<{ current: Incremental.StreamFieldDetails }>;
  };
}

/** @internal */
export interface WithExtensionsWithStreamDetails {
  extensions?: ExtensionsWithStreamDetails;
}
