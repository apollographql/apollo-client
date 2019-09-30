import ApolloClient from '../..';
import { InMemoryCache } from 'apollo-cache-inmemory';
import gql from 'graphql-tag';

/**
 * Creates an apollo-client instance with a local query resolver named 'localQuery'.
 * @param localQueryResolver resolver function to run for "localQuery" query.
 */
const setupClientWithLocalQueryResolver = localQueryResolver => {
  const cache = new InMemoryCache();

  const resolvers = {
    Query: { localQuery: localQueryResolver },
  };

  const client = new ApolloClient({
    cache,
    resolvers,
  });

  return client;
};

describe('LocalState', () => {
  test('resolver info field provides information about named fragments', async () => {
    // Create client with local resolver
    const localQueryResolver = jest.fn().mockReturnValue({
      __typename: 'LocalQueryResponse',
      namedFragmentField: 'namedFragmentFieldValue',
    });
    const client = setupClientWithLocalQueryResolver(localQueryResolver);

    // Query local resolver using named fragment
    const query = gql`
      fragment NamedFragment on LocalQueryResponse {
        namedFragmentField
      }
      query {
        localQuery @client {
          ...NamedFragment
        }
      }
    `;
    await client.query({ query });

    // Verify "fragmentMap" passed through via resolver's "info" parameter
    const localResolverInfoParam = localQueryResolver.mock.calls[0][3];
    expect(localResolverInfoParam.fragmentMap).toBeDefined();

    // Verify local resolver can see "namedFragmentField" selected from named fragment
    expect(
      localResolverInfoParam.fragmentMap.NamedFragment.selectionSet.selections,
    ).toContainEqual(
      expect.objectContaining({
        name: {
          kind: 'Name',
          value: 'namedFragmentField',
        },
      }),
    );
  });
});
