import type { Trie } from "@wry/trie";

/**
 * @internal
 * For use in InMemoryCache only. This should not be used in userland
 * code.
 */
export type DeferInfoTrie = Trie<true>;
