import { DocumentNode } from 'graphql';

import { ApolloClient } from '../../../ApolloClient';
import { InMemoryCache } from '../../../cache/inmemory/inMemoryCache';
import { NormalizedCacheObject } from '../../../cache/inmemory/types';
import { mockSingleLink } from '../mocks/mockLink';

export function createClient<TData>(
  data: TData,
  query: DocumentNode,
  variables = {},
): ApolloClient<NormalizedCacheObject> {
  return new ApolloClient({
    link: mockSingleLink({
      request: { query, variables },
      result: { data },
    }),
    cache: new InMemoryCache({ addTypename: false }),
  });
}
