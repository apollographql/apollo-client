import { assert } from 'chai';
import * as _ from 'lodash';

import {
  readFragmentFromStore,
  readObjectByIdFromStore,
} from '../src/data/readFromStore';

import {
  NormalizedCache,
  StoreObject,
} from '../src/data/store';

import {
  writeQueryToStore,
} from '../src/data/writeToStore';

import gql from 'graphql-tag';

import {
  Document,
} from 'graphql';

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
      abcd: _.assign({}, _.assign({}, _.omit(result, 'nestedObj')), {
        nestedObj: {
          type: 'id',
          id: 'abcde',
          generated: false,
        },
      }) as StoreObject,
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

  it('does not throw on a missing field if returnPartialData is true', () => {
    const result = {
      id: 'abcd',
      stringField: 'This is a string!',
      numberField: 5,
      nullField: null,
    } as StoreObject;

    const store = { abcd: result } as NormalizedCache;

    assert.doesNotThrow(() => {
      readFragmentFromStore({
        store,
        fragment: gql`
          fragment FragmentName on Item {
            stringField,
            missingField
          }
        `,
        rootId: 'abcd',
        returnPartialData: true,
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
      abcd: _.assign({}, _.assign({}, _.omit(result, 'simpleArray')), { simpleArray: {
        type: 'json',
        json: result.simpleArray,
      }}) as StoreObject,
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
      abcd: _.assign({}, _.assign({}, _.omit(result, 'simpleArray')), { simpleArray: {
        type: 'json',
        json: result.simpleArray,
      }}) as StoreObject,
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

  describe('read object by id', () => {
    const dataIdFromObject = (obj: any) => {
      if (obj.id && obj.__typename) {
        return obj.__typename + '__' + obj.id;
      }
    };

    const setupStore = (query: Document, result: Object) => {
      return writeQueryToStore({
        query,
        result,
        dataIdFromObject,
      });
    };

    it('with a generated id', () => {
      const primeQuery = gql`
        query {
          author {
            firstName
            lastName
          }
        }`;
      const primeResult = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const store = setupStore(primeQuery, primeResult);
      const object = readObjectByIdFromStore({
        store,
        id: '$ROOT_QUERY.author',
        fragment: gql`
          fragment author on Author {
            firstName
            lastName
          }`,
      });
      assert.deepEqual(object, primeResult.author);
    });

    it('with a real id', () => {
      const primeQuery = gql`
        query {
          author {
            firstName
            lastName
            id
            __typename
          }
        }`;
      const primeResult = {
        author: {
          firstName: 'John',
          lastName: 'Smith',
          id: '129',
          __typename: 'Author',
        },
      };
      const store = setupStore(primeQuery, primeResult);
      const object = readObjectByIdFromStore({
        store,
        id: dataIdFromObject(primeResult.author),
        fragment: gql`
          fragment author on Author {
            firstName
            lastName
            id
            __typename
        }`,
      });

      assert.deepEqual(object, primeResult.author);
    });

    it('with nested data', () => {
      const primeQuery = gql`
        query {
          author {
            name {
              first
              last
            }
          }
        }`;
      const primeResult = {
        author: {
          name: {
            first: 'John',
            last: 'Smith',
          },
        },
      };
      const store = setupStore(primeQuery, primeResult);
      const object = readObjectByIdFromStore({
        store,
        id: '$ROOT_QUERY.author',
        fragment: gql`
          fragment author on Author {
            author {
              name {
                first
                last
              }
            }
        }`,
      });
      assert.deepEqual(object, primeResult.author);
    });

    it('with arrays of nested data', () => {
      const primeQuery = gql`
        query {
          person {
            name
            friends {
              name
            }
          }
        }`;
      const primeResult = {
        person: {
          name: 'John Smith',
          friends: [
            {
              name: 'Jane Smith',
            },
            {
              name: 'Jack Smith',
            },
          ],
        },
      };
      const store = setupStore(primeQuery, primeResult);
      const object = readObjectByIdFromStore({
        store,
        id: '$ROOT_QUERY.person',
        fragment: gql`
          fragment person on Person {
            name
            friends {
              name
            }
          }`,
      });
      assert.deepEqual(object, primeResult.person);
    });

    it('with arrays of scalars', () => {
      const primeQuery = gql`
        query {
          person {
            name
            friendNames
          }
        }`;
      const primeResult = {
        person: {
          name: 'John Smith',
          friendNames: ['Jane Smith', 'Jack Smith'],
        },
      };
      const store = setupStore(primeQuery, primeResult);
      const object = readObjectByIdFromStore({
        store,
        id: '$ROOT_QUERY.person',
        fragment: gql`
          fragment person on Person {
            name
            friendNames
          }
        `,
      });
      assert.deepEqual(object, primeResult.person);
    });

    it('with json blobs', () => {
      const primeQuery = gql`
        query {
          user {
            info
          }
        }`;
      const primeResult = {
        user: {
          info: {
            name: 'John Smith',
            address: '1337 10th Street',
          },
        },
      };
      const store = setupStore(primeQuery, primeResult);
      const object = readObjectByIdFromStore({
        store,
        id: '$ROOT_QUERY.user',
        fragment: gql`
          fragment user on User {
            info
          }`,
      });
      assert.deepEqual(object, primeResult.user);
    });

    it('with aliases', () => {
      const primeQuery = gql`
        query {
          someAlias: author {
            firstName
            lastName
          }
        }`;
      const primeResult = {
        someAlias: {
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const store = setupStore(primeQuery, primeResult);
      const object = readObjectByIdFromStore({
        store,
        id: '$ROOT_QUERY.author',
        fragment: gql`
          fragment author on Author {
            firstName
            lastName
        }`,
      });
      assert.deepEqual(object, primeResult.someAlias);
    });

    it('with variables', () => {
      const primeQuery = gql`
        query pickAuthor($id: Int, $var: String) {
          author(id: $id) {
            name(var: $var) {
              firstName
              lastName
            }
            __typename
            id
          }
        }`;
      const primeResult = {
        author: {
          name: {
            firstName: 'John',
            lastName: 'Smith',
          },
          __typename: 'Author',
          id: '129',
        },
      };
      const store = writeQueryToStore({
        query: primeQuery,
        result: primeResult,
        dataIdFromObject,
        variables: { id: '129', var: 'idk' },
      });
      const object = readObjectByIdFromStore({
        store,
        id: 'Author__129',
        fragment: gql`
          fragment author on Author {
            name(var: $var) {
              firstName
              lastName
            }
            __typename
            id
          }`,
        variables: {
          var: 'idk',
        },
      });
      assert.deepEqual(object, primeResult.author);
    });
  });
});
