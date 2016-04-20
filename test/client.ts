import * as chai from 'chai';
const { assert } = chai;

import ApolloClient from '../src';

import {
  GraphQLError,
} from 'graphql';

import {
  rootReducer as todosReducer,
} from './fixtures/redux-todomvc';

import {
  Store,
} from '../src/store';

import {
  createStore,
  Store as ReduxStore,
  combineReducers,
  applyMiddleware,
} from 'redux';

import {
  createNetworkInterface,
  NetworkInterface,
} from '../src/networkInterface';

import mockNetworkInterface from './mocks/mockNetworkInterface';

import {
  parseQuery,
} from '../src/parser';

import * as chaiAsPromised from 'chai-as-promised';

// make it easy to assert with promises
chai.use(chaiAsPromised);

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
    const networkInterface: NetworkInterface = createNetworkInterface('swapi');
    const client = new ApolloClient({
      networkInterface,
    });

    assert.equal(client.networkInterface._uri, networkInterface._uri);
  });

  it('can allow passing in a store', () => {
    const client = new ApolloClient();

    const store: ReduxStore = createStore(
      combineReducers({
        todos: todosReducer,
        apollo: client.reducer(),
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
        'Existing store does not use apolloReducer for apollo'
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
        },
      }
    );
  });

  it('can allow passing in a top level key', () => {
    const reduxRootKey = 'test';
    const client = new ApolloClient({
      reduxRootKey,
    });

    client.initStore();

    assert.deepEqual(
      client.store.getState(),
      {
        [reduxRootKey]: {
          queries: {},
          mutations: {},
          data: {},
        },
      }
    );
  });

  it('should allow for a single query to take place', (done) => {

    const query = `
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
        assert.deepEqual(result, { data });
        done();
       });
  });

  it('should allow for a single query with existing store', (done) => {
    const query = `
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
        apollo: client.reducer(),
      }),
      applyMiddleware(client.middleware())
    );

    return client.query({ query })
      .then((result) => {
        assert.deepEqual(result, { data });
        done();
       });
  });

  it('can allow a custom top level key', (done) => {

    const query = `
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

    const reduxRootKey = 'test';
    const client = new ApolloClient({
      networkInterface,
      reduxRootKey,
    });

    return client.query({ query })
      .then((result) => {
        assert.deepEqual(result, { data });
        done();
       });
  });

  it('can allow the store to be rehydrated from the server', (done) => {

    const query = `
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

    const reduxHydration = {
      apollo: {
        queries: {
          '0': {
            queryString: '\n      query people {\n        allPeople(first: 1) {\n          people {\n            name\n          }\n        }\n      }\n    ', /* tslint:disable */
            query: {
              id: 'ROOT_QUERY',
              typeName: 'Query',
              selectionSet: parseQuery(query).selectionSet,
            },
            minimizedQueryString: null,
            minimizedQuery: null,
            variables: undefined,
            loading: false,
            networkError: null,
            graphQLErrors: null,
            forceFetch: false,
            returnPartialData: false,
            lastRequestId: 1,
          },
        },
        mutations: {},
        data: {
          'ROOT_QUERY.allPeople({"first":"1"}).people.0': {
            name: 'Luke Skywalker',
          },
          'ROOT_QUERY.allPeople({"first":"1"})': {
            people: [ 'ROOT_QUERY.allPeople({"first":"1"}).people.0' ],
          },
          ROOT_QUERY: {
            'allPeople({"first":"1"})': 'ROOT_QUERY.allPeople({"first":"1"})',
          },
        },
      },
    };

    const client = new ApolloClient({
      networkInterface,
      reduxHydration,
    });

    return client.query({ query })
      .then((result) => {
        assert.deepEqual(result, { data });
        assert.deepEqual(reduxHydration, client.store.getState());
        done();
       });
  });

  it('allows for a single query with existing store and custom key', (done) => {
    const reduxRootKey = 'test';

    const query = `
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
        [reduxRootKey]: client.reducer(),
      }),
      applyMiddleware(client.middleware())
    );

    return client.query({ query })
      .then((result) => {
        assert.deepEqual(result, { data });
        done();
       });
  });
  it('should return errors correctly for a single query', (done) => {

    const query = `
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
      .then((result) => {
        assert.deepEqual(result, { errors });
        done();
      });
  });

  it('should allow for subscribing to a request', (done) => {

    const query = `
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
});
