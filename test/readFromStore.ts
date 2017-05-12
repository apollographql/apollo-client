import { assert } from 'chai';
import { assign, omit } from 'lodash';

import {
  readQueryFromStore,
} from '../src/data/readFromStore';

import {
  withError,
} from './util/wrap';

import {
  NormalizedCache,
  StoreObject,
  IdValue,
  StoreValue,
  JsonValue,
} from '../src/data/storeUtils';

import {
  HeuristicFragmentMatcher,
} from '../src/data/fragmentMatcher';
const fragmentMatcherFunction = new HeuristicFragmentMatcher().match;

import gql from 'graphql-tag';


describe('reading from the store', () => {
  it('rejects malformed queries', () => {
    assert.throws(() => {
      readQueryFromStore({
        store: {},
        query: gql`
          query { name }
          query { address }
        `,
      });
    }, /exactly one/);

    assert.throws(() => {
      readQueryFromStore({
        store: {},
        query: gql`
          fragment x on y { name }
        `,
      });
    }, /contain a query/);
  });

  it('runs a basic query', () => {
    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
    } as StoreObject;

    const store = {
      'ROOT_QUERY': result,
    } as NormalizedCache;

    const queryResult = readQueryFromStore({
      store,
      query: gql`
        query {
          stringField,
          numberField
        }
      `,
    });

    // The result of the query shouldn't contain __data_id fields
    assert.deepEqual(queryResult, {
      stringField: result['stringField'],
      numberField: result['numberField'],
    });
  });

  it('runs a basic query with arguments', () => {
    const query = gql`
      query {
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
      'ROOT_QUERY': {
        id: 'abcd',
        nullField: null,
        'numberField({"intArg":5,"floatArg":3.14})': 5,
        'stringField({"arg":"This is a string!"})': 'Heyo',
      },
    } as NormalizedCache;

    const result = readQueryFromStore({
      store,
      query,
      variables,
    });

    assert.deepEqual(result, {
      id: 'abcd',
      nullField: null,
      numberField: 5,
      stringField: 'Heyo',
    });
  });

  it('runs a basic query with default values for arguments', () => {
    const query = gql`
      query someBigQuery(
        $stringArg: String = "This is a default string!",
        $intArg: Int = 0,
        $floatArg: Float,
      ){
        id,
        stringField(arg: $stringArg),
        numberField(intArg: $intArg, floatArg: $floatArg),
        nullField
      }
    `;

    const variables = {
      floatArg: 3.14,
    };

    const store = {
      'ROOT_QUERY': {
        id: 'abcd',
        nullField: null,
        'numberField({"intArg":0,"floatArg":3.14})': 5,
        'stringField({"arg":"This is a default string!"})': 'Heyo',
      },
    } as NormalizedCache;

    const result = readQueryFromStore({
      store,
      query,
      variables,
    });

    assert.deepEqual(result, {
      id: 'abcd',
      nullField: null,
      numberField: 5,
      stringField: 'Heyo',
    });
  });

  it('runs a nested query', () => {
    const result: any = {
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
      'ROOT_QUERY': assign({}, assign({}, omit(result, 'nestedObj')), {
        nestedObj: {
          type: 'id',
          id: 'abcde',
          generated: false,
        },
      } as StoreObject),
      abcde: result.nestedObj,
    } as NormalizedCache;

    const queryResult = readQueryFromStore({
      store,
      query: gql`
        {
          stringField,
          numberField,
          nestedObj {
            stringField,
            numberField
          }
        }
      `,
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

  it('runs a nested query with multiple fragments', () => {
    const result: any = {
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
      deepNestedObj: {
        stringField: 'This is a deep string',
        numberField: 7,
        nullField: null,
      } as StoreObject,
      nullObject: null,
      __typename: 'Item',
    };

    const store = {
      'ROOT_QUERY': assign({}, assign({}, omit(result, 'nestedObj', 'deepNestedObj')), {
        __typename: 'Query',
        nestedObj: {
          type: 'id',
          id: 'abcde',
          generated: false,
        },
      } as StoreObject),
      abcde: assign({}, result.nestedObj, {
        deepNestedObj: {
          type: 'id',
          id: 'abcdef',
          generated: false,
        },
      }) as StoreObject,
      abcdef: result.deepNestedObj as StoreObject,
    } as NormalizedCache;

    const queryResult = readQueryFromStore({
      store,
      query: gql`
        {
          stringField,
          numberField,
          nullField,
          ... on Query {
            nestedObj {
              stringField
              nullField
              deepNestedObj {
                stringField
                nullField
              }
            }
          }
          ... on Query {
            nestedObj {
              numberField
              nullField
              deepNestedObj {
                numberField
                nullField
              }
            }
          }
          ... on Query {
            nullObject
          }
        }
      `,
    });

    // The result of the query shouldn't contain __data_id fields
    assert.deepEqual(queryResult, {
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      nestedObj: {
        stringField: 'This is a string too!',
        numberField: 6,
        nullField: null,
        deepNestedObj: {
          stringField: 'This is a deep string',
          numberField: 7,
          nullField: null,
        },
      },
      nullObject: null,
    });
  });

  it('runs a nested query with proper fragment fields in arrays', () => {
    return withError(() => {
      const store = {
        'ROOT_QUERY': {
          __typename: 'Query',
          nestedObj: { type: 'id', id: 'abcde', generated: false },
        } as StoreObject,
        abcde: {
          id: 'abcde',
          innerArray: [{ type: 'id', generated: true, id: 'abcde.innerArray.0' } as any],
        } as StoreObject,
        'abcde.innerArray.0': {
          id: 'abcdef',
          someField: 3,
        } as StoreObject,
      } as NormalizedCache;

      const queryResult = readQueryFromStore({
        store,
        query: gql`
          {
            ... on DummyQuery {
              nestedObj {
                innerArray { id otherField }
              }
            }
            ... on Query {
              nestedObj {
                innerArray { id someField }
              }
            }
            ... on DummyQuery2 {
              nestedObj {
                innerArray { id otherField2 }
              }
            }
          }
        `,
        fragmentMatcherFunction,
      });

      assert.deepEqual(queryResult, {
        nestedObj: {
          innerArray: [{id: 'abcdef', someField: 3}],
        },
      });
    }, /IntrospectionFragmentMatcher/);
  });

  it('runs a nested query with an array without IDs', () => {
    const result: any = {
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
      'ROOT_QUERY': assign({}, assign({}, omit(result, 'nestedArray')), {
        nestedArray: [
          { type: 'id', generated: true, id: 'abcd.nestedArray.0' } as IdValue,
          { type: 'id', generated: true, id: 'abcd.nestedArray.1' } as IdValue,
        ],
      }) as StoreObject,
      'abcd.nestedArray.0': result.nestedArray[0],
      'abcd.nestedArray.1': result.nestedArray[1],
    } as NormalizedCache;

    const queryResult = readQueryFromStore({
      store,
      query: gql`
        {
          stringField,
          numberField,
          nestedArray {
            stringField,
            numberField
          }
        }
      `,
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

  it('runs a nested query with an array without IDs and a null', () => {
    const result: any = {
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
      'ROOT_QUERY': assign({}, assign({}, omit(result, 'nestedArray')), {
        nestedArray: [
          null,
          { type: 'id', generated: true, id: 'abcd.nestedArray.1' } as IdValue,
        ],
      }) as StoreObject,
      'abcd.nestedArray.1': result.nestedArray[1],
    } as NormalizedCache;

    const queryResult = readQueryFromStore({
      store,
      query: gql`
        {
          stringField,
          numberField,
          nestedArray {
            stringField,
            numberField
          }
        }
      `,
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

  it('runs a nested query with an array with IDs and a null', () => {
    const result: any = {
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
      'ROOT_QUERY': assign({}, assign({}, omit(result, 'nestedArray')), {
        nestedArray: [
          null,
          { type: 'id', generated: false, id: 'abcde' },
        ],
      }) as StoreObject,
      'abcde': result.nestedArray[1],
    } as NormalizedCache;

    const queryResult = readQueryFromStore({
      store,
      query: gql`
        {
          stringField,
          numberField,
          nestedArray {
            id,
            stringField,
            numberField
          }
        }
      `,
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

    const store = { 'ROOT_QUERY': result } as NormalizedCache;

    assert.throws(() => {
      readQueryFromStore({
        store,
        query: gql`
          {
            stringField,
            missingField
          }
        `,
      });
    }, /field missingField on object/);
  });

  it('runs a nested query where the reference is null', () => {
    const result: any = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      nestedObj: null,
    };

    const store = {
      'ROOT_QUERY': assign({}, assign({}, omit(result, 'nestedObj')), { nestedObj: null }) as StoreObject,
    } as NormalizedCache;

    const queryResult = readQueryFromStore({
      store,
      query: gql`
        {
          stringField,
          numberField,
          nestedObj {
            stringField,
            numberField
          }
        }
      `,
    });

    // The result of the query shouldn't contain __data_id fields
    assert.deepEqual(queryResult, {
      stringField: 'This is a string!',
      numberField: 5,
      nestedObj: null,
    });
  });

  it('runs an array of non-objects', () => {
    const result: any = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      simpleArray: ['one', 'two', 'three'],
    };

    const store = {
      'ROOT_QUERY': assign({}, assign({}, omit(result, 'simpleArray')), { simpleArray: {
        type: 'json',
        json: result.simpleArray,
      } as JsonValue }) as StoreObject,
    } as NormalizedCache;

    const queryResult = readQueryFromStore({
      store,
      query: gql`
        {
          stringField,
          numberField,
          simpleArray
        }
      `,
    });

    // The result of the query shouldn't contain __data_id fields
    assert.deepEqual(queryResult, {
      stringField: 'This is a string!',
      numberField: 5,
      simpleArray: ['one', 'two', 'three'],
    });
  });

  it('runs an array of non-objects with null', () => {
    const result: any = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      simpleArray: [null, 'two', 'three'],
    };

    const store = {
      'ROOT_QUERY': assign({}, assign({}, omit(result, 'simpleArray')), { simpleArray: {
        type: 'json',
        json: result.simpleArray,
      } as JsonValue }) as StoreObject,
    } as NormalizedCache;

    const queryResult = readQueryFromStore({
      store,
      query: gql`
        {
          stringField,
          numberField,
          simpleArray
        }
      `,
    });

    // The result of the query shouldn't contain __data_id fields
    assert.deepEqual(queryResult, {
      stringField: 'This is a string!',
      numberField: 5,
      simpleArray: [null, 'two', 'three'],
    });
  });

  it('runs a query with custom resolvers for a computed field', () => {
    const result = {
      __typename: 'Thing',
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
    } as StoreObject;

    const store = {
      'ROOT_QUERY': result,
    } as NormalizedCache;

    const queryResult = readQueryFromStore({
      store,
      query: gql`
        query {
          stringField
          numberField
          computedField(extra: "bit") @client
        }
      `,
      config: {
        customResolvers: {
          Thing: {
            computedField: (obj, args) => obj.stringField + obj.numberField + args['extra'],
          },
        },
      },
    });

    // The result of the query shouldn't contain __data_id fields
    assert.deepEqual(queryResult, {
      stringField: result['stringField'],
      numberField: result['numberField'],
      computedField: 'This is a string!5bit',
    });
  });

  it('runs a query with custom resolvers for a computed field on root Query', () => {
    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
    } as StoreObject;

    const store = {
      'ROOT_QUERY': result,
    } as NormalizedCache;

    const queryResult = readQueryFromStore({
      store,
      query: gql`
        query {
          stringField
          numberField
          computedField(extra: "bit") @client
        }
      `,
      config: {
        customResolvers: {
          Query: {
            computedField: (obj, args) => obj.stringField + obj.numberField + args['extra'],
          },
        },
      },
    });

    // The result of the query shouldn't contain __data_id fields
    assert.deepEqual(queryResult, {
      stringField: result['stringField'],
      numberField: result['numberField'],
      computedField: 'This is a string!5bit',
    });
  });

  it('will read from an arbitrary root id', () => {
    const data: any = {
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
      deepNestedObj: {
        stringField: 'This is a deep string',
        numberField: 7,
        nullField: null,
      } as StoreObject,
      nullObject: null,
      __typename: 'Item',
    };

    const store = {
      'ROOT_QUERY': assign({}, assign({}, omit(data, 'nestedObj', 'deepNestedObj')), {
        __typename: 'Query',
        nestedObj: {
          type: 'id',
          id: 'abcde',
          generated: false,
        } as IdValue,
      }) as StoreObject,
      abcde: assign({}, data.nestedObj, {
        deepNestedObj: {
          type: 'id',
          id: 'abcdef',
          generated: false,
        },
      }) as StoreObject,
      abcdef: data.deepNestedObj as StoreObject,
    } as NormalizedCache;

    const queryResult1 = readQueryFromStore({
      store,
      rootId: 'abcde',
      query: gql`
        {
          stringField
          numberField
          nullField
          deepNestedObj {
            stringField
            numberField
            nullField
          }
        }
      `,
    });

    assert.deepEqual(queryResult1, {
      stringField: 'This is a string too!',
      numberField: 6,
      nullField: null,
      deepNestedObj: {
        stringField: 'This is a deep string',
        numberField: 7,
        nullField: null,
      },
    });

    const queryResult2 = readQueryFromStore({
      store,
      rootId: 'abcdef',
      query: gql`
        {
          stringField
          numberField
          nullField
        }
      `,
    });

    assert.deepEqual(queryResult2, {
      stringField: 'This is a deep string',
      numberField: 7,
      nullField: null,
    });
  });
});
