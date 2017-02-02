import { assert } from 'chai';
import { parseSelectionSet, parseFragmentDefinitionMap } from './util/graphqlAST';
import { createMockGraphPrimitives } from './mocks/mockGraphPrimitives';
import { ID_KEY } from '../src/graph/common';
import { writeToGraph } from '../src/graph/write';
import { readFromGraph } from '../src/graph/read';

describe('diffing queries against the store 2', () => {
  it('returns nothing when the store is enough', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{
        people_one(id: "1") {
          name
        }
      }`),
      data: {
        people_one: {
          name: 'Luke Skywalker',
        },
      },
    });

    assert.deepEqual(readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{
        people_one(id: "1") {
          name
        }
      }`),
    }), {
      stale: false,
      data: {
        people_one: {
          name: 'Luke Skywalker',
        },
      },
    });
  });

  it('caches root queries both under the ID of the node and the query name', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{
        people_one(id: "1") {
          __typename,
          id,
          name
        }
      }`),
      data: {
        people_one: {
          __typename: 'Person',
          id: '1',
          name: 'Luke Skywalker',
        },
      },
      getDataID: ({ id }: { id: string }) => id,
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {},
        references: {
          'people_one({"id":"1"})': '(1)',
        },
      },
      '(1)': {
        scalars: {
          __typename: 'Person',
          id: '1',
          name: 'Luke Skywalker',
        },
        references: {},
      },
    });

    assert.deepEqual(readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{
        people_one(id: "1") {
          __typename,
          id,
          name
        }
      }`),
    }), {
      stale: false,
      data: {
        people_one: {
          __typename: 'Person',
          id: '1',
          name: 'Luke Skywalker',
        },
      },
    });
  });

  it('does not swallow errors other than field errors', () => {
    const graph = createMockGraphPrimitives();

    const store = writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{
        person {
          powers
        }
      }`),
      data: {
        person: {
          powers: 'the force',
        },
      },
    });

    assert.throws(() => {
      readFromGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{
          ...notARealFragment
        }`),
      });
    }, 'Could not find fragment named \'notARealFragment\'.');
  });

  it('does not error on a correct query with union typed fragments', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{
        person {
          __typename
          firstName
          lastName
        }
      }`),
      data: {
        person: {
          __typename: 'Author',
          firstName: 'John',
          lastName: 'Smith',
        },
      },
    });

    assert.deepEqual(readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{
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
      }`),
    }), {
      stale: false,
      data: {
        person: {
          __typename: 'Author',
          firstName: 'John',
          lastName: 'Smith',
        },
      },
    });
  });

  it('does not error on a query with fields missing from all but one named fragment', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{
        person {
          __typename
          firstName
          lastName
        }
      }`),
      data: {
        person: {
          __typename: 'Author',
          firstName: 'John',
          lastName: 'Smith',
        },
      },
    });

    assert.deepEqual(readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{
        person {
          __typename
          ...authorInfo
          ...jediInfo
        }
      }`),
      fragments: parseFragmentDefinitionMap(`
        fragment authorInfo on Author {
          firstName
        }
        fragment jediInfo on Jedi {
          powers
        }
      `),
    }), {
      stale: false,
      data: {
        person: {
          __typename: 'Author',
          firstName: 'John',
        },
      },
    });
  });

  it('will add a private id property', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{
        a { id b }
        c { d e { id f } g { h } }
      }`),
      data: {
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
      },
      getDataID: ({ id }: { id: string }) => id,
    });

    const result = readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{
        a { id b }
        c { d e { id f } g { h } }
      }`),
    });

    assert.deepEqual(result, {
      stale: false,
      data: {
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
      },
    });

    const data: any = result.data;
    assert.equal(data[ID_KEY], 'root');
    assert.equal(data.a[0][ID_KEY], '(a:1)');
    assert.equal(data.a[1][ID_KEY], '(a:2)');
    assert.equal(data.a[2][ID_KEY], '(a:3)');
    assert.equal(data.c[ID_KEY], 'root.c');
    assert.equal(data.c.e[0][ID_KEY], '(e:1)');
    assert.equal(data.c.e[1][ID_KEY], '(e:2)');
    assert.equal(data.c.e[2][ID_KEY], '(e:3)');
    assert.equal(data.c.e[3][ID_KEY], '(e:4)');
    assert.equal(data.c.e[4][ID_KEY], '(e:5)');
    assert.equal(data.c.g[ID_KEY], 'root.c.g');
  });

  describe('referential equality preservation', () => {
    it('will return the previous result if there are no changes', () => {
      const graph = createMockGraphPrimitives();

      writeToGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{
          a { b }
          c { d e { f } }
        }`),
        data: {
          a: { b: 1 },
          c: { d: 2, e: { f: 3 } },
        },
      });

      const previousData = {
        a: { b: 1 },
        c: { d: 2, e: { f: 3 } },
      };

      const result = readFromGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{
          a { b }
          c { d e { f } }
        }`),
        previousData,
      });

      assert.deepEqual(result, {
        stale: false,
        data: {
          a: { b: 1 },
          c: { d: 2, e: { f: 3 } },
        },
      });

      assert.strictEqual(result.data, previousData);
    });

    it('will return parts of the previous result that changed', () => {
      const graph = createMockGraphPrimitives();

      writeToGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{
          a { b }
          c { d e { f } }
        }`),
        data: {
          a: { b: 1 },
          c: { d: 2, e: { f: 3 } },
        },
      });

      const previousData = {
        a: { b: 1 },
        c: { d: 20, e: { f: 3 } },
      };

      const result = readFromGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{
          a { b }
          c { d e { f } }
        }`),
        previousData,
      });

      assert.deepEqual(result, {
        stale: false,
        data: {
          a: { b: 1 },
          c: { d: 2, e: { f: 3 } },
        },
      });

      const data: any = result.data;
      assert.notStrictEqual(data, previousData);
      assert.strictEqual(data.a, previousData.a);
      assert.notStrictEqual(data.c, previousData.c);
      assert.strictEqual(data.c.e, previousData.c.e);
    });

    it('will return the previous result if there are no changes in child arrays', () => {
      const graph = createMockGraphPrimitives();

      writeToGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{
          a { b }
          c { d e { f } }
        }`),
        data: {
          a: [{ b: 1.1 }, { b: 1.2 }, { b: 1.3 }],
          c: { d: 2, e: [{ f: 3.1 }, { f: 3.2 }, { f: 3.3 }, { f: 3.4 }, { f: 3.5 }] },
        },
      });

      const previousData = {
        a: [{ b: 1.1 }, { b: 1.2 }, { b: 1.3 }],
        c: { d: 2, e: [{ f: 3.1 }, { f: 3.2 }, { f: 3.3 }, { f: 3.4 }, { f: 3.5 }] },
      };

      const result = readFromGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{
          a { b }
          c { d e { f } }
        }`),
        previousData,
      });

      assert.deepEqual(result, {
        stale: false,
        data: {
          a: [{ b: 1.1 }, { b: 1.2 }, { b: 1.3 }],
          c: { d: 2, e: [{ f: 3.1 }, { f: 3.2 }, { f: 3.3 }, { f: 3.4 }, { f: 3.5 }] },
        },
      });

      assert.strictEqual(result.data, previousData);
    });

    it('will not add zombie items when previousResult starts with the same items', () => {
      const graph = createMockGraphPrimitives();

      writeToGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{ a { b } }`),
        data: { a: [{ b: 1.1 }, { b: 1.2 }] },
      });

      const previousData = {
        a: [{ b: 1.1 }, { b: 1.2 }, { b: 1.3 }],
      };

      const result = readFromGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{ a { b } }`),
        previousData,
      });

      assert.deepEqual(result, {
        stale: false,
        data: { a: [{ b: 1.1 }, { b: 1.2 }] },
      });

      const data: any = result.data;
      assert.strictEqual(data.a[0], previousData.a[0]);
      assert.strictEqual(data.a[1], previousData.a[1]);
    });

    it('will return the previous result if there are no changes in nested child arrays', () => {
      const graph = createMockGraphPrimitives();

      writeToGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{
          a { b }
          c { d e { f } }
        }`),
        data: {
          a: [[[[[{ b: 1.1 }, { b: 1.2 }, { b: 1.3 }]]]]],
          c: { d: 2, e: [[{ f: 3.1 }, { f: 3.2 }, { f: 3.3 }], [{ f: 3.4 }, { f: 3.5 }]] },
        },
      });

      const previousData = {
        a: [[[[[{ b: 1.1 }, { b: 1.2 }, { b: 1.3 }]]]]],
        c: { d: 2, e: [[{ f: 3.1 }, { f: 3.2 }, { f: 3.3 }], [{ f: 3.4 }, { f: 3.5 }]] },
      };

      const result = readFromGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{
          a { b }
          c { d e { f } }
        }`),
        previousData,
      });

      assert.deepEqual(result, {
        stale: false,
        data: {
          a: [[[[[{ b: 1.1 }, { b: 1.2 }, { b: 1.3 }]]]]],
          c: { d: 2, e: [[{ f: 3.1 }, { f: 3.2 }, { f: 3.3 }], [{ f: 3.4 }, { f: 3.5 }]] },
        },
      });

      assert.strictEqual(result.data, previousData);
    });

    it('will return parts of the previous result if there are changes in child arrays', () => {
      const graph = createMockGraphPrimitives();

      writeToGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{
          a { b }
          c { d e { f } }
        }`),
        data: {
          a: [{ b: 1.1 }, { b: 1.2 }, { b: 1.3 }],
          c: { d: 2, e: [{ f: 3.1 }, { f: 3.2 }, { f: 3.3 }, { f: 3.4 }, { f: 3.5 }] },
        },
      });

      const previousData = {
        a: [{ b: 1.1 }, { b: -1.2 }, { b: 1.3 }],
        c: { d: 20, e: [{ f: 3.1 }, { f: 3.2 }, { f: 3.3 }, { f: 3.4 }, { f: 3.5 }] },
      };

      const result = readFromGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{
          a { b }
          c { d e { f } }
        }`),
        previousData,
      });

      assert.deepEqual(result, {
        stale: false,
        data: {
          a: [{ b: 1.1 }, { b: 1.2 }, { b: 1.3 }],
          c: { d: 2, e: [{ f: 3.1 }, { f: 3.2 }, { f: 3.3 }, { f: 3.4 }, { f: 3.5 }] },
        },
      });

      const data: any = result.data;
      assert.notStrictEqual(data, previousData);
      assert.notStrictEqual(data.a, previousData.a);
      assert.strictEqual(data.a[0], previousData.a[0]);
      assert.notStrictEqual(data.a[1], previousData.a[1]);
      assert.strictEqual(data.a[2], previousData.a[2]);
      assert.notStrictEqual(data.c, previousData.c);
      assert.strictEqual(data.c.e, previousData.c.e);
      assert.strictEqual(data.c.e[0], previousData.c.e[0]);
      assert.strictEqual(data.c.e[1], previousData.c.e[1]);
      assert.strictEqual(data.c.e[2], previousData.c.e[2]);
      assert.strictEqual(data.c.e[3], previousData.c.e[3]);
      assert.strictEqual(data.c.e[4], previousData.c.e[4]);
    });

    it('will return the same items in a different order', () => {
      const graph = createMockGraphPrimitives();

      writeToGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{
          a { id b }
          c { d e { id f } g { h } }
        }`),
        data: {
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
        },
        getDataID: ({ id }: { id: string }) => id,
      });

      const previousData = {
        a: [
          { id: 'a:3', b: 1.3, [ID_KEY]: '(a:3)' },
          { id: 'a:2', b: 1.2, [ID_KEY]: '(a:2)' },
          { id: 'a:1', b: 1.1, [ID_KEY]: '(a:1)' },
        ],
        c: {
          d: 2,
          e: [
            { id: 'e:4', f: 3.4, [ID_KEY]: '(e:4)' },
            { id: 'e:2', f: 3.2, [ID_KEY]: '(e:2)' },
            { id: 'e:5', f: 3.5, [ID_KEY]: '(e:5)' },
            { id: 'e:3', f: 3.3, [ID_KEY]: '(e:3)' },
            { id: 'e:1', f: 3.1, [ID_KEY]: '(e:1)' },
          ],
          g: { h: 4 },
        },
      };

      const result = readFromGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{
          a { id b }
          c { d e { id f } g { h } }
        }`),
        previousData,
      });

      assert.deepEqual(result, {
        stale: false,
        data: {
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
        },
      });

      const data: any = result.data;
      assert.notStrictEqual(data, previousData);
      assert.notStrictEqual(data.a, previousData.a);
      assert.strictEqual(data.a[0], previousData.a[2]);
      assert.strictEqual(data.a[1], previousData.a[1]);
      assert.strictEqual(data.a[2], previousData.a[0]);
      assert.notStrictEqual(data.c, previousData.c);
      assert.notStrictEqual(data.c.e, previousData.c.e);
      assert.strictEqual(data.c.e[0], previousData.c.e[4]);
      assert.strictEqual(data.c.e[1], previousData.c.e[1]);
      assert.strictEqual(data.c.e[2], previousData.c.e[3]);
      assert.strictEqual(data.c.e[3], previousData.c.e[0]);
      assert.strictEqual(data.c.e[4], previousData.c.e[2]);
      assert.strictEqual(data.c.g, previousData.c.g);
    });

    it('will return the same JSON scalar field object', () => {
      const graph = createMockGraphPrimitives();

      writeToGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{
          a { b c }
          d { e f }
        }`),
        data: {
          a: { b: 1, c: { x: 2, y: 3, z: 4 } },
          d: { e: 5, f: { x: 6, y: 7, z: 8 } },
        },
      });

      const previousData = {
        a: { b: 1, c: { x: 2, y: 3, z: 4 } },
        d: { e: 50, f: { x: 6, y: 7, z: 8 } },
      };

      const result = readFromGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{
          a { b c }
          d { e f }
        }`),
        previousData,
      });

      assert.deepEqual(result, {
        stale: false,
        data: {
          a: { b: 1, c: { x: 2, y: 3, z: 4 } },
          d: { e: 5, f: { x: 6, y: 7, z: 8 } },
        },
      });

      const data: any = result.data;
      assert.notStrictEqual(data, previousData);
      assert.strictEqual(data.a, previousData.a);
      assert.notStrictEqual(data.d, previousData.d);
      assert.strictEqual(data.d.f, previousData.d.f);
    });
  });
});
