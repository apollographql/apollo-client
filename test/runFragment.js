import { assert } from 'chai';
import _ from 'lodash';

import { runFragment } from '../src/graphql-from-store';
import { normalizeResult } from '../src/normalize';

describe('run GraphQL fragments on the store', () => {
  it('rejects malformed queries', () => {
    assert.throws(() => {
      runFragment({
        store: {},
        fragment: `
          fragment X on Y { name }
          fragment W on Y { address }
        `,
        rootId: 'asdf',
      });
    }, /exactly one definition/);

    assert.throws(() => {
      runFragment({
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

    const store = normalizeResult(_.cloneDeep(result));

    const queryResult = runFragment({
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

    const store = normalizeResult(_.cloneDeep(result));

    const queryResult = runFragment({
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

    const store = normalizeResult(_.cloneDeep(result));

    const queryResult = runFragment({
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

    const store = normalizeResult(_.cloneDeep(result));

    assert.throws(() => {
      runFragment({
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
