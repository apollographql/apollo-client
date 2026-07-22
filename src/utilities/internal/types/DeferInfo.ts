import type { Trie } from "@wry/trie";

/**
 * @internal
 * For use in cache implementations only. This should not be used in userland
 * code.
 */
export type DeferInfo = Trie<true>;
