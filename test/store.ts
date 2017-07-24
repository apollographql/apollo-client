import * as chai from 'chai';
const { assert } = chai;
import gql from 'graphql-tag';

import { Store, createApolloStore } from '../src/store';

import { getOperationName } from '../src/queries/getFromAST';

describe('createApolloStore', () => {
  it('does not require any arguments', () => {
    const store = createApolloStore();
    assert.isDefined(store);
  });

  it('has a default root key', () => {
    const store = createApolloStore();
    assert.deepEqual(store.getState()['apollo'], {});
  });

  it('can take a custom root key', () => {
    const store = createApolloStore({
      reduxRootKey: 'test',
    });

    assert.deepEqual(store.getState()['test'], {});
  });

  it('can be rehydrated from the server', () => {
    const initialState = {
      apollo: {
        data: {
          'test.0': true,
        },
        optimistic: [] as any[],
      },
    };

    const store = createApolloStore({
      initialState,
    });

    assert.deepEqual(store.getState(), {
      apollo: {},
    });
  });

  it('throws an error if state contains a non-empty queries field', () => {
    const initialState = {
      apollo: {
        queries: {
          'test.0': true,
        },
        mutations: {},
        data: {
          'test.0': true,
        },
        optimistic: [] as any[],
      },
    };

    assert.throws(() =>
      createApolloStore({
        initialState,
      }),
    );
  });

  it('throws an error if state contains a non-empty mutations field', () => {
    const initialState = {
      apollo: {
        queries: {},
        mutations: { 0: true },
        data: {
          'test.0': true,
        },
        optimistic: [] as any[],
      },
    };

    assert.throws(() =>
      createApolloStore({
        initialState,
      }),
    );
  });

  it('reset itself', () => {
    const initialState = {
      apollo: {
        data: {
          'test.0': true,
        },
      },
    };

    const emptyState: Store = {};

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
    const queryDocument = gql`
      query {
        abc
      }
    `;

    const initialState = {
      apollo: {
        data: {
          'test.0': true,
          'test.1': true,
        },
        optimistic: [] as any[],
      },
    };

    const emptyState: Store = {};

    const store = createApolloStore({
      initialState,
    });

    store.dispatch({
      type: 'APOLLO_QUERY_INIT',
      queryId: 'test.0',
      queryString: '',
      document: queryDocument,
      operationName: getOperationName(queryDocument),
      variables: {},
      fetchPolicy: 'cache-first',
      requestId: 1,
      storePreviousVariables: false,
      isPoll: false,
      isRefetch: false,
      metadata: null,
    });

    store.dispatch({
      type: 'APOLLO_STORE_RESET',
      observableQueryIds: ['test.0'],
    });

    assert.deepEqual(store.getState().apollo, emptyState);
  });
});
