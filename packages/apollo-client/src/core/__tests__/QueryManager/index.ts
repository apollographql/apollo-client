// externals
import { from } from 'rxjs';
import { map } from 'rxjs/operators';
import { assign } from 'lodash';
import gql from 'graphql-tag';
import { DocumentNode, ExecutionResult, GraphQLError } from 'graphql';
import { ApolloLink, Operation, Observable } from 'apollo-link';
import {
  InMemoryCache,
  ApolloReducerConfig,
  NormalizedCacheObject,
} from 'apollo-cache-inmemory';

// mocks
import mockQueryManager from '../../../__mocks__/mockQueryManager';
import mockWatchQuery from '../../../__mocks__/mockWatchQuery';
import {
  mockSingleLink,
  MockSubscriptionLink,
} from '../../../__mocks__/mockLinks';

// core
import { ApolloQueryResult } from '../../types';
import { NetworkStatus } from '../../networkStatus';
import { ObservableQuery } from '../../ObservableQuery';
import { WatchQueryOptions } from '../../watchQueryOptions';
import { QueryManager } from '../../QueryManager';

import { ApolloError } from '../../../errors/ApolloError';
import { DataStore } from '../../../data/store';
import { Observer } from '../../../util/Observable';

// testing utils
import wrap from '../../../util/wrap';
import observableToPromise, {
  observableToPromiseAndSubscription,
} from '../../../util/observableToPromise';
import { stripSymbols } from 'apollo-utilities';

describe('QueryManager', () => {
  // Standard "get id from object" method.
  const dataIdFromObject = (object: any) => {
    if (object.__typename && object.id) {
      return object.__typename + '__' + object.id;
    }
    return undefined;
  };

  // Helper method that serves as the constructor method for
  // QueryManager but has defaults that make sense for these
  // tests.
  const createQueryManager = ({
    link,
    config = {},
    clientAwareness = {},
  }: {
    link?: ApolloLink;
    config?: ApolloReducerConfig;
    clientAwareness?: { [key: string]: string };
  }) => {
    return new QueryManager({
      link: link || mockSingleLink(),
      store: new DataStore(
        new InMemoryCache({ addTypename: false, ...config }),
      ),
      clientAwareness,
    });
  };

  // Helper method that sets up a mockQueryManager and then passes on the
  // results to an observer.
  const assertWithObserver = ({
    done,
    query,
    variables = {},
    queryOptions = {},
    result,
    error,
    delay,
    observer,
  }: {
    done: () => void;
    query: DocumentNode;
    variables?: Object;
    queryOptions?: Object;
    error?: Error;
    result?: ExecutionResult;
    delay?: number;
    observer: Observer<ApolloQueryResult<any>>;
  }) => {
    const queryManager = mockQueryManager({
      request: { query, variables },
      result,
      error,
      delay,
    });
    const finalOptions = assign(
      { query, variables },
      queryOptions,
    ) as WatchQueryOptions;
    return queryManager.watchQuery<any>(finalOptions).subscribe({
      next: wrap(done, observer.next!),
      error: observer.error,
    });
  };

  const mockMutation = ({
    mutation,
    data,
    errors,
    variables = {},
    config = {},
  }: {
    mutation: DocumentNode;
    data?: Object;
    errors?: GraphQLError[];
    variables?: Object;
    config?: ApolloReducerConfig;
  }) => {
    const link = mockSingleLink({
      request: { query: mutation, variables },
      result: { data, errors },
    });
    const queryManager = createQueryManager({
      link,
      config,
    });
    return new Promise<{
      result: ExecutionResult;
      queryManager: QueryManager<NormalizedCacheObject>;
    }>((resolve, reject) => {
      queryManager
        .mutate({ mutation, variables })
        .then(result => {
          resolve({ result, queryManager });
        })
        .catch(error => {
          reject(error);
        });
    });
  };

  const assertMutationRoundtrip = (opts: {
    mutation: DocumentNode;
    data: Object;
    variables?: Object;
  }) => {
    return mockMutation(opts).then(({ result }) => {
      expect(stripSymbols(result.data)).toEqual(opts.data);
    });
  };

  // Helper method that takes a query with a first response and a second response.
  // Used to assert stuff about refetches.
  const mockRefetch = ({
    request,
    firstResult,
    secondResult,
    thirdResult,
  }: {
    request: Operation;
    firstResult: ExecutionResult;
    secondResult: ExecutionResult;
    thirdResult?: ExecutionResult;
  }) => {
    const args = [
      {
        request,
        result: firstResult,
      },
      {
        request,
        result: secondResult,
      },
    ];

    if (thirdResult) {
      args.push({ request, result: thirdResult });
    }

    return mockQueryManager(...args);
  };

  it('handles GraphQL errors', done => {
    assertWithObserver({
      done,
      query: gql`
        query people {
          allPeople(first: 1) {
            people {
              name
            }
          }
        }
      `,
      variables: {},
      result: {
        errors: [
          {
            name: 'Name',
            message: 'This is an error message.',
          },
        ],
      },
      observer: {
        next() {
          done.fail(
            new Error('Returned a result when it was supposed to error out'),
          );
        },

        error(apolloError) {
          expect(apolloError).toBeDefined();
          done();
        },
      },
    });
  });

  it('handles GraphQL errors as data', done => {
    assertWithObserver({
      done,
      query: gql`
        query people {
          allPeople(first: 1) {
            people {
              name
            }
          }
        }
      `,
      variables: {},
      queryOptions: {
        errorPolicy: 'all',
      },
      result: {
        errors: [
          {
            name: 'Name',
            message: 'This is an error message.',
          },
        ],
      },
      observer: {
        next({ errors }) {
          expect(errors).toBeDefined();
          expect(errors[0].name).toBe('Name');
          expect(errors[0].message).toBe('This is an error message.');
          done();
        },
        error(apolloError) {
          throw new Error(
            'Returned a result when it was supposed to error out',
          );
        },
      },
    });
  });

  it('handles GraphQL errors with data returned', done => {
    assertWithObserver({
      done,
      query: gql`
        query people {
          allPeople(first: 1) {
            people {
              name
            }
          }
        }
      `,
      result: {
        data: {
          allPeople: {
            people: {
              name: 'Ada Lovelace',
            },
          },
        },
        errors: [
          {
            name: 'Name',
            message: 'This is an error message.',
          },
        ],
      },
      observer: {
        next() {
          done.fail(
            new Error('Returned data when it was supposed to error out.'),
          );
        },

        error(apolloError) {
          expect(apolloError).toBeDefined();
          done();
        },
      },
    });
  });

  it('empty error array (handle non-spec-compliant server) #156', done => {
    assertWithObserver({
      done,
      query: gql`
        query people {
          allPeople(first: 1) {
            people {
              name
            }
          }
        }
      `,
      result: {
        data: {
          allPeople: {
            people: {
              name: 'Ada Lovelace',
            },
          },
        },
        errors: [],
      },
      observer: {
        next(result) {
          expect(result.data['allPeople'].people.name).toBe('Ada Lovelace');
          expect(result['errors']).toBeUndefined();
          done();
        },
      },
    });
  });

  // Easy to get into this state if you write an incorrect `formatError`
  // function with graphql-server or express-graphql
  it('error array with nulls (handle non-spec-compliant server) #1185', done => {
    assertWithObserver({
      done,
      query: gql`
        query people {
          allPeople(first: 1) {
            people {
              name
            }
          }
        }
      `,
      result: {
        errors: [null as any],
      },
      observer: {
        next() {
          done.fail(new Error('Should not fire next for an error'));
        },
        error(error) {
          expect((error as any).graphQLErrors).toEqual([null]);
          expect(error.message).toBe('GraphQL error: Error message not found.');
          done();
        },
      },
    });
  });

  it('handles network errors', done => {
    assertWithObserver({
      done,
      query: gql`
        query people {
          allPeople(first: 1) {
            people {
              name
            }
          }
        }
      `,
      error: new Error('Network error'),
      observer: {
        next: () => {
          done.fail(new Error('Should not deliver result'));
        },
        error: error => {
          const apolloError = error as ApolloError;
          expect(apolloError.networkError).toBeDefined();
          expect(apolloError.networkError!.message).toMatch('Network error');
          done();
        },
      },
    });
  });

  it('uses console.error to log unhandled errors', done => {
    const oldError = console.error;
    let printed: any;
    console.error = (...args: any[]) => {
      printed = args;
    };

    assertWithObserver({
      done,
      query: gql`
        query people {
          allPeople(first: 1) {
            people {
              name
            }
          }
        }
      `,
      error: new Error('Network error'),
      observer: {
        next: () => {
          done.fail(new Error('Should not deliver result'));
        },
      },
    });

    setTimeout(() => {
      expect(printed[0]).toMatch(/error/);
      console.error = oldError;
      done();
    }, 10);
  });

  // XXX this looks like a bug in zen-observable but we should figure
  // out a solution for it
  xit('handles an unsubscribe action that happens before data returns', done => {
    const subscription = assertWithObserver({
      done,
      query: gql`
        query people {
          allPeople(first: 1) {
            people {
              name
            }
          }
        }
      `,
      delay: 1000,
      observer: {
        next: () => {
          done.fail(new Error('Should not deliver result'));
        },
        error: () => {
          done.fail(new Error('Should not deliver result'));
        },
      },
    });

    expect(subscription.unsubscribe).not.toThrow();
  });

  it('supports interoperability with other Observable implementations like RxJS', done => {
    const expResult = {
      data: {
        allPeople: {
          people: [
            {
              name: 'Luke Skywalker',
            },
          ],
        },
      },
    };

    const handle = mockWatchQuery({
      request: {
        query: gql`
          query people {
            allPeople(first: 1) {
              people {
                name
              }
            }
          }
        `,
      },
      result: expResult,
    });

    const observable = from(handle);

    observable.pipe(map(result => assign({ fromRx: true }, result))).subscribe({
      next: wrap(done, newResult => {
        const expectedResult = assign(
          { fromRx: true, loading: false, networkStatus: 7, stale: false },
          expResult,
        );
        expect(stripSymbols(newResult)).toEqual(expectedResult);
        done();
      }),
    });
  });

  it('allows you to subscribe twice to one query', done => {
    const request = {
      query: gql`
        query fetchLuke($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `,
      variables: {
        id: '1',
      },
    };
    const data1 = {
      people_one: {
        name: 'Luke Skywalker',
      },
    };

    const data2 = {
      people_one: {
        name: 'Luke Skywalker has a new name',
      },
    };

    const data3 = {
      people_one: {
        name: 'Luke Skywalker has another name',
      },
    };

    const queryManager = mockQueryManager(
      {
        request,
        result: { data: data1 },
      },
      {
        request,
        result: { data: data2 },

        // Wait for both to subscribe
        delay: 100,
      },
      {
        request,
        result: { data: data3 },
      },
    );

    let subOneCount = 0;

    // pre populate data to avoid contention
    queryManager.query<any>(request).then(() => {
      const handle = queryManager.watchQuery<any>(request);

      const subOne = handle.subscribe({
        next(result) {
          subOneCount++;

          if (subOneCount === 1) {
            expect(stripSymbols(result.data)).toEqual(data1);
          } else if (subOneCount === 2) {
            expect(stripSymbols(result.data)).toEqual(data2);
          }
        },
      });

      let subTwoCount = 0;
      handle.subscribe({
        next(result) {
          subTwoCount++;
          if (subTwoCount === 1) {
            expect(stripSymbols(result.data)).toEqual(data1);
            handle.refetch();
          } else if (subTwoCount === 2) {
            expect(stripSymbols(result.data)).toEqual(data2);
            setTimeout(() => {
              try {
                expect(subOneCount).toBe(2);

                subOne.unsubscribe();
                handle.refetch();
              } catch (e) {
                done.fail(e);
              }
            }, 0);
          } else if (subTwoCount === 3) {
            setTimeout(() => {
              try {
                expect(subOneCount).toBe(2);
                done();
              } catch (e) {
                done.fail(e);
              }
            }, 0);
          }
        },
      });
    });
  });
  it('resolves all queries when one finishes after another', done => {
    const request = {
      query: gql`
        query fetchLuke($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `,
      variables: {
        id: '1',
      },
      notifyOnNetworkStatusChange: true,
    };
    const request2 = {
      query: gql`
        query fetchLeia($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `,
      variables: {
        id: '2',
      },
      notifyOnNetworkStatusChange: true,
    };
    const request3 = {
      query: gql`
        query fetchHan($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `,
      variables: {
        id: '3',
      },
      notifyOnNetworkStatusChange: true,
    };

    const data1 = {
      people_one: {
        name: 'Luke Skywalker',
      },
    };
    const data2 = {
      people_one: {
        name: 'Leia Skywalker',
      },
    };
    const data3 = {
      people_one: {
        name: 'Han Solo',
      },
    };

    const queryManager = mockQueryManager(
      {
        request,
        result: { data: data1 },
        delay: 10,
      },
      {
        request: request2,
        result: { data: data2 },
        // make the second request the slower one
        delay: 100,
      },
      {
        request: request3,
        result: { data: data3 },
        delay: 10,
      },
    );

    const ob1 = queryManager.watchQuery(request);
    const ob2 = queryManager.watchQuery(request2);
    const ob3 = queryManager.watchQuery(request3);

    let finishCount = 0;
    ob1.subscribe(result => {
      expect(stripSymbols(result.data)).toEqual(data1);
      finishCount++;
    });
    ob2.subscribe(result => {
      expect(stripSymbols(result.data)).toEqual(data2);
      expect(finishCount).toBe(2);
      done();
    });
    ob3.subscribe(result => {
      expect(stripSymbols(result.data)).toEqual(data3);
      finishCount++;
    });
  });

  it('allows you to refetch queries', () => {
    const request = {
      query: gql`
        query fetchLuke($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `,
      variables: {
        id: '1',
      },
      notifyOnNetworkStatusChange: false,
    };
    const data1 = {
      people_one: {
        name: 'Luke Skywalker',
      },
    };

    const data2 = {
      people_one: {
        name: 'Luke Skywalker has a new name',
      },
    };

    const queryManager = mockRefetch({
      request,
      firstResult: { data: data1 },
      secondResult: { data: data2 },
    });

    const observable = queryManager.watchQuery<any>(request);
    return observableToPromise(
      { observable },
      result => {
        expect(stripSymbols(result.data)).toEqual(data1);
        observable.refetch();
      },
      result => expect(stripSymbols(result.data)).toEqual(data2),
    );
  });

  it('will return referentially equivalent data if nothing changed in a refetch', done => {
    const request = {
      query: gql`
        {
          a
          b {
            c
          }
          d {
            e
            f {
              g
            }
          }
        }
      `,
      notifyOnNetworkStatusChange: false,
    };

    const data1 = {
      a: 1,
      b: { c: 2 },
      d: { e: 3, f: { g: 4 } },
    };

    const data2 = {
      a: 1,
      b: { c: 2 },
      d: { e: 30, f: { g: 4 } },
    };

    const data3 = {
      a: 1,
      b: { c: 2 },
      d: { e: 3, f: { g: 4 } },
    };

    const queryManager = mockRefetch({
      request,
      firstResult: { data: data1 },
      secondResult: { data: data2 },
      thirdResult: { data: data3 },
    });

    const observable = queryManager.watchQuery<any>(request);

    let count = 0;
    let firstResultData: any;

    observable.subscribe({
      next: result => {
        try {
          switch (count++) {
            case 0:
              expect(stripSymbols(result.data)).toEqual(data1);
              firstResultData = result.data;
              observable.refetch();
              break;
            case 1:
              expect(stripSymbols(result.data)).toEqual(data2);
              expect(result.data).not.toEqual(firstResultData);
              expect(result.data.b).toEqual(firstResultData.b);
              expect(result.data.d).not.toEqual(firstResultData.d);
              expect(result.data.d.f).toEqual(firstResultData.d.f);
              observable.refetch();
              break;
            case 2:
              expect(stripSymbols(result.data)).toEqual(data3);
              expect(result.data).not.toBe(firstResultData);
              expect(result.data.b).toEqual(firstResultData.b);
              expect(result.data.d).not.toBe(firstResultData.d);
              expect(result.data.d.f).toEqual(firstResultData.d.f);
              done();
              break;
            default:
              throw new Error('Next run too many times.');
          }
        } catch (error) {
          done.fail(error);
        }
      },
      error: error => done.fail(error),
    });
  });

  it('will return referentially equivalent data in getCurrentResult if nothing changed', done => {
    const request = {
      query: gql`
        {
          a
          b {
            c
          }
          d {
            e
            f {
              g
            }
          }
        }
      `,
      notifyOnNetworkStatusChange: false,
    };

    const data1 = {
      a: 1,
      b: { c: 2 },
      d: { e: 3, f: { g: 4 } },
    };

    const queryManager = mockQueryManager({
      request,
      result: { data: data1 },
    });

    const observable = queryManager.watchQuery<any>(request);

    observable.subscribe({
      next: result => {
        try {
          expect(stripSymbols(result.data)).toEqual(data1);
          expect(stripSymbols(result.data)).toEqual(
            stripSymbols(observable.getCurrentResult().data),
          );
          done();
        } catch (error) {
          done.fail(error);
        }
      },
      error: error => done.fail(error),
    });
  });

  it('sets networkStatus to `refetch` when refetching', () => {
    const request = {
      query: gql`
        query fetchLuke($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `,
      variables: {
        id: '1',
      },
      notifyOnNetworkStatusChange: true,
    };
    const data1 = {
      people_one: {
        name: 'Luke Skywalker',
      },
    };

    const data2 = {
      people_one: {
        name: 'Luke Skywalker has a new name',
      },
    };

    const queryManager = mockRefetch({
      request,
      firstResult: { data: data1 },
      secondResult: { data: data2 },
    });

    const observable = queryManager.watchQuery<any>(request);
    return observableToPromise(
      { observable },
      result => {
        expect(stripSymbols(result.data)).toEqual(data1);
        observable.refetch();
      },
      result => expect(result.networkStatus).toBe(NetworkStatus.refetch),
      result => {
        expect(result.networkStatus).toBe(NetworkStatus.ready);
        expect(stripSymbols(result.data)).toEqual(data2);
      },
    );
  });

  it('allows you to refetch queries with promises', () => {
    const request = {
      query: gql`
        {
          people_one(id: 1) {
            name
          }
        }
      `,
    };
    const data1 = {
      people_one: {
        name: 'Luke Skywalker',
      },
    };

    const data2 = {
      people_one: {
        name: 'Luke Skywalker has a new name',
      },
    };

    const queryManager = mockRefetch({
      request,
      firstResult: { data: data1 },
      secondResult: { data: data2 },
    });

    const handle = queryManager.watchQuery<any>(request);
    handle.subscribe({});

    return handle
      .refetch()
      .then(result => expect(stripSymbols(result.data)).toEqual(data2));
  });

  it('allows you to refetch queries with new variables', () => {
    const query = gql`
      {
        people_one(id: 1) {
          name
        }
      }
    `;

    const data1 = {
      people_one: {
        name: 'Luke Skywalker',
      },
    };

    const data2 = {
      people_one: {
        name: 'Luke Skywalker has a new name',
      },
    };

    const data3 = {
      people_one: {
        name: 'Luke Skywalker has a new name and age',
      },
    };

    const data4 = {
      people_one: {
        name: 'Luke Skywalker has a whole new bag',
      },
    };

    const variables1 = {
      test: 'I am your father',
    };

    const variables2 = {
      test: "No. No! That's not true! That's impossible!",
    };

    const queryManager = mockQueryManager(
      {
        request: { query: query },
        result: { data: data1 },
      },
      {
        request: { query: query },
        result: { data: data2 },
      },
      {
        request: { query: query, variables: variables1 },
        result: { data: data3 },
      },
      {
        request: { query: query, variables: variables2 },
        result: { data: data4 },
      },
    );

    const observable = queryManager.watchQuery<any>({
      query,
      notifyOnNetworkStatusChange: false,
    });
    return observableToPromise(
      { observable },
      result => {
        expect(stripSymbols(result.data)).toEqual(data1);
        observable.refetch();
      },
      result => {
        expect(stripSymbols(result.data)).toEqual(data2);
        observable.refetch(variables1);
      },
      result => {
        expect(result.loading).toBe(true);
        expect(stripSymbols(result.data)).toEqual(data2);
      },
      result => {
        expect(stripSymbols(result.data)).toEqual(data3);
        observable.refetch(variables2);
      },
      result => {
        expect(result.loading).toBe(true);
        expect(stripSymbols(result.data)).toEqual(data3);
      },
      result => {
        expect(stripSymbols(result.data)).toEqual(data4);
      },
    );
  });

  it('only modifies varaibles when refetching', () => {
    const query = gql`
      {
        people_one(id: 1) {
          name
        }
      }
    `;

    const data1 = {
      people_one: {
        name: 'Luke Skywalker',
      },
    };

    const data2 = {
      people_one: {
        name: 'Luke Skywalker has a new name',
      },
    };

    const queryManager = mockQueryManager(
      {
        request: { query: query },
        result: { data: data1 },
      },
      {
        request: { query: query },
        result: { data: data2 },
      },
    );

    const observable = queryManager.watchQuery<any>({
      query,
      notifyOnNetworkStatusChange: false,
    });
    const originalOptions = assign({}, observable.options);
    return observableToPromise(
      { observable },
      result => {
        expect(stripSymbols(result.data)).toEqual(data1);
        observable.refetch();
      },
      result => {
        expect(stripSymbols(result.data)).toEqual(data2);
        const updatedOptions = assign({}, observable.options);
        delete originalOptions.variables;
        delete updatedOptions.variables;
        expect(updatedOptions).toEqual(originalOptions);
      },
    );
  });

  it('continues to poll after refetch', () => {
    const query = gql`
      {
        people_one(id: 1) {
          name
        }
      }
    `;

    const data1 = {
      people_one: {
        name: 'Luke Skywalker',
      },
    };

    const data2 = {
      people_one: {
        name: 'Luke Skywalker has a new name',
      },
    };

    const data3 = {
      people_one: {
        name: 'Patsy',
      },
    };

    const queryManager = mockQueryManager(
      {
        request: { query },
        result: { data: data1 },
      },
      {
        request: { query },
        result: { data: data2 },
      },
      {
        request: { query },
        result: { data: data3 },
      },
    );

    const observable = queryManager.watchQuery<any>({
      query,
      pollInterval: 200,
      notifyOnNetworkStatusChange: false,
    });

    return observableToPromise(
      { observable },
      result => {
        expect(stripSymbols(result.data)).toEqual(data1);
        observable.refetch();
      },
      result => expect(stripSymbols(result.data)).toEqual(data2),
      result => {
        expect(stripSymbols(result.data)).toEqual(data3);
        observable.stopPolling();
      },
    );
  });

  it('sets networkStatus to `poll` if a polling query is in flight', done => {
    const query = gql`
      {
        people_one(id: 1) {
          name
        }
      }
    `;

    const data1 = {
      people_one: {
        name: 'Luke Skywalker',
      },
    };

    const data2 = {
      people_one: {
        name: 'Luke Skywalker has a new name',
      },
    };

    const data3 = {
      people_one: {
        name: 'Patsy',
      },
    };

    const queryManager = mockQueryManager(
      {
        request: { query },
        result: { data: data1 },
      },
      {
        request: { query },
        result: { data: data2 },
      },
      {
        request: { query },
        result: { data: data3 },
      },
    );

    const observable = queryManager.watchQuery<any>({
      query,
      pollInterval: 30,
      notifyOnNetworkStatusChange: true,
    });

    let counter = 0;
    const handle = observable.subscribe({
      next(result) {
        counter += 1;

        if (counter === 1) {
          expect(result.networkStatus).toBe(NetworkStatus.ready);
        } else if (counter === 2) {
          expect(result.networkStatus).toBe(NetworkStatus.poll);
          handle.unsubscribe();
          done();
        }
      },
    });
  });

  it('supports returnPartialData #193', () => {
    const primeQuery = gql`
      query primeQuery {
        people_one(id: 1) {
          name
        }
      }
    `;

    const complexQuery = gql`
      query complexQuery {
        luke: people_one(id: 1) {
          name
        }
        vader: people_one(id: 4) {
          name
        }
      }
    `;

    const diffedQuery = gql`
      query complexQuery {
        vader: people_one(id: 4) {
          name
        }
      }
    `;

    const data1 = {
      people_one: {
        name: 'Luke Skywalker',
      },
    };

    const data2 = {
      vader: {
        name: 'Darth Vader',
      },
    };

    const queryManager = mockQueryManager(
      {
        request: { query: primeQuery },
        result: { data: data1 },
      },
      {
        request: { query: diffedQuery },
        result: { data: data2 },
        delay: 5,
      },
    );

    // First, prime the store so that query diffing removes the query
    return queryManager
      .query<any>({
        query: primeQuery,
      })
      .then(() => {
        const handle = queryManager.watchQuery<any>({
          query: complexQuery,
          returnPartialData: true,
        });

        return handle.result().then(result => {
          expect(result.data['luke'].name).toBe('Luke Skywalker');
          expect(result.data).not.toHaveProperty('vader');
        });
      });
  });

  it('can handle null values in arrays (#1551)', done => {
    const query = gql`
      {
        list {
          value
        }
      }
    `;
    const data = { list: [null, { value: 1 }] };
    const queryManager = mockQueryManager({
      request: { query },
      result: { data },
    });
    const observable = queryManager.watchQuery({ query });

    observable.subscribe({
      next: result => {
        expect(stripSymbols(result.data)).toEqual(data);
        expect(stripSymbols(observable.getCurrentResult().data)).toEqual(data);
        done();
      },
    });
  });

  it('should error if we pass fetchPolicy = cache-first or cache-only on a polling query', () => {
    assertWithObserver({
      done: () => {},
      observer: {
        next() {},
        error(error) {
          expect(error).toBeInstanceOf(Error);
        },
      },
      query: gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `,
      queryOptions: { pollInterval: 200, fetchPolicy: 'cache-only' },
    });
    assertWithObserver({
      done: () => {},
      observer: {
        next() {
          // done.fail(new Error('Returned a result when it should not have.'));
        },
        error(error) {
          expect(error).toBeInstanceOf(Error);
        },
      },
      query: gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `,
      queryOptions: { pollInterval: 200, fetchPolicy: 'cache-first' },
    });
  });

  it('supports cache-only fetchPolicy fetching only cached data', () => {
    const primeQuery = gql`
      query primeQuery {
        luke: people_one(id: 1) {
          name
        }
      }
    `;

    const complexQuery = gql`
      query complexQuery {
        luke: people_one(id: 1) {
          name
        }
        vader: people_one(id: 4) {
          name
        }
      }
    `;

    const data1 = {
      luke: {
        name: 'Luke Skywalker',
      },
    };

    const queryManager = mockQueryManager({
      request: { query: primeQuery },
      result: { data: data1 },
    });

    // First, prime the cache
    return queryManager
      .query<any>({
        query: primeQuery,
      })
      .then(() => {
        const handle = queryManager.watchQuery<any>({
          query: complexQuery,
          fetchPolicy: 'cache-only',
        });

        return handle.result().then(result => {
          expect(result.data['luke'].name).toBe('Luke Skywalker');
          expect(result.data).not.toHaveProperty('vader');
        });
      });
  });

  it('runs a mutation', () => {
    return assertMutationRoundtrip({
      mutation: gql`
        mutation makeListPrivate {
          makeListPrivate(id: "5")
        }
      `,
      data: { makeListPrivate: true },
    });
  });

  it('runs a mutation even when errors is empty array #2912', () => {
    const errors = [];
    return assertMutationRoundtrip({
      mutation: gql`
        mutation makeListPrivate {
          makeListPrivate(id: "5")
        }
      `,
      errors,
      data: { makeListPrivate: true },
    });
  });

  it('runs a mutation with default errorPolicy equal to "none"', () => {
    const errors = [new GraphQLError('foo')];

    return mockMutation({
      mutation: gql`
        mutation makeListPrivate {
          makeListPrivate(id: "5")
        }
      `,
      errors,
    }).then(
      result => {
        throw new Error(
          'Mutation should not be successful with default errorPolicy',
        );
      },
      error => {
        expect(error.graphQLErrors).toEqual(errors);
      },
    );
  });

  it('runs a mutation with variables', () => {
    return assertMutationRoundtrip({
      mutation: gql`
        mutation makeListPrivate($listId: ID!) {
          makeListPrivate(id: $listId)
        }
      `,
      variables: { listId: '1' },
      data: { makeListPrivate: true },
    });
  });

  const getIdField = ({ id }: { id: string }) => id;

  it('runs a mutation with object parameters and puts the result in the store', () => {
    const data = {
      makeListPrivate: {
        id: '5',
        isPrivate: true,
      },
    };
    return mockMutation({
      mutation: gql`
        mutation makeListPrivate {
          makeListPrivate(input: { id: "5" }) {
            id
            isPrivate
          }
        }
      `,
      data,
      config: { dataIdFromObject: getIdField },
    }).then(({ result, queryManager }) => {
      expect(stripSymbols(result.data)).toEqual(data);

      // Make sure we updated the store with the new data
      expect(
        (queryManager.dataStore.getCache() as InMemoryCache).extract()['5'],
      ).toEqual({
        id: '5',
        isPrivate: true,
      });
    });
  });

  it('runs a mutation and puts the result in the store', () => {
    const data = {
      makeListPrivate: {
        id: '5',
        isPrivate: true,
      },
    };

    return mockMutation({
      mutation: gql`
        mutation makeListPrivate {
          makeListPrivate(id: "5") {
            id
            isPrivate
          }
        }
      `,
      data,
      config: { dataIdFromObject: getIdField },
    }).then(({ result, queryManager }) => {
      expect(stripSymbols(result.data)).toEqual(data);

      // Make sure we updated the store with the new data
      expect(
        (queryManager.dataStore.getCache() as InMemoryCache).extract()['5'],
      ).toEqual({
        id: '5',
        isPrivate: true,
      });
    });
  });

  it('runs a mutation and puts the result in the store with root key', () => {
    const mutation = gql`
      mutation makeListPrivate {
        makeListPrivate(id: "5") {
          id
          isPrivate
        }
      }
    `;

    const data = {
      makeListPrivate: {
        id: '5',
        isPrivate: true,
      },
    };

    const queryManager = createQueryManager({
      link: mockSingleLink({
        request: { query: mutation },
        result: { data },
      }),
      config: { dataIdFromObject: getIdField },
    });

    return queryManager
      .mutate({
        mutation,
      })
      .then(result => {
        expect(stripSymbols(result.data)).toEqual(data);

        // Make sure we updated the store with the new data
        expect(
          (queryManager.dataStore.getCache() as InMemoryCache).extract()['5'],
        ).toEqual({
          id: '5',
          isPrivate: true,
        });
      });
  });

  it(`doesn't return data while query is loading`, () => {
    const query1 = gql`
      {
        people_one(id: 1) {
          name
        }
      }
    `;

    const data1 = {
      people_one: {
        name: 'Luke Skywalker',
      },
    };

    const query2 = gql`
      {
        people_one(id: 5) {
          name
        }
      }
    `;

    const data2 = {
      people_one: {
        name: 'Darth Vader',
      },
    };

    const queryManager = mockQueryManager(
      {
        request: { query: query1 },
        result: { data: data1 },
        delay: 10,
      },
      {
        request: { query: query2 },
        result: { data: data2 },
      },
    );

    const observable1 = queryManager.watchQuery<any>({ query: query1 });
    const observable2 = queryManager.watchQuery<any>({ query: query2 });

    return Promise.all([
      observableToPromise({ observable: observable1 }, result =>
        expect(stripSymbols(result.data)).toEqual(data1),
      ),
      observableToPromise({ observable: observable2 }, result =>
        expect(stripSymbols(result.data)).toEqual(data2),
      ),
    ]);
  });

  it(`updates result of previous query if the result of a new query overlaps`, () => {
    const query1 = gql`
      {
        people_one(id: 1) {
          name
          age
        }
      }
    `;

    const data1 = {
      people_one: {
        name: 'Luke Skywalker',
        age: 50,
      },
    };

    const query2 = gql`
      {
        people_one(id: 1) {
          name
          username
        }
      }
    `;

    const data2 = {
      people_one: {
        name: 'Luke Skywalker has a new name',
        username: 'luke',
      },
    };

    const queryManager = mockQueryManager(
      {
        request: { query: query1 },
        result: { data: data1 },
      },
      {
        request: { query: query2 },
        result: { data: data2 },
        delay: 10,
      },
    );

    const observable = queryManager.watchQuery<any>({ query: query1 });
    return observableToPromise(
      { observable },
      result => {
        expect(stripSymbols(result.data)).toEqual(data1);
        queryManager.query<any>({ query: query2 });
      },
      // 3 because the query init action for the second query causes a callback
      result =>
        expect(stripSymbols(result.data)).toEqual({
          people_one: {
            name: 'Luke Skywalker has a new name',
            age: 50,
          },
        }),
    );
  });

  it('warns if you forget the template literal tag', async () => {
    const queryManager = mockQueryManager();
    expect(() => {
      queryManager.query<any>({
        // Bamboozle TypeScript into letting us do this
        query: ('string' as any) as DocumentNode,
      });
    }).toThrowError(/wrap the query string in a "gql" tag/);

    await expect(
      queryManager.mutate({
        // Bamboozle TypeScript into letting us do this
        mutation: ('string' as any) as DocumentNode,
      }),
    ).rejects.toThrow(/wrap the query string in a "gql" tag/);

    expect(() => {
      queryManager.watchQuery<any>({
        // Bamboozle TypeScript into letting us do this
        query: ('string' as any) as DocumentNode,
      });
    }).toThrowError(/wrap the query string in a "gql" tag/);
  });

  it('should transform queries correctly when given a QueryTransformer', done => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
    const transformedQuery = gql`
      query {
        author {
          firstName
          lastName
          __typename
        }
      }
    `;

    const transformedQueryResult = {
      author: {
        firstName: 'John',
        lastName: 'Smith',
        __typename: 'Author',
      },
    };

    //make sure that the query is transformed within the query
    //manager
    createQueryManager({
      link: mockSingleLink({
        request: { query: transformedQuery },
        result: { data: transformedQueryResult },
      }),
      config: { addTypename: true },
    })
      .query({ query: query })
      .then(result => {
        expect(stripSymbols(result.data)).toEqual(transformedQueryResult);
        done();
      });
  });

  it('should transform mutations correctly', done => {
    const mutation = gql`
      mutation {
        createAuthor(firstName: "John", lastName: "Smith") {
          firstName
          lastName
        }
      }
    `;
    const transformedMutation = gql`
      mutation {
        createAuthor(firstName: "John", lastName: "Smith") {
          firstName
          lastName
          __typename
        }
      }
    `;

    const transformedMutationResult = {
      createAuthor: {
        firstName: 'It works!',
        lastName: 'It works!',
        __typename: 'Author',
      },
    };

    createQueryManager({
      link: mockSingleLink({
        request: { query: transformedMutation },
        result: { data: transformedMutationResult },
      }),
      config: { addTypename: true },
    })
      .mutate({ mutation: mutation })
      .then(result => {
        expect(stripSymbols(result.data)).toEqual(transformedMutationResult);
        done();
      });
  });

  it('should reject a query promise given a network error', done => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
    const networkError = new Error('Network error');
    mockQueryManager({
      request: { query },
      error: networkError,
    })
      .query({ query })
      .then(() => {
        done.fail(new Error('Returned result on an errored fetchQuery'));
      })
      .catch(error => {
        const apolloError = error as ApolloError;

        expect(apolloError.message).toBeDefined();
        expect(apolloError.networkError).toBe(networkError);
        expect(apolloError.graphQLErrors).toEqual([]);
        done();
      })
      .catch(done.fail);
  });

  it('should error when we attempt to give an id beginning with $', done => {
    const query = gql`
      query {
        author {
          firstName
          lastName
          id
          __typename
        }
      }
    `;
    const data = {
      author: {
        firstName: 'John',
        lastName: 'Smith',
        id: '129',
        __typename: 'Author',
      },
    };
    const reducerConfig = {
      dataIdFromObject: (x: any) => '$' + dataIdFromObject(x),
    };
    createQueryManager({
      link: mockSingleLink({
        request: { query },
        result: { data },
      }),
      config: reducerConfig,
    })
      .query({ query })
      .then(() => {
        done.fail(new Error('Returned a result when it should not have.'));
      })
      .catch(() => {
        done();
      });
  });

  it('should reject a query promise given a GraphQL error', () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
    const graphQLErrors = [new Error('GraphQL error')];
    return mockQueryManager({
      request: { query },
      result: { errors: graphQLErrors },
    })
      .query({ query })
      .then(
        () => {
          throw new Error('Returned result on an errored fetchQuery');
        },
        // don't use .catch() for this or it will catch the above error
        error => {
          const apolloError = error as ApolloError;
          expect(apolloError.graphQLErrors).toBe(graphQLErrors);
          expect(!apolloError.networkError).toBeTruthy();
        },
      );
  });

  it('should not empty the store when a non-polling query fails due to a network error', done => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
    const data = {
      author: {
        firstName: 'Dhaivat',
        lastName: 'Pandya',
      },
    };
    const queryManager = mockQueryManager(
      {
        request: { query },
        result: { data },
      },
      {
        request: { query },
        error: new Error('Network error ocurred'),
      },
    );
    queryManager
      .query<any>({ query })
      .then(result => {
        expect(stripSymbols(result.data)).toEqual(data);

        queryManager
          .query<any>({ query, fetchPolicy: 'network-only' })
          .then(() => {
            done.fail(
              new Error('Returned a result when it was not supposed to.'),
            );
          })
          .catch(() => {
            // make that the error thrown doesn't empty the state
            expect(
              (queryManager.dataStore.getCache() as InMemoryCache).extract()[
                '$ROOT_QUERY.author'
              ] as Object,
            ).toEqual(data['author']);
            done();
          });
      })
      .catch(() => {
        done.fail(new Error('Threw an error on the first query.'));
      });
  });

  it('should be able to unsubscribe from a polling query subscription', () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
    const data = {
      author: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };

    const observable = mockQueryManager({
      request: { query },
      result: { data },
    }).watchQuery({ query, pollInterval: 20 });

    const { promise, subscription } = observableToPromiseAndSubscription(
      {
        observable,
        wait: 60,
      },
      (result: any) => {
        expect(stripSymbols(result.data)).toEqual(data);
        subscription.unsubscribe();
      },
    );
    return promise;
  });

  it('should not empty the store when a polling query fails due to a network error', () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
    const data = {
      author: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    const queryManager = mockQueryManager(
      {
        request: { query },
        result: { data },
      },
      {
        request: { query },
        error: new Error('Network error occurred.'),
      },
    );
    const observable = queryManager.watchQuery<any>({
      query,
      pollInterval: 20,
      notifyOnNetworkStatusChange: false,
    });

    return observableToPromise(
      {
        observable,
        errorCallbacks: [
          () => {
            expect(
              (queryManager.dataStore.getCache() as InMemoryCache).extract()[
                '$ROOT_QUERY.author'
              ] as Object,
            ).toEqual(data.author);
          },
        ],
      },
      result => {
        expect(stripSymbols(result.data)).toEqual(data);
        expect((queryManager.dataStore.getCache() as InMemoryCache).extract()[
          '$ROOT_QUERY.author'
        ] as Object).toEqual(data.author);
      },
    );
  });

  it('should not fire next on an observer if there is no change in the result', () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;

    const data = {
      author: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    const queryManager = mockQueryManager(
      {
        request: { query },
        result: { data },
      },
      {
        request: { query },
        result: { data },
      },
    );

    const observable = queryManager.watchQuery<any>({ query });
    return Promise.all<any[] | void>([
      // we wait for a little bit to ensure the result of the second query
      // don't trigger another subscription event
      observableToPromise({ observable, wait: 100 }, result => {
        expect(stripSymbols(result.data)).toEqual(data);
      }),
      queryManager.query<any>({ query }).then(result => {
        expect(stripSymbols(result.data)).toEqual(data);
      }),
    ]);
  });

  it('should store metadata with watched queries', () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;

    const data = {
      author: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    const queryManager = mockQueryManager({
      request: { query },
      result: { data },
    });

    const observable = queryManager.watchQuery({
      query,
      metadata: { foo: 'bar' },
    });
    return observableToPromise({ observable }, result => {
      expect(stripSymbols(result.data)).toEqual(data);
      expect(queryManager.queryStore.get(observable.queryId).metadata).toEqual({
        foo: 'bar',
      });
    });
  });

  it('should return stale data when we orphan a real-id node in the store with a real-id node', () => {
    const query1 = gql`
      query {
        author {
          name {
            firstName
            lastName
          }
          age
          id
          __typename
        }
      }
    `;
    const query2 = gql`
      query {
        author {
          name {
            firstName
          }
          id
          __typename
        }
      }
    `;
    const data1 = {
      author: {
        name: {
          firstName: 'John',
          lastName: 'Smith',
        },
        age: 18,
        id: '187',
        __typename: 'Author',
      },
    };
    const data2 = {
      author: {
        name: {
          firstName: 'John',
        },
        id: '197',
        __typename: 'Author',
      },
    };
    const reducerConfig = { dataIdFromObject };
    const queryManager = createQueryManager({
      link: mockSingleLink(
        {
          request: { query: query1 },
          result: { data: data1 },
        },
        {
          request: { query: query2 },
          result: { data: data2 },
        },
      ),
      config: reducerConfig,
    });

    const observable1 = queryManager.watchQuery<any>({ query: query1 });
    const observable2 = queryManager.watchQuery<any>({ query: query2 });

    // I'm not sure the waiting 60 here really is required, but the test used to do it
    return Promise.all([
      observableToPromise(
        {
          observable: observable1,
          wait: 60,
        },
        result => {
          expect(stripSymbols(result)).toEqual({
            data: data1,
            loading: false,
            networkStatus: NetworkStatus.ready,
            stale: false,
          });
        },
        result => {
          expect(stripSymbols(result)).toEqual({
            data: data1,
            loading: false,
            networkStatus: NetworkStatus.ready,
            stale: true,
          });
        },
      ),
      observableToPromise(
        {
          observable: observable2,
          wait: 60,
        },
        result => {
          expect(stripSymbols(result)).toEqual({
            data: data2,
            loading: false,
            networkStatus: NetworkStatus.ready,
            stale: false,
          });
        },
      ),
    ]);
  });

  it('should return partial data when configured when we orphan a real-id node in the store with a real-id node', () => {
    const query1 = gql`
      query {
        author {
          name {
            firstName
            lastName
          }
          age
          id
          __typename
        }
      }
    `;
    const query2 = gql`
      query {
        author {
          name {
            firstName
          }
          id
          __typename
        }
      }
    `;
    const data1 = {
      author: {
        name: {
          firstName: 'John',
          lastName: 'Smith',
        },
        age: 18,
        id: '187',
        __typename: 'Author',
      },
    };
    const data2 = {
      author: {
        name: {
          firstName: 'John',
        },
        id: '197',
        __typename: 'Author',
      },
    };

    const queryManager = createQueryManager({
      link: mockSingleLink(
        {
          request: { query: query1 },
          result: { data: data1 },
        },
        {
          request: { query: query2 },
          result: { data: data2 },
        },
      ),
    });

    const observable1 = queryManager.watchQuery<any>({
      query: query1,
      returnPartialData: true,
    });
    const observable2 = queryManager.watchQuery<any>({ query: query2 });

    // I'm not sure the waiting 60 here really is required, but the test used to do it
    return Promise.all([
      observableToPromise(
        {
          observable: observable1,
          wait: 60,
        },
        result => {
          expect(result).toEqual({
            data: {},
            loading: true,
            networkStatus: NetworkStatus.loading,
            stale: false,
          });
        },
        result => {
          expect(result).toEqual({
            data: data1,
            loading: false,
            networkStatus: NetworkStatus.ready,
            stale: false,
          });
        },
        result => {
          expect(result).toEqual({
            data: data2,
            loading: false,
            networkStatus: NetworkStatus.ready,
            stale: false,
          });
        },
      ),
      observableToPromise(
        {
          observable: observable2,
          wait: 60,
        },
        result => {
          expect(result).toEqual({
            data: data2,
            loading: false,
            networkStatus: NetworkStatus.ready,
            stale: false,
          });
        },
      ),
    ]);
  });

  it('should error if we replace a real id node in the store with a generated id node', () => {
    const queryWithId = gql`
      query {
        author {
          firstName
          lastName
          __typename
          id
        }
      }
    `;
    const dataWithId = {
      author: {
        firstName: 'John',
        lastName: 'Smith',
        id: '129',
        __typename: 'Author',
      },
    };
    const queryWithoutId = gql`
      query {
        author {
          address
        }
      }
    `;
    const dataWithoutId = {
      author: {
        address: 'fake address',
      },
    };
    const reducerConfig = { dataIdFromObject };
    const queryManager = createQueryManager({
      link: mockSingleLink(
        {
          request: { query: queryWithId },
          result: { data: dataWithId },
        },
        {
          request: { query: queryWithoutId },
          result: { data: dataWithoutId },
        },
      ),
      config: reducerConfig,
    });

    const observableWithId = queryManager.watchQuery<any>({
      query: queryWithId,
    });
    const observableWithoutId = queryManager.watchQuery<any>({
      query: queryWithoutId,
    });

    // I'm not sure the waiting 60 here really is required, but the test used to do it
    return Promise.all([
      observableToPromise({ observable: observableWithId, wait: 60 }, result =>
        expect(stripSymbols(result.data)).toEqual(dataWithId),
      ),
      observableToPromise({
        observable: observableWithoutId,
        errorCallbacks: [error => expect(error.message).toMatch('Store error')],
        wait: 60,
      }),
    ]);
  });

  it('should not error when merging a generated id store node  with a real id node', () => {
    const queryWithoutId = gql`
      query {
        author {
          name {
            firstName
            lastName
          }
          age
          __typename
        }
      }
    `;
    const queryWithId = gql`
      query {
        author {
          name {
            firstName
          }
          id
          __typename
        }
      }
    `;
    const dataWithoutId = {
      author: {
        name: {
          firstName: 'John',
          lastName: 'Smith',
        },
        age: '124',
        __typename: 'Author',
      },
    };
    const dataWithId = {
      author: {
        name: {
          firstName: 'Jane',
        },
        id: '129',
        __typename: 'Author',
      },
    };
    const mergedDataWithoutId = {
      author: {
        name: {
          firstName: 'Jane',
          lastName: 'Smith',
        },
        age: '124',
        __typename: 'Author',
      },
    };
    const queryManager = createQueryManager({
      link: mockSingleLink(
        {
          request: { query: queryWithoutId },
          result: { data: dataWithoutId },
        },
        {
          request: { query: queryWithId },
          result: { data: dataWithId },
        },
      ),
    });

    const observableWithId = queryManager.watchQuery<any>({
      query: queryWithId,
    });
    const observableWithoutId = queryManager.watchQuery<any>({
      query: queryWithoutId,
    });

    // I'm not sure the waiting 60 here really is required, but the test used to do it
    return Promise.all([
      observableToPromise(
        { observable: observableWithoutId, wait: 120 },
        result => expect(stripSymbols(result.data)).toEqual(dataWithoutId),
        result =>
          expect(stripSymbols(result.data)).toEqual(mergedDataWithoutId),
      ),
      observableToPromise({ observable: observableWithId, wait: 120 }, result =>
        expect(stripSymbols(result.data)).toEqual(dataWithId),
      ),
    ]);
  });

  it('exposes errors on a refetch as a rejection', done => {
    const request = {
      query: gql`
        {
          people_one(id: 1) {
            name
          }
        }
      `,
    };
    const firstResult = {
      data: {
        people_one: {
          name: 'Luke Skywalker',
        },
      },
    };
    const secondResult = {
      errors: [
        {
          name: 'PeopleError',
          message: 'This is not the person you are looking for.',
        },
      ],
    };

    const queryManager = mockRefetch({ request, firstResult, secondResult });

    const handle = queryManager.watchQuery<any>(request);

    const checkError = error => {
      expect(error.graphQLErrors).toEqual([
        {
          name: 'PeopleError',
          message: 'This is not the person you are looking for.',
        },
      ]);
    };

    handle.subscribe({
      error: checkError,
    });

    handle
      .refetch()
      .then(() => {
        done.fail(new Error('Error on refetch should reject promise'));
      })
      .catch(error => {
        checkError(error);
        done();
      });

    // We have an unhandled error warning from the `subscribe` above, which has no `error` cb
  });

  it('does not return incomplete data when two queries for the same item are executed', () => {
    const queryA = gql`
      query queryA {
        person(id: "abc") {
          __typename
          id
          firstName
          lastName
        }
      }
    `;
    const queryB = gql`
      query queryB {
        person(id: "abc") {
          __typename
          id
          lastName
          age
        }
      }
    `;
    const dataA = {
      person: {
        __typename: 'Person',
        id: 'abc',
        firstName: 'Luke',
        lastName: 'Skywalker',
      },
    };
    const dataB = {
      person: {
        __typename: 'Person',
        id: 'abc',
        lastName: 'Skywalker',
        age: '32',
      },
    };
    const queryManager = new QueryManager<NormalizedCacheObject>({
      link: mockSingleLink(
        { request: { query: queryA }, result: { data: dataA } },
        { request: { query: queryB }, result: { data: dataB }, delay: 20 },
      ),
      store: new DataStore(new InMemoryCache({})),
      ssrMode: true,
    });

    const observableA = queryManager.watchQuery({
      query: queryA,
    });
    const observableB = queryManager.watchQuery({
      query: queryB,
    });

    return Promise.all([
      observableToPromise({ observable: observableA }, () => {
        expect(
          stripSymbols(queryManager.getCurrentQueryResult(observableA)),
        ).toEqual({
          data: dataA,
          partial: false,
        });
        expect(queryManager.getCurrentQueryResult(observableB)).toEqual({
          data: undefined,
          partial: true,
        });
      }),
      observableToPromise({ observable: observableB }, () => {
        expect(
          stripSymbols(queryManager.getCurrentQueryResult(observableA)),
        ).toEqual({
          data: dataA,
          partial: false,
        });
        expect(queryManager.getCurrentQueryResult(observableB)).toEqual({
          data: dataB,
          partial: false,
        });
      }),
    ]);
  });

  describe('polling queries', () => {
    it('allows you to poll queries', () => {
      const query = gql`
        query fetchLuke($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `;

      const variables = {
        id: '1',
      };

      const data1 = {
        people_one: {
          name: 'Luke Skywalker',
        },
      };

      const data2 = {
        people_one: {
          name: 'Luke Skywalker has a new name',
        },
      };

      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data: data1 },
        },
        {
          request: { query, variables },
          result: { data: data2 },
        },
      );
      const observable = queryManager.watchQuery<any>({
        query,
        variables,
        pollInterval: 50,
        notifyOnNetworkStatusChange: false,
      });

      return observableToPromise(
        { observable },
        result => expect(stripSymbols(result.data)).toEqual(data1),
        result => expect(stripSymbols(result.data)).toEqual(data2),
      );
    });

    it('does not poll during SSR', done => {
      const query = gql`
        query fetchLuke($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `;

      const variables = {
        id: '1',
      };

      const data1 = {
        people_one: {
          name: 'Luke Skywalker',
        },
      };

      const data2 = {
        people_one: {
          name: 'Luke Skywalker has a new name',
        },
      };

      const queryManager = new QueryManager<NormalizedCacheObject>({
        link: mockSingleLink(
          {
            request: { query, variables },
            result: { data: data1 },
          },
          {
            request: { query, variables },
            result: { data: data2 },
          },
          {
            request: { query, variables },
            result: { data: data2 },
          },
        ),
        store: new DataStore(new InMemoryCache({ addTypename: false })),
        ssrMode: true,
      });

      const observable = queryManager.watchQuery<any>({
        query,
        variables,
        pollInterval: 10,
        notifyOnNetworkStatusChange: false,
      });

      let count = 1;
      let doneCalled = false;
      const subHandle = observable.subscribe({
        next: (result: any) => {
          switch (count) {
            case 1:
              expect(stripSymbols(result.data)).toEqual(data1);
              setTimeout(() => {
                subHandle.unsubscribe();
                if (!doneCalled) {
                  done();
                }
              }, 15);
              count++;
              break;
            case 2:
            default:
              doneCalled = true;
              done.fail(new Error('Only expected one result, not multiple'));
          }
        },
      });
    });

    it('should let you handle multiple polled queries and unsubscribe from one of them', done => {
      const query1 = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const query2 = gql`
        query {
          person {
            name
          }
        }
      `;
      const data11 = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const data12 = {
        author: {
          firstName: 'Jack',
          lastName: 'Smith',
        },
      };
      const data13 = {
        author: {
          firstName: 'Jolly',
          lastName: 'Smith',
        },
      };
      const data14 = {
        author: {
          firstName: 'Jared',
          lastName: 'Smith',
        },
      };
      const data21 = {
        person: {
          name: 'Jane Smith',
        },
      };
      const data22 = {
        person: {
          name: 'Josey Smith',
        },
      };
      const queryManager = mockQueryManager(
        {
          request: { query: query1 },
          result: { data: data11 },
        },
        {
          request: { query: query1 },
          result: { data: data12 },
        },
        {
          request: { query: query1 },
          result: { data: data13 },
        },
        {
          request: { query: query1 },
          result: { data: data14 },
        },
        {
          request: { query: query2 },
          result: { data: data21 },
        },
        {
          request: { query: query2 },
          result: { data: data22 },
        },
      );
      let handle1Count = 0;
      let handleCount = 0;
      let setMilestone = false;

      const subscription1 = queryManager
        .watchQuery({
          query: query1,
          pollInterval: 150,
        })
        .subscribe({
          next() {
            handle1Count++;
            handleCount++;
            if (handle1Count > 1 && !setMilestone) {
              subscription1.unsubscribe();
              setMilestone = true;
            }
          },
        });

      const subscription2 = queryManager
        .watchQuery({
          query: query2,
          pollInterval: 2000,
        })
        .subscribe({
          next() {
            handleCount++;
          },
        });

      setTimeout(() => {
        expect(handleCount).toBe(3);
        subscription1.unsubscribe();
        subscription2.unsubscribe();

        done();
      }, 400);
    });

    it('allows you to unsubscribe from polled queries', () => {
      const query = gql`
        query fetchLuke($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `;

      const variables = {
        id: '1',
      };

      const data1 = {
        people_one: {
          name: 'Luke Skywalker',
        },
      };

      const data2 = {
        people_one: {
          name: 'Luke Skywalker has a new name',
        },
      };

      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data: data1 },
        },
        {
          request: { query, variables },
          result: { data: data2 },
        },
      );
      const observable = queryManager.watchQuery({
        query,
        variables,
        pollInterval: 50,
        notifyOnNetworkStatusChange: false,
      });

      const { promise, subscription } = observableToPromiseAndSubscription(
        {
          observable,
          wait: 60,
        },
        result => expect(stripSymbols(result.data)).toEqual(data1),
        result => {
          expect(stripSymbols(result.data)).toEqual(data2);

          // we unsubscribe here manually, rather than waiting for the timeout.
          subscription.unsubscribe();
        },
      );

      return promise;
    });

    it('allows you to unsubscribe from polled query errors', done => {
      const query = gql`
        query fetchLuke($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `;

      const variables = {
        id: '1',
      };

      const data1 = {
        people_one: {
          name: 'Luke Skywalker',
        },
      };

      const data2 = {
        people_one: {
          name: 'Luke Skywalker has a new name',
        },
      };

      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data: data1 },
        },
        {
          request: { query, variables },
          error: new Error('Network error'),
        },
        {
          request: { query, variables },
          result: { data: data2 },
        },
      );

      const observable = queryManager.watchQuery<any>({
        query,
        variables,
        pollInterval: 50,
        notifyOnNetworkStatusChange: false,
      });

      let isFinished;
      process.once('unhandledRejection', () => {
        if (!isFinished) done.fail('unhandledRejection from network');
      });

      const { promise, subscription } = observableToPromiseAndSubscription(
        {
          observable,
          wait: 60,
          errorCallbacks: [
            error => {
              expect(error.message).toMatch('Network error');
              subscription.unsubscribe();
            },
          ],
        },
        result => expect(stripSymbols(result.data)).toEqual(data1),
      );

      promise.then(() => {
        setTimeout(() => {
          isFinished = true;
          done();
        }, 4);
      });
    });

    it('exposes a way to start a polling query', () => {
      const query = gql`
        query fetchLuke($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `;

      const variables = {
        id: '1',
      };

      const data1 = {
        people_one: {
          name: 'Luke Skywalker',
        },
      };

      const data2 = {
        people_one: {
          name: 'Luke Skywalker has a new name',
        },
      };

      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data: data1 },
        },
        {
          request: { query, variables },
          result: { data: data2 },
        },
      );

      const observable = queryManager.watchQuery<any>({
        query,
        variables,
        notifyOnNetworkStatusChange: false,
      });
      observable.startPolling(50);

      return observableToPromise(
        { observable },
        result => expect(stripSymbols(result.data)).toEqual(data1),
        result => expect(stripSymbols(result.data)).toEqual(data2),
      );
    });

    it('exposes a way to stop a polling query', () => {
      const query = gql`
        query fetchLeia($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `;

      const variables = {
        id: '2',
      };

      const data1 = {
        people_one: {
          name: 'Leia Skywalker',
        },
      };

      const data2 = {
        people_one: {
          name: 'Leia Skywalker has a new name',
        },
      };

      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data: data1 },
        },
        {
          request: { query, variables },
          result: { data: data2 },
        },
      );
      const observable = queryManager.watchQuery<any>({
        query,
        variables,
        pollInterval: 50,
      });

      return observableToPromise({ observable, wait: 60 }, result => {
        expect(stripSymbols(result.data)).toEqual(data1);
        observable.stopPolling();
      });
    });

    it('stopped polling queries still get updates', () => {
      const query = gql`
        query fetchLeia($id: String) {
          people_one(id: $id) {
            name
          }
        }
      `;

      const variables = {
        id: '2',
      };

      const data1 = {
        people_one: {
          name: 'Leia Skywalker',
        },
      };

      const data2 = {
        people_one: {
          name: 'Leia Skywalker has a new name',
        },
      };

      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data: data1 },
        },
        {
          request: { query, variables },
          result: { data: data2 },
        },
      );
      const observable = queryManager.watchQuery({
        query,
        variables,
        pollInterval: 50,
      });

      let timeout: Function;
      return Promise.race([
        observableToPromise(
          { observable },
          result => {
            expect(stripSymbols(result.data)).toEqual(data1);
            queryManager
              .query({ query, variables, fetchPolicy: 'network-only' })
              .then(() => timeout(new Error('Should have two results by now')));
          },
          result => expect(stripSymbols(result.data)).toEqual(data2),
        ),
        // Ensure that the observable has recieved 2 results *before*
        // the rejection triggered above
        new Promise((_, reject) => {
          timeout = (error: Error) => reject(error);
        }),
      ]);
    });
  });
  describe('store resets', () => {
    it('returns a promise resolving when all queries have been refetched', () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      const dataChanged = {
        author: {
          firstName: 'John changed',
          lastName: 'Smith',
        },
      };

      const query2 = gql`
        query {
          author2 {
            firstName
            lastName
          }
        }
      `;

      const data2 = {
        author2: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      const data2Changed = {
        author2: {
          firstName: 'John changed',
          lastName: 'Smith',
        },
      };

      const queryManager = createQueryManager({
        link: mockSingleLink(
          {
            request: { query },
            result: { data },
          },
          {
            request: { query: query2 },
            result: { data: data2 },
          },
          {
            request: { query },
            result: { data: dataChanged },
          },
          {
            request: { query: query2 },
            result: { data: data2Changed },
          },
        ),
      });

      const observable = queryManager.watchQuery<any>({ query });
      const observable2 = queryManager.watchQuery<any>({ query: query2 });

      return Promise.all([
        observableToPromise({ observable }, result =>
          expect(stripSymbols(result.data)).toEqual(data),
        ),
        observableToPromise({ observable: observable2 }, result =>
          expect(stripSymbols(result.data)).toEqual(data2),
        ),
      ]).then(() => {
        observable.subscribe({ next: () => null });
        observable2.subscribe({ next: () => null });

        return queryManager.resetStore().then(() => {
          const result = queryManager.getCurrentQueryResult(observable);
          expect(result.partial).toBe(false);
          expect(stripSymbols(result.data)).toEqual(dataChanged);

          const result2 = queryManager.getCurrentQueryResult(observable2);
          expect(result2.partial).toBe(false);
          expect(stripSymbols(result2.data)).toEqual(data2Changed);
        });
      });
    });

    it('should change the store state to an empty state', () => {
      const queryManager = createQueryManager({});

      queryManager.resetStore();

      expect(
        (queryManager.dataStore.getCache() as InMemoryCache).extract(),
      ).toEqual({});
      expect(queryManager.queryStore.getStore()).toEqual({});
      expect(queryManager.mutationStore.getStore()).toEqual({});
    });

    xit('should only refetch once when we store reset', () => {
      let queryManager: QueryManager<NormalizedCacheObject>;
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      const data2 = {
        author: {
          firstName: 'Johnny',
          lastName: 'Smith',
        },
      };

      let timesFired = 0;
      const link: ApolloLink = new ApolloLink(
        op =>
          new Observable(observer => {
            timesFired += 1;
            if (timesFired > 1) {
              observer.next({ data: data2 });
            } else {
              observer.next({ data });
            }
            observer.complete();
            return;
          }),
      );
      queryManager = createQueryManager({ link });
      const observable = queryManager.watchQuery<any>({ query });

      // wait just to make sure the observable doesn't fire again
      return observableToPromise(
        { observable, wait: 0 },
        result => {
          expect(stripSymbols(result.data)).toEqual(data);
          expect(timesFired).toBe(1);
          // reset the store after data has returned
          queryManager.resetStore();
        },
        result => {
          // only refetch once and make sure data has changed
          expect(stripSymbols(result.data)).toEqual(data2);
          expect(timesFired).toBe(2);
        },
      );
    });

    it('should not refetch torn-down queries', done => {
      let queryManager: QueryManager<NormalizedCacheObject>;
      let observable: ObservableQuery<any>;
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      let timesFired = 0;
      const link: ApolloLink = ApolloLink.from([
        () =>
          new Observable(observer => {
            timesFired += 1;
            observer.next({ data });
            return;
          }),
      ]);

      queryManager = createQueryManager({ link });
      observable = queryManager.watchQuery({ query });

      observableToPromise({ observable, wait: 0 }, result =>
        expect(stripSymbols(result.data)).toEqual(data),
      ).then(() => {
        expect(timesFired).toBe(1);

        // at this point the observable query has been torn down
        // because observableToPromise unsubscribe before resolving
        queryManager.resetStore();

        setTimeout(() => {
          expect(timesFired).toBe(1);

          done();
        }, 50);
      });
    });

    it('should not error on queries that are already in the store', () => {
      let queryManager: QueryManager<NormalizedCacheObject>;
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      let timesFired = 0;
      const link = ApolloLink.from([
        new ApolloLink(
          () =>
            new Observable(observer => {
              timesFired += 1;
              observer.next({ data });
              observer.complete();
              return;
            }),
        ),
      ]);
      queryManager = createQueryManager({ link });
      const observable = queryManager.watchQuery<any>({
        query,
        notifyOnNetworkStatusChange: false,
      });

      // wait to make sure store reset happened
      return observableToPromise(
        { observable, wait: 20 },
        result => {
          try {
            expect(stripSymbols(result.data)).toEqual(data);
            expect(timesFired).toBe(1);
          } catch (e) {
            return fail(e);
          }
          setTimeout(async () => {
            try {
              await queryManager.resetStore();
            } catch (e) {
              fail(e);
            }
          }, 10);
        },
        result => {
          try {
            expect(stripSymbols(result.data)).toEqual(data);
            expect(timesFired).toBe(2);
          } catch (e) {
            fail(e);
          }
        },
      );
    });

    it('should not error on a stopped query()', done => {
      let queryManager: QueryManager<NormalizedCacheObject>;
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      const link = new ApolloLink(
        () =>
          new Observable(observer => {
            observer.next({ data });
          }),
      );

      queryManager = createQueryManager({ link });

      const queryId = '1';
      queryManager
        .fetchQuery(queryId, { query })
        .catch(e => done.fail('Exception thrown for stopped query'));

      queryManager.removeQuery(queryId);
      queryManager.resetStore().then(() => done());
    });

    it('should throw an error on an inflight fetch query if the store is reset', done => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const queryManager = mockQueryManager({
        request: { query },
        result: { data },
        delay: 10000, //i.e. forever
      });
      queryManager
        .fetchQuery('made up id', { query })
        .then(() => {
          done.fail(new Error('Returned a result.'));
        })
        .catch(error => {
          expect(error.message).toMatch('Store reset');
          done();
        });
      queryManager.resetStore();
    });

    it('should call refetch on a mocked Observable if the store is reset', done => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const queryManager = mockQueryManager();

      const mockObservableQuery: ObservableQuery<any> = ({
        refetch(_: any): Promise<ExecutionResult> {
          done();
          return null as never;
        },
        options: {
          query: query,
        },
        scheduler: queryManager.scheduler,
        resetLastResults: jest.fn(() => {}),
      } as any) as ObservableQuery<any>;

      const queryId = 'super-fake-id';
      queryManager.addObservableQuery<any>(queryId, mockObservableQuery);
      queryManager.resetStore();
    });

    it('should not call refetch on a cache-only Observable if the store is reset', done => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const queryManager = createQueryManager({});
      const options = assign({}) as WatchQueryOptions;
      options.fetchPolicy = 'cache-only';
      options.query = query;
      let refetchCount = 0;
      const mockObservableQuery: ObservableQuery<any> = ({
        refetch(_: any): Promise<ExecutionResult> {
          refetchCount++;
          return null as never;
        },
        options,
        queryManager: queryManager,

        resetLastResults: jest.fn(() => {}),
      } as any) as ObservableQuery<any>;

      const queryId = 'super-fake-id';
      queryManager.addObservableQuery<any>(queryId, mockObservableQuery);
      queryManager.resetStore();
      setTimeout(() => {
        expect(refetchCount).toEqual(0);
        done();
      }, 50);
    });

    it('should not call refetch on a standby Observable if the store is reset', done => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const queryManager = createQueryManager({});
      const options = assign({}) as WatchQueryOptions;
      options.fetchPolicy = 'standby';
      options.query = query;
      let refetchCount = 0;
      const mockObservableQuery: ObservableQuery<any> = ({
        refetch(_: any): Promise<ExecutionResult> {
          refetchCount++;
          return null as never;
        },
        options,
        queryManager: queryManager,

        resetLastResults: jest.fn(() => {}),
      } as any) as ObservableQuery<any>;

      const queryId = 'super-fake-id';
      queryManager.addObservableQuery<any>(queryId, mockObservableQuery);
      queryManager.resetStore();
      setTimeout(() => {
        expect(refetchCount).toEqual(0);
        done();
      }, 50);
    });

    it('should throw an error on an inflight query() if the store is reset', done => {
      let queryManager: QueryManager<NormalizedCacheObject>;
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const link = new ApolloLink(
        () =>
          new Observable(observer => {
            // reset the store as soon as we hear about the query
            queryManager.resetStore();
            observer.next({ data });
            return;
          }),
      );

      queryManager = createQueryManager({ link });
      queryManager
        .query<any>({ query })
        .then(() => {
          done.fail(new Error('query() gave results on a store reset'));
        })
        .catch(() => {
          done();
        });
    });
  });
  describe('refetching observed queries', () => {
    it('returns a promise resolving when all queries have been refetched', () => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      const dataChanged = {
        author: {
          firstName: 'John changed',
          lastName: 'Smith',
        },
      };

      const query2 = gql`
        query {
          author2 {
            firstName
            lastName
          }
        }
      `;

      const data2 = {
        author2: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      const data2Changed = {
        author2: {
          firstName: 'John changed',
          lastName: 'Smith',
        },
      };

      const queryManager = createQueryManager({
        link: mockSingleLink(
          {
            request: { query },
            result: { data },
          },
          {
            request: { query: query2 },
            result: { data: data2 },
          },
          {
            request: { query },
            result: { data: dataChanged },
          },
          {
            request: { query: query2 },
            result: { data: data2Changed },
          },
        ),
      });

      const observable = queryManager.watchQuery<any>({ query });
      const observable2 = queryManager.watchQuery<any>({ query: query2 });

      return Promise.all([
        observableToPromise({ observable }, result =>
          expect(stripSymbols(result.data)).toEqual(data),
        ),
        observableToPromise({ observable: observable2 }, result =>
          expect(stripSymbols(result.data)).toEqual(data2),
        ),
      ]).then(() => {
        observable.subscribe({ next: () => null });
        observable2.subscribe({ next: () => null });

        return queryManager.reFetchObservableQueries().then(() => {
          const result = queryManager.getCurrentQueryResult(observable);
          expect(result.partial).toBe(false);
          expect(stripSymbols(result.data)).toEqual(dataChanged);

          const result2 = queryManager.getCurrentQueryResult(observable2);
          expect(result2.partial).toBe(false);
          expect(stripSymbols(result2.data)).toEqual(data2Changed);
        });
      });
    });

    it('should only refetch once when we refetch observable queries', done => {
      let queryManager: QueryManager<NormalizedCacheObject>;
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      const data2 = {
        author: {
          firstName: 'Johnny',
          lastName: 'Smith',
        },
      };

      let timesFired = 0;
      const link: ApolloLink = new ApolloLink(
        op =>
          new Observable(observer => {
            timesFired += 1;
            if (timesFired > 1) {
              observer.next({ data: data2 });
            } else {
              observer.next({ data });
            }
            observer.complete();
            return;
          }),
      );
      queryManager = createQueryManager({ link });
      const observable = queryManager.watchQuery<any>({ query });

      // wait just to make sure the observable doesn't fire again
      return observableToPromise(
        { observable, wait: 0 },
        result => {
          expect(stripSymbols(result.data)).toEqual(data);
          expect(timesFired).toBe(1);
          // refetch the observed queries after data has returned
          queryManager.reFetchObservableQueries();
        },
        result => {
          // only refetch once and make sure data has changed
          expect(stripSymbols(result.data)).toEqual(data2);
          expect(timesFired).toBe(2);
          done();
        },
      ).catch(e => {
        done.fail(e);
      });
    });

    it('should not refetch torn-down queries', done => {
      let queryManager: QueryManager<NormalizedCacheObject>;
      let observable: ObservableQuery<any>;
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      let timesFired = 0;
      const link: ApolloLink = ApolloLink.from([
        () =>
          new Observable(observer => {
            timesFired += 1;
            observer.next({ data });
            return;
          }),
      ]);

      queryManager = createQueryManager({ link });
      observable = queryManager.watchQuery({ query });

      observableToPromise({ observable, wait: 0 }, result =>
        expect(stripSymbols(result.data)).toEqual(data),
      ).then(() => {
        expect(timesFired).toBe(1);

        // at this point the observable query has been torn down
        // because observableToPromise unsubscribe before resolving
        queryManager.reFetchObservableQueries();

        setTimeout(() => {
          expect(timesFired).toBe(1);

          done();
        }, 50);
      });
    });

    it('should not error on queries that are already in the store', () => {
      let queryManager: QueryManager<NormalizedCacheObject>;
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      let timesFired = 0;
      const link = ApolloLink.from([
        () =>
          new Observable(observer => {
            timesFired += 1;
            observer.next({ data });
            return;
          }),
      ]);
      queryManager = createQueryManager({ link });
      const observable = queryManager.watchQuery<any>({
        query,
        notifyOnNetworkStatusChange: false,
      });

      // wait to make sure store reset happened
      return observableToPromise(
        { observable, wait: 20 },
        result => {
          expect(stripSymbols(result.data)).toEqual(data);
          expect(timesFired).toBe(1);
          setTimeout(
            queryManager.reFetchObservableQueries.bind(queryManager),
            10,
          );
        },
        result => {
          expect(stripSymbols(result.data)).toEqual(data);
          expect(timesFired).toBe(2);
        },
      );
    });

    it('should NOT throw an error on an inflight fetch query if the observable queries are refetched', done => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const queryManager = mockQueryManager({
        request: { query },
        result: { data },
        delay: 100,
      });
      queryManager
        .fetchQuery('made up id', { query })
        .then(() => {
          done();
        })
        .catch(error => {
          done.fail(new Error('Should not return an error'));
        });
      queryManager.reFetchObservableQueries();
    });

    it('should call refetch on a mocked Observable if the observed queries are refetched', done => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const queryManager = mockQueryManager();

      const mockObservableQuery: ObservableQuery<any> = ({
        refetch(_: any): Promise<ExecutionResult> {
          done();
          return null as never;
        },
        options: {
          query: query,
        },
        scheduler: queryManager.scheduler,
        resetLastResults: jest.fn(() => {}),
      } as any) as ObservableQuery<any>;

      const queryId = 'super-fake-id';
      queryManager.addObservableQuery<any>(queryId, mockObservableQuery);
      queryManager.reFetchObservableQueries();
    });

    it('should not call refetch on a cache-only Observable if the observed queries are refetched', done => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const queryManager = createQueryManager({});
      const options = assign({}) as WatchQueryOptions;
      options.fetchPolicy = 'cache-only';
      options.query = query;
      let refetchCount = 0;
      const mockObservableQuery: ObservableQuery<any> = ({
        refetch(_: any): Promise<ExecutionResult> {
          refetchCount++;
          return null as never;
        },
        options,
        queryManager: queryManager,

        resetLastResults: jest.fn(() => {}),
      } as any) as ObservableQuery<any>;

      const queryId = 'super-fake-id';
      queryManager.addObservableQuery<any>(queryId, mockObservableQuery);
      queryManager.reFetchObservableQueries();
      setTimeout(() => {
        expect(refetchCount).toEqual(0);
        done();
      }, 50);
    });

    it('should not call refetch on a standby Observable if the observed queries are refetched', done => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const queryManager = createQueryManager({});
      const options = assign({}) as WatchQueryOptions;
      options.fetchPolicy = 'standby';
      options.query = query;
      let refetchCount = 0;
      const mockObservableQuery: ObservableQuery<any> = ({
        refetch(_: any): Promise<ExecutionResult> {
          refetchCount++;
          return null as never;
        },
        options,
        queryManager: queryManager,

        resetLastResults: jest.fn(() => {}),
      } as any) as ObservableQuery<any>;

      const queryId = 'super-fake-id';
      queryManager.addObservableQuery<any>(queryId, mockObservableQuery);
      queryManager.reFetchObservableQueries();
      setTimeout(() => {
        expect(refetchCount).toEqual(0);
        done();
      }, 50);
    });

    it('should refetch on a standby Observable if the observed queries are refetched and the includeStandby parameter is set to true', done => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const queryManager = createQueryManager({});
      const options = assign({}) as WatchQueryOptions;
      options.fetchPolicy = 'standby';
      options.query = query;
      let refetchCount = 0;
      const mockObservableQuery: ObservableQuery<any> = ({
        refetch(_: any): Promise<ExecutionResult> {
          refetchCount++;
          return null as never;
        },
        options,
        queryManager: queryManager,

        resetLastResults: jest.fn(() => {}),
      } as any) as ObservableQuery<any>;

      const queryId = 'super-fake-id';
      queryManager.addObservableQuery<any>(queryId, mockObservableQuery);
      const includeStandBy = true;
      queryManager.reFetchObservableQueries(includeStandBy);
      setTimeout(() => {
        expect(refetchCount).toEqual(1);
        done();
      }, 50);
    });

    it('should NOT throw an error on an inflight query() if the observed queries are refetched', done => {
      let queryManager: QueryManager<NormalizedCacheObject>;
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const link = new ApolloLink(
        () =>
          new Observable(observer => {
            // refetch observed queries as soon as we hear about the query
            queryManager.reFetchObservableQueries();
            observer.next({ data });
            return;
          }),
      );

      queryManager = createQueryManager({ link });
      queryManager
        .query<any>({ query })
        .then(() => {
          done();
        })
        .catch(e => {
          done.fail(
            new Error(
              'query() should not throw error when refetching observed queriest',
            ),
          );
        });
    });
  });
  describe('loading state', () => {
    it('should be passed as false if we are not watching a query', () => {
      const query = gql`
        query {
          fortuneCookie
        }
      `;
      const data = {
        fortuneCookie: 'Buy it',
      };
      return mockQueryManager({
        request: { query },
        result: { data },
      })
        .query({ query })
        .then(result => {
          expect(!result.loading).toBeTruthy();
          expect(stripSymbols(result.data)).toEqual(data);
        });
    });

    it('should be passed to the observer as true if we are returning partial data', () => {
      const fortuneCookie =
        'You must stick to your goal but rethink your approach';
      const primeQuery = gql`
        query {
          fortuneCookie
        }
      `;
      const primeData = { fortuneCookie };

      const author = { name: 'John' };
      const query = gql`
        query {
          fortuneCookie
          author {
            name
          }
        }
      `;
      const fullData = { fortuneCookie, author };

      const queryManager = mockQueryManager(
        {
          request: { query },
          result: { data: fullData },
          delay: 5,
        },
        {
          request: { query: primeQuery },
          result: { data: primeData },
        },
      );

      return queryManager
        .query<any>({ query: primeQuery })
        .then(primeResult => {
          const observable = queryManager.watchQuery<any>({
            query,
            returnPartialData: true,
          });

          return observableToPromise(
            { observable },
            result => {
              expect(result.loading).toBe(true);
              expect(result.data).toEqual(primeData);
            },
            result => {
              expect(result.loading).toBe(false);
              expect(result.data).toEqual(fullData);
            },
          );
        });
    });

    it('should be passed to the observer as false if we are returning all the data', done => {
      assertWithObserver({
        done,
        query: gql`
          query {
            author {
              firstName
              lastName
            }
          }
        `,
        result: {
          data: {
            author: {
              firstName: 'John',
              lastName: 'Smith',
            },
          },
        },
        observer: {
          next(result) {
            expect(!result.loading).toBeTruthy();
            done();
          },
        },
      });
    });

    it('will update on `resetStore`', done => {
      const testQuery = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const data1 = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const data2 = {
        author: {
          firstName: 'John',
          lastName: 'Smith 2',
        },
      };
      const queryManager = mockQueryManager(
        {
          request: { query: testQuery },
          result: { data: data1 },
        },
        {
          request: { query: testQuery },
          result: { data: data2 },
        },
      );
      let count = 0;

      queryManager
        .watchQuery({
          query: testQuery,
          notifyOnNetworkStatusChange: false,
        })
        .subscribe({
          next: result => {
            switch (count++) {
              case 0:
                expect(result.loading).toBe(false);
                expect(stripSymbols(result.data)).toEqual(data1);
                setTimeout(() => {
                  queryManager.resetStore();
                }, 0);
                break;
              case 1:
                expect(result.loading).toBe(false);
                expect(stripSymbols(result.data)).toEqual(data2);
                done();
                break;
              default:
                done.fail(new Error('`next` was called to many times.'));
            }
          },
          error: error => done.fail(error),
        });
    });

    it('will be true when partial data may be returned', done => {
      const query1 = gql`{
        a { x1 y1 z1 }
      }`;
      const query2 = gql`{
        a { x1 y1 z1 }
        b { x2 y2 z2 }
      }`;
      const data1 = {
        a: { x1: 1, y1: 2, z1: 3 },
      };
      const data2 = {
        a: { x1: 1, y1: 2, z1: 3 },
        b: { x2: 3, y2: 2, z2: 1 },
      };
      const queryManager = mockQueryManager(
        {
          request: { query: query1 },
          result: { data: data1 },
        },
        {
          request: { query: query2 },
          result: { data: data2 },
          delay: 5,
        },
      );

      queryManager
        .query({ query: query1 })
        .then(result1 => {
          expect(result1.loading).toBe(false);
          expect(result1.data).toEqual(data1);

          let count = 0;
          queryManager
            .watchQuery({ query: query2, returnPartialData: true })
            .subscribe({
              next: result2 => {
                switch (count++) {
                  case 0:
                    expect(result2.loading).toBe(true);
                    expect(result2.data).toEqual(data1);
                    break;
                  case 1:
                    expect(result2.loading).toBe(false);
                    expect(result2.data).toEqual(data2);
                    done();
                    break;
                  default:
                    done(new Error('`next` was called to many times.'));
                }
              },
              error: error => done(error),
            });
        })
        .catch(done);
    });
  });

  describe('refetchQueries', () => {
    const oldWarn = console.warn;
    let warned: any;
    let timesWarned = 0;

    beforeEach(done => {
      // clear warnings
      warned = null;
      timesWarned = 0;
      // mock warn method
      console.warn = (...args: any[]) => {
        warned = args;
        timesWarned++;
      };
      done();
    });

    it('should refetch the right query when a result is successfully returned', () => {
      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }
      `;
      const mutationData = {
        changeAuthorName: {
          firstName: 'Jack',
          lastName: 'Smith',
        },
      };
      const query = gql`
        query getAuthors($id: ID!) {
          author(id: $id) {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const secondReqData = {
        author: {
          firstName: 'Jane',
          lastName: 'Johnson',
        },
      };
      const variables = { id: '1234' };
      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data },
        },
        {
          request: { query, variables },
          result: { data: secondReqData },
        },
        {
          request: { query: mutation },
          result: { data: mutationData },
        },
      );
      const observable = queryManager.watchQuery<any>({
        query,
        variables,
        notifyOnNetworkStatusChange: false,
      });
      return observableToPromise(
        { observable },
        result => {
          expect(stripSymbols(result.data)).toEqual(data);
          queryManager.mutate({ mutation, refetchQueries: ['getAuthors'] });
        },
        result => {
          expect(stripSymbols(observable.getCurrentResult().data)).toEqual(
            secondReqData,
          );
          expect(stripSymbols(result.data)).toEqual(secondReqData);
        },
      );
    });

    it('should not warn and continue when an unknown query name is asked to refetch', () => {
      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }
      `;
      const mutationData = {
        changeAuthorName: {
          firstName: 'Jack',
          lastName: 'Smith',
        },
      };
      const query = gql`
        query getAuthors {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const secondReqData = {
        author: {
          firstName: 'Jane',
          lastName: 'Johnson',
        },
      };
      const queryManager = mockQueryManager(
        {
          request: { query },
          result: { data },
        },
        {
          request: { query },
          result: { data: secondReqData },
        },
        {
          request: { query: mutation },
          result: { data: mutationData },
        },
      );
      const observable = queryManager.watchQuery<any>({
        query,
        notifyOnNetworkStatusChange: false,
      });
      return observableToPromise(
        { observable },
        result => {
          expect(stripSymbols(result.data)).toEqual(data);
          queryManager.mutate({
            mutation,
            refetchQueries: ['fakeQuery', 'getAuthors'],
          });
        },
        result => {
          expect(stripSymbols(result.data)).toEqual(secondReqData);
          expect(timesWarned).toBe(0);
        },
      );
    });

    it('should ignore without warning a query name that is asked to refetch with no active subscriptions', () => {
      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }
      `;
      const mutationData = {
        changeAuthorName: {
          firstName: 'Jack',
          lastName: 'Smith',
        },
      };
      const query = gql`
        query getAuthors {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const secondReqData = {
        author: {
          firstName: 'Jane',
          lastName: 'Johnson',
        },
      };
      const queryManager = mockQueryManager(
        {
          request: { query },
          result: { data },
        },
        {
          request: { query },
          result: { data: secondReqData },
        },
        {
          request: { query: mutation },
          result: { data: mutationData },
        },
      );

      const observable = queryManager.watchQuery<any>({ query });
      return observableToPromise({ observable }, result => {
        expect(stripSymbols(result.data)).toEqual(data);
      })
        .then(() => {
          // The subscription has been stopped already
          return queryManager.mutate({
            mutation,
            refetchQueries: ['getAuthors'],
          });
        })
        .then(() => expect(timesWarned).toBe(0));
    });

    it('also works with a query document and variables', done => {
      const mutation = gql`
        mutation changeAuthorName($id: ID!) {
          changeAuthorName(newName: "Jack Smith", id: $id) {
            firstName
            lastName
          }
        }
      `;
      const mutationData = {
        changeAuthorName: {
          firstName: 'Jack',
          lastName: 'Smith',
        },
      };
      const query = gql`
        query getAuthors($id: ID!) {
          author(id: $id) {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const secondReqData = {
        author: {
          firstName: 'Jane',
          lastName: 'Johnson',
        },
      };

      const variables = { id: '1234' };
      const mutationVariables = { id: '2345' };
      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data },
          delay: 10,
        },
        {
          request: { query, variables },
          result: { data: secondReqData },
          delay: 100,
        },
        {
          request: { query: mutation, variables: mutationVariables },
          result: { data: mutationData },
          delay: 10,
        },
      );
      const observable = queryManager.watchQuery<any>({ query, variables });
      let count = 0;
      observable.subscribe({
        next: result => {
          const resultData = stripSymbols(result.data);
          if (count === 0) {
            expect(resultData).toEqual(data);
            queryManager.mutate({
              mutation,
              variables: mutationVariables,
              refetchQueries: [{ query, variables }],
            });
          }
          if (count === 1) {
            setTimeout(() => {
              expect(stripSymbols(observable.getCurrentResult().data)).toEqual(
                secondReqData,
              );
              done();
            }, 1);

            expect(resultData).toEqual(secondReqData);
          }

          count++;
        },
      });
    });

    it('also works with a conditional function that returns false', () => {
      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }
      `;
      const mutationData = {
        changeAuthorName: {
          firstName: 'Jack',
          lastName: 'Smith',
        },
      };
      const query = gql`
        query getAuthors {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const secondReqData = {
        author: {
          firstName: 'Jane',
          lastName: 'Johnson',
        },
      };
      const queryManager = mockQueryManager(
        {
          request: { query },
          result: { data },
        },
        {
          request: { query },
          result: { data: secondReqData },
        },
        {
          request: { query: mutation },
          result: { data: mutationData },
        },
      );
      const observable = queryManager.watchQuery<any>({ query });
      const conditional = result => {
        expect(stripSymbols(result.data)).toEqual(mutationData);
        return false;
      };

      return observableToPromise({ observable }, result => {
        expect(stripSymbols(result.data)).toEqual(data);
        queryManager.mutate({ mutation, refetchQueries: conditional });
      });
    });
    it('also works with a conditional function that returns an array of refetches', () => {
      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }
      `;
      const mutationData = {
        changeAuthorName: {
          firstName: 'Jack',
          lastName: 'Smith',
        },
      };
      const query = gql`
        query getAuthors {
          author {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const secondReqData = {
        author: {
          firstName: 'Jane',
          lastName: 'Johnson',
        },
      };
      const queryManager = mockQueryManager(
        {
          request: { query },
          result: { data },
        },
        {
          request: { query },
          result: { data: secondReqData },
        },
        {
          request: { query: mutation },
          result: { data: mutationData },
        },
      );
      const observable = queryManager.watchQuery<any>({ query });
      const conditional = result => {
        expect(stripSymbols(result.data)).toEqual(mutationData);
        return [{ query }];
      };

      return observableToPromise(
        { observable },
        result => {
          expect(stripSymbols(result.data)).toEqual(data);
          queryManager.mutate({ mutation, refetchQueries: conditional });
        },
        result => expect(stripSymbols(result.data)).toEqual(secondReqData),
      );
    });

    it('should refetch using the original query context (if any)', () => {
      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }
      `;
      const mutationData = {
        changeAuthorName: {
          firstName: 'Jack',
          lastName: 'Smith',
        },
      };
      const query = gql`
        query getAuthors($id: ID!) {
          author(id: $id) {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const secondReqData = {
        author: {
          firstName: 'Jane',
          lastName: 'Johnson',
        },
      };
      const variables = { id: '1234' };
      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data },
        },
        {
          request: { query, variables },
          result: { data: secondReqData },
        },
        {
          request: { query: mutation },
          result: { data: mutationData },
        },
      );

      const headers = {
        someHeader: 'some value',
      };
      const observable = queryManager.watchQuery<any>({
        query,
        variables,
        context: {
          headers,
        },
        notifyOnNetworkStatusChange: false,
      });

      return observableToPromise(
        { observable },
        result => {
          queryManager.mutate({
            mutation,
            refetchQueries: ['getAuthors'],
          });
        },
        result => {
          const context = queryManager.link.operation.getContext();
          expect(context.headers).not.toBeUndefined();
          expect(context.headers.someHeader).toEqual(headers.someHeader);
        },
      );
    });

    it('should refetch using the specified context, if provided', () => {
      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }
      `;
      const mutationData = {
        changeAuthorName: {
          firstName: 'Jack',
          lastName: 'Smith',
        },
      };
      const query = gql`
        query getAuthors($id: ID!) {
          author(id: $id) {
            firstName
            lastName
          }
        }
      `;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const secondReqData = {
        author: {
          firstName: 'Jane',
          lastName: 'Johnson',
        },
      };
      const variables = { id: '1234' };
      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data },
        },
        {
          request: { query, variables },
          result: { data: secondReqData },
        },
        {
          request: { query: mutation },
          result: { data: mutationData },
        },
      );

      const observable = queryManager.watchQuery<any>({
        query,
        variables,
        notifyOnNetworkStatusChange: false,
      });

      const headers = {
        someHeader: 'some value',
      };

      return observableToPromise(
        { observable },
        result => {
          queryManager.mutate({
            mutation,
            refetchQueries: [
              {
                query,
                variables,
                context: {
                  headers,
                },
              },
            ],
          });
        },
        result => {
          const context = queryManager.link.operation.getContext();
          expect(context.headers).not.toBeUndefined();
          expect(context.headers.someHeader).toEqual(headers.someHeader);
        },
      );
    });

    afterEach(done => {
      // restore standard method
      console.warn = oldWarn;
      done();
    });
  });

  describe('awaitRefetchQueries', () => {
    function awaitRefetchTest({ awaitRefetchQueries }) {
      const query = gql`
        query getAuthors($id: ID!) {
          author(id: $id) {
            firstName
            lastName
          }
        }
      `;

      const queryData = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }
      `;

      const mutationData = {
        changeAuthorName: {
          firstName: 'Jack',
          lastName: 'Smith',
        },
      };

      const secondReqData = {
        author: {
          firstName: 'Jane',
          lastName: 'Johnson',
        },
      };

      const variables = { id: '1234' };

      const queryManager = mockQueryManager(
        {
          request: { query, variables },
          result: { data: queryData },
        },
        {
          request: { query: mutation },
          result: { data: mutationData },
        },
        {
          request: { query, variables },
          result: { data: secondReqData },
        },
      );

      const observable = queryManager.watchQuery<any>({
        query,
        variables,
        notifyOnNetworkStatusChange: false,
      });

      let mutationComplete = false;
      return observableToPromise(
        { observable },
        result => {
          expect(stripSymbols(result.data)).toEqual(queryData);
          const mutateOptions = {
            mutation,
            refetchQueries: ['getAuthors'],
          };
          if (awaitRefetchQueries) {
            mutateOptions.awaitRefetchQueries = awaitRefetchQueries;
          }
          queryManager.mutate(mutateOptions).then(() => {
            mutationComplete = true;
          });
        },
        result => {
          if (awaitRefetchQueries) {
            expect(mutationComplete).not.toBeTruthy();
          } else {
            expect(mutationComplete).toBeTruthy();
          }
          expect(stripSymbols(observable.getCurrentResult().data)).toEqual(
            secondReqData,
          );
          expect(stripSymbols(result.data)).toEqual(secondReqData);
        },
      );
    }

    it(
      'should not wait for `refetchQueries` to complete before resolving ' +
        'the mutation, when `awaitRefetchQueries` is falsy',
      () => {
        awaitRefetchTest({ awaitRefetchQueries: undefined });
        awaitRefetchTest({ awaitRefetchQueries: false });
      },
    );

    it(
      'should wait for `refetchQueries` to complete before resolving ' +
        'the mutation, when `awaitRefetchQueries` is `true`',
      () => {
        awaitRefetchTest({ awaitRefetchQueries: true });
      },
    );
  });

  describe('store watchers', () => {
    it('does not fill up the store on resolved queries', () => {
      const query1 = gql`
        query One {
          one
        }
      `;
      const query2 = gql`
        query Two {
          two
        }
      `;
      const query3 = gql`
        query Three {
          three
        }
      `;
      const query4 = gql`
        query Four {
          four
        }
      `;

      const link = mockSingleLink(
        { request: { query: query1 }, result: { data: { one: 1 } } },
        { request: { query: query2 }, result: { data: { two: 2 } } },
        { request: { query: query3 }, result: { data: { three: 3 } } },
        { request: { query: query4 }, result: { data: { four: 4 } } },
      );
      const cache = new InMemoryCache();

      const queryManager = new QueryManager<NormalizedCacheObject>({
        link,
        store: new DataStore(cache),
      });

      return queryManager
        .query({ query: query1 })
        .then(one => {
          return queryManager.query({ query: query2 });
        })
        .then(() => {
          return queryManager.query({ query: query3 });
        })
        .then(() => {
          return queryManager.query({ query: query4 });
        })
        .then(() => {
          return new Promise(r => {
            setTimeout(r, 10);
          });
        })
        .then(() => {
          expect(cache.watches.size).toBe(0);
        });
    });
  });

  describe('`no-cache` handling', () => {
    it(
      'should return a query result (if one exists) when a `no-cache` ' +
        'fetch policy is used',
      done => {
        const query = gql`
          query {
            author {
              firstName
              lastName
            }
          }
        `;

        const data = {
          author: {
            firstName: 'John',
            lastName: 'Smith',
          },
        };

        const queryManager = createQueryManager({
          link: mockSingleLink({
            request: { query },
            result: { data },
          }),
        });

        const observable = queryManager.watchQuery<any>({
          query,
          fetchPolicy: 'no-cache',
        });
        observableToPromise({ observable }, result => {
          expect(stripSymbols(result.data)).toEqual(data);
          const currentResult = queryManager.getCurrentQueryResult(observable);
          expect(currentResult.data).toEqual(data);
          done();
        });
      },
    );
  });

  describe('client awareness', () => {
    it('should pass client awareness settings into the link chain via context', done => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      const link = mockSingleLink({
        request: { query },
        result: { data },
      });

      const clientAwareness = {
        name: 'Test',
        version: '1.0.0',
      };

      const queryManager = createQueryManager({
        link,
        clientAwareness,
      });

      const observable = queryManager.watchQuery<any>({
        query,
        fetchPolicy: 'no-cache',
      });

      observableToPromise({ observable }, result => {
        const context = link.operation.getContext();
        expect(context.clientAwareness).toBeDefined();
        expect(context.clientAwareness).toEqual(clientAwareness);
        done();
      });
    });
  });
});
