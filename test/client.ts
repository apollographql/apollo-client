import * as chai from 'chai';
const { assert } = chai;
import * as sinon from 'sinon';

import ApolloClient, {
  printAST,
} from '../src';

import {
  disableFragmentWarnings as graphqlTagDisableFragmentWarnings,
} from 'graphql-tag';

import {
  GraphQLError,
  ExecutionResult,
  DocumentNode,
  FragmentDefinitionNode,
} from 'graphql';

import {
  rootReducer as todosReducer,
} from './fixtures/redux-todomvc';

import {
  Store,
} from '../src/store';

import gql from 'graphql-tag';

import {
  print,
} from 'graphql-tag/bundledPrinter';

import { NetworkStatus } from '../src/queries/networkStatus';

import {
  createStore,
  Store as ReduxStore,
  combineReducers,
  applyMiddleware,
} from 'redux';

import {
  QueryManager,
} from '../src/core/QueryManager';

import {
  createNetworkInterface,
  HTTPNetworkInterface,
  Request,
  NetworkInterface,
} from '../src/transport/networkInterface';

import {
  createBatchingNetworkInterface,
} from '../src/transport/batchedNetworkInterface';

import mockNetworkInterface from './mocks/mockNetworkInterface';

import {
  getFragmentDefinitions,
} from '../src/queries/getFromAST';

import {
  createMockFetch,
  createMockedIResponse,
} from './mocks/mockFetch';

import * as chaiAsPromised from 'chai-as-promised';

import { ApolloError } from '../src/errors/ApolloError';

import { withWarning } from './util/wrap';

import observableToPromise from './util/observableToPromise';

import { cloneDeep, assign } from 'lodash';

declare var fetch: any;

// make it easy to assert with promises
chai.use(chaiAsPromised);

// Turn off warnings for repeated fragment names
graphqlTagDisableFragmentWarnings();

describe('client', () => {
  it('does not require any arguments and creates store lazily', () => {
    const client = new ApolloClient();

    assert.isUndefined(client.store);

    // We only create the store on the first query
    client.initStore();
    assert.isDefined(client.store);
    assert.isDefined(client.store.getState().apollo);
  });

  it('can be loaded via require', () => {
    /* tslint:disable */
    const ApolloClientRequire = require('../src').default;
    /* tslint:enable */

    const client = new ApolloClientRequire();

    assert.isUndefined(client.store);

    // We only create the store on the first query
    client.initStore();
    assert.isDefined(client.store);
    assert.isDefined(client.store.getState().apollo);
  });


  it('can allow passing in a network interface', () => {
    const networkInterface = createNetworkInterface({ uri: 'swapi' });
    const client = new ApolloClient({
      networkInterface,
    });

    assert.equal((client.networkInterface as HTTPNetworkInterface)._uri, networkInterface._uri);
  });

  it('can allow passing in a store', () => {
    const client = new ApolloClient();

    const store: ReduxStore<any> = createStore(
      combineReducers({
        todos: todosReducer,
        apollo: client.reducer()as any,
      }),
      applyMiddleware(client.middleware()),
    );

    assert.deepEqual(client.store.getState(), store.getState());
  });

  it('throws an error if you pass in a store without apolloReducer', () => {
    try {
      const client = new ApolloClient();

      createStore(
        combineReducers({
          todos: todosReducer,
        }),
        applyMiddleware(client.middleware()),
      );

      assert.fail();
    } catch (error) {
      assert.equal(
        error.message,
        'Existing store does not use apolloReducer. Please make sure the store ' +
        'is properly configured and "reduxRootSelector" is correctly specified.',
      );
    }

  });

  it('has a top level key by default', () => {
    const client = new ApolloClient();

    client.initStore();

    assert.deepEqual(
      client.store.getState(),
      {
        apollo: {
          queries: {},
          mutations: {},
          data: {},
          optimistic: [],
          reducerError: null,
        },
      },
    );
  });

  it('should allow passing in a selector function for apollo state', () => {
    const reduxRootSelector = (state: any) => state.testApollo;
    const client = new ApolloClient({
      reduxRootSelector,
    });

    // shouldn't throw
    createStore(
        combineReducers({
          testApollo: client.reducer(),
        } as any),
        // here "client.setStore(store)" will be called internally,
        // this method throws if "reduxRootSelector" or "reduxRootKey"
        // are not configured properly
        applyMiddleware(client.middleware()),
    );
  });

  it('should not allow passing reduxRootSelector as a string', () => {
    const reduxRootSelector = 'testApollo';
    assert.throws( () => new ApolloClient({ reduxRootSelector }));
  });

  it('should throw an error if "reduxRootSelector" is provided and the client tries to create the store', () => {
    const reduxRootSelector = (state: any) => state.testApollo;
    const client = new ApolloClient({
      reduxRootSelector,
    });
    try {
      client.initStore();

      assert.fail();
    } catch (error) {
      assert.equal(
          error.message,
          'Cannot initialize the store because "reduxRootSelector" is provided. ' +
          'reduxRootSelector should only be used when the store is created outside of the client. ' +
          'This may lead to unexpected results when querying the store internally. ' +
          `Please remove that option from ApolloClient constructor.`,
      );
    }
  });

  it('should allow for a single query to take place', () => {
    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

    const data = {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
          },
        ],
      },
    };

    clientRoundrip(query, data);
  });

  it('should allow fragments on root query', () => {
    const query = gql`
      query {
        ...QueryFragment
        records {
          id
        }
      }

      fragment QueryFragment on Query {
        records {
          name
        }
      }
    `;

    const data = {
      records: [
        { id: 1, name: 'One' },
        { id: 2, name: 'Two' },
      ],
    };

    clientRoundrip(query, data);
  });

  it('should allow for a single query with existing store', () => {
    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

    const data = {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
          },
        ],
      },
    };

    const networkInterface = mockNetworkInterface({
      request: { query },
      result: { data },
    });

    const client = new ApolloClient({
      networkInterface,
      addTypename: false,
    });

    createStore(
      combineReducers({
        todos: todosReducer,
        apollo: client.reducer() as any, // XXX see why this type fails
      }),
      applyMiddleware(client.middleware()),
    );

    return client.query({ query })
      .then((result) => {
        assert.deepEqual(result.data, data);
      });
  });

  it('store can be rehydrated from the server', () => {

    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

    const data = {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
          },
        ],
      },
    };

    const networkInterface = mockNetworkInterface({
      request: { query },
      result: { data },
    });

    const initialState: any = {
      apollo: {
        data: {
          'ROOT_QUERY.allPeople({"first":"1"}).people.0': {
            name: 'Luke Skywalker',
          },
          'ROOT_QUERY.allPeople({"first":1})': {
            people: [ {
              type: 'id',
              generated: true,
              id: 'ROOT_QUERY.allPeople({"first":"1"}).people.0',
            } ],
          },
          ROOT_QUERY: {
            'allPeople({"first":1})': {
              type: 'id',
              id: 'ROOT_QUERY.allPeople({"first":1})',
              generated: true,
            },
          },
        },
        optimistic: [],
      },
    };

    const finalState = { apollo: assign({}, initialState.apollo, {
      queries: {
        '1': {
          queryString: print(query),
          document: query,
          variables: {},
          networkStatus: NetworkStatus.ready,
          networkError: null,
          graphQLErrors: [],
          forceFetch: false,
          lastRequestId: 2,
          previousVariables: null,
          metadata: null,
        },
      },
      mutations: {},
      reducerError: null,
    }) };

    const client = new ApolloClient({
      networkInterface,
      initialState,
      addTypename: false,
    });

    return client.query({ query })
      .then((result) => {
        assert.deepEqual(result.data, data);
        assert.deepEqual(finalState, client.store.getState());
      });
  });

  it('allows for a single query with existing store and custom key', () => {
    const reduxRootSelector = (store: any) => store['test'];

    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

    const data = {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
          },
        ],
      },
    };

    const networkInterface = mockNetworkInterface({
      request: { query },
      result: { data },
    });

    const client = new ApolloClient({
      reduxRootSelector,
      networkInterface,
      addTypename: false,
    });

    createStore(
      combineReducers({
        todos: todosReducer,
        test: client.reducer()as any,
      }),
      applyMiddleware(client.middleware()),
    );

    return client.query({ query })
      .then((result: any) => {
        assert.deepEqual(result.data, data);
      });
  });

  it('should return errors correctly for a single query', () => {

    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

    const errors: GraphQLError[] = [
      {
        name: 'test',
        message: 'Syntax Error GraphQL request (8:9) Expected Name, found EOF',
      },
    ];

    const networkInterface = mockNetworkInterface({
      request: { query },
      result: { errors },
    });

    const client = new ApolloClient({
      networkInterface,
      addTypename: false,
    });

    return client.query({ query })
      .catch((error: ApolloError) => {
        assert.deepEqual(error.graphQLErrors, errors);
      });
  });

  it('should surface errors in observer.next as uncaught', (done) => {
    const expectedError = new Error('this error should not reach the store');
    const listeners = process.listeners('uncaughtException');
    const oldHandler = listeners[listeners.length - 1];
    const handleUncaught = (e: Error) => {
      process.removeListener('uncaughtException', handleUncaught);
      process.addListener('uncaughtException', oldHandler);
      if (e === expectedError) {
        done();
      } else {
        done(e);
      }
    };
    process.removeListener('uncaughtException', oldHandler);
    process.addListener('uncaughtException', handleUncaught);
    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

  const data = {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
          },
        ],
      },
    };

    const networkInterface = mockNetworkInterface({
      request: { query },
      result: { data },
    });

    const client = new ApolloClient({
      networkInterface,
      addTypename: false,
    });

    const handle = client.watchQuery({ query });

    handle.subscribe({
      next(result) {
        throw expectedError;
      },
    });
  });

  it('should surfaces errors in observer.error as uncaught', (done) => {
    const expectedError = new Error('this error should not reach the store');
    const listeners = process.listeners('uncaughtException');
    const oldHandler = listeners[listeners.length - 1];
    const handleUncaught = (e: Error) => {
      process.removeListener('uncaughtException', handleUncaught);
      process.addListener('uncaughtException', oldHandler);
      if (e === expectedError) {
        done();
      } else {
        done(e);
      }
    };
    process.removeListener('uncaughtException', oldHandler);
    process.addListener('uncaughtException', handleUncaught);

    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

    const networkInterface = mockNetworkInterface({
      request: { query },
      result: { },
    });

    const client = new ApolloClient({
      networkInterface,
      addTypename: false,
    });

    const handle = client.watchQuery({ query });
    handle.subscribe({
      next() {
        done(new Error('did not expect next to be called'));
      },
      error(err) {
        throw expectedError;
      },
    });
  });

  it('should allow for subscribing to a request', (done) => {

    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

   const data = {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
          },
        ],
      },
    };

    const networkInterface = mockNetworkInterface({
      request: { query },
      result: { data },
    });

    const client = new ApolloClient({
      networkInterface,
      addTypename: false,
    });

    const handle = client.watchQuery({ query });

    handle.subscribe({
      next(result) {
        assert.deepEqual(result.data, data);
        done();
      },
    });
  });

  it('should be able to transform queries', (done) => {
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

    const result = {
      'author': {
        'firstName': 'John',
        'lastName': 'Smith',
      },
    };
    const transformedResult = {
      'author': {
        'firstName': 'John',
        'lastName': 'Smith',
        '__typename': 'Author',
      },
    };

    const networkInterface = mockNetworkInterface(
    {
      request: { query },
      result: { data: result },
    },
    {
      request: { query: transformedQuery },
      result: { data: transformedResult },
    });

    const client = new ApolloClient({
      networkInterface,
      addTypename: true,
    });

    client.query({ query }).then((actualResult) => {
      assert.deepEqual(actualResult.data, transformedResult);
      done();
    });
  });

  it('should be able to transform queries on network-only fetches', (done) => {
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
    const result = {
      'author': {
        'firstName': 'John',
        'lastName': 'Smith',
      },
    };
    const transformedResult = {
      'author': {
        'firstName': 'John',
        'lastName': 'Smith',
        '__typename': 'Author',
      },
    };
    const networkInterface = mockNetworkInterface(
    {
      request: { query },
      result: { data: result },
    },
    {
      request: { query: transformedQuery },
      result: { data: transformedResult },
    });

    const client = new ApolloClient({
      networkInterface,
      addTypename: true,
    });
    client.query({ fetchPolicy: 'network-only', query }).then((actualResult) => {
      assert.deepEqual(actualResult.data, transformedResult);
      done();
    });

  });

  it('should handle named fragments on mutations', (done) => {
    const mutation = gql`
      mutation {
        starAuthor(id: 12) {
          author {
            ...authorDetails
          }
        }
      }
      fragment authorDetails on Author {
        firstName
        lastName
      }`;
    const result = {
      'starAuthor': {
        'author': {
          'firstName': 'John',
          'lastName': 'Smith',
        },
      },
    };
    const networkInterface = mockNetworkInterface(
      {
        request: { query: mutation },
        result: { data: result },
      });
    const client = new ApolloClient({
      networkInterface,
      addTypename: false,
    });
    client.mutate({ mutation }).then((actualResult) => {
      assert.deepEqual(actualResult.data, result);
      done();
    });
  });

  it('should be able to handle named fragments on network-only queries', () => {
    const query = gql`
      fragment authorDetails on Author {
        firstName
        lastName
      }
      query {
        author {
          __typename
          ...authorDetails
        }
      }`;
    const result = {
      'author': {
        __typename: 'Author',
        'firstName': 'John',
        'lastName': 'Smith',
      },
    };

    const networkInterface = mockNetworkInterface({
      request: { query },
      result: { data: result },
    });

    const client = new ApolloClient({
      networkInterface,
      addTypename: false,
    });

    return client.query({ fetchPolicy: 'network-only', query }).then((actualResult) => {
      assert.deepEqual(actualResult.data, result);
    });
  });

  it('should be able to handle named fragments with multiple fragments', () => {
    const query = gql`
      query {
        author {
          __typename
          ...authorDetails
          ...moreDetails
        }
      }
      fragment authorDetails on Author {
        firstName
        lastName
      }
      fragment moreDetails on Author {
        address
      }`;
    const result = {
      'author' : {
        __typename: 'Author',
        'firstName': 'John',
        'lastName': 'Smith',
        'address': '1337 10th St.',
      },
    };

    const networkInterface = mockNetworkInterface(
    {
      request: { query },
      result: { data: result },
    });
    const client = new ApolloClient({
      networkInterface,
      addTypename: false,
    });

    return client.query({ query }).then((actualResult) => {
      assert.deepEqual(actualResult.data, result);
    });
  });

  it('should be able to handle named fragments', (done) => {
    const query = gql`
      query {
        author {
          __typename
          ...authorDetails
        }
      }
      fragment authorDetails on Author {
        firstName
        lastName
      }`;
    const result = {
      'author' : {
        __typename: 'Author',
        'firstName': 'John',
        'lastName': 'Smith',
      },
    };

    const networkInterface = mockNetworkInterface(
    {
      request: { query },
      result: { data: result },
    });
    const client = new ApolloClient({
      networkInterface,
      addTypename: false,
    });
    client.query({ query }).then((actualResult) => {
      assert.deepEqual(actualResult.data, result);
      done();
    });
  });

  it('should send operationName along with the query to the server', (done) => {
    const query = gql`
      query myQueryName {
        fortuneCookie
      }`;
    const data = {
      'fortuneCookie': 'The waiter spit in your food',
    };
    const networkInterface: NetworkInterface = {
      query(request: Request): Promise<ExecutionResult> {
        assert.equal(request.operationName, 'myQueryName');
        return Promise.resolve({ data });
      },
    };
    const client = new ApolloClient({
      networkInterface,
      addTypename: false,
    });
    client.query({ query }).then((actualResult) => {
      assert.deepEqual(actualResult.data, data);
      done();
    });
  });

  it('should send operationName along with the mutation to the server', (done) => {
    const mutation = gql`
      mutation myMutationName {
        fortuneCookie
      }`;
    const data = {
      'fortuneCookie': 'The waiter spit in your food',
    };
    const networkInterface: NetworkInterface = {
      query(request: Request): Promise<ExecutionResult> {
        assert.equal(request.operationName, 'myMutationName');
        return Promise.resolve({ data });
      },
    };
    const client = new ApolloClient({
      networkInterface,
      addTypename: false,
    });
    client.mutate({ mutation }).then((actualResult) => {
      assert.deepEqual(actualResult.data, data);
      done();
    });
  });

  it('does not deduplicate queries if option is set to false', () => {
    const queryDoc = gql`
      query {
        author {
          name
        }
      }`;
    const data = {
      author: {
        name: 'Jonas',
      },
    };
    const data2 = {
      author: {
        name: 'Dhaivat',
      },
    };

    // we have two responses for identical queries, but only the first should be requested.
    // the second one should never make it through to the network interface.
    const networkInterface = mockNetworkInterface({
      request: { query: queryDoc },
      result: { data },
      delay: 10,
    },
    {
      request: { query: queryDoc },
      result: { data: data2 },
    });
    const client = new ApolloClient({
      networkInterface,
      addTypename: false,
      queryDeduplication: false,
    });

    const q1 = client.query({ query: queryDoc });
    const q2 = client.query({ query: queryDoc });

    // if deduplication happened, result2.data will equal data.
    return Promise.all([q1, q2]).then(([result1, result2]) => {
      assert.deepEqual(result1.data, data);
      assert.deepEqual(result2.data, data2);
    });
  });

  it('deduplicates queries by default', () => {
    const queryDoc = gql`
      query {
        author {
          name
        }
      }`;
    const data = {
      author: {
        name: 'Jonas',
      },
    };
    const data2 = {
      author: {
        name: 'Dhaivat',
      },
    };

    // we have two responses for identical queries, but only the first should be requested.
    // the second one should never make it through to the network interface.
    const networkInterface = mockNetworkInterface({
      request: { query: queryDoc },
      result: { data },
      delay: 10,
    },
    {
      request: { query: queryDoc },
      result: { data: data2 },
    });
    const client = new ApolloClient({
      networkInterface,
      addTypename: false,
    });

    const q1 = client.query({ query: queryDoc });
    const q2 = client.query({ query: queryDoc });

    // if deduplication didn't happen, result.data will equal data2.
    return Promise.all([q1, q2]).then(([result1, result2]) => {
      assert.deepEqual(result1.data, result2.data);
    });
  });

  describe('accepts dataIdFromObject option', () => {
    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            id
            name
          }
        }
      }
    `;

    const data = {
      allPeople: {
        people: [
          {
            id: '1',
            name: 'Luke Skywalker',
          },
        ],
      },
    };

    it('for internal store', () => {
      const networkInterface = mockNetworkInterface({
        request: { query },
        result: { data },
      });

      const client = new ApolloClient({
        networkInterface,
        dataIdFromObject: (obj: { id: any }) => obj.id,
        addTypename: false,
      });

      return client.query({ query })
        .then((result) => {
          assert.deepEqual(result.data, data);
          assert.deepEqual(client.store.getState()['apollo'].data['1'],
            {
              id: '1',
              name: 'Luke Skywalker',
            },
          );
        });
    });

    it('for existing store', () => {
      const networkInterface = mockNetworkInterface({
        request: { query },
        result: { data },
      });

      const client = new ApolloClient({
        networkInterface,
        dataIdFromObject: (obj: { id: any }) => obj.id,
        addTypename: false,
      });

      const store = createStore(
        combineReducers({
          apollo: client.reducer()as any,
        }),
        applyMiddleware(client.middleware()),
      );


      return client.query({ query })
        .then((result) => {
          assert.deepEqual(result.data, data);
          assert.deepEqual((store.getState() as any)['apollo'].data['1'],
            {
              id: '1',
              name: 'Luke Skywalker',
            },
          );
        });
    });
  });

  describe('network-only fetchPolicy', () => {
    const query = gql`
      query number {
        myNumber {
          n
        }
      }
    `;

    const firstFetch = {
      myNumber: {
        n: 1,
      },
    };
    const secondFetch = {
      myNumber: {
        n: 2,
      },
    };


    let networkInterface: any;
    let clock: any;
    beforeEach(() => {
      networkInterface = mockNetworkInterface({
        request: { query },
        result: { data: firstFetch },
      }, {
        request: { query },
        result: { data: secondFetch },
      });
    });

    afterEach(() => {
      if (clock) {
        clock.restore();
      }
    });

    it('forces the query to rerun', () => {
      const client = new ApolloClient({
        networkInterface,
        addTypename: false,
      });

      // Run a query first to initialize the store
      return client.query({ query })
        // then query for real
        .then(() => client.query({ query, fetchPolicy: 'network-only' }))
        .then((result) => {
          assert.deepEqual(result.data, { myNumber: { n: 2 } });
        });
    });

    it('can be disabled with ssrMode', () => {
      const client = new ApolloClient({
        networkInterface,
        ssrMode: true,
        addTypename: false,
      });

      const options = { query, fetchPolicy: 'network-only' };

      // Run a query first to initialize the store
      return client.query({ query })
        // then query for real
        .then(() => client.query(options))
        .then((result) => {
          assert.deepEqual(result.data, { myNumber: { n: 1 } });

          // Test that options weren't mutated, issue #339
          assert.deepEqual(options, { query, fetchPolicy: 'network-only' });
        });
    });

    it('can temporarily be disabled with ssrForceFetchDelay', () => {
      clock = sinon.useFakeTimers();

      const client = new ApolloClient({
        networkInterface,
        ssrForceFetchDelay: 100,
        addTypename: false,
      });

      // Run a query first to initialize the store
      const outerPromise = client.query({ query })
        // then query for real
        .then(() => {
          const promise = client.query({ query, fetchPolicy: 'network-only' });
          clock.tick(0);
          return promise;
        })
        .then((result) => {
          assert.deepEqual(result.data, { myNumber: { n: 1 } });
          clock.tick(100);
          const promise = client.query({ query, fetchPolicy: 'network-only' });
          clock.tick(0);
          return promise;
        })
        .then((result) => {
          assert.deepEqual(result.data, { myNumber: { n: 2 } });
        });
      clock.tick(0);
      return outerPromise;
    });
  });

  it('should expose a method called printAST that is prints graphql queries', () => {
    const query = gql`
      query {
        fortuneCookie
      }`;

    assert.equal(printAST(query), print(query));
  });

  it('should pass a network error correctly on a mutation', (done) => {
    const mutation = gql`
      mutation {
        person {
          firstName
          lastName
        }
      }`;
    const data = {
      person: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    const networkError = new Error('Some kind of network error.');
    const client = new ApolloClient({
      networkInterface: mockNetworkInterface({
        request: { query: mutation },
        result: { data },
        error: networkError,
      }),
      addTypename: false,
    });

    client.mutate({ mutation }).then((result) => {
      done(new Error('Returned a result when it should not have.'));
    }).catch((error: ApolloError) => {
      assert(error.networkError);
      assert.equal(error.networkError!.message, networkError.message);
      done();
    });
  });

  it('should pass a GraphQL error correctly on a mutation', (done) => {
    const mutation = gql`
      mutation {
        newPerson {
          person {
            firstName
            lastName
          }
        }
      }`;
    const data = {
      person: {
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    const errors = [ new Error('Some kind of GraphQL error.') ];
    const client = new ApolloClient({
      networkInterface: mockNetworkInterface({
        request: { query: mutation },
        result: { data, errors },
      }),
      addTypename: false,
    });
    client.mutate({ mutation }).then((result) => {
      done(new Error('Returned a result when it should not have.'));
    }).catch((error: ApolloError) => {
      assert(error.graphQLErrors);
      assert.equal(error.graphQLErrors.length, 1);
      assert.equal(error.graphQLErrors[0].message, errors[0].message);
      done();
    });
  });

  it('has a resetStore method which calls QueryManager', (done) => {
    const client = new ApolloClient();
    client.queryManager = {
      resetStore: () => {
        done();
      },
    } as QueryManager;
    client.resetStore();
  });

  it('should allow us to create a network interface with transport-level batching', (done) => {
    const firstQuery = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;
    const firstResult = {
      data: {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      },
      loading: false,
    };
    const secondQuery = gql`
      query {
        person {
          name
        }
      }`;
    const secondResult = {
      data: {
        person: {
          name: 'Jane Smith',
        },
      },
    };
    const url = 'http://not-a-real-url.com';
    const oldFetch = fetch;
    fetch = createMockFetch({
      url,
      opts: {
        body: JSON.stringify([
          {
            query: print(firstQuery),
          },
          {
            query: print(secondQuery),
          },
        ]),
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
      result: createMockedIResponse([firstResult, secondResult]),
    });
    const networkInterface = createBatchingNetworkInterface({
      uri: 'http://not-a-real-url.com',
      batchInterval: 5,
      opts: {},
    });
    Promise.all([
      networkInterface.query({ query: firstQuery }),
      networkInterface.query({ query: secondQuery }),
    ]).then((results) => {
      assert.deepEqual(results, [firstResult, secondResult]);
      fetch = oldFetch;
      done();
    }).catch( e => {
      console.error(e);
    });
  });

  it('should throw an error if response to batch request is not an array', (done) => {
    const firstQuery = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;
    const firstResult = {
      data: {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      },
      loading: false,
    };
    const secondQuery = gql`
      query {
        person {
          name
        }
      }`;
    const url = 'http://not-a-real-url.com';
    const oldFetch = fetch;
    fetch = createMockFetch({
      url,
      opts: {
        body: JSON.stringify([
          {
            query: print(firstQuery),
          },
          {
            query: print(secondQuery),
          },
        ]),
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
      result: createMockedIResponse(firstResult),
    });
    const networkInterface = createBatchingNetworkInterface({
      uri: 'http://not-a-real-url.com',
      batchInterval: 5,
      opts: {},
    });
    Promise.all([
      networkInterface.query({ query: firstQuery }),
      networkInterface.query({ query: secondQuery }),
    ]).then((results) => {
      assert.equal(true, false, 'expected response to throw an error');
    }).catch( e => {
      assert.equal(e.message, 'BatchingNetworkInterface: server response is not an array');
      fetch = oldFetch;
      done();
    });
  });

  it('should not do transport-level batching when the interval is exceeded', (done) => {
    const firstQuery = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;
    const firstResult = {
      data: {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      },
      loading: false,
    };
    const secondQuery = gql`
      query {
        person {
          name
        }
      }`;
    const secondResult = {
      data: {
        person: {
          name: 'Jane Smith',
        },
      },
    };
    const url = 'http://not-a-real-url.com';
    const oldFetch = fetch;
    fetch = createMockFetch({
      url,
      opts: {
        body: JSON.stringify([
          {
            query: print(firstQuery),
          },
        ]),
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
      result: createMockedIResponse([firstResult]),
    }, {
      url,
      opts: {
        body: JSON.stringify([
                    {
            query: print(secondQuery),
          },
        ]),
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
      result: createMockedIResponse([secondResult]),
    });
    const networkInterface = createBatchingNetworkInterface({
      uri: 'http://not-a-real-url.com',
      batchInterval: 5,
      opts: {},
    });
    Promise.all([
      networkInterface.query({ query: firstQuery }),
      new Promise( (resolve, reject) =>
        setTimeout(() => resolve(networkInterface.query({ query: secondQuery })), 10)),
    ]).then((results) => {
      assert.deepEqual(results, [firstResult, secondResult]);
      fetch = oldFetch;
      done();
    }).catch( e => {
      console.error(e);
    });
  });

  it('should enable dev tools logging', () => {
    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

    const data = {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
          },
        ],
      },
    };

    it('with self-made store', () => {
      const networkInterface = mockNetworkInterface({
        request: { query: cloneDeep(query) },
        result: { data },
      });

      const client = new ApolloClient({
        networkInterface,
        addTypename: false,
      });

      const log: any[] = [];
      client.__actionHookForDevTools((entry: any) => {
        log.push(entry);
      });

      return client.query({ query })
        .then(() => {
          assert.equal(log.length, 2);
          assert.equal(log[1].state.queries['0'].loading, false);
        });
    });

    it('with passed in store', () => {
      const networkInterface = mockNetworkInterface({
        request: { query: cloneDeep(query) },
        result: { data },
      });

      const client = new ApolloClient({
        networkInterface,
        addTypename: false,
      });

      createStore(
        combineReducers({
          apollo: client.reducer() as any,
        }),
        {}, // initial state
        applyMiddleware(client.middleware()),
      );

      const log: any[] = [];
      client.__actionHookForDevTools((entry: any) => {
        log.push(entry);
      });

      return client.query({ query })
        .then(() => {
          assert.equal(log.length, 2);
        });
    });
  });

  it('should propagate errors from network interface to observers', (done) => {

    const networkInterface = {
      query: () => Promise.reject(new Error('Uh oh!')),
    };

    const client = new ApolloClient({
      networkInterface,
      addTypename: false,
    });

    const handle = client.watchQuery({ query: gql`query { a b c }` });

    handle.subscribe({
      error(error) {
        assert.equal(error.message, 'Network error: Uh oh!');
        done();
      },
    });
  });
});

function clientRoundrip(
  query: DocumentNode,
  data: ExecutionResult,
  variables?: any,
) {
  const networkInterface = mockNetworkInterface({
    request: { query: cloneDeep(query) },
    result: { data },
  });

  const client = new ApolloClient({
    networkInterface,
  });

  return client.query({ query, variables })
    .then((result) => {
      assert.deepEqual(result.data, data);
    });
}
