import {
  QueryManager,
} from '../src/core/QueryManager';

import mockQueryManager from './mocks/mockQueryManager';

import mockWatchQuery from './mocks/mockWatchQuery';

import { ObservableQuery } from '../src/core/ObservableQuery';

import { WatchQueryOptions } from '../src/core/watchQueryOptions';

import {
  createApolloStore,
  ApolloStore,
} from '../src/store';

import gql from 'graphql-tag';

import {
  assert,
} from 'chai';

import {
  DocumentNode,
  ExecutionResult,
} from 'graphql';

import ApolloClient, {
  ApolloStateSelector,
} from '../src/ApolloClient';

import {
  ApolloQueryResult,
} from '../src/core/types';

import { createStore, combineReducers, applyMiddleware } from 'redux';

import * as Rx from 'rxjs';

import { assign } from 'lodash';

import mockNetworkInterface, {
  ParsedRequest,
} from './mocks/mockNetworkInterface';

import {
  NetworkInterface,
} from '../src/transport/networkInterface';

import {
  ApolloError,
} from '../src/errors/ApolloError';

import {
  Observer,
} from '../src/util/Observable';

import { NetworkStatus } from '../src/queries/networkStatus';

import wrap, { withWarning } from './util/wrap';

import observableToPromise, {
  observableToPromiseAndSubscription,
} from './util/observableToPromise';

describe('QueryManager', () => {

  // Standard "get id from object" method.
  const dataIdFromObject = (object: any) => {
    if (object.__typename && object.id) {
      return object.__typename + '__' + object.id;
    }
    return undefined;
  };

  const defaultReduxRootSelector = (state: any) => state.apollo;

  // Helper method that serves as the constructor method for
  // QueryManager but has defaults that make sense for these
  // tests.
  const createQueryManager = ({
    networkInterface,
    store,
    reduxRootSelector,
    addTypename = false,
  }: {
    networkInterface?: NetworkInterface,
    store?: ApolloStore,
    reduxRootSelector?: ApolloStateSelector,
    addTypename?: boolean,
  }) => {

    return new QueryManager({
      networkInterface: networkInterface || mockNetworkInterface(),
      store: store || createApolloStore(),
      reduxRootSelector: reduxRootSelector || defaultReduxRootSelector,
      addTypename,
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
    done: MochaDone,
    query: DocumentNode,
    variables?: Object,
    queryOptions?: Object,
    error?: Error,
    result?: ExecutionResult,
    delay?: number,
    observer: Observer<ApolloQueryResult<any>>,
  }) => {
    const queryManager = mockQueryManager({
      request: { query, variables },
      result,
      error,
      delay,
    });
    const finalOptions = assign({ query, variables }, queryOptions) as WatchQueryOptions;
    return queryManager.watchQuery<any>(finalOptions).subscribe({
      next: wrap(done, observer.next!),
      error: observer.error,
    });
  };

  // Helper method that asserts whether a particular query correctly returns
  // a given piece of data.
  const assertRoundtrip = ({
    done,
    query,
    data,
    variables = {},
  }: {
    done: MochaDone,
    query: DocumentNode,
    data: Object,
    variables?: Object,
  }) => {
    assertWithObserver({
      done,
      query,
      result: { data },
      variables,
      observer: {
        next(result) {
          assert.deepEqual(result.data, data, 'Roundtrip assertion failed.');
          done();
        },
      },
    });
  };

  const mockMutation = ({
    mutation,
    data,
    variables = {},
    store,
  }: {
    mutation: DocumentNode,
    data: Object,
    variables?: Object,
    store?: ApolloStore,
  }) => {
    if (!store) {
      store = createApolloStore();
    }
    const networkInterface = mockNetworkInterface({
      request: { query: mutation, variables },
      result: { data },
    });
    const queryManager = createQueryManager({ networkInterface, store });
    return new Promise<{ result: ExecutionResult, queryManager: QueryManager }>((resolve, reject) => {
      queryManager.mutate({ mutation, variables }).then((result) => {
        resolve({ result, queryManager });
      }).catch((error) => {
        reject(error);
      });
    });
  };

  const assertMutationRoundtrip = (opts: {
    mutation: DocumentNode,
    data: Object,
    variables?: Object,
  }) => {
    return mockMutation(opts).then(({ result }) => {
      assert.deepEqual(result.data, opts.data);
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
    request: ParsedRequest,
    firstResult: ExecutionResult,
    secondResult: ExecutionResult,
    thirdResult?: ExecutionResult,
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

  it('properly roundtrips through a Redux store', (done) => {
    assertRoundtrip({
      query: gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }`,
      data: {
        allPeople: {
          people: [
            {
              name: 'Luke Skywalker',
            },
          ],
        },
      },
      done,
    });
  });

  it('runs multiple root queries', (done) => {
    assertRoundtrip({
      query: gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
        person(id: "1") {
          name
        }
      }
    `,
      data: {
        allPeople: {
          people: [
            {
              name: 'Luke Skywalker',
            },
          ],
        },
        person: {
          name: 'Luke Skywalker',
        },
      },
      done,
    });
  });

  it('properly roundtrips through a Redux store with variables', (done) => {
    assertRoundtrip({
      query: gql`
      query people($firstArg: Int) {
        allPeople(first: $firstArg) {
          people {
            name
          }
        }
      }`,

      variables: {
        firstArg: 1,
      },

      data: {
        allPeople: {
          people: [
            {
              name: 'Luke Skywalker',
            },
          ],
        },
      },
      done,
    });
  });

  it('handles GraphQL errors', (done) => {
    assertWithObserver({
      done,
      query: gql`
          query people {
            allPeople(first: 1) {
              people {
                name
              }
            }
          }`,
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
        next(result) {
          done(new Error('Returned a result when it was supposed to error out'));
        },

        error(apolloError) {
          assert(apolloError);
          done();
        },
      },
    });
  });

  it('handles GraphQL errors with data returned', (done) => {
    assertWithObserver({
      done,
      query: gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }`,
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
        next(result) {
          done(new Error('Returned data when it was supposed to error out.'));
        },

        error(apolloError) {
          assert(apolloError);
          done();
        },
      },
    });

  });

  it('empty error array (handle non-spec-compliant server) #156', (done) => {
    assertWithObserver({
      done,
      query: gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }`,
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
          assert.equal(result.data['allPeople'].people.name, 'Ada Lovelace');
          assert.notProperty(result, 'errors');
          done();
        },
      },
    });
  });

  // Easy to get into this state if you write an incorrect `formatError`
  // function with graphql-server or express-graphql
  it('error array with nulls (handle non-spec-compliant server) #1185', (done) => {
    assertWithObserver({
      done,
      query: gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }`,
      result: {
        errors: [null as any],
      },
      observer: {
        next() {
          done(new Error('Should not fire next for an error'));
        },
        error(error) {
          assert.deepEqual((error as any).graphQLErrors, [null]);
          assert.equal(error.message, 'GraphQL error: Error message not found.');
          done();
        },
      },
    });
  });


  it('handles network errors', (done) => {
    assertWithObserver({
      done,
      query: gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }`,
      error: new Error('Network error'),
      observer: {
        next: (result) => {
          done(new Error('Should not deliver result'));
        },
        error: (error) => {
          const apolloError = error as ApolloError;
          assert(apolloError.networkError);
          assert.include(apolloError.networkError!.message, 'Network error');
          done();
        },
      },
    });
  });

  it('uses console.error to log unhandled errors', (done) => {
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
      }`,
      error: new Error('Network error'),
      observer: {
        next: (result) => {
          done(new Error('Should not deliver result'));
        },
      },
    });

    setTimeout(() => {
      assert.match(printed[0], /error/);
      console.error = oldError;
      done();
    }, 10);
  });

  it('handles an unsubscribe action that happens before data returns', (done) => {
    const subscription = assertWithObserver({
      done,
      query: gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }`,
      delay: 1000,
      observer: {
        next: (result) => {
          done(new Error('Should not deliver result'));
        },
        error: (error) => {
          done(new Error('Should not deliver result'));
        },
      },
    });

    assert.doesNotThrow(subscription.unsubscribe);
    done();
  });

  it('supports interoperability with other Observable implementations like RxJS', (done) => {
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
        }`,
      },
      result: expResult,
    });

    const observable = Rx.Observable.from(handle as any);


    observable
      .map(result => (assign({ fromRx: true }, result)))
      .subscribe({
      next: wrap(done, (newResult) => {
        const expectedResult = assign({ fromRx: true, loading: false, networkStatus: 7, stale: false }, expResult);
        assert.deepEqual(newResult, expectedResult);
        done();
      }),
    });
  });

  it('allows you to subscribe twice to one query', (done) => {
    const request = {
      query: gql`
        query fetchLuke($id: String) {
          people_one(id: $id) {
            name
          }
        }`,
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

    const queryManager = mockQueryManager({
      request,
      result: { data: data1 },
    }, {
      request,
      result: { data: data2 },

      // Wait for both to subscribe
      delay: 100,
    }, {
      request,
      result: { data: data3 },
    });

    let subOneCount = 0;

    // pre populate data to avoid contention
    queryManager.query<any>(request)
      .then(() => {
        const handle = queryManager.watchQuery<any>(request);

        const subOne = handle.subscribe({
          next(result) {
            subOneCount++;

            if (subOneCount === 1) {
              assert.deepEqual(result.data, data1);
            } else if (subOneCount === 2) {
              assert.deepEqual(result.data, data2);
            }
          },
        });

        let subTwoCount = 0;
        handle.subscribe({
          next(result) {
            subTwoCount++;
            if (subTwoCount === 1) {
              assert.deepEqual(result.data, data1);
              handle.refetch();
            } else if (subTwoCount === 2) {
              assert.deepEqual(result.data, data2);
              setTimeout(() => {
                try {
                  assert.equal(subOneCount, 2);

                  subOne.unsubscribe();
                  handle.refetch();
                } catch (e) { done(e); }
              }, 0);
            } else if (subTwoCount === 3) {
              setTimeout(() => {
                try {
                  assert.equal(subOneCount, 2);
                  done();
                } catch (e) { done(e); }
              }, 0);
            }
          },
        });
      });
  });

  it('allows you to refetch queries', () => {
    const request = {
      query: gql`
        query fetchLuke($id: String) {
          people_one(id: $id) {
            name
          }
        }`,
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
    return observableToPromise({ observable },
      (result) => {
        assert.deepEqual(result.data, data1);
        observable.refetch();
      },
      (result) => assert.deepEqual(result.data, data2),
    );
  });

  it('will return referentially equivalent data if nothing changed in a refetch', done => {
    const request = {
      query: gql`
        {
          a
          b { c }
          d { e f { g } }
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
              assert.deepEqual(result.data, data1);
              firstResultData = result.data;
              observable.refetch();
              break;
            case 1:
              assert.deepEqual(result.data, data2);
              assert.notStrictEqual(result.data, firstResultData);
              assert.strictEqual(result.data.b, firstResultData.b);
              assert.notStrictEqual(result.data.d, firstResultData.d);
              assert.strictEqual(result.data.d.f, firstResultData.d.f);
              observable.refetch();
              break;
            case 2:
              assert.deepEqual(result.data, data3);
              assert.notStrictEqual(result.data, firstResultData);
              assert.strictEqual(result.data.b, firstResultData.b);
              assert.notStrictEqual(result.data.d, firstResultData.d);
              assert.strictEqual(result.data.d.f, firstResultData.d.f);
              done();
              break;
            default:
              throw new Error('Next run too many times.');
          }
        } catch (error) {
          done(error);
        }
      },
      error: error =>
        done(error),
    });
  });

  it('will return referentially equivalent data in getCurrentResult if nothing changed', done => {
    const request = {
      query: gql`
        {
          a
          b { c }
          d { e f { g } }
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
          assert.deepEqual(result.data, data1);
          assert.strictEqual(result.data, observable.currentResult().data);
          done();
        } catch (error) {
          done(error);
        }
      },
      error: error =>
        done(error),
    });
  });

  it('sets networkStatus to `refetch` when refetching', () => {
    const request = {
      query: gql`
        query fetchLuke($id: String) {
          people_one(id: $id) {
            name
          }
        }`,
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
    return observableToPromise({ observable },
      (result) => {
        assert.deepEqual(result.data, data1);
        observable.refetch();
      },
      (result) => assert.equal(result.networkStatus, NetworkStatus.refetch),
      (result) => {
        assert.equal(result.networkStatus, NetworkStatus.ready);
        assert.deepEqual(result.data, data2);
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
      }`,
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

    return handle.refetch().then(
      (result) => assert.deepEqual(result.data, data2),
    );
  });

  it('returns frozen results from refetch', () => {
    const request = {
      query: gql`
      {
        people_one(id: 1) {
          name
        }
      }`,
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

    return handle.refetch().then( result => {
      assert.deepEqual(result.data, data2);
      assert.throws( () => (result.data as any).stuff = 'awful');
    });
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

    const observable = queryManager.watchQuery<any>({ query, notifyOnNetworkStatusChange: false });
    return observableToPromise({ observable },
      (result) => {
        assert.deepEqual(result.data, data1);
        observable.refetch();
      },
      (result) => {
        assert.deepEqual(result.data, data2);
        observable.refetch(variables1);
      },
      (result) => {
        assert.isTrue(result.loading);
        assert.deepEqual(result.data, data2);
      },
      (result) => {
        assert.deepEqual(result.data, data3);
        observable.refetch(variables2);
      },
      (result) => {
        assert.isTrue(result.loading);
        assert.deepEqual(result.data, data3);
      },
      (result) => {
        assert.deepEqual(result.data, data4);
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

    const observable = queryManager.watchQuery<any>({ query, notifyOnNetworkStatusChange: false });
    const originalOptions = assign({}, observable.options);
    return observableToPromise({ observable },
      (result) => {
        assert.deepEqual(result.data, data1);
        observable.refetch();
      },
      (result) => {
        assert.deepEqual(result.data, data2);
        const updatedOptions = assign({}, observable.options);
        delete originalOptions.variables;
        delete updatedOptions.variables;
        assert.deepEqual(updatedOptions, originalOptions);
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

    return observableToPromise({ observable },
      (result) => {
        assert.deepEqual(result.data, data1);
        observable.refetch();
      },
      (result) => assert.deepEqual(result.data, data2),
      (result) => {
        assert.deepEqual(result.data, data3);
        observable.stopPolling();
        assert(result);
      },
    );
  });

  it('sets networkStatus to `poll` if a polling query is in flight', (done) => {
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
          assert.equal(result.networkStatus, NetworkStatus.ready);
        } else if (counter === 2) {
          assert.equal(result.networkStatus, NetworkStatus.poll);
          handle.unsubscribe();
          done();
        }
      },
    });
  });

  it('can handle null values in arrays (#1551)', (done) => {
    const query = gql`{ list { value } }`;
    const data = { list: [ null, { value: 1 } ] };
    const queryManager = mockQueryManager({
      request: { query },
      result: { data },
    });
    const observable = queryManager.watchQuery({ query });

    observable.subscribe({
      next: (result) => {
        assert.deepEqual(result.data, data);
        assert.deepEqual(observable.currentResult().data, data);
        done();
      },
    });
  });

  it('deepFreezes results in development mode', () => {
    const query = gql`{ stuff }`;
    const data = { stuff: 'wonderful' };
    const queryManager = mockQueryManager({
      request: { query },
      result: { data },
    });

    return queryManager.query({ query })
    .then(result => {
      assert.deepEqual(result.data, data);
      assert.throws( () => (result.data as any).stuff = 'awful' );
    });
  });

  it('should error if we pass fetchPolicy = cache-first or cache-only on a polling query', (done) => {
    assert.throw(() => {
      assertWithObserver({
        done,
        observer: {
          next(result) {
            done(new Error('Returned a result when it should not have.'));
          },
        },
        query: gql`
          query {
            author {
              firstName
              lastName
            }
          }`,
        queryOptions: { pollInterval: 200, fetchPolicy: 'cache-only' },
      });
    });
    assert.throw(() => {
      assertWithObserver({
        done,
        observer: {
          next(result) {
            done(new Error('Returned a result when it should not have.'));
          },
        },
        query: gql`
          query {
            author {
              firstName
              lastName
            }
          }`,
        queryOptions: { pollInterval: 200, fetchPolicy: 'cache-first' },
      });
    });
    done();
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

    const queryManager = mockQueryManager(
      {
        request: { query: primeQuery },
        result: { data: data1 },
      },
    );

    // First, prime the cache
    return queryManager.query<any>({
      query: primeQuery,
    }).then(() => {
      const handle = queryManager.watchQuery<any>({
        query: complexQuery,
        fetchPolicy: 'cache-only',
      });

      return handle.result().then((result) => {
        assert.equal(result.data['luke'].name, 'Luke Skywalker');
        assert.notProperty(result.data, 'vader');
      });
    });
  });

  it('runs a mutation', () => {
    return assertMutationRoundtrip({
      mutation: gql`
        mutation makeListPrivate {
          makeListPrivate(id: "5")
        }`,
      data: { makeListPrivate: true },
    });
  });

  it('runs a mutation with variables', () => {
    return assertMutationRoundtrip({
      mutation: gql`
        mutation makeListPrivate($listId: ID!) {
          makeListPrivate(id: $listId)
        }`,
      variables: { listId: '1' },
      data: { makeListPrivate: true },
    });
  });

  const getIdField = ({id}: {id: string}) => id;

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
          makeListPrivate(input: {id: "5"}) {
            id,
            isPrivate,
          }
        }`,
      data,
      store: createApolloStore({
        config: { dataIdFromObject: getIdField },
      }),
    }).then(({ result, queryManager }) => {
      assert.deepEqual(result.data, data);

      // Make sure we updated the store with the new data
      assert.deepEqual(
        queryManager.store.getState()['apollo'].data['5'],
        { id: '5', isPrivate: true },
      );
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
            id,
            isPrivate,
          }
        }`,
      data,
      store: createApolloStore({
        config: { dataIdFromObject: getIdField },
      }),
    }).then(({ result, queryManager }) => {
      assert.deepEqual(result.data, data);

      // Make sure we updated the store with the new data
      assert.deepEqual(
        queryManager.store.getState()['apollo'].data['5'],
        { id: '5', isPrivate: true },
      );
    });
  });

  it('runs a mutation and puts the result in the store with root key', () => {
    const  mutation = gql`
      mutation makeListPrivate {
        makeListPrivate(id: "5") {
          id,
          isPrivate,
        }
      }
    `;

    const data = {
      makeListPrivate: {
        id: '5',
        isPrivate: true,
      },
    };

    const reduxRootKey = 'test';
    const reduxRootSelector = (state: any) => state[reduxRootKey];
    const store = createApolloStore({
      reduxRootKey,
      config: { dataIdFromObject: getIdField },
    });
    const queryManager = createQueryManager({
      networkInterface: mockNetworkInterface(
        {
          request: { query: mutation },
          result: { data },
        },
      ),
      store,
      reduxRootSelector,
    });

    return queryManager.mutate({
      mutation,
    }).then((result) => {
      assert.deepEqual(result.data, data);

      // Make sure we updated the store with the new data
      assert.deepEqual(reduxRootSelector(store.getState()).data['5'], { id: '5', isPrivate: true });
    });
  });

  it('does not broadcast queries when non-apollo actions are dispatched', () => {
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

    function testReducer (state = false, action: any): boolean {
      if (action.type === 'TOGGLE') {
        return true;
      }
      return state;
    }
    const client = new ApolloClient();
    const store = createStore(
      combineReducers({
        test: testReducer,
        apollo: client.reducer() as any, // XXX see why this type fails
      }),
      applyMiddleware(client.middleware()),
    );
    const observable = createQueryManager({
      networkInterface: mockNetworkInterface(
        {
          request: { query, variables },
          result: { data: data1 },
        },
        {
          request: { query, variables },
          result: { data: data2 },
        },
      ),
      store: store,
    }).watchQuery({ query, variables, notifyOnNetworkStatusChange: false });

    return observableToPromise({ observable },
      (result) => {
        assert.deepEqual(result.data, data1);
        observable.refetch();
      },
      (result) => {
        assert.deepEqual(result.data, data2);
        store.dispatch({
          type: 'TOGGLE',
        });
      },
    );
  });

  it('does not call broadcastNewStore when Apollo state is not affected by an action', () => {
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

    function testReducer (state = false, action: any): boolean {
      if (action.type === 'TOGGLE') {
        return true;
      }
      return state;
    }
    const client = new ApolloClient();
    const store = createStore(
      combineReducers({
        test: testReducer,
        apollo: client.reducer() as any, // XXX see why this type fails
      }),
      applyMiddleware(client.middleware()),
    );
    const qm = createQueryManager({
      networkInterface: mockNetworkInterface(
        {
          request: { query, variables },
          result: { data: data1 },
        },
        {
          request: { query, variables },
          result: { data: data2 },
        },
      ),
      store: store,
    });

    const observable = qm.watchQuery({ query, variables, notifyOnNetworkStatusChange: false });

    return observableToPromise({ observable },
      (result) => {
        assert.deepEqual(result.data, data1);
        observable.refetch();
      },
      (result) => {
        assert.deepEqual(result.data, data2);

        // here's the actual test. Everything else is just setup.
        let called = false;
        client.queryManager.broadcastNewStore = (s: any) => {
          called = true;
        };
        store.dispatch({
          type: 'TOGGLE',
        });
        assert.equal((store.getState() as any).test, true, 'test state should have been updated');
        assert.equal(called, false, 'broadcastNewStore should not have been called');
      },
    );
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
      observableToPromise({ observable: observable1 },
        (result) => assert.deepEqual(result.data, data1),
      ),
      observableToPromise({ observable: observable2 },
        (result) => assert.deepEqual(result.data, data2),
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
    return observableToPromise({ observable },
      (result) => {
        assert.deepEqual(result.data, data1);
        queryManager.query<any>({ query: query2 });
      },
      // 3 because the query init action for the second query causes a callback
      (result) => assert.deepEqual(result.data, {
        people_one: {
          name: 'Luke Skywalker has a new name',
          age: 50,
        },
      }),
    );
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

      return observableToPromise({ observable },
        (result) => assert.deepEqual(result.data, data1),
        (result) => assert.deepEqual(result.data, data2),
      );

    });

    it('does not poll during SSR', (done) => {
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

      const queryManager = new QueryManager({
        networkInterface: mockNetworkInterface({
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
        }),
        store: createApolloStore(),
        reduxRootSelector: defaultReduxRootSelector,
        addTypename: false,
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
              assert.deepEqual(result.data, data1);
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
              done(new Error('Only expected one result, not multiple'));
          }
        },
      });
    });

    it('should let you handle multiple polled queries and unsubscribe from one of them', (done) => {
      const query1 = gql`
        query {
          author {
            firstName
            lastName
          }
        }`;
      const query2 = gql`
        query {
          person {
            name
          }
        }`;
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
          result: { data: data13},
        },
        {
          request: {query: query1 },
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

      const subscription1 = queryManager.watchQuery({
        query: query1,
        pollInterval: 150,
      }).subscribe({
        next(result) {
          handle1Count++;
          handleCount++;
          if (handle1Count > 1 && !setMilestone) {
            subscription1.unsubscribe();
            setMilestone = true;
          }
        },
      });

      const subscription2 = queryManager.watchQuery({
        query: query2,
        pollInterval: 2000,
      }).subscribe({
        next(result) {
          handleCount++;
        },
      });

      setTimeout(() => {
        assert.equal(handleCount, 3);
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

      const { promise, subscription } = observableToPromiseAndSubscription({
          observable,
          wait: 60,
        },
        (result) => assert.deepEqual(result.data, data1),
        (result) => {
          assert.deepEqual(result.data, data2);

          // we unsubscribe here manually, rather than waiting for the timeout.
          subscription.unsubscribe();
        },
      );

      return promise;
    });

    it('allows you to unsubscribe from polled query errors', () => {
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

      const { promise, subscription } = observableToPromiseAndSubscription({
          observable,
          wait: 60,
          errorCallbacks: [
            (error) => {
              assert.include(error.message, 'Network error');
              subscription.unsubscribe();
            },
          ],
        },
        (result) => assert.deepEqual(result.data, data1),
      );

      return promise;
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

      const observable = queryManager.watchQuery<any>({ query, variables, notifyOnNetworkStatusChange: false });
      observable.startPolling(50);

      return observableToPromise({ observable },
        (result) => assert.deepEqual(result.data, data1),
        (result) => assert.deepEqual(result.data, data2),
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

      return observableToPromise({ observable, wait: 60},
        (result) => {
          assert.deepEqual(result.data, data1);
          observable.stopPolling();
        },
      );
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
        observableToPromise({ observable },
          (result) => {
            assert.deepEqual(result.data, data1);
            queryManager.query({ query, variables, fetchPolicy: 'network-only' })
              .then(() => timeout(new Error('Should have two results by now')));
          },
          (result) => assert.deepEqual(result.data, data2),
        ),
        // Ensure that the observable has recieved 2 results *before*
        // the rejection triggered above
        new Promise((resolve, reject) => {
          timeout = (error: Error) => reject(error);
        }),
      ]);
    });
  });

  it('warns if you forget the template literal tag', () => {
    const queryManager = mockQueryManager();
    assert.throws(() => {
      queryManager.query<any>({
        // Bamboozle TypeScript into letting us do this
        query: 'string' as any as DocumentNode,
      });
    }, /wrap the query string in a "gql" tag/);

    assert.throws(() => {
      queryManager.mutate({
        // Bamboozle TypeScript into letting us do this
        mutation: 'string' as any as DocumentNode,
      });
    }, /wrap the query string in a "gql" tag/);

    assert.throws(() => {
      queryManager.watchQuery<any>({
        // Bamboozle TypeScript into letting us do this
        query: 'string' as any as DocumentNode,
      });
    }, /wrap the query string in a "gql" tag/);
  });

  it('should transform queries correctly when given a QueryTransformer', (done) => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;
    const transformedQuery = gql`
      query {
        author {
          firstName
          lastName
          __typename
        }
      }`;
    const unmodifiedQueryResult = {
      'author': {
        'firstName': 'John',
        'lastName': 'Smith',
      },
    };
    const transformedQueryResult = {
      'author': {
        'firstName': 'John',
        'lastName': 'Smith',
        '__typename': 'Author',
      },
    };

    //make sure that the query is transformed within the query
    //manager
    createQueryManager({
      networkInterface: mockNetworkInterface(
        {
          request: {query},
          result: {data: unmodifiedQueryResult},
        },
        {
          request: {query: transformedQuery},
          result: {data: transformedQueryResult},
        },
      ),
      addTypename: true,
    }).query({query: query}).then((result) => {
      assert.deepEqual(result.data, transformedQueryResult);
      done();
    });
  });

  it('should transform mutations correctly', (done) => {
    const mutation = gql`
      mutation {
        createAuthor(firstName: "John", lastName: "Smith") {
          firstName
          lastName
        }
      }`;
    const transformedMutation = gql`
      mutation {
        createAuthor(firstName: "John", lastName: "Smith") {
          firstName
          lastName
          __typename
        }
      }`;
    const unmodifiedMutationResult = {
      'createAuthor': {
        'firstName': 'It works!',
        'lastName': 'It works!',
      },
    };
    const transformedMutationResult = {
      'createAuthor': {
        'firstName': 'It works!',
        'lastName': 'It works!',
        '__typename': 'Author',
      },
    };

    createQueryManager({
      networkInterface: mockNetworkInterface(
        {
          request: {query: mutation},
          result: {data: unmodifiedMutationResult},
        },
        {
          request: {query: transformedMutation},
          result: {data: transformedMutationResult},
        }),
      addTypename: true,
    }).mutate({mutation: mutation}).then((result) => {
      assert.deepEqual(result.data, transformedMutationResult);
      done();
    });
  });

  describe('store resets', () => {
    it('should change the store state to an empty state', () => {
      const queryManager = createQueryManager({});

      queryManager.resetStore();
      const currentState = queryManager.getApolloState();
      const expectedState: any = {
        data: {},
        mutations: {},
        queries: {},
        optimistic: [],
        reducerError: null,
      };

      assert.deepEqual(currentState, expectedState);
    });

    it('should only refetch once when we store reset', () => {
      let queryManager: QueryManager;
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }`;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      let timesFired = 0;
      const networkInterface: NetworkInterface = {
        query(request: Request): Promise<ExecutionResult> {
          if (timesFired === 0) {
            timesFired += 1;
            queryManager.resetStore();
          } else {
            timesFired += 1;
          }
          return Promise.resolve({ data });
        },
      };
      queryManager = createQueryManager({ networkInterface });
      const observable = queryManager.watchQuery<any>({ query });

      // wait just to make sure the observable doesn't fire again
      return observableToPromise({ observable, wait: 0 },
        (result) => assert.deepEqual(result.data, data),
      ).then(() => {
        assert.equal(timesFired, 2);
      });
    });

    it('should not refetch toredown queries', (done) => {
      let queryManager: QueryManager;
      let observable: ObservableQuery<any>;
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }`;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      let timesFired = 0;
      const networkInterface: NetworkInterface = {
        query(request: Request): Promise<ExecutionResult> {
          timesFired += 1;
          return Promise.resolve({ data });
        },
      };
      queryManager = createQueryManager({ networkInterface });
      observable = queryManager.watchQuery({ query });


      observableToPromise({ observable, wait: 0 },
        (result) => assert.deepEqual(result.data, data),
      ).then(() => {
        assert.equal(timesFired, 1);

        // at this point the observable query has been toredown
        // because observableToPromise unsubscribe before resolving
        queryManager.resetStore();

        setTimeout(() => {
          assert.equal(timesFired, 1);

          done();
        }, 50);
      });
    });

    it('should not error on queries that are already in the store', () => {
      let queryManager: QueryManager;
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }`;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };

      let timesFired = 0;
      const networkInterface: NetworkInterface = {
        query(request: Request): Promise<ExecutionResult> {
          if (timesFired === 0) {
            timesFired += 1;
            setTimeout(queryManager.resetStore.bind(queryManager), 10);
          } else {
            timesFired += 1;
          }
          return Promise.resolve({ data });
        },
      };
      queryManager = createQueryManager({ networkInterface });
      const observable = queryManager.watchQuery<any>({ query, notifyOnNetworkStatusChange: false });

      // wait to make sure store reset happened
      return observableToPromise({ observable, wait: 20 },
        result => assert.deepEqual(result.data, data),
      ).then(() => {
        assert.equal(timesFired, 2);
      });
    });


    it('should throw an error on an inflight fetch query if the store is reset', (done) => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }`;
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
      queryManager.fetchQuery('made up id', { query }).then((result) => {
        done(new Error('Returned a result.'));
      }).catch((error) => {
        assert.include(error.message, 'Store reset');
        done();
      });
      queryManager.resetStore();
    });

    it('should call refetch on a mocked Observable if the store is reset', (done) => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }`;
      const queryManager = mockQueryManager();

      const mockObservableQuery: ObservableQuery<any> = {
        refetch(variables: any): Promise<ExecutionResult> {
          done();
          return null as never;
        },
        options: {
          query: query,
        },
        scheduler: queryManager.scheduler,
      } as any as ObservableQuery<any>;

      const queryId = 'super-fake-id';
      queryManager.addObservableQuery<any>(queryId, mockObservableQuery);
      queryManager.resetStore();
    });

    it('should not call refetch on a cache-only Observable if the store is reset', (done) => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }`;
      const queryManager = createQueryManager({});
      const options = assign({}) as WatchQueryOptions;
      options.fetchPolicy = 'cache-only';
      options.query = query;
      let refetchCount = 0;
      const mockObservableQuery: ObservableQuery<any> = {
        refetch(variables: any): Promise<ExecutionResult> {
          refetchCount ++;
          return null as never;
        },
        options,
        queryManager: queryManager,
      } as any as ObservableQuery<any>;

      const queryId = 'super-fake-id';
      queryManager.addObservableQuery<any>(queryId, mockObservableQuery);
      queryManager.resetStore();
      setTimeout(() => {
        assert.equal(refetchCount, 0);
        done();
      }, 50);

    });

    it('should not call refetch on a standby Observable if the store is reset', (done) => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }`;
      const queryManager = createQueryManager({});
      const options = assign({}) as WatchQueryOptions;
      options.fetchPolicy = 'standby';
      options.query = query;
      let refetchCount = 0;
      const mockObservableQuery: ObservableQuery<any> = {
        refetch(variables: any): Promise<ExecutionResult> {
          refetchCount ++;
          return null as never;
        },
        options,
        queryManager: queryManager,
      } as any as ObservableQuery<any>;

      const queryId = 'super-fake-id';
      queryManager.addObservableQuery<any>(queryId, mockObservableQuery);
      queryManager.resetStore();
      setTimeout(() => {
        assert.equal(refetchCount, 0);
        done();
      }, 50);
    });

    it('should throw an error on an inflight query() if the store is reset', (done) => {
      let queryManager: QueryManager;
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }`;

      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const networkInterface: NetworkInterface = {
        query(request: Request): Promise<ExecutionResult> {
          // reset the store as soon as we hear about the query
          queryManager.resetStore();
          return Promise.resolve({ data });
        },
      };

      queryManager = createQueryManager({ networkInterface });
      queryManager.query<any>({ query }).then((result) => {
        done(new Error('query() gave results on a store reset'));
      }).catch((error) => {
        done();
      });
    });
  });

  it('should reject a query promise given a network error', (done) => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;
    const networkError = new Error('Network error');
    mockQueryManager({
      request: { query },
      error: networkError,
    }).query({ query }).then((result) => {
      done(new Error('Returned result on an errored fetchQuery'));
    }).catch((error) => {
      const apolloError = error as ApolloError;

      assert(apolloError.message);
      assert.equal(apolloError.networkError, networkError);
      assert.deepEqual(apolloError.graphQLErrors, []);
      done();
    }).catch(done);
  });

  it('should error when we attempt to give an id beginning with $', (done) => {
    const query = gql`
      query {
        author {
          firstName
          lastName
          id
          __typename
        }
      }`;
    const data = {
      author: {
        firstName: 'John',
        lastName: 'Smith',
        id: '129',
        __typename: 'Author',
      },
    };
    const reducerConfig = { dataIdFromObject: (x: any) => '$' + dataIdFromObject(x) };
    const store = createApolloStore({ config: reducerConfig, reportCrashes: false });
    createQueryManager({
      networkInterface: mockNetworkInterface({
        request: { query },
        result: { data },
      }),
      store,
    }).query({ query }).then((result) => {
      done(new Error('Returned a result when it should not have.'));
    }).catch((error) => {
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
      }`;
    const graphQLErrors = [new Error('GraphQL error')];
    return mockQueryManager({
      request: { query },
      result: { errors: graphQLErrors },
    }).query({ query }).then(
      (result) => {
        throw new Error('Returned result on an errored fetchQuery');
      },
      // don't use .catch() for this or it will catch the above error
      (error) => {
        const apolloError = error as ApolloError;
        assert(apolloError.message);
        assert.equal(apolloError.graphQLErrors, graphQLErrors);
        assert(!apolloError.networkError);
      });
  });

  it('should not empty the store when a non-polling query fails due to a network error', (done) => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;
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
    queryManager.query<any>({ query }).then((result) => {
      assert.deepEqual(result.data, data);

      queryManager.query<any>({ query, fetchPolicy: 'network-only' }).then(() => {
        done(new Error('Returned a result when it was not supposed to.'));
      }).catch((error) => {
        // make that the error thrown doesn't empty the state
        assert.deepEqual(queryManager.store.getState().apollo.data['$ROOT_QUERY.author'], data['author']);
        done();
      });
    }).catch((error) => {
      done(new Error('Threw an error on the first query.'));
    });
  });

  it('should be able to unsubscribe from a polling query subscription', () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;
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

    const { promise, subscription } = observableToPromiseAndSubscription({
        observable,
        wait: 60,
      },
      (result: any) => {
        assert.deepEqual(result.data, data);
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
      }`;
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
    const observable = queryManager.watchQuery<any>({ query, pollInterval: 20, notifyOnNetworkStatusChange: false });

    return observableToPromise({
        observable,
        errorCallbacks: [
          () => {
            assert.deepEqual(
              queryManager.store.getState().apollo.data['$ROOT_QUERY.author'],
              data.author,
            );
          },
        ],
      },
      (result) => {
        assert.deepEqual(result.data, data);
        assert.deepEqual(
          queryManager.store.getState().apollo.data['$ROOT_QUERY.author'],
          data.author,
        );
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
      }`;

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
      observableToPromise({ observable, wait: 100 },
        (result) => {
          assert.deepEqual(result.data, data);
        },
      ),
      queryManager.query<any>({ query }).then((result) => {
        assert.deepEqual(result.data, data);
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
      }`;

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
    );

    const observable = queryManager.watchQuery({
      query,
      metadata: { foo: 'bar' },
    });
    return observableToPromise({ observable },
      (result) => {
        assert.deepEqual(result.data, data);
        assert.deepEqual(
          queryManager.getApolloState().queries[observable.queryId].metadata,
          { foo: 'bar' },
        );
      },
    );
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
      }`;
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
    const store = createApolloStore({ config: reducerConfig, reportCrashes: false });
    const queryManager = createQueryManager({
      networkInterface: mockNetworkInterface(
        {
          request: { query: query1 },
          result: { data: data1 },
        },
        {
          request: { query: query2 },
          result: { data: data2 },
        },
      ),
      store,
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
        (result) => {
          assert.deepEqual(result, {
            data: data1,
            loading: false,
            networkStatus: NetworkStatus.ready,
            stale: false,
          });
        },
        (result) => {
          assert.deepEqual(result, {
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
        (result) => {
          assert.deepEqual(result, {
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
      }`;
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
      }`;
    const dataWithoutId = {
      author: {
        address: 'fake address',
      },
    };
    const reducerConfig = { dataIdFromObject };
    const store = createApolloStore({ config: reducerConfig, reportCrashes: false });
    const queryManager = createQueryManager({
      networkInterface: mockNetworkInterface(
        {
          request: { query: queryWithId },
          result: { data: dataWithId },
        },
        {
          request: { query: queryWithoutId },
          result: { data: dataWithoutId },
        },
      ),
      store,
    });

    const observableWithId = queryManager.watchQuery<any>({ query: queryWithId });
    const observableWithoutId = queryManager.watchQuery<any>({ query: queryWithoutId });

    // I'm not sure the waiting 60 here really is required, but the test used to do it
    return Promise.all([
      observableToPromise({ observable: observableWithId, wait: 60 },
        (result) => assert.deepEqual(result.data, dataWithId),
      ),
      observableToPromise({
          observable: observableWithoutId,
          errorCallbacks: [
            (error) => assert.include(error.message, 'Store error'),
            // The error gets triggered a second time when we unsubscribe the
            // the first promise, as there is no duplicate prevention for errors
            (error) => assert.include(error.message, 'Store error'),
          ],
          wait: 60,
        },
      ),
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
      }`;
    const queryWithId = gql`
      query {
        author {
          name {
            firstName
          }
          id
          __typename
        }
      }`;
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
    const store = createApolloStore({ config: { dataIdFromObject } });
    const queryManager = createQueryManager({
      networkInterface:  mockNetworkInterface(
        {
          request: { query: queryWithoutId },
          result: { data: dataWithoutId },
        },
        {
          request: { query: queryWithId },
          result: { data: dataWithId },
        },
      ),
      store,
    });

    const observableWithId = queryManager.watchQuery<any>({ query: queryWithId });
    const observableWithoutId = queryManager.watchQuery<any>({ query: queryWithoutId });

    // I'm not sure the waiting 60 here really is required, but the test used to do it
    return Promise.all([
      observableToPromise({ observable: observableWithoutId, wait: 120 },
        (result) => assert.deepEqual(result.data, dataWithoutId),
        (result) => assert.deepEqual(result.data, mergedDataWithoutId),
      ),
      observableToPromise({ observable: observableWithId, wait: 120 },
        (result) => assert.deepEqual(result.data, dataWithId),
      ),
    ]);
  });

  describe('loading state', () => {
    it('should be passed as false if we are not watching a query', () => {
      const query = gql`
        query {
          fortuneCookie
        }`;
      const data = {
        fortuneCookie: 'Buy it',
      };
      return  mockQueryManager({
        request: { query },
        result: { data },
      }).query({ query }).then((result) => {
        assert(!result.loading);
        assert.deepEqual(result.data, data);
      });
    });

    it('should be passed to the observer as false if we are returning all the data', (done) => {
      assertWithObserver({
        done,
        query: gql`
          query {
            author {
              firstName
              lastName
            }
          }`,
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
            assert(!result.loading);
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
        }`;
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

      queryManager.watchQuery({
        query: testQuery,
        notifyOnNetworkStatusChange: false,
      }).subscribe({
        next: result => {
          switch (count++) {
            case 0:
              assert.isFalse(result.loading);
              assert.deepEqual(result.data, data1);
              setTimeout(() => {
                queryManager.resetStore();
              }, 0);
              break;
            case 1:
              assert.isFalse(result.loading);
              assert.deepEqual(result.data, data2);
              done();
              break;
            default:
              done(new Error('`next` was called to many times.'));
          }
        },
        error: error => done(error),
      });
    });
  });

  describe('refetchQueries', () => {
    const oldWarn = console.warn;
    let warned: any;
    let timesWarned = 0;

    beforeEach((done) => {
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
        }`;
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
        }`;
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
      const observable = queryManager.watchQuery<any>({ query, notifyOnNetworkStatusChange: false });
      return observableToPromise({ observable },
        (result) => {
          assert.deepEqual(result.data, data);
          queryManager.mutate({ mutation, refetchQueries: ['getAuthors'] });
        },
        (result) => assert.deepEqual(result.data, secondReqData),
      );
    });

    it('should warn but continue when an unknown query name is asked to refetch', () => {
      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }`;
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
        }`;
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
      const observable = queryManager.watchQuery<any>({ query, notifyOnNetworkStatusChange: false });
      return observableToPromise({ observable },
        (result) => {
          assert.deepEqual(result.data, data);
          queryManager.mutate({ mutation, refetchQueries: ['fakeQuery', 'getAuthors'] });
        },
        (result) => {
          assert.deepEqual(result.data, secondReqData);
          assert.include(warned[0], 'Warning: unknown query with name fakeQuery');
          assert.equal(timesWarned, 1);
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
        }`;
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
        }`;
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
      return observableToPromise({ observable },
        (result) => {
          assert.deepEqual(result.data, data);
        },
      ).then(() => {
        // The subscription has been stopped already
        return queryManager.mutate({ mutation, refetchQueries: ['getAuthors'] });
      })
      .then(() => assert.equal(timesWarned, 0));
    });

    it('also works with a query document and variables', () => {
      const mutation = gql`
        mutation changeAuthorName {
          changeAuthorName(newName: "Jack Smith") {
            firstName
            lastName
          }
        }`;
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
        }`;
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
      return observableToPromise({ observable },
        (result) => {
          assert.deepEqual(result.data, data);
          queryManager.mutate({ mutation, refetchQueries: [{ query }] });
        },
        (result) => assert.deepEqual(result.data, secondReqData),
      );
    });

    afterEach((done) => {
      // restore standard method
      console.warn = oldWarn;
      done();
    });
  });

  it('exposes errors on a refetch as a rejection', (done) => {
    const request = {
      query: gql`
      {
        people_one(id: 1) {
          name
        }
      }`,
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

    handle.subscribe({
      error: () => { /* nothing */ },
    });

    handle.refetch()
    .then(() => {
      done(new Error('Error on refetch should reject promise'));
    })
    .catch((error) => {
      assert.deepEqual(error.graphQLErrors, [
        {
          name: 'PeopleError',
          message: 'This is not the person you are looking for.',
        },
      ]);
      done();
    });

    // We have an unhandled error warning from the `subscribe` above, which has no `error` cb
  });
});
