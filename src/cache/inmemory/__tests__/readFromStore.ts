import { assign, omit } from 'lodash';
import gql from 'graphql-tag';

import { stripSymbols } from '../../../utilities/testing/stripSymbols';
import { StoreObject } from '../types';
import { StoreReader } from '../readFromStore';
import { makeReference, InMemoryCache, Reference, isReference } from '../../../core';
import { Cache } from '../../core/types/Cache';
import { MissingFieldError } from '../../core/types/common';
import { defaultNormalizedCacheFactory, readQueryFromStore } from './helpers';
import { withError } from './diffAgainstStore';

describe('reading from the store', () => {
  const reader = new StoreReader({
    cache: new InMemoryCache(),
  });

  it('runs a nested query with proper fragment fields in arrays', () => {
    withError(() => {
      const store = defaultNormalizedCacheFactory({
        ROOT_QUERY: {
          __typename: 'Query',
          nestedObj: makeReference('abcde'),
        } as StoreObject,
        abcde: {
          id: 'abcde',
          innerArray: [
            {
              id: 'abcdef',
              someField: 3,
            },
          ],
        } as StoreObject,
      });

      const queryResult = readQueryFromStore(reader, {
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
      });

      expect(stripSymbols(queryResult)).toEqual({
        nestedObj: {
          innerArray: [{ id: 'abcdef', someField: 3 }],
        },
      });
    });
  });

  it('rejects malformed queries', () => {
    expect(() => {
      readQueryFromStore(reader, {
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
      readQueryFromStore(reader, {
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

    const queryResult = readQueryFromStore(reader, {
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

    const result = readQueryFromStore(reader, {
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

    const result = readQueryFromStore(reader, {
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

    const result = readQueryFromStore(reader, {
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
        nestedObj: makeReference('abcde'),
      } as StoreObject),
      abcde: result.nestedObj,
    });

    const queryResult = readQueryFromStore(reader, {
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
          nestedObj: makeReference('abcde'),
        } as StoreObject,
      ),
      abcde: assign({}, result.nestedObj, {
        deepNestedObj: makeReference('abcdef'),
      }) as StoreObject,
      abcdef: result.deepNestedObj as StoreObject,
    });

    const queryResult = readQueryFromStore(reader, {
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
      ROOT_QUERY: result,
    });

    const queryResult = readQueryFromStore(reader, {
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
      ROOT_QUERY: result,
    });

    const queryResult = readQueryFromStore(reader, {
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
        nestedArray: [null, makeReference('abcde')],
      }) as StoreObject,
      abcde: result.nestedArray[1],
    });

    const queryResult = readQueryFromStore(reader, {
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
      readQueryFromStore(reader, {
        store,
        query: gql`
          {
            stringField
            missingField
          }
        `,
      });
    }).toThrowError(/Can't find field 'missingField' on ROOT_QUERY object/);
  });

  it('readQuery supports returnPartialData', () => {
    const cache = new InMemoryCache;
    const aQuery = gql`query { a }`;
    const bQuery = gql`query { b }`;
    const abQuery = gql`query { a b }`;

    cache.writeQuery({
      query: aQuery,
      data: { a: 123 },
    });

    expect(cache.readQuery({ query: bQuery })).toBe(null);
    expect(cache.readQuery({ query: abQuery })).toBe(null);

    expect(cache.readQuery({
      query: bQuery,
      returnPartialData: true,
    })).toEqual({});

    expect(cache.readQuery({
      query: abQuery,
      returnPartialData: true,
    })).toEqual({ a: 123 });
  });

  it('readFragment supports returnPartialData', () => {
    const cache = new InMemoryCache;
    const id = cache.identify({
      __typename: "ABObject",
      id: 321,
    });

    const aFragment = gql`fragment AFragment on ABObject { a }`;
    const bFragment = gql`fragment BFragment on ABObject { b }`;
    const abFragment = gql`fragment ABFragment on ABObject { a b }`;

    expect(cache.readFragment({ id, fragment: aFragment })).toBe(null);
    expect(cache.readFragment({ id, fragment: bFragment })).toBe(null);
    expect(cache.readFragment({ id, fragment: abFragment })).toBe(null);

    const ref = cache.writeFragment({
      id,
      fragment: aFragment,
      data: {
        __typename: "ABObject",
        a: 123,
      },
    });
    expect(isReference(ref)).toBe(true);
    expect(ref!.__ref).toBe(id);

    expect(cache.readFragment({
      id,
      fragment: bFragment,
    })).toBe(null);

    expect(cache.readFragment({
      id,
      fragment: abFragment,
    })).toBe(null);

    expect(cache.readFragment({
      id,
      fragment: bFragment,
      returnPartialData: true,
    })).toEqual({
      __typename: "ABObject",
    });

    expect(cache.readFragment({
      id,
      fragment: abFragment,
      returnPartialData: true,
    })).toEqual({
      __typename: "ABObject",
      a: 123,
    });
  });

  it('distinguishes between missing @client and non-@client fields', () => {
    const query = gql`
      query {
        normal {
          present @client
          missing
        }
        clientOnly @client {
          present
          missing
        }
      }
    `;

    const cache = new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            normal() {
              return { present: "here" };
            },
            clientOnly() {
              return { present: "also here" };
            },
          },
        },
      },
    });

    const { result, complete, missing } = cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
    });

    expect(complete).toBe(false);

    expect(result).toEqual({
      normal: {
        present: "here",
      },
      clientOnly: {
        present: "also here",
      },
    });

    expect(missing).toEqual([
      new MissingFieldError(
        `Can't find field 'missing' on object {
  "present": "here"
}`,
        ["normal", "missing"],
        query,
        false, // clientOnly
        {}, // variables
      ),
      new MissingFieldError(
        `Can't find field 'missing' on object {
  "present": "also here"
}`,
        ["clientOnly", "missing"],
        query,
        true, // clientOnly
        {}, // variables
      ),
    ]);
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

    const queryResult = readQueryFromStore(reader, {
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
      ROOT_QUERY: result,
    });

    const queryResult = readQueryFromStore(reader, {
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
      ROOT_QUERY: result,
    });

    const queryResult = readQueryFromStore(reader, {
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
          nestedObj: makeReference('abcde'),
        },
      ) as StoreObject,
      abcde: assign({}, data.nestedObj, {
        deepNestedObj: makeReference('abcdef'),
      }) as StoreObject,
      abcdef: data.deepNestedObj as StoreObject,
    });

    const queryResult1 = readQueryFromStore(reader, {
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

    const queryResult2 = readQueryFromStore(reader, {
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

  it('properly handles the @connection directive', () => {
    const store = defaultNormalizedCacheFactory({
      ROOT_QUERY: {
        'books:abc': [
          {
            name: 'efgh',
          },
        ],
      },
    });

    const queryResult = readQueryFromStore(reader, {
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

  it('can use keyArgs function instead of @connection directive', () => {
    const reader = new StoreReader({
      cache: new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              books: {
                // Even though we're returning an arbitrary string here,
                // the InMemoryCache will ensure the actual key begins
                // with "books".
                keyArgs: () => "abc",
              },
            },
          },
        },
      }),
    });

    const store = defaultNormalizedCacheFactory({
      ROOT_QUERY: {
        "books:abc": [
          {
            name: 'efgh',
          },
        ],
      },
    });

    const queryResult = readQueryFromStore(reader, {
      store,
      query: gql`
        {
          books(skip: 0, limit: 2) {
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

  it('refuses to return raw Reference objects', () => {
    const store = defaultNormalizedCacheFactory({
      ROOT_QUERY: {
        author: {
          __typename: 'Author',
          name: 'Toni Morrison',
          books: [
            {
              title: 'The Bluest Eye',
              publisher: makeReference('Publisher1'),
            },
            {
              title: 'Song of Solomon',
              publisher: makeReference('Publisher2'),
            },
            {
              title: 'Beloved',
              publisher: makeReference('Publisher2'),
            },
          ],
        },
      },
      Publisher1: {
        __typename: 'Publisher',
        id: 1,
        name: 'Holt, Rinehart and Winston',
      },
      Publisher2: {
        __typename: 'Publisher',
        id: 2,
        name: 'Alfred A. Knopf, Inc.',
      },
    });

    expect(() => {
      readQueryFromStore(reader, {
        store,
        query: gql`
          {
            author {
              name
              books
            }
          }
        `,
      });
    }).toThrow(
      /Missing selection set for object of type Publisher returned for query field books/,
    );

    expect(
      readQueryFromStore(reader, {
        store,
        query: gql`
          {
            author {
              name
              books {
                title
                publisher {
                  name
                }
              }
            }
          }
        `,
      }),
    ).toEqual({
      author: {
        __typename: 'Author',
        name: 'Toni Morrison',
        books: [
          {
            title: 'The Bluest Eye',
            publisher: {
              __typename: 'Publisher',
              name: 'Holt, Rinehart and Winston',
            },
          },
          {
            title: 'Song of Solomon',
            publisher: {
              __typename: 'Publisher',
              name: 'Alfred A. Knopf, Inc.',
            },
          },
          {
            title: 'Beloved',
            publisher: {
              __typename: 'Publisher',
              name: 'Alfred A. Knopf, Inc.',
            },
          },
        ],
      },
    });
  });

  it("read functions for root query fields work with empty cache", () => {
    const cache = new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            uuid() {
              return "8d573b9c-cfcf-4e3e-98dd-14d255af577e";
            },
            null() {
              return null;
            },
          }
        },
      },
    });

    expect(cache.readQuery({
      query: gql`query { uuid null }`,
    })).toEqual({
      uuid: "8d573b9c-cfcf-4e3e-98dd-14d255af577e",
      null: null,
    });

    expect(cache.extract()).toEqual({});

    expect(cache.readFragment({
      id: "ROOT_QUERY",
      fragment: gql`
        fragment UUIDFragment on Query {
          null
          uuid
        }
      `,
    })).toEqual({
      uuid: "8d573b9c-cfcf-4e3e-98dd-14d255af577e",
      null: null,
    });

    expect(cache.extract()).toEqual({});

    expect(cache.readFragment({
      id: "does not exist",
      fragment: gql`
        fragment F on Never {
          whatever
        }
      `,
    })).toBe(null);

    expect(cache.extract()).toEqual({});
  });

  it("custom read functions can map/filter dangling references", () => {
    const cache = new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            ducks(existing: Reference[] = [], { canRead }) {
              return existing.map(duck => canRead(duck) ? duck : null);
            },
            chickens(existing: Reference[] = [], { canRead }) {
              return existing.map(chicken => canRead(chicken) ? chicken : {});
            },
            oxen(existing: Reference[] = [], { canRead }) {
              return existing.filter(canRead);
            },
          },
        },
      },
    });

    cache.writeQuery({
      query: gql`
        query {
          ducks { quacking }
          chickens { inCoop }
          oxen { gee haw }
        }
      `,
      data: {
        ducks: [
          { __typename: "Duck", id: 1, quacking: true },
          { __typename: "Duck", id: 2, quacking: false },
          { __typename: "Duck", id: 3, quacking: false },
        ],
        chickens: [
          { __typename: "Chicken", id: 1, inCoop: true },
          { __typename: "Chicken", id: 2, inCoop: true },
          { __typename: "Chicken", id: 3, inCoop: false },
        ],
        oxen: [
          { __typename: "Ox", id: 1, gee: true, haw: false },
          { __typename: "Ox", id: 2, gee: false, haw: true },
        ],
      },
    });

    expect(cache.extract()).toEqual({
      "Chicken:1": {
        __typename: "Chicken",
        id: 1,
        inCoop: true,
      },
      "Chicken:2": {
        __typename: "Chicken",
        id: 2,
        inCoop: true,
      },
      "Chicken:3": {
        __typename: "Chicken",
        id: 3,
        inCoop: false,
      },
      "Duck:1": {
        __typename: "Duck",
        id: 1,
        quacking: true,
      },
      "Duck:2": {
        __typename: "Duck",
        id: 2,
        quacking: false,
      },
      "Duck:3": {
        __typename: "Duck",
        id: 3,
        quacking: false,
      },
      "Ox:1": {
        __typename: "Ox",
        id: 1,
        gee: true,
        haw: false,
      },
      "Ox:2": {
        __typename: "Ox",
        id: 2,
        gee: false,
        haw: true,
      },
      ROOT_QUERY: {
        __typename: "Query",
        chickens: [
          { __ref: "Chicken:1" },
          { __ref: "Chicken:2" },
          { __ref: "Chicken:3" },
        ],
        ducks: [
          { __ref: "Duck:1" },
          { __ref: "Duck:2" },
          { __ref: "Duck:3" },
        ],
        oxen: [
          { __ref: "Ox:1" },
          { __ref: "Ox:2" },
        ],
      },
    });

    function diffChickens() {
      return cache.diff({
        query: gql`query { chickens { id inCoop }}`,
        optimistic: true,
      });
    }

    expect(diffChickens()).toEqual({
      complete: true,
      result: {
        chickens: [
          { __typename: "Chicken", id: 1, inCoop: true },
          { __typename: "Chicken", id: 2, inCoop: true },
          { __typename: "Chicken", id: 3, inCoop: false },
        ],
      }
    });

    expect(cache.evict({
      id: cache.identify({
        __typename: "Chicken",
        id: 2,
      }),
    })).toBe(true);

    expect(diffChickens()).toEqual({
      complete: false,
      missing: [
        expect.anything(),
        expect.anything(),
      ],
      result: {
        chickens: [
          { __typename: "Chicken", id: 1, inCoop: true },
          {},
          { __typename: "Chicken", id: 3, inCoop: false },
        ],
      },
    });

    function diffDucks() {
      return cache.diff({
        query: gql`query { ducks { id quacking }}`,
        optimistic: true,
      });
    }

    expect(diffDucks()).toEqual({
      complete: true,
      result: {
        ducks: [
          { __typename: "Duck", id: 1, quacking: true },
          { __typename: "Duck", id: 2, quacking: false },
          { __typename: "Duck", id: 3, quacking: false },
        ],
      },
    });

    expect(cache.evict({
      id: cache.identify({
        __typename: "Duck",
        id: 3,
      }),
    })).toBe(true);

    // Returning null as a placeholder in a list is a way to indicate that
    // a list element has been removed, without causing an incomplete
    // diff, and without altering the positions of later elements.
    expect(diffDucks()).toEqual({
      complete: true,
      result: {
        ducks: [
          { __typename: "Duck", id: 1, quacking: true },
          { __typename: "Duck", id: 2, quacking: false },
          null,
        ],
      },
    });

    function diffOxen() {
      return cache.diff({
        query: gql`query { oxen { id gee haw }}`,
        optimistic: true,
      });
    }

    expect(diffOxen()).toEqual({
      complete: true,
      result: {
        oxen: [
          { __typename: "Ox", id: 1, gee: true, haw: false },
          { __typename: "Ox", id: 2, gee: false, haw: true },
        ],
      },
    });

    expect(cache.evict({
      id: cache.identify({
        __typename: "Ox",
        id: 1,
      }),
    })).toBe(true);

    expect(diffOxen()).toEqual({
      complete: true,
      result: {
        oxen: [
          { __typename: "Ox", id: 2, gee: false, haw: true },
        ],
      },
    });
  });

  it("propagates eviction signals to parent queries", () => {
    const cache = new InMemoryCache({
      typePolicies: {
        Deity: {
          keyFields: ["name"],
          fields: {
            children(offspring: Reference[], { canRead }) {
              // Automatically filter out any dangling references, and
              // supply a default empty array if !offspring.
              return offspring ? offspring.filter(canRead) : [];
            },
          },
        },

        Query: {
          fields: {
            ruler(ruler, { canRead, toReference }) {
              // If the throne is empty, promote Apollo!
              return canRead(ruler) ? ruler : toReference({
                __typename: "Deity",
                name: "Apollo",
              });
            },
          },
        },
      },
    });

    const rulerQuery = gql`
      query {
        ruler {
          name
          children {
            name
            children {
              name
            }
          }
        }
      }
    `;

    const children = [
      // Sons #1 and #2 don't have names because Cronus (l.k.a. Saturn)
      // devoured them shortly after birth, as famously painted by
      // Francisco Goya:
      "Son #1",
      "Hera",
      "Son #2",
      "Zeus",
      "Demeter",
      "Hades",
      "Poseidon",
      "Hestia",
    ].map(name => ({
      __typename: "Deity",
      name,
      children: [],
    }));

    cache.writeQuery({
      query: rulerQuery,
      data: {
        ruler: {
          __typename: "Deity",
          name: "Cronus",
          children,
        },
      },
    });

    const diffs: Cache.DiffResult<any>[] = [];

    function watch() {
      return cache.watch({
        query: rulerQuery,
        immediate: true,
        optimistic: true,
        callback(diff) {
          diffs.push(diff);
        },
      });
    }

    const cancel = watch();

    function devour(name: string) {
      return cache.evict({
        id: cache.identify({ __typename: "Deity", name }),
      });
    }

    const initialDiff = {
      result: {
        ruler: {
          __typename: "Deity",
          name: "Cronus",
          children,
        },
      },
      complete: true,
    };

    // We already have one diff because of the immediate:true above.
    expect(diffs).toEqual([
      initialDiff,
    ]);

    expect(devour("Son #1")).toBe(true);

    const childrenWithoutSon1 =
      children.filter(child => child.name !== "Son #1");

    expect(childrenWithoutSon1.length).toBe(children.length - 1);

    const diffWithoutSon1 = {
      result: {
        ruler: {
          name: "Cronus",
          __typename: "Deity",
          children: childrenWithoutSon1,
        },
      },
      complete: true,
    };

    expect(diffs).toEqual([
      initialDiff,
      diffWithoutSon1,
    ]);

    expect(devour("Son #1")).toBe(false);

    expect(diffs).toEqual([
      initialDiff,
      diffWithoutSon1,
    ]);

    expect(devour("Son #2")).toBe(true);

    const diffWithoutDevouredSons = {
      result: {
        ruler: {
          name: "Cronus",
          __typename: "Deity",
          children: childrenWithoutSon1.filter(child => {
            return child.name !== "Son #2";
          }),
        },
      },
      complete: true,
    };

    expect(diffs).toEqual([
      initialDiff,
      diffWithoutSon1,
      diffWithoutDevouredSons,
    ]);

    const childrenOfZeus = [
      "Ares",
      "Artemis",
      // Fun fact: Apollo is the only major Greco-Roman deity whose name
      // is the same in both traditions.
      "Apollo",
      "Athena",
    ].map(name => ({
      __typename: "Deity",
      name,
      children: [],
    }));

    const zeusRef = cache.writeFragment({
      id: cache.identify({
        __typename: "Deity",
        name: "Zeus",
      }),
      fragment: gql`fragment Offspring on Deity {
        children {
          name
        }
      }`,
      data: {
        children: childrenOfZeus,
      },
    });

    expect(isReference(zeusRef)).toBe(true);
    expect(zeusRef!.__ref).toBe('Deity:{"name":"Zeus"}');

    const diffWithChildrenOfZeus = {
      complete: true,
      result: {
        ...diffWithoutDevouredSons.result,
        ruler: {
          ...diffWithoutDevouredSons.result.ruler,
          children: diffWithoutDevouredSons.result.ruler.children.map(child => {
            return child.name === "Zeus" ? {
              ...child,
              children: childrenOfZeus
                // Remove empty child.children arrays.
                .map(({ children, ...child }) => child),
            } : child;
          }),
        },
      },
    };

    expect(diffs).toEqual([
      initialDiff,
      diffWithoutSon1,
      diffWithoutDevouredSons,
      diffWithChildrenOfZeus,
    ]);

    // Zeus usurps the throne from Cronus!
    cache.writeQuery({
      query: rulerQuery,
      data: {
        ruler: {
          __typename: "Deity",
          name: "Zeus",
        },
      },
    });

    const diffWithZeusAsRuler = {
      complete: true,
      result: {
        ruler: {
          __typename: "Deity",
          name: "Zeus",
          children: childrenOfZeus,
        },
      },
    };

    expect(diffs).toEqual([
      initialDiff,
      diffWithoutSon1,
      diffWithoutDevouredSons,
      diffWithChildrenOfZeus,
      diffWithZeusAsRuler,
    ]);

    expect(cache.gc().sort()).toEqual([
      'Deity:{"name":"Cronus"}',
      'Deity:{"name":"Demeter"}',
      'Deity:{"name":"Hades"}',
      'Deity:{"name":"Hera"}',
      'Deity:{"name":"Hestia"}',
      'Deity:{"name":"Poseidon"}',
    ]);

    const snapshotAfterGC = {
      ROOT_QUERY: {
        __typename: "Query",
        ruler: { __ref: 'Deity:{"name":"Zeus"}' },
      },
      'Deity:{"name":"Zeus"}': {
        __typename: "Deity",
        name: "Zeus",
        children: [
          { __ref: 'Deity:{"name":"Ares"}' },
          { __ref: 'Deity:{"name":"Artemis"}' },
          { __ref: 'Deity:{"name":"Apollo"}' },
          { __ref: 'Deity:{"name":"Athena"}' },
        ],
      },
      'Deity:{"name":"Apollo"}': {
        __typename: "Deity",
        name: "Apollo",
      },
      'Deity:{"name":"Artemis"}': {
        __typename: "Deity",
        name: "Artemis",
      },
      'Deity:{"name":"Ares"}': {
        __typename: "Deity",
        name: "Ares",
      },
      'Deity:{"name":"Athena"}': {
        __typename: "Deity",
        name: "Athena",
      },
    };

    const zeusMeta = {
      extraRootIds: [
        'Deity:{"name":"Zeus"}',
      ],
    };

    expect(cache.extract()).toEqual({
      ...snapshotAfterGC,
      __META: zeusMeta,
    });

    // There should be no diff generated by garbage collection.
    expect(diffs).toEqual([
      initialDiff,
      diffWithoutSon1,
      diffWithoutDevouredSons,
      diffWithChildrenOfZeus,
      diffWithZeusAsRuler,
    ]);

    cancel();

    const lastDiff = diffs[diffs.length - 1];

    expect(cache.readQuery({
      query: rulerQuery,
    })).toBe(lastDiff.result);

    expect(cache.evict({
      id: cache.identify({
        __typename: "Deity",
        name: "Ares",
      }),
    })).toBe(true);

    // No new diff generated since we called cancel() above.
    expect(diffs).toEqual([
      initialDiff,
      diffWithoutSon1,
      diffWithoutDevouredSons,
      diffWithChildrenOfZeus,
      diffWithZeusAsRuler,
    ]);

    const snapshotWithoutAres = {
      ...snapshotAfterGC,
      __META: zeusMeta,
    };
    delete snapshotWithoutAres["Deity:{\"name\":\"Ares\"}"];
    expect(cache.extract()).toEqual(snapshotWithoutAres);
    // Ares already removed, so no new garbage to collect.
    expect(cache.gc()).toEqual([]);

    const childrenOfZeusWithoutAres =
      childrenOfZeus.filter(child => {
        return child.name !== "Ares";
      });

    expect(childrenOfZeusWithoutAres).toEqual([
      { __typename: "Deity", name: "Artemis", children: [] },
      { __typename: "Deity", name: "Apollo", children: [] },
      { __typename: "Deity", name: "Athena", children: [] },
    ]);

    expect(cache.readQuery({
      query: rulerQuery,
    })).toEqual({
      ruler: {
        __typename: "Deity",
        name: "Zeus",
        children: childrenOfZeusWithoutAres,
      },
    });

    expect(cache.evict({
      id: cache.identify({
        __typename: "Deity",
        name: "Zeus",
      }),
    })).toBe(true);

    // You didn't think we were going to let Apollo be garbage-collected,
    // did you?
    cache.retain(cache.identify({
      __typename: "Deity",
      name: "Apollo",
    })!);

    expect(cache.gc().sort()).toEqual([
      'Deity:{"name":"Artemis"}',
      'Deity:{"name":"Athena"}',
    ]);

    expect(cache.extract()).toEqual({
      __META: {
        extraRootIds: [
          'Deity:{"name":"Apollo"}',
          'Deity:{"name":"Zeus"}',
        ],
      },
      ROOT_QUERY: {
        __typename: "Query",
        ruler: { __ref: 'Deity:{"name":"Zeus"}' },
      },
      'Deity:{"name":"Apollo"}': {
        __typename: "Deity",
        name: "Apollo",
      },
    });

    const apolloRulerResult = cache.readQuery<{
      ruler: Record<string, any>;
    }>({ query: rulerQuery })!;

    expect(apolloRulerResult).toEqual({
      ruler: {
        __typename: "Deity",
        name: "Apollo",
        children: [],
      },
    });

    // No new diffs since before.
    expect(diffs).toEqual([
      initialDiff,
      diffWithoutSon1,
      diffWithoutDevouredSons,
      diffWithChildrenOfZeus,
      diffWithZeusAsRuler,
    ]);

    // Rewatch the rulerQuery, which will populate the same diffs array
    // that we were using before.
    const cancel2 = watch();

    const diffWithApolloAsRuler = {
      complete: true,
      result: apolloRulerResult,
    };

    expect(diffs).toEqual([
      initialDiff,
      diffWithoutSon1,
      diffWithoutDevouredSons,
      diffWithChildrenOfZeus,
      diffWithZeusAsRuler,
      diffWithApolloAsRuler,
    ]);

    cache.modify({
      fields: {
        ruler(value, { toReference }) {
          expect(isReference(value)).toBe(true);
          expect(value.__ref).toBe(
            cache.identify(diffWithZeusAsRuler.result.ruler));
          expect(value.__ref).toBe('Deity:{"name":"Zeus"}');
          // Interim ruler Apollo takes over for real.
          return toReference(apolloRulerResult.ruler);
        },
      },
    });

    cancel2();

    // The cache.modify call should have triggered another diff, since we
    // overwrote the ROOT_QUERY.ruler field with a valid Reference to the
    // Apollo entity object.
    expect(diffs).toEqual([
      initialDiff,
      diffWithoutSon1,
      diffWithoutDevouredSons,
      diffWithChildrenOfZeus,
      diffWithZeusAsRuler,
      diffWithApolloAsRuler,
      diffWithApolloAsRuler,
    ]);

    expect(
      // Undo the cache.retain call above.
      cache.release(cache.identify({
        __typename: "Deity",
        name: "Apollo",
      })!)
    ).toBe(0);

    // Since ROOT_QUERY.ruler points to Apollo, nothing needs to be
    // garbage collected.
    expect(cache.gc()).toEqual([]);

    // Having survived GC, Apollo reigns supreme atop Olympus... or
    // something like that.
    expect(cache.extract()).toEqual({
      __META: zeusMeta,
      ROOT_QUERY: {
        __typename: "Query",
        ruler: { __ref: 'Deity:{"name":"Apollo"}' },
      },
      'Deity:{"name":"Apollo"}': {
        __typename: "Deity",
        name: "Apollo",
      },
    });
  });
});
