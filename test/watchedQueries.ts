import {
  Store,
} from '../src/store';

import {
  assert,
} from 'chai';

import {
  WatchedQueries,
} from '../src/watchedQueries';

import {
  parseFragmentIfString,
} from '../src/parser';

describe('watching queries on the store', () => {
  it('works with one query', (done) => {
    const queryWatcher = new WatchedQueries();

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

    const handle = queryWatcher.watchSelectionSet({
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

    queryWatcher.broadcastNewStore(store);
  });

  it('works with two queries', (done) => {
    const queryWatcher = new WatchedQueries();

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

    const handle1 = queryWatcher.watchSelectionSet({
      rootId: 'abcd',
      typeName: 'Person',
      selectionSet: fragment1Def.selectionSet,
    });

    const handle2 = queryWatcher.watchSelectionSet({
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

    queryWatcher.broadcastNewStore(store);
  });
});
