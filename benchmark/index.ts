// This file implements some of the basic benchmarks around
// Apollo Client.

import gql from 'graphql-tag';

import {
  group,
  benchmark,
  afterAll,
  afterEach,
  runBenchmarks,
  DescriptionObject,
  log,
  dataIdFromObject,
} from './util';

import {
  ApolloClient,
  ApolloQueryResult,
  ObservableQuery,
} from '../src/index';

import {
  diffQueryAgainstStore,
} from '../src/data/readFromStore';

import mockNetworkInterface, {
  MockedResponse,
} from '../test/mocks/mockNetworkInterface';

import {
  Deferred,
} from 'benchmark';

import {
  times,
  cloneDeep,
} from 'lodash';

const simpleQuery = gql`
  query {
    author {
      firstName
      lastName
    }
}`;

const simpleResult = {
  data: {
    author: {
      firstName: 'John',
      lastName: 'Smith',
    },
  },
};

const simpleReqResp = {
  request: { query: simpleQuery },
  result: simpleResult,
};

const getClientInstance = () => {
  return new ApolloClient({
    networkInterface: mockNetworkInterface({
      request: { query: simpleQuery },
      result: simpleResult,
    }),
    addTypename: false,
  });
};

const createReservations = (count: number) => {
    const reservations: {
      name: string,
      id: string,
    }[] = [];
  times(count, (reservationIndex) => {
    reservations.push({
      name: 'Fake Reservation',
      id: reservationIndex.toString(),
    });
  });
  return reservations;
};

group((end) => {
  benchmark('constructing an instance', (done) => {
    const c = new ApolloClient({});
    done();
  });
  end();
});

group((end) => {
  benchmark('fetching a query result from mocked server', (done) => {
    const client = getClientInstance();
    client.query({ query: simpleQuery }).then((result) => {
      done();
    });
  });

  end();
});

group((end) => {
  benchmark('write data and receive update from the cache', (done) => {
    const client = getClientInstance();
    const observable = client.watchQuery({
      query: simpleQuery,
      fetchPolicy: 'cache-only',
    });
    observable.subscribe({
      next(res: ApolloQueryResult<Object>) {
        if (Object.keys(res.data).length > 0) {
          done();
        }
      },
      error(err: Error) {
        console.warn('Error occurred in observable.');
      },
    });
    client.query({ query: simpleQuery });
  });

  end();
});

group((end) => {
  // This benchmark is supposed to check whether the time
  // taken to deliver updates is linear in the number of subscribers or not.
  // (Should be linear). When plotting the results from this benchmark,
  // the `meanTimes` structure can be used.
  const meanTimes: { [subscriberCount: string]: number } = {};

  times(50, (countR) => {
    const count = countR * 5;
    benchmark({
      name: `write data and deliver update to ${count} subscribers`,
      count,
    }, (done) => {
      const promises: Promise<void>[] = [];
      const client = getClientInstance();

      times(count, () => {
        promises.push(new Promise<void>((resolve, reject) => {
          client.watchQuery({
            query: simpleQuery,
            fetchPolicy: 'cache-only',
          }).subscribe({
            next(res: ApolloQueryResult<Object>) {
              if (Object.keys(res.data).length > 0) {
                resolve();
              }
            },
          });
        }));
      });

      client.query({ query: simpleQuery });
      Promise.all(promises).then(() => {
        done();
      });
    });

    afterEach((description: DescriptionObject, event: any) => {
      const iterCount = description['count'] as number;
      meanTimes[iterCount.toString()] = event.target.stats.mean * 1000;
    });
  });

  end();
});

times(25, (countR: number) => {
  const count = (countR + 1) * 10;
  const query = gql`
    query($id: String) {
      author(id: $id) {
        name
        id
        __typename
      }
    }`;
  const originalVariables = {id: 1};
  const originalResult = {
    data: {
      author: {
        name: 'John Smith',
        id: 1,
        __typename: 'Author',
      },
    },
  };

  group((end) => {
    // construct a set of mocked responses that each
    // returns an author with a different id (but the
    // same name) so we can populate the cache.
    const mockedResponses: MockedResponse[]  = [];
    times(count, (index) => {
      const result = cloneDeep(originalResult);
      result.data.author.id = index;

      const variables = cloneDeep(originalVariables);
      variables.id = index;

      mockedResponses.push({
        request: { query, variables },
        result,
      });
    });

    const client = new ApolloClient({
      networkInterface: mockNetworkInterface(...mockedResponses),
      addTypename: false,
      dataIdFromObject,
    });

    // insert a bunch of stuff into the cache
    const promises = times(count, (index) => {
      return client.query({
        query,
        variables: { id: index },
      }).then((result) => {
        return Promise.resolve({});
      });
    });

    const myBenchmark = benchmark;
    const myAfterEach = afterEach;
    Promise.all(promises).then(() => {
      myBenchmark({
        name: `read single item from cache with ${count} items in cache`,
        count,
      }, (done) => {
        const randomIndex = Math.floor(Math.random() * count);
        client.query({
          query,
          variables: { id: randomIndex },
        }).then((result) => {
          done();
        });
      });

      end();
    });
  });
});

// Measure the amount of time it takes to read a bunch of
// objects from the cache.
times(50, (index) => {
  group((end) => {
    const query = gql`
      query($id: String) {
        house(id: $id) {
          reservations {
            name
            id
          }
        }
      }`;
    const houseId = '12';
    const reservationCount = index + 1;
    const reservations = createReservations(reservationCount);

    const variables = {id: houseId };
    const result = {
      data: {
        house: {
          reservations,
        },
      },
    };

    const client = new ApolloClient({
      networkInterface: mockNetworkInterface({
        request: { query, variables },
        result,
      }),
      addTypename: false,
      dataIdFromObject,
    });

    const myBenchmark = benchmark;
    client.query({
      query,
      variables,
    }).then(() => {
      myBenchmark(`read result with ${reservationCount} items associated with the result`, (done) => {
        client.query({
          query,
          variables,
          fetchPolicy: 'cache-only',
        }).then(() => {
          done();
        });
      });

      end();
    });
  });
});

// Measure only the amount of time it takes to diff a query against the store
//
// This test allows us to differentiate between the fixed cost of .query() and the fixed cost
// of actually reading from the store.
times(50, (index) => {
  group((end) => {
    const reservationCount = index + 1;

    // Prime the cache.
    const query = gql`
      query($id: String) {
        house(id: $id) {
          reservations {
            name
            id
          }
        }
      }`;
    const variables = { id: '7' };
    const reservations = createReservations(reservationCount);
    const result = {
      data: {
        house: { reservations },
      },
    };
    const client = new ApolloClient({
      networkInterface: mockNetworkInterface({
        request: { query, variables },
        result,
      }),
      addTypename: false,
      dataIdFromObject,
    });

    const myBenchmark = benchmark;

    // We only keep track of the results so that V8 doesn't decide to just throw
    // away our cache read code.
    const results: any[] = [];
    client.query({
      query,
      variables,
    }).then(() => {
      myBenchmark(`diff query against store with ${reservationCount} items`, (done) => {

        results.push(diffQueryAgainstStore({
          query,
          variables,
          store: client.store.getState()['apollo'].data,
        }));
        done();
      });

      end();
    });
  });
});

runBenchmarks();
