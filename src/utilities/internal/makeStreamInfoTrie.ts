import { Trie } from "@wry/trie";

import { StreamArrayState } from "./StreamArrayState.js";
import type { StreamInfoTrie } from "./types/StreamInfoTrie.js";

/** @internal */
export function makeStreamInfoTrie(): StreamInfoTrie {
  return new Trie(false, (path) => ({
    state: new StreamArrayState(path),
    current: { isFirstChunk: true, isLastChunk: false },
  }));
}
