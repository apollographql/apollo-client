import { assert } from 'chai';
import * as _ from 'lodash';

import {
  readQueryFromStore,
} from '../src/data/readFromStore';

import {
  NormalizedCache,
  StoreObject,
} from '../src/data/storeUtils';

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
      'ROOT_QUERY': _.assign({}, _.assign({}, _.omit(result, 'nestedObj')), {
        nestedObj: {
          type: 'id',
          id: 'abcde',
          generated: false,
        },
      }) as StoreObject,
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
      'ROOT_QUERY': _.assign({}, _.assign({}, _.omit(result, 'nestedObj', 'deepNestedObj')), {
        __typename: 'Query',
        nestedObj: {
          type: 'id',
          id: 'abcde',
          generated: false,
        },
      }) as StoreObject,
      abcde: _.assign({}, result.nestedObj, {
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
      'ROOT_QUERY': _.assign({}, _.assign({}, _.omit(result, 'nestedArray')), {
        nestedArray: [
          { type: 'id', generated: true, id: 'abcd.nestedArray.0' },
          { type: 'id', generated: true, id: 'abcd.nestedArray.1' },
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
      'ROOT_QUERY': _.assign({}, _.assign({}, _.omit(result, 'nestedArray')), {
        nestedArray: [
          null,
          { type: 'id', generated: true, id: 'abcd.nestedArray.1' },
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
      'ROOT_QUERY': _.assign({}, _.assign({}, _.omit(result, 'nestedArray')), {
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

  it('does not throw on a missing field if returnPartialData is true', () => {
    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
    } as StoreObject;

    const store = { 'ROOT_QUERY': result } as NormalizedCache;

    assert.doesNotThrow(() => {
      readQueryFromStore({
        store,
        query: gql`
          {
            stringField,
            missingField
          }
        `,
        returnPartialData: true,
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
      'ROOT_QUERY': _.assign({}, _.assign({}, _.omit(result, 'nestedObj')), { nestedObj: null }) as StoreObject,
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
      'ROOT_QUERY': _.assign({}, _.assign({}, _.omit(result, 'simpleArray')), { simpleArray: {
        type: 'json',
        json: result.simpleArray,
      }}) as StoreObject,
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
      'ROOT_QUERY': _.assign({}, _.assign({}, _.omit(result, 'simpleArray')), { simpleArray: {
        type: 'json',
        json: result.simpleArray,
      }}) as StoreObject,
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
});
