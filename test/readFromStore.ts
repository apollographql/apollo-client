/// <reference path="../typings/browser/ambient/chai/index.d.ts" />
/// <reference path="../typings/browser/ambient/mocha/index.d.ts" />

import { assert } from 'chai';
import * as _ from 'lodash';

import { readFragmentFromStore } from '../lib/readFromStore';

describe('reading from the store', () => {
  it('rejects malformed queries', () => {
    assert.throws(() => {
      readFragmentFromStore({
        store: {},
        fragment: `
          fragment X on Y { name }
          fragment W on Y { address }
        `,
        rootId: 'asdf',
      });
    }, /exactly one definition/);

    assert.throws(() => {
      readFragmentFromStore({
        store: {},
        fragment: `
          { name }
        `,
        rootId: 'asdf',
      });
    }, /be a fragment/);
  });

  it('runs a basic fragment', () => {
    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
    };

    const store = {
      abcd: result,
    };

    const queryResult = readFragmentFromStore({
      store,
      fragment: `
        fragment FragmentName on Item {
          stringField,
          numberField
        }
      `,
      rootId: 'abcd',
    });

    // The result of the query shouldn't contain __data_id fields
    assert.deepEqual(queryResult, {
      stringField: result.stringField,
      numberField: result.numberField,
    });
  });

  it('runs a nested fragment', () => {
    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      nestedObj: {
        id: 'abcde',
        stringField: 'This is a string too!',
        numberField: 6,
        nullField: null,
      },
    };

    const store = {
      abcd: _.assign({}, _.assign({}, _.omit(result, 'nestedObj')), { nestedObj: 'abcde' }),
      abcde: result.nestedObj,
    }

    const queryResult = readFragmentFromStore({
      store,
      fragment: `
        fragment FragmentName on Item {
          stringField,
          numberField,
          nestedObj {
            stringField,
            numberField
          }
        }
      `,
      rootId: 'abcd',
    });

    // The result of the query shouldn't contain __data_id fields
    assert.deepEqual(queryResult, {
      stringField: 'This is a string!',
      numberField: 5,
      nestedObj: {
        stringField: 'This is a string too!',
        numberField: 6,
      },
    });
  });

  it('runs a nested fragment with an array without IDs', () => {
    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      nestedArray: [
        {
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
        },
        {
          stringField: 'This is a string also!',
          numberField: 7,
          nullField: null,
        },
      ],
    };

    const store = {
      abcd: _.assign({}, _.assign({}, _.omit(result, 'nestedArray')), {
        nestedArray: [
          'abcd.nestedArray.0',
          'abcd.nestedArray.1',
        ],
      }),
      'abcd.nestedArray.0': result.nestedArray[0],
      'abcd.nestedArray.1': result.nestedArray[1],
    };

    const queryResult = readFragmentFromStore({
      store,
      fragment: `
        fragment FragmentName on Item {
          stringField,
          numberField,
          nestedArray {
            stringField,
            numberField
          }
        }
      `,
      rootId: 'abcd',
    });

    // The result of the query shouldn't contain __data_id fields
    assert.deepEqual(queryResult, {
      stringField: 'This is a string!',
      numberField: 5,
      nestedArray: [
        {
          stringField: 'This is a string too!',
          numberField: 6,
        },
        {
          stringField: 'This is a string also!',
          numberField: 7,
        },
      ],
    });
  });

  it('throws on a missing field', () => {
    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
    };

    const store = { abcd: result };

    assert.throws(() => {
      readFragmentFromStore({
        store,
        fragment: `
          fragment FragmentName on Item {
            stringField,
            missingField
          }
        `,
        rootId: 'abcd',
      });
    }, /field missingField on object/);
  });
});
