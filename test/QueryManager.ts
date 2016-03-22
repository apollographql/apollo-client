/// <reference path="../typings/main.d.ts" />

import {
  QueryManager,
} from '../src/QueryManager';

import {
  NetworkInterface,
} from '../src/networkInterface';

import {
  Store,
} from '../src/store';

import {
  createStore,
  Store as ReduxStore,
} from 'redux';

import {
  writeSelectionSetToStore,
} from '../src/writeToStore';

import {
  QueryResultAction,
} from '../src/store';

import {
  parseFragmentIfString,
} from '../src/parser';

import { assert } from 'chai';

describe('QueryManager', () => {
  it('works with one query', (done) => {
    const queryManager = new QueryManager({
      networkInterface: {} as NetworkInterface,
      store: createStore(() => ({})),
    });

    const fragmentDef = parseFragmentIfString(`
      fragment FragmentName on Item {
        id
        stringField
        numberField
        nullField
      }
    `);

    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
    };

    const handle = queryManager.watchSelectionSet({
      rootId: 'abcd',
      typeName: 'Person',
      selectionSet: fragmentDef.selectionSet,
    });

    handle.onData((res) => {
      assert.deepEqual(res, result);
      done();
    });

    const store = {
      abcd: result,
    } as Store;

    queryManager.broadcastNewStore(store);
  });

  it('works with two queries', (done) => {
    const queryManager = new QueryManager({
      networkInterface: {} as NetworkInterface,
      store: createStore(() => ({})),
    });

    const fragment1Def = parseFragmentIfString(`
      fragment FragmentName on Item {
        id
        numberField
        nullField
      }
    `);

    const fragment2Def = parseFragmentIfString(`
      fragment FragmentName on Item {
        id
        stringField
        nullField
      }
    `);

    const handle1 = queryManager.watchSelectionSet({
      rootId: 'abcd',
      typeName: 'Person',
      selectionSet: fragment1Def.selectionSet,
    });

    const handle2 = queryManager.watchSelectionSet({
      rootId: 'abcd',
      typeName: 'Person',
      selectionSet: fragment2Def.selectionSet,
    });

    let numDone = 0;

    handle1.onData((res) => {
      assert.deepEqual(res, {
        id: 'abcd',
        numberField: 5,
        nullField: null,
      });
      numDone++;
      if (numDone === 2) {
        done();
      }
    });

    handle2.onData((res) => {
      assert.deepEqual(res, {
        id: 'abcd',
        stringField: 'This is a string!',
        nullField: null,
      });
      numDone++;
      if (numDone === 2) {
        done();
      }
    });

    const store = {
      abcd: {
        id: 'abcd',
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
      },
    } as Store;

    queryManager.broadcastNewStore(store);
  });

  it('properly roundtrips through a Redux store', (done) => {
    // Let's mock a million things!
    const networkInterface: NetworkInterface = {
      _uri: '',
      _opts: {},
      query: (requests) => {
        return Promise.resolve(true).then(() => {
          const response = {
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

          return [response];
        });
      },
    };

    let callback;

    const store = {
      subscribe: (cb) => {
        callback = cb;
      },
      dispatch: (action: QueryResultAction) => {
        const state = writeSelectionSetToStore(action);
        callback(state);
      },
    };

    const queryManager = new QueryManager({
      networkInterface,
      store: store as ReduxStore,
    });

    // Done mocking, now we can get to business!
    const query = `
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

    const handle = queryManager.watchQuery({
      query,
    });

    handle.onData((result) => {
      assert.deepEqual(result, {
        allPeople: {
          people: [
            {
              name: 'Luke Skywalker',
            },
          ],
        },
      });

      done();
    });
  });
});
