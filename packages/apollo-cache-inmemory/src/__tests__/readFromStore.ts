import { assign, omit } from 'lodash';
import { IdValue, JsonValue } from 'apollo-utilities';
import gql from 'graphql-tag';
import { stripSymbols } from 'apollo-utilities';

import { NormalizedCache, StoreObject, HeuristicFragmentMatcher } from '../';
import { readQueryFromStore } from '../readFromStore';
import { defaultNormalizedCacheFactory } from '../objectCache';

const fragmentMatcherFunction = new HeuristicFragmentMatcher().match;
import { withError } from './diffAgainstStore';

describe('reading from the store', () => {
  it('runs a nested query with proper fragment fields in arrays', () => {
    withError(() => {
      const store = defaultNormalizedCacheFactory({
        ROOT_QUERY: {
          __typename: 'Query',
          nestedObj: { type: 'id', id: 'abcde', generated: false },
        } as StoreObject,
        abcde: {
          id: 'abcde',
          innerArray: [
            { type: 'id', generated: true, id: 'abcde.innerArray.0' } as any,
          ],
        } as StoreObject,
        'abcde.innerArray.0': {
          id: 'abcdef',
          someField: 3,
        } as StoreObject,
      });

      const queryResult = readQueryFromStore({
        store,
        query: gql`
          {
            ... on DummyQuery {
              nestedObj {
                innerArray {
                  id
                  otherField
                }
              }
            }
            ... on Query {
              nestedObj {
                innerArray {
                  id
                  someField
                }
              }
            }
            ... on DummyQuery2 {
              nestedObj {
                innerArray {
                  id
                  otherField2
                }
              }
            }
          }
        `,
        fragmentMatcherFunction,
      });

      expect(stripSymbols(queryResult)).toEqual({
        nestedObj: {
          innerArray: [{ id: 'abcdef', someField: 3 }],
        },
      });
    }, /queries contain union or interface types/);
  });
  it('rejects malformed queries', () => {
    expect(() => {
      readQueryFromStore({
        store: defaultNormalizedCacheFactory(),
        query: gql`
          query {
            name
          }

          query {
            address
          }
        `,
      });
    }).toThrowError(/2 operations/);

    expect(() => {
      readQueryFromStore({
        store: defaultNormalizedCacheFactory(),
        query: gql`
          fragment x on y {
            name
          }
        `,
      });
    }).toThrowError(/contain a query/);
  });

  it('runs a basic query', () => {
    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
    } as StoreObject;

    const store = defaultNormalizedCacheFactory({
      ROOT_QUERY: result,
    });

    const queryResult = readQueryFromStore({
      store,
      query: gql`
        query {
          stringField
          numberField
        }
      `,
    });

    // The result of the query shouldn't contain __data_id fields
    expect(stripSymbols(queryResult)).toEqual({
      stringField: result['stringField'],
      numberField: result['numberField'],
    });
  });

  it('runs a basic query with arguments', () => {
    const query = gql`
      query {
        id
        stringField(arg: $stringArg)
        numberField(intArg: $intArg, floatArg: $floatArg)
        nullField
      }
    `;

    const variables = {
      intArg: 5,
      floatArg: 3.14,
      stringArg: 'This is a string!',
    };

    const store = defaultNormalizedCacheFactory({
      ROOT_QUERY: {
        id: 'abcd',
        nullField: null,
        'numberField({"floatArg":3.14,"intArg":5})': 5,
        'stringField({"arg":"This is a string!"})': 'Heyo',
      },
    });

    const result = readQueryFromStore({
      store,
      query,
      variables,
    });

    expect(stripSymbols(result)).toEqual({
      id: 'abcd',
      nullField: null,
      numberField: 5,
      stringField: 'Heyo',
    });
  });

  it('runs a basic query with custom directives', () => {
    const query = gql`
      query {
        id
        firstName @include(if: true)
        lastName @upperCase
        birthDate @dateFormat(format: "DD-MM-YYYY")
      }
    `;

    const store = defaultNormalizedCacheFactory({
      ROOT_QUERY: {
        id: 'abcd',
        firstName: 'James',
        'lastName@upperCase': 'BOND',
        'birthDate@dateFormat({"format":"DD-MM-YYYY"})': '20-05-1940',
      },
    });

    const result = readQueryFromStore({
      store,
      query,
    });

    expect(stripSymbols(result)).toEqual({
      id: 'abcd',
      firstName: 'James',
      lastName: 'BOND',
      birthDate: '20-05-1940',
    });
  });

  it('runs a basic query with default values for arguments', () => {
    const query = gql`
      query someBigQuery(
        $stringArg: String = "This is a default string!"
        $intArg: Int = 0
        $floatArg: Float
      ) {
        id
        stringField(arg: $stringArg)
        numberField(intArg: $intArg, floatArg: $floatArg)
        nullField
      }
    `;

    const variables = {
      floatArg: 3.14,
    };

    const store = defaultNormalizedCacheFactory({
      ROOT_QUERY: {
        id: 'abcd',
        nullField: null,
        'numberField({"floatArg":3.14,"intArg":0})': 5,
        'stringField({"arg":"This is a default string!"})': 'Heyo',
      },
    });

    const result = readQueryFromStore({
      store,
      query,
      variables,
    });

    expect(stripSymbols(result)).toEqual({
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

    const store = defaultNormalizedCacheFactory({
      ROOT_QUERY: assign({}, assign({}, omit(result, 'nestedObj')), {
        nestedObj: {
          type: 'id',
          id: 'abcde',
          generated: false,
        },
      } as StoreObject),
      abcde: result.nestedObj,
    });

    const queryResult = readQueryFromStore({
      store,
      query: gql`
        {
          stringField
          numberField
          nestedObj {
            stringField
            numberField
          }
        }
      `,
    });

    // The result of the query shouldn't contain __data_id fields
    expect(stripSymbols(queryResult)).toEqual({
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

    const store = defaultNormalizedCacheFactory({
      ROOT_QUERY: assign(
        {},
        assign({}, omit(result, 'nestedObj', 'deepNestedObj')),
        {
          __typename: 'Query',
          nestedObj: {
            type: 'id',
            id: 'abcde',
            generated: false,
          },
        } as StoreObject,
      ),
      abcde: assign({}, result.nestedObj, {
        deepNestedObj: {
          type: 'id',
          id: 'abcdef',
          generated: false,
        },
      }) as StoreObject,
      abcdef: result.deepNestedObj as StoreObject,
    });

    const queryResult = readQueryFromStore({
      store,
      query: gql`
        {
          stringField
          numberField
          nullField
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
    expect(stripSymbols(queryResult)).toEqual({
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

    const store = defaultNormalizedCacheFactory({
      ROOT_QUERY: assign({}, assign({}, omit(result, 'nestedArray')), {
        nestedArray: [
          { type: 'id', generated: true, id: 'abcd.nestedArray.0' } as IdValue,
          { type: 'id', generated: true, id: 'abcd.nestedArray.1' } as IdValue,
        ],
      }) as StoreObject,
      'abcd.nestedArray.0': result.nestedArray[0],
      'abcd.nestedArray.1': result.nestedArray[1],
    });

    const queryResult = readQueryFromStore({
      store,
      query: gql`
        {
          stringField
          numberField
          nestedArray {
            stringField
            numberField
          }
        }
      `,
    });

    // The result of the query shouldn't contain __data_id fields
    expect(stripSymbols(queryResult)).toEqual({
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

    const store = defaultNormalizedCacheFactory({
      ROOT_QUERY: assign({}, assign({}, omit(result, 'nestedArray')), {
        nestedArray: [
          null,
          { type: 'id', generated: true, id: 'abcd.nestedArray.1' } as IdValue,
        ],
      }) as StoreObject,
      'abcd.nestedArray.1': result.nestedArray[1],
    });

    const queryResult = readQueryFromStore({
      store,
      query: gql`
        {
          stringField
          numberField
          nestedArray {
            stringField
            numberField
          }
        }
      `,
    });

    // The result of the query shouldn't contain __data_id fields
    expect(stripSymbols(queryResult)).toEqual({
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

    const store = defaultNormalizedCacheFactory({
      ROOT_QUERY: assign({}, assign({}, omit(result, 'nestedArray')), {
        nestedArray: [null, { type: 'id', generated: false, id: 'abcde' }],
      }) as StoreObject,
      abcde: result.nestedArray[1],
    });

    const queryResult = readQueryFromStore({
      store,
      query: gql`
        {
          stringField
          numberField
          nestedArray {
            id
            stringField
            numberField
          }
        }
      `,
    });

    // The result of the query shouldn't contain __data_id fields
    expect(stripSymbols(queryResult)).toEqual({
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

    const store = defaultNormalizedCacheFactory({ ROOT_QUERY: result });

    expect(() => {
      readQueryFromStore({
        store,
        query: gql`
          {
            stringField
            missingField
          }
        `,
      });
    }).toThrowError(/field missingField on object/);
  });

  it('runs a nested query where the reference is null', () => {
    const result: any = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
      nestedObj: null,
    };

    const store = defaultNormalizedCacheFactory({
      ROOT_QUERY: assign({}, assign({}, omit(result, 'nestedObj')), {
        nestedObj: null,
      }) as StoreObject,
    });

    const queryResult = readQueryFromStore({
      store,
      query: gql`
        {
          stringField
          numberField
          nestedObj {
            stringField
            numberField
          }
        }
      `,
    });

    // The result of the query shouldn't contain __data_id fields
    expect(stripSymbols(queryResult)).toEqual({
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

    const store = defaultNormalizedCacheFactory({
      ROOT_QUERY: assign({}, assign({}, omit(result, 'simpleArray')), {
        simpleArray: {
          type: 'json',
          json: result.simpleArray,
        } as JsonValue,
      }) as StoreObject,
    });

    const queryResult = readQueryFromStore({
      store,
      query: gql`
        {
          stringField
          numberField
          simpleArray
        }
      `,
    });

    // The result of the query shouldn't contain __data_id fields
    expect(stripSymbols(queryResult)).toEqual({
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

    const store = defaultNormalizedCacheFactory({
      ROOT_QUERY: assign({}, assign({}, omit(result, 'simpleArray')), {
        simpleArray: {
          type: 'json',
          json: result.simpleArray,
        } as JsonValue,
      }) as StoreObject,
    });

    const queryResult = readQueryFromStore({
      store,
      query: gql`
        {
          stringField
          numberField
          simpleArray
        }
      `,
    });

    // The result of the query shouldn't contain __data_id fields
    expect(stripSymbols(queryResult)).toEqual({
      stringField: 'This is a string!',
      numberField: 5,
      simpleArray: [null, 'two', 'three'],
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

    const store = defaultNormalizedCacheFactory({
      ROOT_QUERY: assign(
        {},
        assign({}, omit(data, 'nestedObj', 'deepNestedObj')),
        {
          __typename: 'Query',
          nestedObj: {
            type: 'id',
            id: 'abcde',
            generated: false,
          } as IdValue,
        },
      ) as StoreObject,
      abcde: assign({}, data.nestedObj, {
        deepNestedObj: {
          type: 'id',
          id: 'abcdef',
          generated: false,
        },
      }) as StoreObject,
      abcdef: data.deepNestedObj as StoreObject,
    });

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

    expect(stripSymbols(queryResult1)).toEqual({
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

    expect(stripSymbols(queryResult2)).toEqual({
      stringField: 'This is a deep string',
      numberField: 7,
      nullField: null,
    });
  });

  it('properly handles the connection directive', () => {
    const store = defaultNormalizedCacheFactory({
      ROOT_QUERY: {
        abc: [
          {
            generated: true,
            id: 'ROOT_QUERY.abc.0',
            type: 'id',
          },
        ],
      },
      'ROOT_QUERY.abc.0': {
        name: 'efgh',
      },
    });

    const queryResult = readQueryFromStore({
      store,
      query: gql`
        {
          books(skip: 0, limit: 2) @connection(key: "abc") {
            name
          }
        }
      `,
    });

    expect(stripSymbols(queryResult)).toEqual({
      books: [
        {
          name: 'efgh',
        },
      ],
    });
  });
});
