import type { Trie } from "@wry/trie";

import type { Incremental } from "@apollo/client/incremental";

import type { streamDetailsSymbol } from "../constants.js";

/** @internal */
export interface ExtensionsWithStreamDetails extends Record<string, unknown> {
  [streamDetailsSymbol]?: { current: Trie<Incremental.StreamFieldDetails> };
}
