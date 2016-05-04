import { assert } from 'chai';
import * as _ from 'lodash';

import {
  writeFragmentToStore,
  writeQueryToStore,
} from '../src/data/writeToStore';

import {
  getIdField,
} from '../src/data/extensions';

import gql from '../src/gql';

describe('writing to the store', () => {
  it('properly normalizes a trivial item', () => {
    const fragment = gql`
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

    assert.deepEqual(writeFragmentToStore({
      fragment,
      result: _.cloneDeep(result),
    }), {
      [result.id]: result,
    });
  });

  it('properly normalizes an aliased field', () => {
    const fragment = gql`
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

    assert.deepEqual(normalized, {
      [result.id]: {
        id: 'abcd',
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
      },
    });
  });

  it('properly normalizes a aliased fields with arguments', () => {
    const fragment = gql`
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

    assert.deepEqual(normalized, {
      [result.id]: {
        id: 'abcd',
        'stringField({"arg":"1"})': 'The arg was 1!',
        'stringField({"arg":"2"})': 'The arg was 2!',
        numberField: 5,
        nullField: null,
      },
    });
  });

  it('properly normalizes a fragment with variables', () => {
    const fragment = gql`
      fragment Item on ItemType {
        id,
        stringField(arg: $stringArg),
        numberField(intArg: $intArg, floatArg: $floatArg),
        nullField
      }
    `;

    const variables = {
      intArg: 5,
      floatArg: 3.14,
      stringArg: 'This is a string!',
    };

    const result = {
      id: 'abcd',
      stringField: 'Heyo',
      numberField: 5,
      nullField: null,
    };

    const normalized = writeFragmentToStore({
      result,
      fragment,
      variables,
    });

    assert.deepEqual(normalized, {
      [result.id]: {
        id: 'abcd',
        nullField: null,
        'numberField({"intArg":5,"floatArg":3.14})': 5,
        'stringField({"arg":"This is a string!"})': 'Heyo',
      },
    });
  });

  it('properly normalizes a nested object with an ID', () => {
    const fragment = gql`
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

    assert.deepEqual(writeFragmentToStore({
      fragment,
      result: _.cloneDeep(result),
      dataIdFromObject: getIdField,
    }), {
      [result.id]: _.assign({}, _.assign({}, _.omit(result, 'nestedObj')), {
        nestedObj: result.nestedObj.id,
      }),
      [result.nestedObj.id]: result.nestedObj,
    });
  });

  it('properly normalizes a nested object without an ID', () => {
    const fragment = gql`
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

    assert.deepEqual(writeFragmentToStore({
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
    const fragment = gql`
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

    assert.deepEqual(writeFragmentToStore({
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
    const fragment = gql`
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

    assert.deepEqual(writeFragmentToStore({
      fragment,
      result: _.cloneDeep(result),
      dataIdFromObject: getIdField,
    }), {
      [result.id]: _.assign({}, _.assign({}, _.omit(result, 'nestedArray')), {
        nestedArray: result.nestedArray.map(_.property('id')),
      }),
      [result.nestedArray[0].id]: result.nestedArray[0],
      [result.nestedArray[1].id]: result.nestedArray[1],
    });
  });

  it('properly normalizes a nested array with IDs and a null', () => {
    const fragment = gql`
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
        null,
      ],
    };

    assert.deepEqual(writeFragmentToStore({
      fragment,
      result: _.cloneDeep(result),
      dataIdFromObject: getIdField,
    }), {
      [result.id]: _.assign({}, _.assign({}, _.omit(result, 'nestedArray')), {
        nestedArray: [
          result.nestedArray[0].id,
          null,
        ],
      }),
      [result.nestedArray[0].id]: result.nestedArray[0],
    });
  });

  it('properly normalizes a nested array without IDs', () => {
    const fragment = gql`
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

    assert.deepEqual(normalized, {
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

  it('properly normalizes a nested array without IDs and a null item', () => {
    const fragment = gql`
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
        null,
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

    assert.deepEqual(normalized, {
      [result.id]: _.assign({}, _.assign({}, _.omit(result, 'nestedArray')), {
        nestedArray: [
          null,
          `${result.id}.nestedArray.1`,
        ],
      }),
      [`${result.id}.nestedArray.1`]: result.nestedArray[1],
    });
  });

  it('properly normalizes an array of non-objects', () => {
    const fragment = gql`
      fragment Item on ItemType {
        id,
        stringField,
        numberField,
        nullField,
        simpleArray
      }
    `;

    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      simpleArray: ['one', 'two', 'three'],
    };

    const normalized = writeFragmentToStore({
      fragment,
      result: _.cloneDeep(result),
      dataIdFromObject: getIdField,
    });

    assert.deepEqual(normalized, {
      [result.id]: _.assign({}, _.assign({}, _.omit(result, 'simpleArray')), {
        simpleArray: [
          result.simpleArray[0],
          result.simpleArray[1],
          result.simpleArray[2],
        ],
      }),
    });
  });

  it('properly normalizes an array of non-objects with null', () => {
    const fragment = gql`
      fragment Item on ItemType {
        id,
        stringField,
        numberField,
        nullField,
        simpleArray
      }
    `;

    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      simpleArray: [null, 'two', 'three'],
    };

    const normalized = writeFragmentToStore({
      fragment,
      result: _.cloneDeep(result),
    });

    assert.deepEqual(normalized, {
      [result.id]: _.assign({}, _.assign({}, _.omit(result, 'simpleArray')), {
        simpleArray: [
          result.simpleArray[0],
          result.simpleArray[1],
          result.simpleArray[2],
        ],
      }),
    });
  });

  it('merges nodes', () => {
    const fragment = gql`
      fragment Item on ItemType {
        id,
        numberField,
        nullField
      }
    `;

    const result = {
      id: 'abcd',
      numberField: 5,
      nullField: null,
    };

    const store = writeFragmentToStore({
      fragment,
      result: _.cloneDeep(result),
      dataIdFromObject: getIdField,
    });

    const fragment2 = gql`
      fragment Item on ItemType {
        id,
        stringField,
        nullField
      }
    `;

    const result2 = {
      id: 'abcd',
      stringField: 'This is a string!',
      nullField: null,
    };

    const store2 = writeFragmentToStore({
      store,
      fragment: fragment2,
      result: result2,
      dataIdFromObject: getIdField,
    });

    assert.deepEqual(store2, {
      'abcd': _.assign({}, result, result2),
    });
  });

  it('properly normalizes a nested object that returns null', () => {
    const fragment = gql`
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
      nestedObj: null,
    };

    assert.deepEqual(writeFragmentToStore({
      fragment,
      result: _.cloneDeep(result),
    }), {
      [result.id]: _.assign({}, _.assign({}, _.omit(result, 'nestedObj')), {
        nestedObj: null,
      }),
    });
  });

  it('properly normalizes an object with an ID when no extension is passed', () => {
    const query = gql`
      {
        people_one(id: "5") {
          id
          stringField
        }
      }
    `;

    const result = {
      people_one: {
        id: 'abcd',
        stringField: 'This is a string!',
      },
    };

    assert.deepEqual(writeQueryToStore({
      query,
      result: _.cloneDeep(result),
    }), {
      'ROOT_QUERY': {
        'people_one({"id":"5"})': 'ROOT_QUERY.people_one({"id":"5"})',
      },
      'ROOT_QUERY.people_one({"id":"5"})': {
        'id': 'abcd',
        'stringField': 'This is a string!',
      },
    });
  });
});
