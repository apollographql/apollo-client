/// <reference path="../typings/main.d.ts" />

import { assert } from 'chai';
import * as _ from 'lodash';

import { writeFragmentToStore } from '../src/writeToStore';

describe('writing to the store', () => {
  it('properly normalizes a trivial item', () => {
    const fragment = `
      fragment Item on ItemType {
        id,
        stringField,
        numberField,
        nullField
      }
    `;

    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
    };

    assertEqualSansDataId(writeFragmentToStore({
      fragment,
      result: _.cloneDeep(result),
    }), {
      [result.id]: result,
    });
  });

  it('properly normalizes an aliased field', () => {
    const fragment = `
      fragment Item on ItemType {
        id,
        aliasedField: stringField,
        numberField,
        nullField
      }
    `;

    const result = {
      id: 'abcd',
      aliasedField: 'This is a string!',
      numberField: 5,
      nullField: null,
    };

    const normalized = writeFragmentToStore({
      result,
      fragment,
    });

    assertEqualSansDataId(normalized, {
      [result.id]: {
        id: 'abcd',
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
      },
    });
  });

  it('properly normalizes a aliased fields with arguments', () => {
    const fragment = `
      fragment Item on ItemType {
        id,
        aliasedField1: stringField(arg: 1),
        aliasedField2: stringField(arg: 2),
        numberField,
        nullField
      }
    `;

    const result = {
      id: 'abcd',
      aliasedField1: 'The arg was 1!',
      aliasedField2: 'The arg was 2!',
      numberField: 5,
      nullField: null,
    };

    const normalized = writeFragmentToStore({
      result,
      fragment,
    });

    assertEqualSansDataId(normalized, {
      [result.id]: {
        id: 'abcd',
        'stringField({"arg":"1"})': 'The arg was 1!',
        'stringField({"arg":"2"})': 'The arg was 2!',
        numberField: 5,
        nullField: null,
      },
    });
  });

  it('properly normalizes a nested object with an ID', () => {
    const fragment = `
      fragment Item on ItemType {
        id,
        stringField,
        numberField,
        nullField,
        nestedObj {
          id,
          stringField,
          numberField,
          nullField
        }
      }
    `;

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

    assertEqualSansDataId(writeFragmentToStore({
      fragment,
      result: _.cloneDeep(result),
    }), {
      [result.id]: _.assign({}, _.assign({}, _.omit(result, 'nestedObj')), {
        nestedObj: result.nestedObj.id,
      }),
      [result.nestedObj.id]: result.nestedObj,
    });
  });

  it('properly normalizes a nested object without an ID', () => {
    const fragment = `
      fragment Item on ItemType {
        id,
        stringField,
        numberField,
        nullField,
        nestedObj {
          stringField,
          numberField,
          nullField
        }
      }
    `;

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

    assertEqualSansDataId(writeFragmentToStore({
      fragment,
      result: _.cloneDeep(result),
    }), {
      [result.id]: _.assign({}, _.assign({}, _.omit(result, 'nestedObj')), {
        nestedObj: `${result.id}.nestedObj`,
      }),
      [`${result.id}.nestedObj`]: result.nestedObj,
    });
  });

  it('properly normalizes a nested object with arguments but without an ID', () => {
    const fragment = `
      fragment Item on ItemType {
        id,
        stringField,
        numberField,
        nullField,
        nestedObj(arg: "val") {
          stringField,
          numberField,
          nullField
        }
      }
    `;

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

    assertEqualSansDataId(writeFragmentToStore({
      fragment,
      result: _.cloneDeep(result),
    }), {
      [result.id]: _.assign({}, _.assign({}, _.omit(result, 'nestedObj')), {
        'nestedObj({"arg":"val"})': `${result.id}.nestedObj({"arg":"val"})`,
      }),
      [`${result.id}.nestedObj({"arg":"val"})`]: result.nestedObj,
    });
  });

  it('properly normalizes a nested array with IDs', () => {
    const fragment = `
      fragment Item on ItemType {
        id,
        stringField,
        numberField,
        nullField,
        nestedArray {
          id,
          stringField,
          numberField,
          nullField
        }
      }
    `;

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

    assertEqualSansDataId(writeFragmentToStore({
      fragment,
      result: _.cloneDeep(result),
    }), {
      [result.id]: _.assign({}, _.assign({}, _.omit(result, 'nestedArray')), {
        nestedArray: result.nestedArray.map(_.property('id')),
      }),
      [result.nestedArray[0].id]: result.nestedArray[0],
      [result.nestedArray[1].id]: result.nestedArray[1],
    });
  });

  it('properly normalizes a nested array without IDs', () => {
    const fragment = `
      fragment Item on ItemType {
        id,
        stringField,
        numberField,
        nullField,
        nestedArray {
          stringField,
          numberField,
          nullField
        }
      }
    `;

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

    const normalized = writeFragmentToStore({
      fragment,
      result: _.cloneDeep(result),
    });

    assertEqualSansDataId(normalized, {
      [result.id]: _.assign({}, _.assign({}, _.omit(result, 'nestedArray')), {
        nestedArray: [
          `${result.id}.nestedArray.0`,
          `${result.id}.nestedArray.1`,
        ],
      }),
      [`${result.id}.nestedArray.0`]: result.nestedArray[0],
      [`${result.id}.nestedArray.1`]: result.nestedArray[1],
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
