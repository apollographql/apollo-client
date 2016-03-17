import { assert } from 'chai';
import { normalizeResult } from '../src/normalize';
import _ from 'lodash';

describe('normalize', async () => {
  it('properly normalizes a trivial item', async () => {
    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
    };

    assert.deepEqual(normalizeResult(result), {
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

    assert.deepEqual(normalizeResult(result), {
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

    assert.deepEqual(normalizeResult(result), {
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

    assert.deepEqual(normalizeResult(result), {
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

    const normalized = normalizeResult(result);

    assert.deepEqual(normalized, {
      [result.id]: {
        ..._.omit(result, 'nestedArray'),
        nestedArray: result.nestedArray.map(_.property('id')),
      },
      [result.id + '.nestedArray.0']: result.nestedArray[0],
      [result.id + '.nestedArray.1']: result.nestedArray[1],
    });
  });
});
