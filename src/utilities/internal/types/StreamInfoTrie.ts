import type { Trie } from "@wry/trie";

import type { Incremental } from "@apollo/client/incremental";

/** @internal */
export type StreamInfoTrie = Trie<{
  current: Incremental.StreamFieldInfo;
  previous?: {
    incoming: unknown;
    streamFieldInfo: Incremental.StreamFieldInfo;
    result: unknown;
  };
}>;
