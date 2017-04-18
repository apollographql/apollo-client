import * as chai from 'chai';
const { assert } = chai;
import gql from 'graphql-tag';

import {
  Store,
  createApolloStore,
  ReducerError,
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
        reducerError: null,
      },
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
        reducerError: null,
      },
    );
  });

  it('can be rehydrated from the server', () => {
    const initialState = {
      apollo: {
        data: {
          'test.0': true,
        },
        optimistic: ([] as any[]),
      },
    };

    const store = createApolloStore({
      initialState,
    });

    assert.deepEqual(store.getState(), {
      apollo: {
        queries: {},
        mutations: {},
        data: initialState.apollo.data,
        optimistic: initialState.apollo.optimistic,
        reducerError: null,
      },
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
        optimistic: ([] as any[]),
      },
    };

    assert.throws(() => createApolloStore({
      initialState,
    }));
  });

  it('throws an error if state contains a non-empty mutations field', () => {
    const initialState = {
      apollo: {
        queries: {},
        mutations: { 0: true },
        data: {
          'test.0': true,
        },
        optimistic: ([] as any[]),
      },
    };

    assert.throws(() => createApolloStore({
      initialState,
    }));
  });

  it('reset itself', () => {
    const initialState = {
      apollo: {
        data: {
          'test.0': true,
        },
      },
    };

    const emptyState: Store = {
      queries: { },
      mutations: { },
      data: { },
      optimistic: ([] as any[]),
      reducerError: null,
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
    const queryDocument = gql` query { abc }`;

    const initialState = {
      apollo: {
        data: {
          'test.0': true,
          'test.1': true,
        },
        optimistic: ([] as any[]),
      },
    };

    const emptyState: Store = {
      queries: {
        'test.0': {
          'graphQLErrors': [],
          'lastRequestId': 1,
          'networkStatus': 1,
          'networkError': null,
          'previousVariables': null,
          'queryString': '',
          'document': queryDocument,
          'variables': {},
          'metadata': null,
        },
      },
      mutations: {},
      data: {},
      optimistic: ([] as any[]),
      reducerError: null,
    };

    const store = createApolloStore({
      initialState,
    });

    store.dispatch({
      type: 'APOLLO_QUERY_INIT',
      queryId: 'test.0',
      queryString: '',
      document: queryDocument,
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

  it('can\'t crash the reducer', () => {
    const initialState = {
      apollo: {
        data: {},
        optimistic: ([] as any[]),
        reducerError: (null as Error | null),
      },
    };

    const store = createApolloStore({
      initialState,
    });

    // Try to crash the store with a bad behavior update
    const mutationString = `mutation Increment { incrementer { counter } }`;
    const mutation = gql`${mutationString}`;
    const variables = {};

    store.dispatch({
      type: 'APOLLO_MUTATION_INIT',
      mutationString,
      mutation,
      variables,
      operationName: 'Increment',
      mutationId: '1',
      optimisticResponse: {data: {incrementer: {counter: 1}}},
    });

    store.dispatch({
      type: 'APOLLO_MUTATION_RESULT',
      result: {data: {incrementer: {counter: 1}}},
      document: mutation,
      operationName: 'Increment',
      variables,
      mutationId: '1',
      extraReducers: [() => { throw new Error('test!!!'); }],
    });

    assert(/test!!!/.test(store.getState().apollo.reducerError.error));

    const resetState = {
      queries: {},
      mutations: {},
      data: {},
      optimistic: [
        {
          data: {},
          mutationId: '1',
          action: {
            type: 'APOLLO_MUTATION_RESULT',
            result: {data: {data: {incrementer: {counter: 1}}}},
            document: mutation,
            operationName: 'Increment',
            variables: {},
            mutationId: '1',
            extraReducers: undefined,
            updateQueries: undefined,
            update: undefined,
          },
        },
      ],
      reducerError: (null as ReducerError | null),
    };

    store.dispatch({
      type: 'APOLLO_STORE_RESET',
      observableQueryIds: ['test.0'],
    });

    assert.deepEqual(store.getState().apollo, resetState);
  });
});
