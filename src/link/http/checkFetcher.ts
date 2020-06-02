import { InvariantError } from 'ts-invariant';

export const checkFetcher = (fetcher: WindowOrWorkerGlobalScope['fetch'] | undefined) => {
  if (!fetcher && typeof fetch === 'undefined') {
    throw new InvariantError(`
"fetch" has not been found globally and no fetcher has been \
configured. To fix this, install a fetch package (like \
https://www.npmjs.com/package/cross-fetch), instantiate the \
fetcher, and pass it into your HttpLink constructor. For example:

import fetch from 'cross-fetch';
import { ApolloClient, HttpLink } from '@apollo/client';
const client = new ApolloClient({
  link: new HttpLink({ uri: '/graphql', fetch })
});
    `);
  }
};
