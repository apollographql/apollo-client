import { assert } from 'chai';

import {
  diffQueryAgainstStore,
  ID_KEY,
} from '../src/data/readFromStore';

import { writeQueryToStore } from '../src/data/writeToStore';

import gql from 'graphql-tag';
import {
  withError,
} from './util/wrap';

import {
  HeuristicFragmentMatcher,
} from '../src/data/fragmentMatcher';
const fragmentMatcherFunction = new HeuristicFragmentMatcher().match;

describe('diffing queries against the store', () => {
  it('returns nothing when the store is enough', () => {
    const query = gql`
      {
        people_one(id: "1") {
          name
        }
      }
    `;

    const result = {
      people_one: {
        name: 'Luke Skywalker',
      },
    };

    const store = writeQueryToStore({
      result,
      query,
    });

    assert.notOk(diffQueryAgainstStore({
      store,
      query,
    }).isMissing);
  });

  it('caches root queries both under the ID of the node and the query name', () => {
    const firstQuery = gql`
      {
        people_one(id: "1") {
          __typename,
          id,
          name
        }
      }
    `;

    const result = {
      people_one: {
        __typename: 'Person',
        id: '1',
        name: 'Luke Skywalker',
      },
    };

    const getIdField = ({id}: {id: string}) => id;

    const store = writeQueryToStore({
      result,
      query: firstQuery,
      dataIdFromObject: getIdField,
    });

    const secondQuery = gql`
      {
        people_one(id: "1") {
          __typename,
          id,
          name
        }
      }
    `;

    const { isMissing } = diffQueryAgainstStore({
      store,
      query: secondQuery,
    });

    assert.notOk(isMissing);
    assert.deepEqual(store['1'], result.people_one);
  });

  it('does not swallow errors other than field errors', () => {
    const firstQuery = gql`
      query {
        person {
          powers
        }
      }`;
    const firstResult = {
      person: {
        powers: 'the force',
      },
    };
    const store = writeQueryToStore({
      result: firstResult,
      query: firstQuery,
    });
    const unionQuery = gql`
      query {
        ...notARealFragment
      }`;
    return assert.throws(() => {
      diffQueryAgainstStore({
        store,
        query: unionQuery,
      });
    }, /No fragment/);
  });

  it('does not error on a correct query with union typed fragments', () => {
    return withError(() => {
      const firstQuery = gql`
        query {
          person {
            __typename
            firstName
            lastName
          }
        }`;
      const firstResult = {
        person: {
          __typename: 'Author',
          firstName: 'John',
          lastName: 'Smith',
        },
      };
      const store = writeQueryToStore({
        result: firstResult,
        query: firstQuery,
      });
      const unionQuery = gql`
        query {
          person {
            __typename
            ... on Author {
              firstName
              lastName
            }

            ... on Jedi {
              powers
            }
          }
        }`;
      const { isMissing } = diffQueryAgainstStore({
        store,
        query: unionQuery,
        returnPartialData: false,
        fragmentMatcherFunction,
      });

      assert.isTrue(isMissing);
    }, /IntrospectionFragmentMatcher/);
  });

  it('does not error on a query with fields missing from all but one named fragment', () => {
    const firstQuery = gql`
      query {
        person {
          __typename
          firstName
          lastName
        }
      }`;
    const firstResult = {
      person: {
        __typename: 'Author',
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    const store = writeQueryToStore({
      result: firstResult,
      query: firstQuery,
    });
    const unionQuery = gql`
      query {
        person {
          __typename
          ...authorInfo
          ...jediInfo
        }
      }
      fragment authorInfo on Author {
        firstName
      }
      fragment jediInfo on Jedi {
        powers
      }`;

    const { isMissing } = diffQueryAgainstStore({
      store,
      query: unionQuery,
    });

    assert.isTrue(isMissing);
  });

  it('throws an error on a query with fields missing from matching named fragments', () => {
    const firstQuery = gql`
      query {
        person {
          __typename
          firstName
          lastName
        }
      }`;
    const firstResult = {
      person: {
        __typename: 'Author',
        firstName: 'John',
        lastName: 'Smith',
      },
    };
    const store = writeQueryToStore({
      result: firstResult,
      query: firstQuery,
    });
    const unionQuery = gql`
      query {
        person {
          __typename
          ...authorInfo
          ...jediInfo
        }
      }
      fragment authorInfo on Author {
        firstName
        address
      }
      fragment jediInfo on Jedi {
        jedi
      }`;
    assert.throw(() => {
      diffQueryAgainstStore({
        store,
        query: unionQuery,
        returnPartialData: false,
      });
    });
  });

  it('returns available fields if returnPartialData is true', () => {
    const firstQuery = gql`
      {
        people_one(id: "1") {
          __typename
          id
          name
        }
      }
    `;

    const firstResult = {
      people_one: {
        __typename: 'Person',
        id: 'lukeId',
        name: 'Luke Skywalker',
      },
    };

    const store = writeQueryToStore({
      result: firstResult,
      query: firstQuery,
    });

    // Variants on a simple query with a missing field.

    const simpleQuery = gql`
      {
        people_one(id: "1") {
          name
          age
        }
      }
    `;

    const inlineFragmentQuery = gql`
      {
        people_one(id: "1") {
          ... on Person {
            name
            age
          }
        }
      }
    `;

    const namedFragmentQuery = gql`
      query {
        people_one(id: "1") {
          ...personInfo
        }
      }
      fragment personInfo on Person {
        name
        age
      }`;

    const simpleDiff = diffQueryAgainstStore({
      store,
      query: simpleQuery,
    });

    assert.deepEqual(simpleDiff.result, {
      people_one: {
        name: 'Luke Skywalker',
      },
    });

    const inlineDiff = diffQueryAgainstStore({
      store,
      query: inlineFragmentQuery,
    });

    assert.deepEqual(inlineDiff.result, {
      people_one: {
        name: 'Luke Skywalker',
      },
    });

    const namedDiff = diffQueryAgainstStore({
      store,
      query: namedFragmentQuery,
    });

    assert.deepEqual(namedDiff.result, {
      people_one: {
        name: 'Luke Skywalker',
      },
    });

    assert.throws(function() {
      diffQueryAgainstStore({
        store,
        query: simpleQuery,
        returnPartialData: false,
      });
    });
  });

  it('will add a private id property', () => {
    const query = gql`
      query {
        a { id b }
        c { d e { id f } g { h } }
      }
    `;

    const queryResult = {
      a: [
        { id: 'a:1', b: 1.1 },
        { id: 'a:2', b: 1.2 },
        { id: 'a:3', b: 1.3 },
      ],
      c: {
        d: 2,
        e: [
          { id: 'e:1', f: 3.1 },
          { id: 'e:2', f: 3.2 },
          { id: 'e:3', f: 3.3 },
          { id: 'e:4', f: 3.4 },
          { id: 'e:5', f: 3.5 },
        ],
        g: { h: 4 },
      },
    };

    const store = writeQueryToStore({
      query,
      result: queryResult,
      dataIdFromObject: ({ id }: { id: string }) => id,
    });

    const { result } = diffQueryAgainstStore({
      store,
      query,
    });

    assert.deepEqual(result, queryResult);
    assert.equal(result[ID_KEY], 'ROOT_QUERY');
    assert.equal(result.a[0][ID_KEY], 'a:1');
    assert.equal(result.a[1][ID_KEY], 'a:2');
    assert.equal(result.a[2][ID_KEY], 'a:3');
    assert.equal(result.c[ID_KEY], '$ROOT_QUERY.c');
    assert.equal(result.c.e[0][ID_KEY], 'e:1');
    assert.equal(result.c.e[1][ID_KEY], 'e:2');
    assert.equal(result.c.e[2][ID_KEY], 'e:3');
    assert.equal(result.c.e[3][ID_KEY], 'e:4');
    assert.equal(result.c.e[4][ID_KEY], 'e:5');
    assert.equal(result.c.g[ID_KEY], '$ROOT_QUERY.c.g');
  });

  describe('referential equality preservation', () => {
    it('will return the previous result if there are no changes', () => {
      const query = gql`
        query {
          a { b }
          c { d e { f } }
        }
      `;

      const queryResult = {
        a: { b: 1 },
        c: { d: 2, e: { f: 3 } },
      };

      const store = writeQueryToStore({
        query,
        result: queryResult,
      });

      const previousResult = {
        a: { b: 1 },
        c: { d: 2, e: { f: 3 } },
      };

      const { result } = diffQueryAgainstStore({
        store,
        query,
        previousResult,
      });

      assert.deepEqual(result, queryResult);
      assert.strictEqual(result, previousResult);
    });

    it('will return parts of the previous result that changed', () => {
      const query = gql`
        query {
          a { b }
          c { d e { f } }
        }
      `;

      const queryResult = {
        a: { b: 1 },
        c: { d: 2, e: { f: 3 } },
      };

      const store = writeQueryToStore({
        query,
        result: queryResult,
      });

      const previousResult = {
        a: { b: 1 },
        c: { d: 20, e: { f: 3 } },
      };

      const { result } = diffQueryAgainstStore({
        store,
        query,
        previousResult,
      });

      assert.deepEqual(result, queryResult);
      assert.notStrictEqual(result, previousResult);
      assert.strictEqual(result.a, previousResult.a);
      assert.notStrictEqual(result.c, previousResult.c);
      assert.strictEqual(result.c.e, previousResult.c.e);
    });

    it('will return the previous result if there are no changes in child arrays', () => {
      const query = gql`
        query {
          a { b }
          c { d e { f } }
        }
      `;

      const queryResult = {
        a: [{ b: 1.1 }, { b: 1.2 }, { b: 1.3 }],
        c: { d: 2, e: [{ f: 3.1 }, { f: 3.2 }, { f: 3.3 }, { f: 3.4 }, { f: 3.5 }] },
      };

      const store = writeQueryToStore({
        query,
        result: queryResult,
      });

      const previousResult = {
        a: [{ b: 1.1 }, { b: 1.2 }, { b: 1.3 }],
        c: { d: 2, e: [{ f: 3.1 }, { f: 3.2 }, { f: 3.3 }, { f: 3.4 }, { f: 3.5 }] },
      };

      const { result } = diffQueryAgainstStore({
        store,
        query,
        previousResult,
      });

      assert.deepEqual(result, queryResult);
      assert.strictEqual(result, previousResult);
    });

    it('will not add zombie items when previousResult starts with the same items', () => {
      const query = gql`
        query {
          a { b }
        }
      `;

      const queryResult = {
        a: [{ b: 1.1 }, { b: 1.2 }],
      };

      const store = writeQueryToStore({
        query,
        result: queryResult,
      });

      const previousResult = {
        a: [{ b: 1.1 }, { b: 1.2 }, { b: 1.3 }],
      };

      const { result } = diffQueryAgainstStore({
        store,
        query,
        previousResult,
      });

      assert.deepEqual(result, queryResult);
      assert.strictEqual(result.a[0], previousResult.a[0]);
      assert.strictEqual(result.a[1], previousResult.a[1]);
    });

    it('will return the previous result if there are no changes in nested child arrays', () => {
      const query = gql`
        query {
          a { b }
          c { d e { f } }
        }
      `;

      const queryResult = {
        a: [[[[[{ b: 1.1 }, { b: 1.2 }, { b: 1.3 }]]]]],
        c: { d: 2, e: [[{ f: 3.1 }, { f: 3.2 }, { f: 3.3 }], [{ f: 3.4 }, { f: 3.5 }]] },
      };

      const store = writeQueryToStore({
        query,
        result: queryResult,
      });

      const previousResult = {
        a: [[[[[{ b: 1.1 }, { b: 1.2 }, { b: 1.3 }]]]]],
        c: { d: 2, e: [[{ f: 3.1 }, { f: 3.2 }, { f: 3.3 }], [{ f: 3.4 }, { f: 3.5 }]] },
      };

      const { result } = diffQueryAgainstStore({
        store,
        query,
        previousResult,
      });

      assert.deepEqual(result, queryResult);
      assert.strictEqual(result, previousResult);
    });

    it('will return parts of the previous result if there are changes in child arrays', () => {
      const query = gql`
        query {
          a { b }
          c { d e { f } }
        }
      `;

      const queryResult = {
        a: [{ b: 1.1 }, { b: 1.2 }, { b: 1.3 }],
        c: { d: 2, e: [{ f: 3.1 }, { f: 3.2 }, { f: 3.3 }, { f: 3.4 }, { f: 3.5 }] },
      };

      const store = writeQueryToStore({
        query,
        result: queryResult,
      });

      const previousResult = {
        a: [{ b: 1.1 }, { b: -1.2 }, { b: 1.3 }],
        c: { d: 20, e: [{ f: 3.1 }, { f: 3.2 }, { f: 3.3 }, { f: 3.4 }, { f: 3.5 }] },
      };

      const { result } = diffQueryAgainstStore({
        store,
        query,
        previousResult,
      });

      assert.deepEqual(result, queryResult);
      assert.notStrictEqual(result, previousResult);
      assert.notStrictEqual(result.a, previousResult.a);
      assert.strictEqual(result.a[0], previousResult.a[0]);
      assert.notStrictEqual(result.a[1], previousResult.a[1]);
      assert.strictEqual(result.a[2], previousResult.a[2]);
      assert.notStrictEqual(result.c, previousResult.c);
      assert.notStrictEqual(result.c.e, previousResult.c.e);
      assert.strictEqual(result.c.e[0], previousResult.c.e[0]);
      assert.strictEqual(result.c.e[1], previousResult.c.e[1]);
      assert.strictEqual(result.c.e[2], previousResult.c.e[2]);
      assert.strictEqual(result.c.e[3], previousResult.c.e[3]);
      assert.strictEqual(result.c.e[4], previousResult.c.e[4]);
    });

    it('will return the same items in a different order with `dataIdFromObject`', () => {
      const query = gql`
        query {
          a { id b }
          c { d e { id f } g { h } }
        }
      `;

      const queryResult = {
        a: [
          { id: 'a:1', b: 1.1 },
          { id: 'a:2', b: 1.2 },
          { id: 'a:3', b: 1.3 },
        ],
        c: {
          d: 2,
          e: [
            { id: 'e:1', f: 3.1 },
            { id: 'e:2', f: 3.2 },
            { id: 'e:3', f: 3.3 },
            { id: 'e:4', f: 3.4 },
            { id: 'e:5', f: 3.5 },
          ],
          g: { h: 4 },
        },
      };

      const store = writeQueryToStore({
        query,
        result: queryResult,
        dataIdFromObject: ({ id }: { id: string }) => id,
      });

      const previousResult = {
        a: [
          { id: 'a:3', b: 1.3, [ID_KEY]: 'a:3' },
          { id: 'a:2', b: 1.2, [ID_KEY]: 'a:2' },
          { id: 'a:1', b: 1.1, [ID_KEY]: 'a:1' },
        ],
        c: {
          d: 2,
          e: [
            { id: 'e:4', f: 3.4, [ID_KEY]: 'e:4' },
            { id: 'e:2', f: 3.2, [ID_KEY]: 'e:2' },
            { id: 'e:5', f: 3.5, [ID_KEY]: 'e:5' },
            { id: 'e:3', f: 3.3, [ID_KEY]: 'e:3' },
            { id: 'e:1', f: 3.1, [ID_KEY]: 'e:1' },
          ],
          g: { h: 4 },
        },
      };

      const { result } = diffQueryAgainstStore({
        store,
        query,
        previousResult,
      });

      assert.deepEqual(result, queryResult);
      assert.notStrictEqual(result, previousResult);
      assert.notStrictEqual(result.a, previousResult.a);
      assert.strictEqual(result.a[0], previousResult.a[2]);
      assert.strictEqual(result.a[1], previousResult.a[1]);
      assert.strictEqual(result.a[2], previousResult.a[0]);
      assert.notStrictEqual(result.c, previousResult.c);
      assert.notStrictEqual(result.c.e, previousResult.c.e);
      assert.strictEqual(result.c.e[0], previousResult.c.e[4]);
      assert.strictEqual(result.c.e[1], previousResult.c.e[1]);
      assert.strictEqual(result.c.e[2], previousResult.c.e[3]);
      assert.strictEqual(result.c.e[3], previousResult.c.e[0]);
      assert.strictEqual(result.c.e[4], previousResult.c.e[2]);
      assert.strictEqual(result.c.g, previousResult.c.g);
    });

    it('will return the same JSON scalar field object', () => {
      const query = gql`
        {
          a { b c }
          d { e f }
        }
      `;

      const queryResult = {
        a: { b: 1, c: { x: 2, y: 3, z: 4 } },
        d: { e: 5, f: { x: 6, y: 7, z: 8 } },
      };

      const store = writeQueryToStore({
        query,
        result: queryResult,
      });

      const previousResult = {
        a: { b: 1, c: { x: 2, y: 3, z: 4 } },
        d: { e: 50, f: { x: 6, y: 7, z: 8 } },
      };

      const { result } = diffQueryAgainstStore({
        store,
        query,
        previousResult,
      });

      assert.deepEqual(result, queryResult);
      assert.notStrictEqual(result, previousResult);
      assert.strictEqual(result.a, previousResult.a);
      assert.notStrictEqual(result.d, previousResult.d);
      assert.strictEqual(result.d.f, previousResult.d.f);
    });
  });
});
