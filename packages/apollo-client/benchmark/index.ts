// This file implements some of the basic benchmarks around
// Apollo Client.

import gql from 'graphql-tag';

import {
  group,
  benchmark,
  afterEach,
  runBenchmarks,
  DescriptionObject,
  dataIdFromObject,
} from './util';

import { ApolloClient, ApolloQueryResult } from '../src/index';

import { times, cloneDeep } from 'lodash';

import InMemoryCache from 'apollo-cache-inmemory';

import { Operation, ApolloLink, FetchResult, Observable } from 'apollo-link';

import { print } from 'graphql/language/printer';

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
  benchmark('constructing an instance', done => {
    new ApolloClient({ link: mockSingleLink(), cache: new InMemoryCache() });
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

  times(50, countR => {
    const count = countR * 5;
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

times(25, (countR: number) => {
  const count = (countR + 1) * 10;
  const query = gql`
    query($id: String) {
      author(id: $id) {
        name
        id
        __typename
      }
    }
  `;
  const originalVariables = { id: 1 };
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
    // construct a set of mocked responses that each
    // returns an author with a different id (but the
    // same name) so we can populate the cache.
    const mockedResponses: MockedResponse[] = [];
    times(count, index => {
      const result = cloneDeep(originalResult);
      result.data.author.id = index;

      const variables = cloneDeep(originalVariables);
      variables.id = index;

      mockedResponses.push({
        // what am I doing here
        request: ({ query, variables } as any) as Operation,
        result,
      });
    });

    const client = new ApolloClient({
      link: mockSingleLink(...mockedResponses),
      cache: new InMemoryCache({
        dataIdFromObject: (obj: any) => {
          if (obj.id && obj.__typename) {
            return obj.__typename + obj.id;
          }
          return null;
        },
      }),
    });

    // insert a bunch of stuff into the cache
    const promises = times(count, index => {
      return client
        .query({
          query,
          variables: { id: index },
        })
        .then(_ => {
          return Promise.resolve({});
        });
    });

    const myBenchmark = benchmark;
    // const myAfterEach = afterEach;
    Promise.all(promises).then(() => {
      myBenchmark(
        {
          name: `read single item from cache with ${count} items in cache`,
          count,
        },
        done => {
          const randomIndex = Math.floor(Math.random() * count);
          client
            .query({
              query,
              variables: { id: randomIndex },
            })
            .then(_ => {
              done();
            });
        },
      );

      end();
    });
  });
});

// Measure the amount of time it takes to read a bunch of
// objects from the cache.
times(50, index => {
  group(end => {
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
    const reservationCount = index + 1;
    const reservations = createReservations(reservationCount);

    const variables = { id: houseId };
    const result = {
      data: {
        house: {
          reservations,
        },
      },
    };

    const client = new ApolloClient({
      link: mockSingleLink({
        request: ({ query, variables } as any) as Operation,
        result,
      }),
      cache: new InMemoryCache({
        dataIdFromObject,
        addTypename: false,
      }),
    });

    const myBenchmark = benchmark;
    client
      .query({
        query,
        variables,
      })
      .then(() => {
        myBenchmark(
          `read result with ${reservationCount} items associated with the result`,
          done => {
            client
              .query({
                query,
                variables,
                fetchPolicy: 'cache-only',
              })
              .then(() => {
                done();
              });
          },
        );

        end();
      });
  });
});

// Measure only the amount of time it takes to diff a query against the store
//
// This test allows us to differentiate between the fixed cost of .query() and the fixed cost
// of actually reading from the store.
times(50, index => {
  group(end => {
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
      }
    `;
    const variables = { id: '7' };
    const reservations = createReservations(reservationCount);
    const result = {
      data: {
        house: { reservations },
      },
    };
    const client = new ApolloClient({
      link: mockSingleLink({
        request: ({ query, variables } as any) as Operation,
        result,
      }),
      cache: new InMemoryCache({
        dataIdFromObject,
        addTypename: false,
      }),
    });

    const myBenchmark = benchmark;

    // We only keep track of the results so that V8 doesn't decide to just throw
    // away our cache read code.
    const results: any[] = [];
    client
      .query({
        query,
        variables,
      })
      .then(() => {
        myBenchmark(
          `diff query against store with ${reservationCount} items`,
          done => {
            results.push(
              client.queryManager.dataStore.getCache().diff({
                query,
                variables,
                optimistic: false,
              }),
            );
            done();
          },
        );

        end();
      });
  });
});

runBenchmarks();
