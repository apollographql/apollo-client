import { assert } from 'chai';
import { normalizeResult } from '../src/normalize';
import _ from 'lodash';
import { runFragment } from '../src/graphql-from-store';

describe('normalize', async () => {
  it('properly normalizes a trivial item', async () => {
    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
    };

    assertEqualSansDataId(normalizeResult(_.cloneDeep(result)), {
      [result.id]: result
    });
  });

  it('properly normalizes a nested object with an ID', async () => {
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

    assertEqualSansDataId(normalizeResult(_.cloneDeep(result)), {
      [result.id]: _.omit(result, 'nestedObj'),
      [result.nestedObj.id]: result.nestedObj,
    });
  });

  it('properly normalizes a nested object without an ID', async () => {
    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      nestedObj: {
        stringField: 'This is a string too!',
        numberField: 6,
        nullField: null,
      },
    };

    assertEqualSansDataId(normalizeResult(_.cloneDeep(result)), {
      [result.id]: _.omit(result, 'nestedObj'),
      [result.id + '.nestedObj']: result.nestedObj,
    });
  });

  it('properly normalizes a nested array with IDs', async () => {
    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      nestedArray: [
        {
          id: 'abcde',
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
        },
        {
          id: 'abcdef',
          stringField: 'This is a string also!',
          numberField: 7,
          nullField: null,
        },
      ],
    };

    assertEqualSansDataId(normalizeResult(_.cloneDeep(result)), {
      [result.id]: {
        ..._.omit(result, 'nestedArray'),
        nestedArray: result.nestedArray.map(_.property('id')),
      },
      [result.nestedArray[0].id]: result.nestedArray[0],
      [result.nestedArray[1].id]: result.nestedArray[1],
    });
  });

  it('properly normalizes a nested array without IDs', async () => {
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

    const normalized = normalizeResult(_.cloneDeep(result));

    assertEqualSansDataId(normalized, {
      [result.id]: {
        ..._.omit(result, 'nestedArray'),
        nestedArray: [result.id + '.nestedArray.0', result.id + '.nestedArray.1'],
      },
      [result.id + '.nestedArray.0']: result.nestedArray[0],
      [result.id + '.nestedArray.1']: result.nestedArray[1],
    });
  });
});

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
      numberField: result.numberField
    });
  });
});

function assertEqualSansDataId(a, b) {
  const filteredA = omitDataIdFields(a);
  const filteredB = omitDataIdFields(b);

  assert.deepEqual(filteredA, filteredB);
}

function omitDataIdFields(obj) {
  if (! _.isObject(obj)) {
    return obj;
  }

  const omitted = _.omit(obj, ['__data_id']);

  return _.mapValues(omitted, (value) => {
    return omitDataIdFields(value);
  });
}
