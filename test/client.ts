import * as chai from 'chai';
const { assert } = chai;
import * as sinon from 'sinon';

import ApolloClient, {
  createFragment,
  fragmentDefinitionsMap,
  clearFragmentDefinitions,
  disableFragmentWarnings,
  printAST,
  enableFragmentWarnings,
} from '../src';

import {
  GraphQLError,
  OperationDefinition,
  GraphQLResult,
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
} from 'graphql-tag/printer';

import {
  createStore,
  Store as ReduxStore,
  combineReducers,
  applyMiddleware,
} from 'redux';

import {
  createApolloStore,
} from '../src/store';

import {
  QueryManager,
} from '../src/QueryManager';

import {
  createNetworkInterface,
  HTTPNetworkInterface,
  Request,
  NetworkInterface,
  addQueryMerging,
} from '../src/networkInterface';

import { addTypenameToSelectionSet } from '../src/queries/queryTransform';

import mockNetworkInterface from './mocks/mockNetworkInterface';

import { getFragmentDefinitions } from '../src/queries/getFromAST';

import * as chaiAsPromised from 'chai-as-promised';

import { ApolloError } from '../src/errors';

import {
  createMockFetch,
  createMockedIResponse,
} from './mocks/mockFetch';

// make it easy to assert with promises
chai.use(chaiAsPromised);

// Turn off warnings for repeated fragment names
disableFragmentWarnings();

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
    const networkInterface = createNetworkInterface('swapi');
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
      applyMiddleware(client.middleware())
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
        applyMiddleware(client.middleware())
      );

      assert.fail();
    } catch (error) {
      assert.equal(
        error.message,
        'Existing store does not use apolloReducer. Please make sure the store ' +
        'is properly configured and "reduxRootSelector" is correctly specified.'
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
        },
      }
    );
  });

  it('sets reduxRootKey by default (backcompat)', () => {
    const client = new ApolloClient();

    client.initStore();

    assert.equal(client.reduxRootKey, 'apollo');
  });

  it('sets reduxRootKey if you use ApolloClient as middleware', () => {
    const client = new ApolloClient();

    createStore(
        combineReducers({
          apollo: client.reducer(),
        } as any),
        // here "client.setStore(store)" will be called internally,
        // this method throws if "reduxRootSelector" or "reduxRootKey"
        // are not configured properly
        applyMiddleware(client.middleware())
    );

    assert.equal(client.reduxRootKey, 'apollo');
  });

  it('can allow passing in a top level key', () => {
    const reduxRootKey = 'testApollo';
    const client = new ApolloClient({
      reduxRootKey,
    });

    // shouldn't throw
    createStore(
        combineReducers({
          testApollo: client.reducer(),
        } as any),
        // here "client.setStore(store)" will be called internally,
        // this method throws if "reduxRootSelector" or "reduxRootKey"
        // are not configured properly
        applyMiddleware(client.middleware())
    );

    // Check if the key is added to the client instance, like before
    assert.equal(client.reduxRootKey, 'testApollo');
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
        applyMiddleware(client.middleware())
    );
  });

  it('should allow passing reduxRootSelector as a string', () => {
    const reduxRootSelector = 'testApollo';
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
        applyMiddleware(client.middleware())
    );

    // Check if the key is added to the client instance, like before
    assert.equal(client.reduxRootKey, 'testApollo');
  });

  it('should throw an error if both "reduxRootKey" and "reduxRootSelector" are passed', () => {
    const reduxRootSelector = (state: any) => state.testApollo;
    try {
      new ApolloClient({
        reduxRootKey: 'apollo',
        reduxRootSelector,
      });

      assert.fail();
    } catch (error) {
      assert.equal(
          error.message,
          'Both "reduxRootKey" and "reduxRootSelector" are configured, but only one of two is allowed.'
      );
    }

  });

  it('should throw an error if "reduxRootKey" is provided and the client tries to create the store', () => {
    const client = new ApolloClient({
      reduxRootKey: 'test',
    });
    try {
      client.initStore();

      assert.fail();
    } catch (error) {
      assert.equal(
          error.message,
          'Cannot initialize the store because "reduxRootSelector" or "reduxRootKey" is provided. ' +
          'They should only be used when the store is created outside of the client. ' +
          'This may lead to unexpected results when querying the store internally. ' +
          `Please remove that option from ApolloClient constructor.`
      );
    }
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
          'Cannot initialize the store because "reduxRootSelector" or "reduxRootKey" is provided. ' +
          'They should only be used when the store is created outside of the client. ' +
          'This may lead to unexpected results when querying the store internally. ' +
          `Please remove that option from ApolloClient constructor.`
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

    const networkInterface = mockNetworkInterface({
      request: { query },
      result: { data },
    });

    const client = new ApolloClient({
      networkInterface,
    });

    return client.query({ query })
      .then((result) => {
        assert.deepEqual(result.data, data);
      });
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
    });

    createStore(
      combineReducers({
        todos: todosReducer,
        apollo: client.reducer() as any, // XXX see why this type fails
      }),
      applyMiddleware(client.middleware())
    );

    return client.query({ query })
      .then((result) => {
        assert.deepEqual(result.data, data);
      });
  });

  it('can allow the store to be rehydrated from the server', () => {

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
        queries: {
          '0': {
            queryString: print(query),
            query: {
              id: 'ROOT_QUERY',
              typeName: 'Query',
              selectionSet: (query.definitions[0] as OperationDefinition).selectionSet,
            },
            minimizedQueryString: null,
            minimizedQuery: null,
            variables: undefined,
            loading: false,
            stopped: false,
            networkError: null,
            graphQLErrors: null,
            forceFetch: false,
            fragmentMap: {},
            returnPartialData: false,
            lastRequestId: 1,
            previousVariables: null,
          },
        },
        mutations: {},
        data: {
          'ROOT_QUERY.allPeople({"first":"1"}).people.0': {
            name: 'Luke Skywalker',
          },
          'ROOT_QUERY.allPeople({"first":1})': {
            people: [ 'ROOT_QUERY.allPeople({"first":"1"}).people.0' ],
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

    const client = new ApolloClient({
      networkInterface,
      initialState,
    });

    return client.query({ query })
      .then((result) => {
        assert.deepEqual(result.data, data);
        assert.deepEqual(initialState, client.store.getState());
      });
  });

  it('allows for a single query with existing store and custom key', () => {
    const reduxRootKey = 'test';

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
      reduxRootKey,
      networkInterface,
    });

    createStore(
      combineReducers({
        todos: todosReducer,
        [reduxRootKey]: client.reducer()as any,
      }),
      applyMiddleware(client.middleware())
    );

    return client.query({ query })
      .then((result) => {
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
    });

    return client.query({ query })
      .catch((error) => {
        const apolloError = error as ApolloError;
        assert.deepEqual(apolloError.graphQLErrors, errors);
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
      queryTransformer: addTypenameToSelectionSet,
    });

    client.query({ query }).then((actualResult) => {
      assert.deepEqual(actualResult.data, transformedResult);
      done();
    });
  });

  it('should be able to transform queries on forced fetches', (done) => {
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
      queryTransformer: addTypenameToSelectionSet,
    });
    client.query({ forceFetch: true, query }).then((actualResult) => {
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
    });
    client.mutate({ mutation }).then((actualResult) => {
      assert.deepEqual(actualResult.data, result);
      done();
    });
  });

  it('should be able to handle named fragments on forced fetches', (done) => {
    const query = gql`
      fragment authorDetails on Author {
        firstName
        lastName
      }
      query {
        author {
          ...authorDetails
        }
      }`;
    const result = {
      'author': {
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
    });
    client.query({ forceFetch: true, query }).then((actualResult) => {
      assert.deepEqual(actualResult.data, result);
      done();
    });
  });

  it('should be able to handle named fragments with multiple fragments', (done) => {
    const query = gql`
      query {
        author {
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
    });
    client.query({ query }).then((actualResult) => {
      assert.deepEqual(actualResult.data, result);
      done();
    });
  });

  it('should be able to handle named fragments', (done) => {
    const query = gql`
      query {
        author {
          ...authorDetails
        }
      }
      fragment authorDetails on Author {
        firstName
        lastName
      }`;
    const result = {
      'author' : {
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
    });
    client.query({ query }).then((actualResult) => {
      assert.deepEqual(actualResult.data, result);
      done();
    });
  });

  describe('directives', () => {
    it('should reject the query promise if skipped data arrives in the result', (done) => {
      const query = gql`
        query {
          fortuneCookie @skip(if: true)
          otherThing
        }`;
      const result = {
        fortuneCookie: 'you will go far',
        otherThing: 'false',
      };
      const networkInterface = mockNetworkInterface(
        {
          request: { query },
          result: { data: result },
        }
      );
      const client = new ApolloClient({
        networkInterface,
      });
      // we need this so it doesn't print out a bunch of stuff we don't need
      // when we're trying to test an exception.
      client.store = createApolloStore({ reportCrashes: false });
      client.queryManager = new QueryManager({
        networkInterface,
        store: client.store,
        reduxRootSelector: (state) => state.apollo,
      });

      client.query({ query }).then(() => {
        // do nothing
      }).catch((error) => {
        assert.include(error.message, 'Found extra field');
        done();
      });
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
      query(request: Request): Promise<GraphQLResult> {
        assert.equal(request.operationName, 'myQueryName');
        return Promise.resolve({ data });
      },
    };
    const client = new ApolloClient({
      networkInterface,
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
      query(request: Request): Promise<GraphQLResult> {
        assert.equal(request.operationName, 'myMutationName');
        return Promise.resolve({ data });
      },
    };
    const client = new ApolloClient({
      networkInterface,
    });
    client.mutate({ mutation }).then((actualResult) => {
      assert.deepEqual(actualResult.data, data);
      done();
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
      });

      return client.query({ query })
        .then((result) => {
          assert.deepEqual(result.data, data);
          assert.deepEqual(client.store.getState()['apollo'].data['1'],
            {
              id: '1',
              name: 'Luke Skywalker',
            }
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
      });

      const store = createStore(
        combineReducers({
          apollo: client.reducer()as any,
        }),
        applyMiddleware(client.middleware())
      );


      return client.query({ query })
        .then((result) => {
          assert.deepEqual(result.data, data);
          assert.deepEqual((store.getState() as any)['apollo'].data['1'],
            {
              id: '1',
              name: 'Luke Skywalker',
            }
          );
        });
    });
  });

  describe('forceFetch', () => {
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
      });

      // Run a query first to initialize the store
      return client.query({ query })
        // then query for real
        .then(() => client.query({ query, forceFetch: true }))
        .then((result) => {
          assert.deepEqual(result.data, { myNumber: { n: 2 } });
        });
    });

    it('can be disabled with ssrMode', () => {
      const client = new ApolloClient({
        networkInterface,
        ssrMode: true,
      });

      const options = { query, forceFetch: true };

      // Run a query first to initialize the store
      return client.query({ query })
        // then query for real
        .then(() => client.query(options))
        .then((result) => {
          assert.deepEqual(result.data, { myNumber: { n: 1 } });

          // Test that options weren't mutated, issue #339
          assert.deepEqual(options, { query, forceFetch: true });
        });
    });

    it('can temporarily be disabled with ssrForceFetchDelay', () => {
      clock = sinon.useFakeTimers();

      const client = new ApolloClient({
        networkInterface,
        ssrForceFetchDelay: 100,
      });

      // Run a query first to initialize the store
      const outerPromise = client.query({ query })
        // then query for real
        .then(() => {
          const promise = client.query({ query, forceFetch: true });
          clock.tick(0);
          return promise;
        })
        .then((result) => {
          assert.deepEqual(result.data, { myNumber: { n: 1 } });
          clock.tick(100);
          const promise = client.query({ query, forceFetch: true });
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

  describe('fragment referencing', () => {
    afterEach(() => {
      // after each test, we have to empty out fragmentDefinitionsMap since that is
      // global state that will be held across all client instances.
      clearFragmentDefinitions();
    });

    it('should return a fragment def with a unique name', () => {
      const fragment = gql`
        fragment authorDetails on Author {
          author {
            firstName
            lastName
          }
        }
      `;
      const fragmentDefs = createFragment(fragment);
      assert.equal(fragmentDefs.length, 1);
      assert.equal(print(fragmentDefs[0]), print(getFragmentDefinitions(fragment)[0]));
    });

    it('should correctly return multiple fragments from a single document', () => {
      const fragmentDoc = gql`
        fragment authorDetails on Author {
          firstName
          lastName
        }
        fragment personDetails on Person {
          name
        }
        `;
      const fragmentDefs = createFragment(fragmentDoc);
      assert.equal(fragmentDefs.length, 2);
      const expFragmentDefs = getFragmentDefinitions(fragmentDoc);
      assert.equal(print(fragmentDefs[0]), print(expFragmentDefs[0]));
      assert.equal(print(fragmentDefs[1]), print(expFragmentDefs[1]));
    });

    it('should correctly return fragment defs with one fragment depending on another', () => {
      const fragmentDoc = gql`
        fragment authorDetails on Author {
          firstName
          lastName
          ...otherAuthorDetails
        }`;
      const otherFragmentDoc = gql`
        fragment otherFragmentDoc on Author {
          address
        }`;
      const fragmentDefs = createFragment(fragmentDoc, getFragmentDefinitions(otherFragmentDoc));
      assert.equal(fragmentDefs.length, 2);
      const expFragmentDefs = getFragmentDefinitions(otherFragmentDoc)
        .concat(getFragmentDefinitions(fragmentDoc));
      assert.deepEqual(fragmentDefs.map(print), expFragmentDefs.map(print));
    });

    it('should return fragment defs with a multiple fragments depending on other fragments', () => {
      const fragmentDoc = gql`
        fragment authorDetails on Author {
          firstName
          lastName
          ...otherAuthorDetails
        }

        fragment onlineAuthorDetails on Author {
          email
          ...otherAuthorDetails
        }`;
      const otherFragmentDoc = gql`
        fragment otherAuthorDetails on Author {
          address
        }`;
      const fragmentDefs = createFragment(fragmentDoc, getFragmentDefinitions(otherFragmentDoc));
      assert.equal(fragmentDefs.length, 3);

      const expFragmentDefs = getFragmentDefinitions(otherFragmentDoc)
        .concat(getFragmentDefinitions(fragmentDoc));
      assert.deepEqual(fragmentDefs.map(print), expFragmentDefs.map(print));
    });

    it('should always return a flat array of fragment defs', () => {
      const fragmentDoc1 = gql`
        fragment authorDetails on Author {
          firstName
          lastName
          ...otherAuthorDetails
        }`;
      const fragmentDoc2 = gql`
        fragment otherAuthorDetails on Author {
          address
        }`;
      const fragmentDoc3 = gql`
        fragment personDetails on Person {
          personDetails
        }`;
      const fragments1 = createFragment(fragmentDoc1);
      const fragments2 = createFragment(fragmentDoc2);
      const fragments3 = createFragment(fragmentDoc3, [fragments1, fragments2]);
      assert.equal(fragments1.length, 1);
      assert.equal(fragments2.length, 1);
      assert.equal(fragments3.length, 3);
    });

    it('should add a fragment to the fragmentDefinitionsMap', () => {
      const fragmentDoc = gql`
        fragment authorDetails on Author {
          firstName
          lastName
        }`;
      createFragment(fragmentDoc);
      assert.equal(Object.keys(fragmentDefinitionsMap).length, 1);
      assert(fragmentDefinitionsMap.hasOwnProperty('authorDetails'));
      assert.equal(fragmentDefinitionsMap['authorDetails'].length, 1);
      assert.equal(print(fragmentDefinitionsMap['authorDetails']), print(getFragmentDefinitions(fragmentDoc)[0]));
    });

    it('should add fragments with the same name to fragmentDefinitionsMap + print warning', () => {
      const fragmentDoc = gql`
        fragment authorDetails on Author {
          firstName
          lastName
        }
        fragment authorDetails on Author {
          address
        }`;

      // hacky solution that allows us to test whether the warning is printed
      const oldWarn = console.warn;
      console.warn = (str: string) => {
        assert.include(str, 'Warning: fragment with name');
      };

      createFragment(fragmentDoc);
      assert.equal(Object.keys(fragmentDefinitionsMap).length, 1);
      assert.equal(fragmentDefinitionsMap['authorDetails'].length, 2);
      console.warn = oldWarn;
    });

    it('should issue a warning if we try query with a conflicting fragment name', (done) => {
      enableFragmentWarnings();

      const client = new ApolloClient({
        networkInterface: mockNetworkInterface(),
      });
      const fragmentDoc = gql`
        fragment authorDetails on Author {
          firstName
          lastName
        }`;
      const queryDoc = gql`
        query {
          author {
            firstName
            lastName
          }
        }
        fragment authorDetails on Author {
          firstName
          lastName
        }`;
      createFragment(fragmentDoc);

      const oldWarn = console.warn;
      console.warn = (str: string) => {
        assert.include(str, 'Warning: fragment with name');
        console.warn = oldWarn;
        done();
      };
      client.query({ query: queryDoc });

      disableFragmentWarnings();
    });

    it('should issue a warning if we try to watchQuery with a conflicting fragment name', (done) => {
      enableFragmentWarnings();

      const client = new ApolloClient({
        networkInterface: mockNetworkInterface(),
      });
      const fragmentDoc = gql`
        fragment authorDetails on Author {
          firstName
          lastName
        }`;
      const queryDoc = gql`
        query {
          author {
            firstName
            lastName
          }
        }
        fragment authorDetails on Author {
          firstName
          lastName
        }`;
      createFragment(fragmentDoc);

      const oldWarn = console.warn;
      console.warn = (str: string) => {
        assert.include(str, 'Warning: fragment with name');
        console.warn = oldWarn;
        done();
      };
      client.watchQuery({ query: queryDoc });

      disableFragmentWarnings();
    });

    it('should allow passing fragments to query', (done) => {
      const queryDoc = gql`
        query {
          author {
            ...authorDetails
          }
        }`;
      const composedQuery = gql`
        query {
          author {
            ...authorDetails
          }
        }
        fragment authorDetails on Author {
          firstName
          lastName
        }`;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const networkInterface = mockNetworkInterface({
        request: { query: composedQuery },
        result: { data },
      });
      const client = new ApolloClient({
        networkInterface,
      });
      const fragmentDefs = createFragment(gql`
        fragment authorDetails on Author {
          firstName
          lastName
        }`);

      client.query({ query: queryDoc, fragments: fragmentDefs }).then((result) => {
        assert.deepEqual(result.data, data);
        done();
      });
    });

    it('show allow passing fragments to mutate', (done) => {
      const mutationDoc = gql`
        mutation createAuthor {
          createAuthor {
            ...authorDetails
          }
        }`;
      const composedMutation = gql`
        mutation createAuthor {
          createAuthor {
            ...authorDetails
          }
        }
        fragment authorDetails on Author {
          firstName
          lastName
        }`;
      const data = {
        createAuthor: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const networkInterface = mockNetworkInterface({
        request: { query: composedMutation },
        result: { data },
      });
      const client = new ApolloClient({
        networkInterface,
      });
      const fragmentDefs = createFragment(gql`
        fragment authorDetails on Author {
          firstName
          lastName
        }`);

      client.mutate({ mutation: mutationDoc, fragments: fragmentDefs }).then((result) => {
        assert.deepEqual(result, { data });
        done();
      });
    });

    it('should allow passing fragments to watchQuery', (done) => {
      const queryDoc = gql`
        query {
          author {
            ...authorDetails
          }
        }`;
      const composedQuery = gql`
        query {
          author {
            ...authorDetails
          }
        }
        fragment authorDetails on Author {
          firstName
          lastName
        }`;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const networkInterface = mockNetworkInterface({
        request: { query: composedQuery },
        result: { data },
      });
      const client = new ApolloClient({
        networkInterface,
      });
      const fragmentDefs = createFragment(gql`
        fragment authorDetails on Author {
          firstName
          lastName
        }`);

      const observer = client.watchQuery({ query: queryDoc, fragments: fragmentDefs });
      observer.subscribe({
        next(result) {
          assert.deepEqual(result.data, data);
          done();
        },
      });
    });

    it('should allow referencing named fragments with batching + merging turned on', (done) => {
      const personDetails = createFragment(gql`
        fragment personDetails on Person {
          firstName
          lastName
        }`);

      const query1 = gql`
        query personInfo {
          person {
            ...personDetails
          }
        }`;
      const query2 = gql`
        query authorPopularity {
          author {
            popularity
          }
        }`;

      const data1 = {
        person: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const data2 = {
        author: {
          popularity: 0.9,
        },
      };
      const composedQuery = gql`
        query ___composed {
          ___personInfo___requestIndex_0___fieldIndex_0: person {
            ...___personInfo___requestIndex_0___personDetails
          }

          ___authorPopularity___requestIndex_1___fieldIndex_0: author {
            popularity
          }
        }
        fragment ___personInfo___requestIndex_0___personDetails on Person {
          ___personInfo___requestIndex_0___fieldIndex_1: firstName
          ___personInfo___requestIndex_0___fieldIndex_2: lastName
        }`;
      const composedResult = {
        ___personInfo___requestIndex_0___fieldIndex_0: {
          ___personInfo___requestIndex_0___fieldIndex_1: 'John',
          ___personInfo___requestIndex_0___fieldIndex_2: 'Smith',
        },
        ___authorPopularity___requestIndex_1___fieldIndex_0: data2.author,
      };
      const networkInterface = addQueryMerging(mockNetworkInterface({
        request: { query: composedQuery, debugName: '___composed' },
        result: { data: composedResult },
      }));
      const client = new ApolloClient({
        networkInterface,
        shouldBatch: true,
      });
      const promise1 = client.query({ query: query1, fragments: personDetails });
      client.query({ query: query2 });
      promise1.then((result) => {
        assert.deepEqual(result.data, data1);
        done();
      });
    });

    it('should allow passing fragments in polling queries', (done) => {
      const queryDoc = gql`
        query {
          author {
            ...authorDetails
          }
        }`;
      const composedQuery = gql`
        query {
          author {
            ...authorDetails
          }
        }
        fragment authorDetails on Author {
          firstName
          lastName
        }`;
      const data = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const networkInterface = mockNetworkInterface({
        request: { query: composedQuery },
        result: { data },
      });
      const client = new ApolloClient({
        networkInterface,
      });
      const fragmentDefs = createFragment(gql`
        fragment authorDetails on Author {
          firstName
          lastName
        }`);

      const observer = client.watchQuery(
        { query: queryDoc, pollInterval: 30, fragments: fragmentDefs});
      const subscription = observer.subscribe({
        next(result) {
          assert.deepEqual(result.data, data);
          subscription.unsubscribe();
          done();
        },
      });
    });

    it('should not print a warning if we call disableFragmentWarnings', (done) => {
      const oldWarn = console.warn;
      console.warn = (str: string) => {
        done(new Error('Returned a warning despite calling disableFragmentWarnings'));
      };
      disableFragmentWarnings();
      createFragment(gql`
        fragment authorDetails on Author {
          firstName
        }
      `);
      createFragment(gql`
        fragment authorDetails on Author {
          lastName
        }`);

      // create fragment operates synchronously so if it returns and doesn't call
      // console.warn, we are done.
      setTimeout(() => {
        console.warn = oldWarn;
        done();
      }, 100);
    });

    it('should not add multiple instances of the same fragment to fragmentDefinitionsMap', () => {
      createFragment(gql`
        fragment authorDetails on Author {
          author {
            firstName
            lastName
          }
        }`);
      createFragment(gql`
        fragment authorDetails on Author {
          author {
            firstName
            lastName
          }
        }`);
      assert(fragmentDefinitionsMap.hasOwnProperty('authorDetails'));
      assert.equal(fragmentDefinitionsMap['authorDetails'].length, 1);
    });

    it('should not mutate the input document when querying', () => {
      const client = new ApolloClient();

      const fragments = createFragment(gql`
        fragment authorDetails on Author {
          author {
            firstName
            lastName
          }
        }`);
      const query = gql`{ author { ...authorDetails } }`;
      const initialDefinitions = query.definitions;
      client.query({query, fragments});
      assert.equal(query.definitions, initialDefinitions);
    });
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
    });

    client.mutate({ mutation }).then((result) => {
      done(new Error('Returned a result when it should not have.'));
    }).catch((error) => {
      const apolloError = error as ApolloError;
      assert(apolloError.networkError);
      assert.equal(apolloError.networkError.message, networkError.message);
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
    });
    client.mutate({ mutation }).then((result) => {
      done(new Error('Returned a result when it should not have.'));
    }).catch((error) => {
      const apolloError = error as ApolloError;
      assert(apolloError.graphQLErrors);
      assert.equal(apolloError.graphQLErrors.length, 1);
      assert.equal(apolloError.graphQLErrors[0].message, errors[0].message);
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
    const networkInterface = createNetworkInterface({
      uri: 'http://not-a-real-url.com',
      opts: {},
      transportBatching: true,
    });
    networkInterface.batchQuery([
      {
        query: firstQuery,
      },
      {
        query: secondQuery,
      },
    ]).then((results) => {
      assert.deepEqual(results, [firstResult, secondResult]);
      fetch = oldFetch;
      done();
    });
  });
});
