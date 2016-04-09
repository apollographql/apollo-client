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
    const store = createApolloStore('test');
    assert.deepEqual(
      store.getState()['test'],
      {
        queries: {},
        mutations: {},
        data: {},
      }
    );
  });
});
