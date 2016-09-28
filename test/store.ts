import * as chai from 'chai';
const { assert } = chai;
import gql from 'graphql-tag';

import {
  createApolloStore,
} from '../src/store';

describe('createApolloStore', () => {
  it('does not require any arguments', () => {
    const store = createApolloStore();
    assert.isDefined(store);
  });

  it('has a default root key', () => {
    const store = createApolloStore();
    assert.deepEqual(
      store.getState()['apollo'],
      {
        queries: {},
        mutations: {},
        data: {},
        optimistic: [],
        reducerError: (null as Error),
      }
    );
  });

  it('can take a custom root key', () => {
    const store = createApolloStore({
      reduxRootKey: 'test',
    });

    assert.deepEqual(
      store.getState()['test'],
      {
        queries: {},
        mutations: {},
        data: {},
        optimistic: [],
        reducerError: (null as Error),
      }
    );
  });

  it('can be rehydrated from the server', () => {
    const initialState = {
      apollo: {
        queries: {
          'test.0': true,
        },
        mutations: {},
        data: {
          'test.0': true,
        },
        optimistic: ([] as any[]),
        reducerError: (null as Error),
      },
    };

    const store = createApolloStore({
      initialState,
    });

    assert.deepEqual(store.getState(), initialState);
  });

  it('reset itself', () => {
    const initialState = {
      apollo: {
        queries: {
          'test.0': true,
        },
        mutations: {},
        data: {
          'test.0': true,
        },
        reducerError: (null as Error),
      },
    };

    const emptyState = {
      queries: { },
      mutations: { },
      data: { },
      optimistic: ([] as any[]),
      reducerError: (null as Error),
    };

    const store = createApolloStore({
      initialState,
    });

    store.dispatch({
      type: 'APOLLO_STORE_RESET',
      observableQueryIds: [],
    });

    assert.deepEqual(store.getState().apollo, emptyState);
  });

  it('can reset itself and keep the observable query ids', () => {
    const initialState = {
      apollo: {
        queries: {
          'test.0': true,
          'test.1': false,
        },
        mutations: {},
        data: {
          'test.0': true,
          'test.1': true,
        },
        optimistic: ([] as any[]),
        reducerError: (null as Error),
      },
    };

    const emptyState = {
      queries: {
        'test.0': true,
      },
      mutations: {},
      data: {},
      optimistic: ([] as any[]),
      reducerError: (null as Error),
    };

    const store = createApolloStore({
      initialState,
    });

    store.dispatch({
      type: 'APOLLO_STORE_RESET',
      observableQueryIds: ['test.0'],
    });

    assert.deepEqual(store.getState().apollo, emptyState);
  });

  it('can\'t crash the reducer', () => {
    const initialState = {
      apollo: {
        queries: {
          'test.0': true,
          'test.1': false,
        },
        mutations: {},
        data: {
          'test.0': true,
          'test.1': true,
        },
        optimistic: ([] as any[]),
        reducerError: (null as Error),
      },
    };

    const store = createApolloStore({
      initialState,
    });

    const queryString = `{ shouldBeHere }`;
    const query = gql`${queryString}`;

    // Try to crash the store with a bad query result
    store.dispatch({
      type: 'APOLLO_QUERY_INIT',
      queryString,
      query,
      minimizedQueryString: queryString,
      minimizedQuery: query,
      variables: {},
      forceFetch: true,
      returnPartialData: false,
      queryId: '1',
      requestId: 1,
      fragmentMap: {},
    });
    store.dispatch({
      type: 'APOLLO_QUERY_RESULT',
      result: { data: { somethingElse: true }},
      queryId: '1',
      requestId: 1,
    });

    assert.equal(
      store.getState().apollo.reducerError.message,
      'Cannot read property \'selections\' of undefined'
    );

    store.dispatch({
      type: 'APOLLO_STORE_RESET',
      observableQueryIds: ['test.0'],
    });

    assert.deepEqual(store.getState().apollo, {
      queries: {
        'test.0': true,
      },
      mutations: {},
      data: {},
      optimistic: ([] as any[]),
      reducerError: (null as Error),
    });
  });
});
