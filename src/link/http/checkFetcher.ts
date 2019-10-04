import { InvariantError } from 'ts-invariant';

export const checkFetcher = (fetcher: WindowOrWorkerGlobalScope['fetch']) => {
  if (!fetcher && typeof fetch === 'undefined') {
    let library: string = 'unfetch';
    if (typeof window === 'undefined') library = 'node-fetch';
    throw new InvariantError(`
fetch is not found globally and no fetcher passed, to fix pass a fetch for
your environment like https://www.npmjs.com/package/${library}.

For example:
import fetch from '${library}';
import { createHttpLink } from 'apollo-link-http';

const link = createHttpLink({ uri: '/graphql', fetch: fetch });`);
  }
};
