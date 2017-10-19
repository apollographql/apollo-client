import gql, { disableFragmentWarnings } from 'graphql-tag';
import { toIdValue } from 'apollo-utilities';

import { diffQueryAgainstStore, ID_KEY } from '../readFromStore';
import { writeQueryToStore } from '../writeToStore';
import { HeuristicFragmentMatcher } from '../fragmentMatcher';

const fragmentMatcherFunction = new HeuristicFragmentMatcher().match;

disableFragmentWarnings();
export function withError(func: Function, regex: RegExp) {
  let message: string = null as never;
  const oldError = console.error;

  console.error = (m: string) => (message = m);

  try {
    const result = func();
    expect(message).toMatch(regex);
    return result;
  } finally {
    console.error = oldError;
  }
}

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

    expect(
      diffQueryAgainstStore({
        store,
        query,
      }).complete,
    ).toBeTruthy();
  });

  it('caches root queries both under the ID of the node and the query name', () => {
    const firstQuery = gql`
      {
        people_one(id: "1") {
          __typename
          id
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

    const getIdField = ({ id }: { id: string }) => id;

    const store = writeQueryToStore({
      result,
      query: firstQuery,
      dataIdFromObject: getIdField,
    });

    const secondQuery = gql`
      {
        people_one(id: "1") {
          __typename
          id
          name
        }
      }
    `;

    const { complete } = diffQueryAgainstStore({
      store,
      query: secondQuery,
    });

    expect(complete).toBeTruthy();
    expect(store['1']).toEqual(result.people_one);
  });

  it('does not swallow errors other than field errors', () => {
    const firstQuery = gql`
      query {
        person {
          powers
        }
      }
    `;
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
      }
    `;
    return expect(() => {
      diffQueryAgainstStore({
        store,
        query: unionQuery,
      });
    }).toThrowError(/No fragment/);
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
        }
      `;
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
        }
      `;
      const { complete } = diffQueryAgainstStore({
        store,
        query: unionQuery,
        returnPartialData: false,
        fragmentMatcherFunction,
      });

      expect(complete).toBe(false);
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
      }
    `;
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
      }
    `;

    const { complete } = diffQueryAgainstStore({
      store,
      query: unionQuery,
    });

    expect(complete).toBe(false);
  });

  it('throws an error on a query with fields missing from matching named fragments', () => {
    const firstQuery = gql`
      query {
        person {
          __typename
          firstName
          lastName
        }
      }
    `;
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
          ...authorInfo2
          ...jediInfo2
        }
      }

      fragment authorInfo2 on Author {
        firstName
        address
      }

      fragment jediInfo2 on Jedi {
        jedi
      }
    `;
    expect(() => {
      diffQueryAgainstStore({
        store,
        query: unionQuery,
        returnPartialData: false,
      });
    }).toThrow();
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
      }
    `;

    const simpleDiff = diffQueryAgainstStore({
      store,
      query: simpleQuery,
    });

    expect(simpleDiff.result).toEqual({
      people_one: {
        name: 'Luke Skywalker',
      },
    });

    const inlineDiff = diffQueryAgainstStore({
      store,
      query: inlineFragmentQuery,
    });

    expect(inlineDiff.result).toEqual({
      people_one: {
        name: 'Luke Skywalker',
      },
    });

    const namedDiff = diffQueryAgainstStore({
      store,
      query: namedFragmentQuery,
    });

    expect(namedDiff.result).toEqual({
      people_one: {
        name: 'Luke Skywalker',
      },
    });

    expect(function() {
      diffQueryAgainstStore({
        store,
        query: simpleQuery,
        returnPartialData: false,
      });
    }).toThrow();
  });

  it('will add a private id property', () => {
    const query = gql`
      query {
        a {
          id
          b
        }
        c {
          d
          e {
            id
            f
          }
          g {
            h
          }
        }
      }
    `;

    const queryResult = {
      a: [{ id: 'a:1', b: 1.1 }, { id: 'a:2', b: 1.2 }, { id: 'a:3', b: 1.3 }],
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

    expect(result).toEqual(queryResult);
    expect(result[ID_KEY]).toBe('ROOT_QUERY');
    expect(result.a[0][ID_KEY]).toBe('a:1');
    expect(result.a[1][ID_KEY]).toBe('a:2');
    expect(result.a[2][ID_KEY]).toBe('a:3');
    expect(result.c[ID_KEY]).toBe('$ROOT_QUERY.c');
    expect(result.c.e[0][ID_KEY]).toBe('e:1');
    expect(result.c.e[1][ID_KEY]).toBe('e:2');
    expect(result.c.e[2][ID_KEY]).toBe('e:3');
    expect(result.c.e[3][ID_KEY]).toBe('e:4');
    expect(result.c.e[4][ID_KEY]).toBe('e:5');
    expect(result.c.g[ID_KEY]).toBe('$ROOT_QUERY.c.g');
  });

  describe('referential equality preservation', () => {
    it('will return the previous result if there are no changes', () => {
      const query = gql`
        query {
          a {
            b
          }
          c {
            d
            e {
              f
            }
          }
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

      expect(result).toEqual(queryResult);
      expect(result).toEqual(previousResult);
    });

    it('will return parts of the previous result that changed', () => {
      const query = gql`
        query {
          a {
            b
          }
          c {
            d
            e {
              f
            }
          }
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

      expect(result).toEqual(queryResult);
      expect(result).not.toEqual(previousResult);
      expect(result.a).toEqual(previousResult.a);
      expect(result.c).not.toEqual(previousResult.c);
      expect(result.c.e).toEqual(previousResult.c.e);
    });

    it('will return the previous result if there are no changes in child arrays', () => {
      const query = gql`
        query {
          a {
            b
          }
          c {
            d
            e {
              f
            }
          }
        }
      `;

      const queryResult = {
        a: [{ b: 1.1 }, { b: 1.2 }, { b: 1.3 }],
        c: {
          d: 2,
          e: [{ f: 3.1 }, { f: 3.2 }, { f: 3.3 }, { f: 3.4 }, { f: 3.5 }],
        },
      };

      const store = writeQueryToStore({
        query,
        result: queryResult,
      });

      const previousResult = {
        a: [{ b: 1.1 }, { b: 1.2 }, { b: 1.3 }],
        c: {
          d: 2,
          e: [{ f: 3.1 }, { f: 3.2 }, { f: 3.3 }, { f: 3.4 }, { f: 3.5 }],
        },
      };

      const { result } = diffQueryAgainstStore({
        store,
        query,
        previousResult,
      });

      expect(result).toEqual(queryResult);
      expect(result).toEqual(previousResult);
    });

    it('will not add zombie items when previousResult starts with the same items', () => {
      const query = gql`
        query {
          a {
            b
          }
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

      expect(result).toEqual(queryResult);
      expect(result.a[0]).toEqual(previousResult.a[0]);
      expect(result.a[1]).toEqual(previousResult.a[1]);
    });

    it('will return the previous result if there are no changes in nested child arrays', () => {
      const query = gql`
        query {
          a {
            b
          }
          c {
            d
            e {
              f
            }
          }
        }
      `;

      const queryResult = {
        a: [[[[[{ b: 1.1 }, { b: 1.2 }, { b: 1.3 }]]]]],
        c: {
          d: 2,
          e: [[{ f: 3.1 }, { f: 3.2 }, { f: 3.3 }], [{ f: 3.4 }, { f: 3.5 }]],
        },
      };

      const store = writeQueryToStore({
        query,
        result: queryResult,
      });

      const previousResult = {
        a: [[[[[{ b: 1.1 }, { b: 1.2 }, { b: 1.3 }]]]]],
        c: {
          d: 2,
          e: [[{ f: 3.1 }, { f: 3.2 }, { f: 3.3 }], [{ f: 3.4 }, { f: 3.5 }]],
        },
      };

      const { result } = diffQueryAgainstStore({
        store,
        query,
        previousResult,
      });

      expect(result).toEqual(queryResult);
      expect(result).toEqual(previousResult);
    });

    it('will return parts of the previous result if there are changes in child arrays', () => {
      const query = gql`
        query {
          a {
            b
          }
          c {
            d
            e {
              f
            }
          }
        }
      `;

      const queryResult = {
        a: [{ b: 1.1 }, { b: 1.2 }, { b: 1.3 }],
        c: {
          d: 2,
          e: [{ f: 3.1 }, { f: 3.2 }, { f: 3.3 }, { f: 3.4 }, { f: 3.5 }],
        },
      };

      const store = writeQueryToStore({
        query,
        result: queryResult,
      });

      const previousResult = {
        a: [{ b: 1.1 }, { b: -1.2 }, { b: 1.3 }],
        c: {
          d: 20,
          e: [{ f: 3.1 }, { f: 3.2 }, { f: 3.3 }, { f: 3.4 }, { f: 3.5 }],
        },
      };

      const { result } = diffQueryAgainstStore({
        store,
        query,
        previousResult,
      });

      expect(result).toEqual(queryResult);
      expect(result).not.toEqual(previousResult);
      expect(result.a).not.toEqual(previousResult.a);
      expect(result.a[0]).toEqual(previousResult.a[0]);
      expect(result.a[1]).not.toEqual(previousResult.a[1]);
      expect(result.a[2]).toEqual(previousResult.a[2]);
      expect(result.c).not.toEqual(previousResult.c);
      expect(result.c.e).toEqual(previousResult.c.e);
      expect(result.c.e[0]).toEqual(previousResult.c.e[0]);
      expect(result.c.e[1]).toEqual(previousResult.c.e[1]);
      expect(result.c.e[2]).toEqual(previousResult.c.e[2]);
      expect(result.c.e[3]).toEqual(previousResult.c.e[3]);
      expect(result.c.e[4]).toEqual(previousResult.c.e[4]);
    });

    it('will return the same items in a different order with `dataIdFromObject`', () => {
      const query = gql`
        query {
          a {
            id
            b
          }
          c {
            d
            e {
              id
              f
            }
            g {
              h
            }
          }
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

      expect(result).toEqual(queryResult);
      expect(result).not.toEqual(previousResult);
      expect(result.a).not.toEqual(previousResult.a);
      expect(result.a[0]).toEqual(previousResult.a[2]);
      expect(result.a[1]).toEqual(previousResult.a[1]);
      expect(result.a[2]).toEqual(previousResult.a[0]);
      expect(result.c).not.toEqual(previousResult.c);
      expect(result.c.e).not.toEqual(previousResult.c.e);
      expect(result.c.e[0]).toEqual(previousResult.c.e[4]);
      expect(result.c.e[1]).toEqual(previousResult.c.e[1]);
      expect(result.c.e[2]).toEqual(previousResult.c.e[3]);
      expect(result.c.e[3]).toEqual(previousResult.c.e[0]);
      expect(result.c.e[4]).toEqual(previousResult.c.e[2]);
      expect(result.c.g).toEqual(previousResult.c.g);
    });

    it('will return the same JSON scalar field object', () => {
      const query = gql`
        {
          a {
            b
            c
          }
          d {
            e
            f
          }
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

      expect(result).toEqual(queryResult);
      expect(result).not.toEqual(previousResult);
      expect(result.a).toEqual(previousResult.a);
      expect(result.d).not.toEqual(previousResult.d);
      expect(result.d.f).toEqual(previousResult.d.f);
    });
    it('will preserve equality with custom resolvers', () => {
      const listQuery = gql`
        {
          people {
            id
            name
            __typename
          }
        }
      `;

      const listResult = {
        people: [
          {
            id: '4',
            name: 'Luke Skywalker',
            __typename: 'Person',
          },
        ],
      };

      const itemQuery = gql`
        {
          person(id: 4) {
            id
            name
            __typename
          }
        }
      `;

      const dataIdFromObject = (obj: any) => obj.id;

      const store = writeQueryToStore({
        query: listQuery,
        result: listResult,
        dataIdFromObject,
      });

      const previousResult = {
        person: listResult.people[0],
      };

      const cacheResolvers = {
        Query: {
          person: (_: any, args: any) => toIdValue(args['id']),
        },
      };

      const config = { dataIdFromObject, cacheResolvers };

      const { result } = diffQueryAgainstStore({
        store,
        query: itemQuery,
        previousResult,
        config,
      });

      expect(result).toEqual(previousResult);
    });
  });
});
