import * as chai from 'chai';
const { assert } = chai;

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
      },
    };

    const store = createApolloStore({
      initialState,
    });

    assert.deepEqual(store.getState(), initialState);
  });

  it('can reset itself', () => {
    const initialState = {
      apollo: {
        queries: {
          'test.0': true,
        },
        mutations: {},
        data: {
          'test.0': true,
        },
      },
    };

    const emptyState = {
      queries: { },
      mutations: { },
      data: { },
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
      },
    };

    const emptyState = {
      queries: {
        'test.0': true,
      },
      mutations: {},
      data: {},
    };

    const store = createApolloStore({
      initialState,
    });

    store.dispatch({
      type: 'APOLLO_STORE_RESET',
      observableQueryIds: ['test.0'],
    });

    assert.deepEqual(store.getState().apollo, emptyState)
  });
});
