import gql from 'graphql-tag';

import { ApolloLink } from '../../link/core/ApolloLink';
import { InMemoryCache } from '../../cache/inmemory/inMemoryCache';
import { stripSymbols } from '../../utilities/testing/stripSymbols';
import { itAsync } from '../../utilities/testing/itAsync';
import { ApolloClient } from '../..';
import subscribeAndCount from '../../utilities/testing/subscribeAndCount';
import { mockSingleLink } from '../../utilities/testing/mocking/mockLink';
import { NetworkStatus } from '../networkStatus';

const query = gql`
  query {
    author {
      __typename
      id
      firstName
      lastName
    }
  }
`;

const result = {
  author: {
    __typename: 'Author',
    id: 1,
    firstName: 'John',
    lastName: 'Smith',
  },
};

const mutation = gql`
  mutation updateName($id: ID!, $firstName: String!) {
    updateName(id: $id, firstName: $firstName) {
      __typename
      id
      firstName
    }
  }
`;

const variables = {
  id: 1,
  firstName: 'James',
};

const mutationResult = {
  updateName: {
    id: 1,
    __typename: 'Author',
    firstName: 'James',
  },
};

const merged = { author: { ...result.author, firstName: 'James' } };

const createLink = (reject: (reason: any) => any) =>
  mockSingleLink({
    request: { query },
    result: { data: result },
  }, {
    request: { query },
    result: { data: result },
  }).setOnError(reject);

const createFailureLink = (reject: (reason: any) => any) =>
  mockSingleLink({
    request: { query },
    error: new Error('query failed'),
  }, {
    request: { query },
    result: { data: result },
  }).setOnError(reject);

const createMutationLink = (reject: (reason: any) => any) =>
  // fetch the data
  mockSingleLink({
    request: { query },
    result: { data: result },
  }, // update the data
  {
    request: { query: mutation, variables },
    result: { data: mutationResult },
  }, // get the new results
  {
    request: { query },
    result: { data: merged },
  }).setOnError(reject);

describe('network-only', () => {
  itAsync('requests from the network even if already in cache', (resolve, reject) => {
    let called = 0;
    const inspector = new ApolloLink((operation, forward) => {
      called++;
      return forward(operation).map(result => {
        called++;
        return result;
      });
    });

    const client = new ApolloClient({
      link: inspector.concat(createLink(reject)),
      cache: new InMemoryCache({ addTypename: false }),
    });

    return client.query({ query }).then(
      () => client
        .query({ fetchPolicy: 'network-only', query })
        .then(actualResult => {
          expect(stripSymbols(actualResult.data)).toEqual(result);
          expect(called).toBe(4);
        }),
    ).then(resolve, reject);
  });

  itAsync('saves data to the cache on success', (resolve, reject) => {
    let called = 0;
    const inspector = new ApolloLink((operation, forward) => {
      called++;
      return forward(operation).map(result => {
        called++;
        return result;
      });
    });

    const client = new ApolloClient({
      link: inspector.concat(createLink(reject)),
      cache: new InMemoryCache({ addTypename: false }),
    });

    return client.query({ query, fetchPolicy: 'network-only' }).then(
      () => client.query({ query }).then(actualResult => {
        expect(stripSymbols(actualResult.data)).toEqual(result);
        expect(called).toBe(2);
      }),
    ).then(resolve, reject);
  });

  itAsync('does not save data to the cache on failure', (resolve, reject) => {
    let called = 0;
    const inspector = new ApolloLink((operation, forward) => {
      called++;
      return forward(operation).map(result => {
        called++;
        return result;
      });
    });

    const client = new ApolloClient({
      link: inspector.concat(createFailureLink(reject)),
      cache: new InMemoryCache({ addTypename: false }),
    });

    let didFail = false;
    return client
      .query({ query, fetchPolicy: 'network-only' })
      .catch(e => {
        expect(e.message).toMatch('query failed');
        didFail = true;
      })
      .then(() => client.query({ query }).then(actualResult => {
        expect(stripSymbols(actualResult.data)).toEqual(result);
        // the first error doesn't call .map on the inspector
        expect(called).toBe(3);
        expect(didFail).toBe(true);
      }))
      .then(resolve, reject);
  });

  itAsync('updates the cache on a mutation', (resolve, reject) => {
    let called = 0;
    const inspector = new ApolloLink((operation, forward) => {
      called++;
      return forward(operation).map(result => {
        called++;
        return result;
      });
    });

    const client = new ApolloClient({
      link: inspector.concat(createMutationLink(reject)),
      cache: new InMemoryCache({ addTypename: false }),
    });

    return client
      .query({ query })
      .then(() =>
        // XXX currently only no-cache is supported as a fetchPolicy
        // this mainly serves to ensure the cache is updated correctly
        client.mutate({ mutation, variables }),
      )
      .then(() => {
        return client.query({ query }).then(actualResult => {
          expect(stripSymbols(actualResult.data)).toEqual(merged);
        });
      })
      .then(resolve, reject);
  });
});

describe('no-cache', () => {
  itAsync('requests from the network when not in cache', (resolve, reject) => {
    let called = 0;
    const inspector = new ApolloLink((operation, forward) => {
      called++;
      return forward(operation).map(result => {
        called++;
        return result;
      });
    });

    const client = new ApolloClient({
      link: inspector.concat(createLink(reject)),
      cache: new InMemoryCache({ addTypename: false }),
    });

    return client
      .query({ fetchPolicy: 'no-cache', query })
      .then(actualResult => {
        expect(actualResult.data).toEqual(result);
        expect(called).toBe(2);
      })
      .then(resolve, reject);
  });

  itAsync('requests from the network even if already in cache', (resolve, reject) => {
    let called = 0;
    const inspector = new ApolloLink((operation, forward) => {
      called++;
      return forward(operation).map(result => {
        called++;
        return result;
      });
    });

    const client = new ApolloClient({
      link: inspector.concat(createLink(reject)),
      cache: new InMemoryCache({ addTypename: false }),
    });

    return client.query({ query }).then(
      () => client.query({ fetchPolicy: 'no-cache', query }).then(actualResult => {
        expect(actualResult.data).toEqual(result);
        expect(called).toBe(4);
      }),
    ).then(resolve, reject);
  });

  itAsync('does not save the data to the cache on success', (resolve, reject) => {
    let called = 0;
    const inspector = new ApolloLink((operation, forward) => {
      called++;
      return forward(operation).map(result => {
        called++;
        return result;
      });
    });

    const client = new ApolloClient({
      link: inspector.concat(createLink(reject)),
      cache: new InMemoryCache({ addTypename: false }),
    });

    return client.query({ query, fetchPolicy: 'no-cache' }).then(
      () => client.query({ query }).then(actualResult => {
        expect(stripSymbols(actualResult.data)).toEqual(result);
        // the second query couldn't read anything from the cache
        expect(called).toBe(4);
      }),
    ).then(resolve, reject);
  });

  itAsync('does not save data to the cache on failure', (resolve, reject) => {
    let called = 0;
    const inspector = new ApolloLink((operation, forward) => {
      called++;
      return forward(operation).map(result => {
        called++;
        return result;
      });
    });

    const client = new ApolloClient({
      link: inspector.concat(createFailureLink(reject)),
      cache: new InMemoryCache({ addTypename: false }),
    });

    let didFail = false;
    return client
      .query({ query, fetchPolicy: 'no-cache' })
      .catch(e => {
        expect(e.message).toMatch('query failed');
        didFail = true;
      })
      .then(() => client.query({ query }).then(actualResult => {
        expect(stripSymbols(actualResult.data)).toEqual(result);
        // the first error doesn't call .map on the inspector
        expect(called).toBe(3);
        expect(didFail).toBe(true);
      }))
      .then(resolve, reject);
  });

  itAsync('does not update the cache on a mutation', (resolve, reject) => {
    let called = 0;
    const inspector = new ApolloLink((operation, forward) => {
      called++;
      return forward(operation).map(result => {
        called++;
        return result;
      });
    });

    const client = new ApolloClient({
      link: inspector.concat(createMutationLink(reject)),
      cache: new InMemoryCache({ addTypename: false }),
    });

    return client
      .query({ query })
      .then(() =>
        client.mutate({ mutation, variables, fetchPolicy: 'no-cache' }),
      )
      .then(() => {
        return client.query({ query }).then(actualResult => {
          expect(stripSymbols(actualResult.data)).toEqual(result);
        });
      })
      .then(resolve, reject);
  });
});

describe('cache-and-network', function() {
  itAsync('gives appropriate networkStatus for refetched queries', (resolve, reject) => {
    const client = new ApolloClient({
      link: ApolloLink.empty(),
      cache: new InMemoryCache(),
      resolvers: {
        Query: {
          hero(_data, args) {
            return {
              __typename: 'Hero',
              ...args,
              name: 'Luke Skywalker',
            };
          },
        },
      },
    });

    const observable = client.watchQuery({
      query: gql`
        query FetchLuke($id: String) {
          hero(id: $id) @client {
            id
            name
          }
        }
      `,
      fetchPolicy: 'cache-and-network',
      variables: { id: '1' },
      notifyOnNetworkStatusChange: true,
    });

    function dataWithId(id: number | string) {
      return {
        hero: {
          __typename: 'Hero',
          id: String(id),
          name: 'Luke Skywalker',
        },
      };
    }

    subscribeAndCount(reject, observable, (count, result) => {
      if (count === 1) {
        expect(result).toEqual({
          data: dataWithId(1),
          loading: false,
          networkStatus: NetworkStatus.ready,
        });
        return observable.setVariables({ id: '2' });
      } else if (count === 2) {
        expect(result).toEqual({
          data: dataWithId(1),
          loading: true,
          networkStatus: NetworkStatus.setVariables,
        });
      } else if (count === 3) {
        expect(result).toEqual({
          data: dataWithId(2),
          loading: false,
          networkStatus: NetworkStatus.ready,
        });
        return observable.refetch();
      } else if (count === 4) {
        expect(result).toEqual({
          data: dataWithId(2),
          loading: true,
          networkStatus: NetworkStatus.refetch,
        });
      } else if (count === 5) {
        expect(result).toEqual({
          data: dataWithId(2),
          loading: false,
          networkStatus: NetworkStatus.ready,
        });
        return observable.refetch({ id: '3' });
      } else if (count === 6) {
        expect(result).toEqual({
          data: dataWithId(2),
          loading: true,
          networkStatus: NetworkStatus.setVariables,
        });
      } else if (count === 7) {
        expect(result).toEqual({
          data: dataWithId(3),
          loading: false,
          networkStatus: NetworkStatus.ready,
        });
        resolve();
      }
    });
  });
});
