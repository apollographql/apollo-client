/**
 * fetchPolicy determines where the client may return a result from.
 */
export type FetchPolicy = 'cache-first' | 'cache-and-network' | 'network-only' | 'cache-only';

/**
 * return result from cache and only fetch from network if cached result is not available.
 */
export const CACHE_FIRST: FetchPolicy = 'cache-first';

/**
 * returns result from cache first (if it exists), then return network result once it's available.
 */
export const CACHE_AND_NETWORK: FetchPolicy = 'cache-and-network';

/**
 * return result from network, fail if network call doesn't succeed.
 */
export const NETWORK_ONLY: FetchPolicy = 'network-only';

/**
 * return result from cache if avaiable, fail otherwise.
 */
export const CACHE_ONLY: FetchPolicy = 'cache-only';

/**
 * default cache policy which is CACHE_FIRST.
 */
export const DEFAULT: FetchPolicy = CACHE_FIRST;

export const FETCH_POLICIES = {
  CACHE_AND_NETWORK,
  CACHE_FIRST,
  CACHE_ONLY,
  DEFAULT,
  NETWORK_ONLY,
};
