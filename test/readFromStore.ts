import { assert } from 'chai';
import * as _ from 'lodash';

import {
  readFragmentFromStore,
} from '../src/data/readFromStore';

import {
  NormalizedCache,
  StoreObject,
} from '../src/data/store';

import gql from '../src/gql';

describe('reading from the store', () => {
  it('rejects malformed queries', () => {
    assert.throws(() => {
      readFragmentFromStore({
        store: {},
        fragment: gql`
          fragment X on Y { name }
          fragment W on Y { address }
        `,
        rootId: 'asdf',
      });
    }, /exactly one definition/);

    assert.throws(() => {
      readFragmentFromStore({
        store: {},
        fragment: gql`
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
    } as StoreObject;

    const store = {
      abcd: result,
    } as NormalizedCache;

    const queryResult = readFragmentFromStore({
      store,
      fragment: gql`
        fragment FragmentName on Item {
          stringField,
          numberField
        }
      `,
      rootId: 'abcd',
    });

    // The result of the query shouldn't contain __data_id fields
    assert.deepEqual(queryResult, {
      stringField: result['stringField'],
      numberField: result['numberField'],
    });
  });

  it('runs a basic fragment with arguments', () => {
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

    const store = {
      abcd: {
        id: 'abcd',
        nullField: null,
        'numberField({"intArg":5,"floatArg":3.14})': 5,
        'stringField({"arg":"This is a string!"})': 'Heyo',
      },
    } as NormalizedCache;

    const result = readFragmentFromStore({
      store,
      fragment,
      variables,
      rootId: 'abcd',
    });

    assert.deepEqual(result, {
      id: 'abcd',
      nullField: null,
      numberField: 5,
      stringField: 'Heyo',
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
      } as StoreObject,
    };

    const store = {
      abcd: _.assign({}, _.assign({}, _.omit(result, 'nestedObj')), { nestedObj: 'abcde' }) as StoreObject,
      abcde: result.nestedObj,
    } as NormalizedCache;

    const queryResult = readFragmentFromStore({
      store,
      fragment: gql`
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
      ] as StoreObject[],
    };

    const store = {
      abcd: _.assign({}, _.assign({}, _.omit(result, 'nestedArray')), {
        nestedArray: [
          'abcd.nestedArray.0',
          'abcd.nestedArray.1',
        ],
      }) as StoreObject,
      'abcd.nestedArray.0': result.nestedArray[0],
      'abcd.nestedArray.1': result.nestedArray[1],
    } as NormalizedCache;

    const queryResult = readFragmentFromStore({
      store,
      fragment: gql`
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

  it('runs a nested fragment with an array without IDs and a null', () => {
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
      ] as StoreObject[],
    };

    const store = {
      abcd: _.assign({}, _.assign({}, _.omit(result, 'nestedArray')), {
        nestedArray: [
          null,
          'abcd.nestedArray.1',
        ],
      }) as StoreObject,
      'abcd.nestedArray.1': result.nestedArray[1],
    } as NormalizedCache;

    const queryResult = readFragmentFromStore({
      store,
      fragment: gql`
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
        null,
        {
          stringField: 'This is a string also!',
          numberField: 7,
        },
      ],
    });
  });

  it('runs a nested fragment with an array with IDs and a null', () => {
    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      nestedArray: [
        null,
        {
          id: 'abcde',
          stringField: 'This is a string also!',
          numberField: 7,
          nullField: null,
        },
      ] as StoreObject[],
    };

    const store = {
      abcd: _.assign({}, _.assign({}, _.omit(result, 'nestedArray')), {
        nestedArray: [
          null,
          'abcde',
        ],
      }) as StoreObject,
      'abcde': result.nestedArray[1],
    } as NormalizedCache;

    const queryResult = readFragmentFromStore({
      store,
      fragment: gql`
        fragment FragmentName on Item {
          stringField,
          numberField,
          nestedArray {
            id,
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
        null,
        {
          id: 'abcde',
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
    } as StoreObject;

    const store = { abcd: result } as NormalizedCache;

    assert.throws(() => {
      readFragmentFromStore({
        store,
        fragment: gql`
          fragment FragmentName on Item {
            stringField,
            missingField
          }
        `,
        rootId: 'abcd',
      });
    }, /field missingField on object/);
  });

  it('runs a nested fragment where the reference is null', () => {
    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      nestedObj: null,
    };

    const store = {
      abcd: _.assign({}, _.assign({}, _.omit(result, 'nestedObj')), { nestedObj: null }) as StoreObject,
    } as NormalizedCache;

    const queryResult = readFragmentFromStore({
      store,
      fragment: gql`
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
      nestedObj: null,
    });
  });

  it('runs an array of non-objects', () => {
    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      simpleArray: ['one', 'two', 'three'],
    };

    const store = {
      abcd: _.assign({}, _.assign({}, _.omit(result, 'simpleArray')), { simpleArray: result.simpleArray }) as StoreObject,
    } as NormalizedCache;

    const queryResult = readFragmentFromStore({
      store,
      fragment: gql`
        fragment FragmentName on Item {
          stringField,
          numberField,
          simpleArray
        }
      `,
      rootId: 'abcd',
    });

    // The result of the query shouldn't contain __data_id fields
    assert.deepEqual(queryResult, {
      stringField: 'This is a string!',
      numberField: 5,
      simpleArray: ['one', 'two', 'three'],
    });
  });

  it('runs an array of non-objects with null', () => {
    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      simpleArray: [null, 'two', 'three'],
    };

    const store = {
      abcd: _.assign({}, _.assign({}, _.omit(result, 'simpleArray')), { simpleArray: result.simpleArray }) as StoreObject,
    } as NormalizedCache;

    const queryResult = readFragmentFromStore({
      store,
      fragment: gql`
        fragment FragmentName on Item {
          stringField,
          numberField,
          simpleArray
        }
      `,
      rootId: 'abcd',
    });

    // The result of the query shouldn't contain __data_id fields
    assert.deepEqual(queryResult, {
      stringField: 'This is a string!',
      numberField: 5,
      simpleArray: [null, 'two', 'three'],
    });
  });
});
