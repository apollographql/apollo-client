import type { Trie } from "@wry/trie";

import type { Incremental } from "@apollo/client/incremental";

/** @internal */
export type StreamInfoTrie = Trie<{
  current: Incremental.StreamFieldInfo;
  cache: {
    truncate?: boolean;
    streamPosition: number;
  };
  previous?: {
    incoming: unknown;
    streamFieldInfo: Incremental.StreamFieldInfo;
    result: unknown;
  };
}>;
