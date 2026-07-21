import type { Trie } from "@wry/trie";

import type { Incremental } from "@apollo/client/incremental";
import type { StreamArrayState } from "../StreamArrayState.js";

/** @internal */
export type StreamInfoTrie = Trie<{
  current: Incremental.StreamFieldInfo;
  state: StreamArrayState;
  previous?: {
    incoming: unknown;
    streamFieldInfo: Incremental.StreamFieldInfo;
    result: unknown;
  };
}>;
