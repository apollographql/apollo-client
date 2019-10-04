import { InvariantError } from 'ts-invariant';

export const checkFetcher = (fetcher: WindowOrWorkerGlobalScope['fetch']) => {
  if (!fetcher && typeof fetch === 'undefined') {
    let library: string = 'unfetch';
    if (typeof window === 'undefined') library = 'node-fetch';
    throw new InvariantError(
      '"fetch" has not been found globally and no fetcher has been ' +
      'configured. To fix this, install a fetch package ' +
      `(like https://www.npmjs.com/package/${library}), instantiate the ` +
      'fetcher, and pass it into your `HttpLink` constructor. For example:' +
      '\n\n' +
      `import fetch from '${library}';\n` +
      "import { ApolloClient, HttpLink } from '@apollo/client';\n" +
      'const client = new ApolloClient({\n' +
      "  link: new HttpLink({ uri: '/graphq', fetch })\n" +
      '});'
    );
  }
};
