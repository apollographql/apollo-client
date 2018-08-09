// This file implements some of the basic benchmarks around
// Apollo Client.

import gql from 'graphql-tag';

import {
  group,
  benchmark,
  afterEach,
  DescriptionObject,
  dataIdFromObject,
} from './util';

import { ApolloClient, ApolloQueryResult } from '../src/index';

import { times, cloneDeep } from 'lodash';

import { InMemoryCache } from 'apollo-cache-inmemory';

import { Operation, ApolloLink, FetchResult, Observable } from 'apollo-link';

import { print } from 'graphql/language/printer';

import { collectAndReportBenchmarks } from './github-reporter';

interface MockedResponse {
  request: Operation;
  result?: FetchResult;
  error?: Error;
  delay?: number;
}

function mockSingleLink(...mockedResponses: MockedResponse[]): ApolloLink {
  return new MockLink(mockedResponses);
}

function requestToKey(request: Operation): string {
  const queryString = request.query && print(request.query);

  return JSON.stringify({
    variables: request.variables || {},
    query: queryString,
  });
}

class MockLink extends ApolloLink {
  private mockedResponsesByKey: { [key: string]: MockedResponse[] } = {};

  constructor(mockedResponses: MockedResponse[]) {
    super();
    mockedResponses.forEach(mockedResponse => {
      this.addMockedResponse(mockedResponse);
    });
  }

  public addMockedResponse(mockedResponse: MockedResponse) {
    const key = requestToKey(mockedResponse.request);
    let mockedResponses = this.mockedResponsesByKey[key];
    if (!mockedResponses) {
      mockedResponses = [];
      this.mockedResponsesByKey[key] = mockedResponses;
    }
    mockedResponses.push(mockedResponse);
  }

  public request(operation: Operation) {
    const key = requestToKey(operation);
    const responses = this.mockedResponsesByKey[key];
    if (!responses || responses.length === 0) {
      throw new Error(
        `No more mocked responses for the query: ${print(
          operation.query,
        )}, variables: ${JSON.stringify(operation.variables)}`,
      );
    }

    const { result, error, delay } = responses.shift()!;
    if (!result && !error) {
      throw new Error(
        `Mocked response should contain either result or error: ${key}`,
      );
    }

    return new Observable<FetchResult>(observer => {
      let timer = setTimeout(() => {
        if (error) {
          observer.error(error);
        } else {
          if (result) observer.next(result);
          observer.complete();
        }
      }, delay ? delay : 0);

      return () => {
        clearTimeout(timer);
      };
    });
  }
}

const simpleQuery = gql`
  query {
    author {
      firstName
      lastName
    }
  }
`;

const simpleResult = {
  data: {
    author: {
      firstName: 'John',
      lastName: 'Smith',
    },
  },
};

const getClientInstance = () => {
  const link = mockSingleLink({
    request: { query: simpleQuery } as Operation,
    result: simpleResult,
  });

  return new ApolloClient({
    link,
    cache: new InMemoryCache({ addTypename: false }),
  });
};

const createReservations = (count: number) => {
  const reservations: {
    name: string;
    id: string;
  }[] = [];
  times(count, reservationIndex => {
    reservations.push({
      name: 'Fake Reservation',
      id: reservationIndex.toString(),
    });
  });
  return reservations;
};

group(end => {
  benchmark('baseline', done => {
    let arr = Array.from({ length: 100 }, () => Math.random());
    arr.sort();
    done();
  });
  end();
});

group(end => {
  const link = mockSingleLink({
    request: { query: simpleQuery } as Operation,
    result: simpleResult,
  });

  const cache = new InMemoryCache();

  benchmark('constructing an instance', done => {
    new ApolloClient({ link, cache });
    done();
  });
  end();
});

group(end => {
  benchmark('fetching a query result from mocked server', done => {
    const client = getClientInstance();
    client.query({ query: simpleQuery }).then(_ => {
      done();
    });
  });

  end();
});

group(end => {
  benchmark('write data and receive update from the cache', done => {
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
      error(_: Error) {
        console.warn('Error occurred in observable.');
      },
    });
    client.query({ query: simpleQuery });
  });

  end();
});

group(end => {
  // This benchmark is supposed to check whether the time
  // taken to deliver updates is linear in the number of subscribers or not.
  // (Should be linear). When plotting the results from this benchmark,
  // the `meanTimes` structure can be used.
  const meanTimes: { [subscriberCount: string]: number } = {};

  times(4, countR => {
    const count = 5 * Math.pow(4, countR);
    benchmark(
      {
        name: `write data and deliver update to ${count} subscribers`,
        count,
      },
      done => {
        const promises: Promise<void>[] = [];
        const client = getClientInstance();

        times(count, () => {
          promises.push(
            new Promise<void>((resolve, _) => {
              client
                .watchQuery({
                  query: simpleQuery,
                  fetchPolicy: 'cache-only',
                })
                .subscribe({
                  next(res: ApolloQueryResult<Object>) {
                    if (Object.keys(res.data).length > 0) {
                      resolve();
                    }
                  },
                });
            }),
          );
        });

        client.query({ query: simpleQuery });
        Promise.all(promises).then(() => {
          done();
        });
      },
    );

    afterEach((description: DescriptionObject, event: any) => {
      const iterCount = description['count'] as number;
      meanTimes[iterCount.toString()] = event.target.stats.mean * 1000;
    });
  });

  end();
});

times(4, (countR: number) => {
  const count = 5 * Math.pow(4, countR);
  const query = gql`
    query($id: String) {
      author(id: $id) {
        name
        id
        __typename
      }
    }
  `;
  const originalResult = {
    data: {
      author: {
        name: 'John Smith',
        id: 1,
        __typename: 'Author',
      },
    },
  };

  group(end => {
    const cache = new InMemoryCache({
      dataIdFromObject: (obj: any) => {
        if (obj.id && obj.__typename) {
          return obj.__typename + obj.id;
        }
        return null;
      },
    });

    // insert a bunch of stuff into the cache
    times(count, index => {
      const result = cloneDeep(originalResult);
      result.data.author.id = index;

      return cache.writeQuery({
        query,
        variables: { id: index },
        data: result.data as any,
      });
    });

    benchmark(
      {
        name: `read single item from cache with ${count} items in cache`,
        count,
      },
      done => {
        const randomIndex = Math.floor(Math.random() * count);
        cache.readQuery({
          query,
          variables: { id: randomIndex },
        });
        done();
      },
    );

    end();
  });
});

// Measure the amount of time it takes to read a bunch of
// objects from the cache.
times(4, index => {
  group(end => {
    const cache = new InMemoryCache({
      dataIdFromObject,
      addTypename: false,
    });

    const query = gql`
      query($id: String) {
        house(id: $id) {
          reservations {
            name
            id
          }
        }
      }
    `;
    const houseId = '12';
    const reservationCount = 5 * Math.pow(4, index);
    const reservations = createReservations(reservationCount);

    const variables = { id: houseId };

    cache.writeQuery({
      query,
      variables,
      data: {
        house: {
          reservations,
        },
      },
    });

    benchmark(
      `read result with ${reservationCount} items associated with the result`,
      done => {
        cache.readQuery({
          query,
          variables,
        });
        done();
      },
    );

    end();
  });
});

// Measure only the amount of time it takes to diff a query against the store
//
// This test allows us to differentiate between the fixed cost of .query() and the fixed cost
// of actually reading from the store.
times(4, index => {
  group(end => {
    const reservationCount = 5 * Math.pow(4, index);

    // Prime the cache.
    const query = gql`
      query($id: String) {
        house(id: $id) {
          reservations {
            name
            id
          }
        }
      }
    `;
    const variables = { id: '7' };
    const reservations = createReservations(reservationCount);
    const result = {
      house: { reservations },
    };

    const cache = new InMemoryCache({
      dataIdFromObject,
      addTypename: false,
    });

    cache.write({
      dataId: 'ROOT_QUERY',
      query,
      variables,
      result,
    });

    // We only keep track of the results so that V8 doesn't decide to just throw
    // away our cache read code.
    let results: any = null;
    benchmark(
      `diff query against store with ${reservationCount} items`,
      done => {
        results = cache.diff({
          query,
          variables,
          optimistic: false,
        });
        done();
      },
    );

    end();
  });
});

if (process.env.DANGER_GITHUB_API_TOKEN) {
  collectAndReportBenchmarks(true);
} else {
  collectAndReportBenchmarks(false);
}
