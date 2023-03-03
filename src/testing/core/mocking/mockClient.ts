import { DocumentNode } from 'graphql';

import { ApolloClient } from '../../../core/index.js';
import { InMemoryCache, NormalizedCacheObject } from '../../../cache/index.js';
import { mockSingleLink } from './mockLink.js';

export function createMockClient<TData>(
  data: TData,
  query: DocumentNode,
  variables = {},
): ApolloClient<NormalizedCacheObject> {
  return new ApolloClient({
    link: mockSingleLink({
      request: { query, variables },
      result: { data },
    }).setOnError(error => { throw error }),
    cache: new InMemoryCache({ addTypename: false }),
  });
}
