export * from 'apollo-client';
export * from 'apollo-link';
import { HttpLink } from 'apollo-link-http';
export * from 'apollo-cache-inmemory';
import { InMemoryCache, NormalizedCache } from 'apollo-cache-inmemory';

import gql from 'graphql-tag';
import ApolloClient from 'apollo-client';

export { gql, InMemoryCache, HttpLink };

export default class DefaultClient<
  TCache = NormalizedCache
> extends ApolloClient<TCache> {
  constructor(config: any = {}) {
    if (!config.cache) config.cache = new InMemoryCache();
    if (!config.link) config.link = new HttpLink({ uri: '/graphql' });
    super(config);
  }
}
