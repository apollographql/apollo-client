import { assert } from 'chai';
import { parseSelectionSet, parseFragmentDefinitionMap } from './util/graphqlAST';
import { createMockGraphPrimitives } from './mocks/mockGraphPrimitives';
import { ID_KEY } from '../src/graph/common';
import { writeToGraph } from '../src/graph/write';

const TEST_ID_KEY = Symbol('testIdKey');
const getDataID = (object: any) => object[TEST_ID_KEY];

describe('writeToGraph', () => {
  it('will perform basic scalar writes', () => {
    const graph = createMockGraphPrimitives();
    const foo: any = Symbol();
    const bar: any = Symbol();
    const buz: any = Symbol();
    writeToGraph({
      graph,
      id: 'a',
      data: { foo },
      selectionSet: parseSelectionSet(`{ foo }`),
    });
    assert.deepEqual(graph.data, {
      a: {
        scalars: { foo },
        references: {},
      },
    });
    writeToGraph({
      graph,
      id: 'b',
      data: { bar },
      selectionSet: parseSelectionSet(`{ bar }`),
    });
    assert.deepEqual(graph.data, {
      a: {
        scalars: { foo },
        references: {},
      },
      b: {
        scalars: { bar },
        references: {},
      },
    });
    writeToGraph({
      graph,
      id: 'a',
      data: { buz },
      selectionSet: parseSelectionSet(`{ buz }`),
    });
    assert.deepEqual(graph.data, {
      a: {
        scalars: { foo, buz },
        references: {},
      },
      b: {
        scalars: { bar },
        references: {},
      },
    });
  });

  it('will perform basic scalar writes with aliases', () => {
    const graph = createMockGraphPrimitives();
    const foo: any = Symbol();
    const bar: any = Symbol();
    const buz: any = Symbol();
    writeToGraph({
      graph,
      id: 'a',
      data: { x: foo },
      selectionSet: parseSelectionSet(`{ x: foo }`),
    });
    assert.deepEqual(graph.data, {
      a: {
        scalars: { foo },
        references: {},
      },
    });
    writeToGraph({
      graph,
      id: 'b',
      data: { y: bar },
      selectionSet: parseSelectionSet(`{ y: bar }`),
    });
    assert.deepEqual(graph.data, {
      a: {
        scalars: { foo },
        references: {},
      },
      b: {
        scalars: { bar },
        references: {},
      },
    });
    writeToGraph({
      graph,
      id: 'a',
      data: { z: buz },
      selectionSet: parseSelectionSet(`{ z: buz }`),
    });
    assert.deepEqual(graph.data, {
      a: {
        scalars: { foo, buz },
        references: {},
      },
      b: {
        scalars: { bar },
        references: {},
      },
    });
  });

  it('will perform basic scalar writes with arguments', () => {
    const graph = createMockGraphPrimitives();
    const foo: any = Symbol();
    const bar: any = Symbol();
    const buz: any = Symbol();
    writeToGraph({
      graph,
      id: 'a',
      data: { foo },
      selectionSet: parseSelectionSet(`{ foo(a: 1, b: 2, c: 3) }`),
    });
    assert.deepEqual(graph.data, {
      a: {
        scalars: { 'foo({"a":1,"b":2,"c":3})': foo },
        references: {},
      },
    });
    writeToGraph({
      graph,
      id: 'b',
      data: { bar },
      selectionSet: parseSelectionSet(`{ bar(var: $var) }`),
      variables: { var: { x: 'a', y: 'b', z: 'c' } },
    });
    assert.deepEqual(graph.data, {
      a: {
        scalars: { 'foo({"a":1,"b":2,"c":3})': foo },
        references: {},
      },
      b: {
        scalars: { 'bar({"var":{"x":"a","y":"b","z":"c"}})': bar },
        references: {},
      },
    });
    writeToGraph({
      graph,
      id: 'a',
      data: { alias: buz },
      selectionSet: parseSelectionSet(`{ alias: buz(array: [1, 2, 3], enum: YES, null: null, string: "yolo") }`),
    });
    assert.deepEqual(graph.data, {
      a: {
        scalars: {
          'foo({"a":1,"b":2,"c":3})': foo,
          'buz({"array":[1,2,3],"enum":"YES","null":null,"string":"yolo"})': buz,
        },
        references: {},
      },
      b: {
        scalars: { 'bar({"var":{"x":"a","y":"b","z":"c"}})': bar },
        references: {},
      },
    });
  });

  it('will write nothing with a null id', () => {
    const graph = createMockGraphPrimitives();
    const foo: any = Symbol();
    const bar: any = Symbol();
    const buz: any = Symbol();
    writeToGraph({
      graph,
      id: null,
      data: { foo },
      selectionSet: parseSelectionSet(`{ foo }`),
    });
    assert.deepEqual(graph.data, {});
    writeToGraph({
      graph,
      id: 'b',
      data: { bar },
      selectionSet: parseSelectionSet(`{ bar }`),
    });
    assert.deepEqual(graph.data, {
      b: {
        scalars: { bar },
        references: {},
      },
    });
    writeToGraph({
      graph,
      id: null,
      data: { buz },
      selectionSet: parseSelectionSet(`{ buz }`),
    });
    assert.deepEqual(graph.data, {
      b: {
        scalars: { bar },
        references: {},
      },
    });
  });

  it('will write complex scalars', () => {
    const graph = createMockGraphPrimitives();
    const scalars = {
      a: true,
      b: null,
      c: 2,
      d: 'Hello, world!',
      e: [1, 2, 3, 4],
      f: { a: 1, b: 2, c: 3 },
      g: [[1, [2, 3]], [[{ a: 1, b: 2, c: { d: 3, e: 4 } }]]],
    };
    writeToGraph({
      graph,
      id: 'foo',
      data: scalars,
      selectionSet: parseSelectionSet(`{ a b c d e f g }`),
    });
    assert.deepEqual(graph.data, {
      foo: {
        scalars,
        references: {},
      },
    });
  });

  it('will write nested object scalars', () => {
    const graph = createMockGraphPrimitives();
    writeToGraph({
      graph,
      id: 'root',
      data: { foo: { a: 1, b1: { c: 2 }, b2: { c: -2, d: { e: -3 } } } },
      selectionSet: parseSelectionSet(`{ foo { a b1: b { c } b2: b(arg: YES) { c d { e } } } }`),
    });
    assert.deepEqual(graph.data, {
      root: {
        scalars: {},
        references: { foo: 'root.foo' },
      },
      'root.foo': {
        scalars: { a: 1 },
        references: {
          b: 'root.foo.b',
          'b({"arg":"YES"})': 'root.foo.b({"arg":"YES"})',
        },
      },
      'root.foo.b': {
        scalars: { c: 2 },
        references: {},
      },
      'root.foo.b({"arg":"YES"})': {
        scalars: { c: -2 },
        references: {
          d: 'root.foo.b({"arg":"YES"}).d',
        },
      },
      'root.foo.b({"arg":"YES"}).d': {
        scalars: { e: -3 },
        references: {},
      },
    });
    writeToGraph({
      graph,
      id: 'root',
      data: { bar: { d: 3, e: { alias: 4 } } },
      selectionSet: parseSelectionSet(`{ bar { d(var: $var) e { alias: f } } }`),
      variables: { var: true },
    });
    assert.deepEqual(graph.data, {
      root: {
        scalars: {},
        references: {
          foo: 'root.foo',
          bar: 'root.bar',
        },
      },
      'root.foo': {
        scalars: { a: 1 },
        references: {
          b: 'root.foo.b',
          'b({"arg":"YES"})': 'root.foo.b({"arg":"YES"})',
        },
      },
      'root.foo.b': {
        scalars: { c: 2 },
        references: {},
      },
      'root.foo.b({"arg":"YES"})': {
        scalars: { c: -2 },
        references: {
          d: 'root.foo.b({"arg":"YES"}).d',
        },
      },
      'root.foo.b({"arg":"YES"}).d': {
        scalars: { e: -3 },
        references: {},
      },
      'root.bar': {
        scalars: { 'd({"var":true})': 3 },
        references: { e: 'root.bar.e' },
      },
      'root.bar.e': {
        scalars: { f: 4 },
        references: {},
      },
    });
    writeToGraph({
      graph,
      id: 'root',
      data: { foo: { baz: { g: 5, h: { i: 6 } }, alias: { j: 7, k: 8 } } },
      selectionSet: parseSelectionSet(`{ foo { baz { g h { i } } alias: b { j k } } }`),
    });
    assert.deepEqual(graph.data, {
      root: {
        scalars: {},
        references: {
          foo: 'root.foo',
          bar: 'root.bar',
        },
      },
      'root.foo': {
        scalars: { a: 1 },
        references: {
          b: 'root.foo.b',
          'b({"arg":"YES"})': 'root.foo.b({"arg":"YES"})',
          baz: 'root.foo.baz',
        },
      },
      'root.foo.b': {
        scalars: {
          c: 2,
          j: 7,
          k: 8,
        },
        references: {},
      },
      'root.foo.b({"arg":"YES"})': {
        scalars: { c: -2 },
        references: {
          d: 'root.foo.b({"arg":"YES"}).d',
        },
      },
      'root.foo.b({"arg":"YES"}).d': {
        scalars: { e: -3 },
        references: {},
      },
      'root.bar': {
        scalars: { 'd({"var":true})': 3 },
        references: { e: 'root.bar.e' },
      },
      'root.bar.e': {
        scalars: { f: 4 },
        references: {},
      },
      'root.foo.baz': {
        scalars: { g: 5 },
        references: { h: 'root.foo.baz.h' },
      },
      'root.foo.baz.h': {
        scalars: { i: 6 },
        references: {},
      },
    });
  });

  it('will add typenames to the path of nested objects if available', () => {
    const graph = createMockGraphPrimitives();
    writeToGraph({
      graph,
      id: 'root',
      data: {
        foo: {
          __typename: 'Type1',
          a: 1,
          b1: { __typename: 'Type2', c: 2 },
          b2: { __typename: 'Type3', c: -2, d: { e: -3 } },
        },
      },
      selectionSet: parseSelectionSet(`{
        foo {
          a
          b1: b { c }
          b2: b(arg: YES) { c d { e } }
        }
      }`),
    });
    assert.deepEqual(graph.data, {
      root: {
        scalars: {},
        references: { foo: 'root.foo:Type1' },
      },
      'root.foo:Type1': {
        scalars: { a: 1 },
        references: {
          b: 'root.foo:Type1.b:Type2',
          'b({"arg":"YES"})': 'root.foo:Type1.b({"arg":"YES"}):Type3',
        },
      },
      'root.foo:Type1.b:Type2': {
        scalars: { c: 2 },
        references: {},
      },
      'root.foo:Type1.b({"arg":"YES"}):Type3': {
        scalars: { c: -2 },
        references: {
          d: 'root.foo:Type1.b({"arg":"YES"}):Type3.d',
        },
      },
      'root.foo:Type1.b({"arg":"YES"}):Type3.d': {
        scalars: { e: -3 },
        references: {},
      },
    });
    writeToGraph({
      graph,
      id: 'root',
      data: {
        bar: {
          __typename: 'Type4',
          d: 3,
          e: {
            __typename: 'Type5',
            alias: 4,
          },
        },
      },
      selectionSet: parseSelectionSet(`{ bar { d(var: $var) e { alias: f } } }`),
      variables: { var: true },
    });
    assert.deepEqual(graph.data, {
      root: {
        scalars: {},
        references: {
          foo: 'root.foo:Type1',
          bar: 'root.bar:Type4',
        },
      },
      'root.foo:Type1': {
        scalars: { a: 1 },
        references: {
          b: 'root.foo:Type1.b:Type2',
          'b({"arg":"YES"})': 'root.foo:Type1.b({"arg":"YES"}):Type3',
        },
      },
      'root.foo:Type1.b:Type2': {
        scalars: { c: 2 },
        references: {},
      },
      'root.foo:Type1.b({"arg":"YES"}):Type3': {
        scalars: { c: -2 },
        references: {
          d: 'root.foo:Type1.b({"arg":"YES"}):Type3.d',
        },
      },
      'root.foo:Type1.b({"arg":"YES"}):Type3.d': {
        scalars: { e: -3 },
        references: {},
      },
      'root.bar:Type4': {
        scalars: { 'd({"var":true})': 3 },
        references: { e: 'root.bar:Type4.e:Type5' },
      },
      'root.bar:Type4.e:Type5': {
        scalars: { f: 4 },
        references: {},
      },
    });
    writeToGraph({
      graph,
      id: 'root',
      data: {
        foo: {
          __typename: 'Type6',
          baz: {
            __typename: 'Type7',
            g: 5,
            h: { __typename: 'Type8', i: 6 },
          },
          alias: {
            __typename: 'Type9',
            j: 7,
            k: 8,
          },
        },
      },
      selectionSet: parseSelectionSet(`{ foo { baz { g h { i } } alias: b { j k } } }`),
    });
    assert.deepEqual(graph.data, {
      root: {
        scalars: {},
        references: {
          foo: 'root.foo:Type6',
          bar: 'root.bar:Type4',
        },
      },
      'root.foo:Type1': {
        scalars: { a: 1 },
        references: {
          b: 'root.foo:Type1.b:Type2',
          'b({"arg":"YES"})': 'root.foo:Type1.b({"arg":"YES"}):Type3',
        },
      },
      'root.foo:Type1.b:Type2': {
        scalars: { c: 2 },
        references: {},
      },
      'root.foo:Type1.b({"arg":"YES"}):Type3': {
        scalars: { c: -2 },
        references: {
          d: 'root.foo:Type1.b({"arg":"YES"}):Type3.d',
        },
      },
      'root.foo:Type1.b({"arg":"YES"}):Type3.d': {
        scalars: { e: -3 },
        references: {},
      },
      'root.bar:Type4': {
        scalars: { 'd({"var":true})': 3 },
        references: { e: 'root.bar:Type4.e:Type5' },
      },
      'root.bar:Type4.e:Type5': {
        scalars: { f: 4 },
        references: {},
      },
      'root.foo:Type6': {
        scalars: {},
        references: {
          b: 'root.foo:Type6.b:Type9',
          baz: 'root.foo:Type6.baz:Type7',
        },
      },
      'root.foo:Type6.b:Type9': {
        scalars: { j: 7, k: 8 },
        references: {},
      },
      'root.foo:Type6.baz:Type7': {
        scalars: { g: 5 },
        references: { h: 'root.foo:Type6.baz:Type7.h:Type8' },
      },
      'root.foo:Type6.baz:Type7.h:Type8': {
        scalars: { i: 6 },
        references: {},
      },
    });
  });

  it('will set a reference to null if the value is null', () => {
    const graph = createMockGraphPrimitives();
    writeToGraph({
      graph,
      id: 'foo',
      data: {
        bar: null,
        buz1: null,
        buz2: null,
      },
      selectionSet: parseSelectionSet(`{
        bar { a b c { d } }
        buz1: buz { a b c { d } }
        buz2: buz(a: 1, b: 2, c: 3) { a b c { d } }
      }`),
    });
    assert.deepEqual(graph.data, {
      foo: {
        scalars: {},
        references: {
          bar: null,
          buz: null,
          'buz({"a":1,"b":2,"c":3})': null,
        },
      },
    });
  });

  it('will use a data id for the node id if available', () => {
    const graph = createMockGraphPrimitives();
    writeToGraph({
      graph,
      id: 'root',
      data: {
        foo: { [TEST_ID_KEY]: '1', a: 1, b: 2, c: 3 },
        bar: { [TEST_ID_KEY]: '2', x: 3, y: 2, z: 1 },
      },
      selectionSet: parseSelectionSet(`{
        foo { a b c }
        bar { x y z }
      }`),
      getDataID,
    });
    assert.deepEqual(graph.data, {
      root: {
        scalars: {},
        references: {
          foo: '(1)',
          bar: '(2)',
        },
      },
      '(1)': {
        scalars: { a: 1, b: 2, c: 3 },
        references: {},
      },
      '(2)': {
        scalars: { x: 3, y: 2, z: 1 },
        references: {},
      },
    });
    writeToGraph({
      graph,
      id: 'root',
      data: {
        far: {
          far: {
            away: {
              [TEST_ID_KEY]: '1',
              b: 4,
              c: 5,
              d: 6,
              e: {
                f: {
                  [TEST_ID_KEY]: '2',
                  y: 7,
                  z: 8,
                  a: 9,
                },
              },
            },
          },
        },
      },
      selectionSet: parseSelectionSet(`{
        far {
          far {
            away {
              b
              c
              d
              e {
                f {
                  y
                  z
                  a
                }
              }
            }
          }
        }
      }`),
      getDataID,
    });
    assert.deepEqual(graph.data, {
      root: {
        scalars: {},
        references: {
          foo: '(1)',
          bar: '(2)',
          far: 'root.far',
        },
      },
      '(1)': {
        scalars: { a: 1, b: 4, c: 5, d: 6 },
        references: { e: '(1).e' },
      },
      '(1).e': {
        scalars: {},
        references: { f: '(2)' },
      },
      '(2)': {
        scalars: { x: 3, y: 7, z: 8, a: 9 },
        references: {},
      },
      'root.far': {
        scalars: {},
        references: { far: 'root.far.far' },
      },
      'root.far.far': {
        scalars: {},
        references: { away: '(1)' },
      },
    });
  });

  it('will use a data id for the node id but not a typename', () => {
    const graph = createMockGraphPrimitives();
    writeToGraph({
      graph,
      id: 'root',
      data: {
        foo: { [TEST_ID_KEY]: '1', __typename: 'Type1', a: 1, b: 2, c: 3 },
        bar: { [TEST_ID_KEY]: '2', __typename: 'Type2', x: 3, y: 2, z: 1 },
      },
      selectionSet: parseSelectionSet(`{
        foo { a b c }
        bar { x y z }
      }`),
      getDataID,
    });
    assert.deepEqual(graph.data, {
      root: {
        scalars: {},
        references: {
          foo: '(1)',
          bar: '(2)',
        },
      },
      '(1)': {
        scalars: { a: 1, b: 2, c: 3 },
        references: {},
      },
      '(2)': {
        scalars: { x: 3, y: 2, z: 1 },
        references: {},
      },
    });
    writeToGraph({
      graph,
      id: 'root',
      data: {
        far: {
          __typename: 'Type3',
          far: {
            __typename: 'Type4',
            away: {
              [TEST_ID_KEY]: '1',
              __typename: 'Type5',
              b: 4,
              c: 5,
              d: 6,
              e: {
                __typename: 'Type6',
                f: {
                  [TEST_ID_KEY]: '2',
                  __typename: 'Type7',
                  y: 7,
                  z: 8,
                  a: 9,
                },
              },
            },
          },
        },
      },
      selectionSet: parseSelectionSet(`{
        far {
          far {
            away {
              b
              c
              d
              e {
                f {
                  y
                  z
                  a
                }
              }
            }
          }
        }
      }`),
      getDataID,
    });
    assert.deepEqual(graph.data, {
      root: {
        scalars: {},
        references: {
          foo: '(1)',
          bar: '(2)',
          far: 'root.far:Type3',
        },
      },
      '(1)': {
        scalars: { a: 1, b: 4, c: 5, d: 6 },
        references: { e: '(1).e:Type6' },
      },
      '(1).e:Type6': {
        scalars: {},
        references: { f: '(2)' },
      },
      '(2)': {
        scalars: { x: 3, y: 7, z: 8, a: 9 },
        references: {},
      },
      'root.far:Type3': {
        scalars: {},
        references: { far: 'root.far:Type3.far:Type4' },
      },
      'root.far:Type3.far:Type4': {
        scalars: {},
        references: { away: '(1)' },
      },
    });
  });

  it('will only write data with a node id if null was provided for the root id', () => {
    const graph = createMockGraphPrimitives();
    writeToGraph({
      graph,
      id: null,
      data: {
        foo: { [TEST_ID_KEY]: '1', a: 1, b: 2, c: 3 },
        bar: { [TEST_ID_KEY]: '2', x: 3, y: 2, z: 1 },
      },
      selectionSet: parseSelectionSet(`{
        foo { a b c }
        bar { x y z }
      }`),
      getDataID,
    });
    assert.deepEqual(graph.data, {
      '(1)': {
        scalars: { a: 1, b: 2, c: 3 },
        references: {},
      },
      '(2)': {
        scalars: { x: 3, y: 2, z: 1 },
        references: {},
      },
    });
    writeToGraph({
      graph,
      id: null,
      data: {
        far: {
          far: {
            away: {
              [TEST_ID_KEY]: '1',
              b: 4,
              c: 5,
              d: 6,
              e: {
                f: {
                  [TEST_ID_KEY]: '2',
                  y: 7,
                  z: 8,
                  a: 9,
                },
              },
            },
          },
        },
      },
      selectionSet: parseSelectionSet(`{
        far {
          far {
            away {
              b
              c
              d
              e {
                f {
                  y
                  z
                  a
                }
              }
            }
          }
        }
      }`),
      getDataID,
    });
    assert.deepEqual(graph.data, {
      '(1)': {
        scalars: { a: 1, b: 4, c: 5, d: 6 },
        references: { e: '(1).e' },
      },
      '(1).e': {
        scalars: {},
        references: { f: '(2)' },
      },
      '(2)': {
        scalars: { x: 3, y: 7, z: 8, a: 9 },
        references: {},
      },
    });
  });

  it('will return the object written to the store with ID_KEYs', () => {
    const graph = createMockGraphPrimitives();
    const { data: data1 } = writeToGraph({
      graph,
      id: 'root',
      data: {
        foo: { [TEST_ID_KEY]: '1', __typename: 'Type1', a: 1, b: 2, c: 3, extra: true },
        bar: { [TEST_ID_KEY]: '2', __typename: 'Type2', x: 3, y: 2, z: 1, extra: { yay: '!' } },
      },
      selectionSet: parseSelectionSet(`{
        foo { __typename a b c }
        bar { x y z }
      }`),
      getDataID,
    });
    assert.deepEqual(data1, {
      foo: {
        __typename: 'Type1',
        a: 1,
        b: 2,
        c: 3,
      },
      bar: {
        x: 3,
        y: 2,
        z: 1,
      },
    });
    assert.equal((data1 as any)[ID_KEY], 'root');
    assert.equal((data1 as any).foo[ID_KEY], '(1)');
    assert.equal((data1 as any).bar[ID_KEY], '(2)');
    const { data: data2 } = writeToGraph({
      graph,
      id: 'root',
      data: {
        unused: true,
        far: {
          unused: false,
          __typename: 'Type3',
          far: {
            __typename: 'Type4',
            away: {
              [TEST_ID_KEY]: '1',
              __typename: 'Type5',
              b: 4,
              c: 5,
              d: 6,
              e: {
                __typename: 'Type6',
                f: {
                  [TEST_ID_KEY]: '2',
                  __typename: 'Type7',
                  y: 7,
                  z: 8,
                  a: 9,
                },
              },
            },
          },
        },
      },
      selectionSet: parseSelectionSet(`{
        far {
          far {
            __typename
            away {
              __typename
              b
              c
              d
              e {
                f {
                  y
                  z
                  a
                }
              }
            }
          }
        }
      }`),
      getDataID,
    });
    assert.deepEqual(data2, {
      far: {
        far: {
          __typename: 'Type4',
          away: {
            __typename: 'Type5',
            b: 4,
            c: 5,
            d: 6,
            e: {
              f: {
                y: 7,
                z: 8,
                a: 9,
              },
            },
          },
        },
      },
    });
    assert.equal((data2 as any)[ID_KEY], 'root');
    assert.equal((data2 as any).far[ID_KEY], 'root.far:Type3');
    assert.equal((data2 as any).far.far[ID_KEY], 'root.far:Type3.far:Type4');
    assert.equal((data2 as any).far.far.away[ID_KEY], '(1)');
    assert.equal((data2 as any).far.far.away.e[ID_KEY], '(1).e:Type6');
    assert.equal((data2 as any).far.far.away.e.f[ID_KEY], '(2)');
  });

  it('will throw an error if there are missing values', () => {
    try {
      writeToGraph({
        graph: createMockGraphPrimitives(),
        id: 'root',
        data: { a: 1, b: 2 },
        selectionSet: parseSelectionSet(`{ a b c }`),
      });
      throw new Error('This should have failed.');
    } catch (error) {
      assert.equal(error._partialWrite, true);
      assert.equal(error.message, 'No data found for field \'c\'.');
    }
    try {
      writeToGraph({
        graph: createMockGraphPrimitives(),
        id: 'root',
        data: { a: 1, b: 2, c: { d: 3, e: 4 } },
        selectionSet: parseSelectionSet(`{ a b c { d e f } }`),
      });
      throw new Error('This should have failed.');
    } catch (error) {
      assert.equal(error._partialWrite, true);
      assert.equal(error.message, 'No data found for field \'f\'.');
    }
  });

  it('will not throw an error if there are missing values in a fragment', () => {
    writeToGraph({
      graph: createMockGraphPrimitives(),
      id: 'root',
      data: { a: 1, b: 2 },
      selectionSet: parseSelectionSet(`{ a b ... { c d { e } } }`),
    });
    writeToGraph({
      graph: createMockGraphPrimitives(),
      id: 'root',
      data: { a: 1, b: 2 },
      selectionSet: parseSelectionSet(`{ a b ... on Foo { c d { e } } }`),
    });
    writeToGraph({
      graph: createMockGraphPrimitives(),
      id: 'root',
      data: { a: 1, b: 2 },
      selectionSet: parseSelectionSet(`{ a b ...foo }`),
      fragments: parseFragmentDefinitionMap(`fragment foo on Foo { c d { e } }`),
    });
    writeToGraph({
      graph: createMockGraphPrimitives(),
      id: 'root',
      data: { a: 1, b: 2, c: { d: 3, e: 4 } },
      selectionSet: parseSelectionSet(`{ a b c { d e ... { f g { h } } } }`),
    });
    writeToGraph({
      graph: createMockGraphPrimitives(),
      id: 'root',
      data: { a: 1, b: 2, c: { d: 3, e: 4 } },
      selectionSet: parseSelectionSet(`{ a b c { d e ... on Bar { f g { h } } } }`),
    });
    writeToGraph({
      graph: createMockGraphPrimitives(),
      id: 'root',
      data: { a: 1, b: 2, c: { d: 3, e: 4 } },
      selectionSet: parseSelectionSet(`{ a b c { d e ...bar } }`),
      fragments: parseFragmentDefinitionMap(`fragment bar on Bar { f g { h } }`),
    });
  });

  it('will write fields in fragments to the store', () => {
    const graph = createMockGraphPrimitives();
    const data = {
      a: 1, b: 2, c: 3,
      d: 4, e: 5, f: 6,
      g: 7, h: 8, i: 9,
      j: 10, k: 11, l: 12,
      m: 13, n: 14, o: 15,
      p: 16, q: 17, r: 18,
      s: 19, t: 20, u: 21,
      nested1: {
        p: 16.1, q: 17.1, r: 18.1,
        s: 19.1, t: 20.1, u: 21.1,
        nested2: {
          s: 19.2, t: 20.2, u: 21.2,
        },
      },
    };
    writeToGraph({
      graph,
      id: 'root',
      data,
      selectionSet: parseSelectionSet(`{
        a b c
        ... { d e f ... { g h i } }
        ... on Foo { j k l ... on Bar { m n o } }
        ...foo
        ...bar
        nested1 {
          ...foo
          nested2 {
            ...bar
          }
        }
      }`),
      fragments: parseFragmentDefinitionMap(`
        fragment foo on Foo {
          p q r
          ...bar
        }

        fragment bar on Bar {
          s t u
        }
      `),
    });
    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          a: 1, b: 2, c: 3,
          d: 4, e: 5, f: 6,
          g: 7, h: 8, i: 9,
          j: 10, k: 11, l: 12,
          m: 13, n: 14, o: 15,
          p: 16, q: 17, r: 18,
          s: 19, t: 20, u: 21,
        },
        references: {
          nested1: 'root.nested1',
        },
      },
      'root.nested1': {
        scalars: {
          p: 16.1, q: 17.1, r: 18.1,
          s: 19.1, t: 20.1, u: 21.1,
        },
        references: {
          nested2: 'root.nested1.nested2',
        },
      },
      'root.nested1.nested2': {
        scalars: { s: 19.2, t: 20.2, u: 21.2 },
        references: {},
      },
    });
  });

  it('will error when referencing a fragment that does not exist', () => {
    assert.throws(() => {
      writeToGraph({
        graph: createMockGraphPrimitives(),
        id: 'root',
        data: {},
        selectionSet: parseSelectionSet(`{ ...doesNotExist }`),
      });
    });
    assert.throws(() => {
      writeToGraph({
        graph: createMockGraphPrimitives(),
        id: 'root',
        data: {},
        selectionSet: parseSelectionSet(`{ ...doesNotExist }`),
        fragments: parseFragmentDefinitionMap(`fragment foo on Foo { a b c }`),
      });
    });
  });

  it('will error when referencing a variable that does not exist', () => {
    assert.throws(() => {
      writeToGraph({
        graph: createMockGraphPrimitives(),
        id: 'root',
        data: {},
        selectionSet: parseSelectionSet(`{ field(variable: $doesNotExist) }`),
      });
    });
    assert.throws(() => {
      writeToGraph({
        graph: createMockGraphPrimitives(),
        id: 'root',
        data: {},
        selectionSet: parseSelectionSet(`{ field(variable: $doesNotExist) }`),
        variables: { foo: { a: 1, b: 2, c: 3 } },
      });
    });
  });

  it('will write nested array references', () => {
    const graph = createMockGraphPrimitives();
    writeToGraph({
      graph,
      id: 'root',
      data: {
        foo: [
          { a: 1.1, b: 2.1, c: 3.1 },
          { a: 1.2, b: 2.2, c: 3.2 },
          { a: 1.3, b: 2.3, c: 3.3 },
        ],
        bar: [
          [
            { d: 4.1, e: 5.1, f: 6.1 },
          ],
          [
            [
              { d: 4.2, e: 5.2, f: 6.2 },
              { d: 4.3, e: 5.3, f: 6.3 },
            ],
            [
              { d: 4.4, e: 5.4, f: 6.4 },
            ],
          ],
          [
            { d: 4.5, e: 5.5, f: 6.5 },
            { d: 4.6, e: 5.6, f: 6.6 },
          ],
        ],
      },
      selectionSet: parseSelectionSet(`{
        foo { a b c }
        bar { d e f }
      }`),
    });
    assert.deepEqual(graph.data, {
      root: {
        scalars: {},
        references: {
          foo: [
            'root.foo[0]',
            'root.foo[1]',
            'root.foo[2]',
          ],
          bar: [
            [
              'root.bar[0][0]',
            ],
            [
              [
                'root.bar[1][0][0]',
                'root.bar[1][0][1]',
              ],
              [
                'root.bar[1][1][0]',
              ],
            ],
            [
              'root.bar[2][0]',
              'root.bar[2][1]',
            ],
          ],
        },
      },
      'root.foo[0]': {
        scalars: { a: 1.1, b: 2.1, c: 3.1 },
        references: {},
      },
      'root.foo[1]': {
        scalars: { a: 1.2, b: 2.2, c: 3.2 },
        references: {},
      },
      'root.foo[2]': {
        scalars: { a: 1.3, b: 2.3, c: 3.3 },
        references: {},
      },
      'root.bar[0][0]': {
        scalars: { d: 4.1, e: 5.1, f: 6.1 },
        references: {},
      },
      'root.bar[1][0][0]': {
        scalars: { d: 4.2, e: 5.2, f: 6.2 },
        references: {},
      },
      'root.bar[1][0][1]': {
        scalars: { d: 4.3, e: 5.3, f: 6.3 },
        references: {},
      },
      'root.bar[1][1][0]': {
        scalars: { d: 4.4, e: 5.4, f: 6.4 },
        references: {},
      },
      'root.bar[2][0]': {
        scalars: { d: 4.5, e: 5.5, f: 6.5 },
        references: {},
      },
      'root.bar[2][1]': {
        scalars: { d: 4.6, e: 5.6, f: 6.6 },
        references: {},
      },
    });
  });

  it('will write nested array references where some items have ids', () => {
    const graph = createMockGraphPrimitives();
    writeToGraph({
      graph,
      id: 'root',
      data: {
        foo: [
          { a: 1.1, b: 2.1, c: 3.1, [TEST_ID_KEY]: '1' },
          { a: 1.2, b: 2.2, c: 3.2, [TEST_ID_KEY]: '2' },
          { a: 1.3, b: 2.3, c: 3.3 },
        ],
        bar: [
          [
            { d: 4.1, e: 5.1, f: 6.1 },
          ],
          [
            [
              { d: 4.2, e: 5.2, f: 6.2, [TEST_ID_KEY]: '3' },
              { d: 4.3, e: 5.3, f: 6.3 },
            ],
            [
              { d: 4.4, e: 5.4, f: 6.4, [TEST_ID_KEY]: '4' },
            ],
          ],
          [
            { d: 4.5, e: 5.5, f: 6.5 },
            { d: 4.6, e: 5.6, f: 6.6, [TEST_ID_KEY]: '5' },
          ],
        ],
      },
      selectionSet: parseSelectionSet(`{
        foo { a b c }
        bar { d e f }
      }`),
      getDataID,
    });
    assert.deepEqual(graph.data, {
      root: {
        scalars: {},
        references: {
          foo: [
            '(1)',
            '(2)',
            'root.foo[2]',
          ],
          bar: [
            [
              'root.bar[0][0]',
            ],
            [
              [
                '(3)',
                'root.bar[1][0][1]',
              ],
              [
                '(4)',
              ],
            ],
            [
              'root.bar[2][0]',
              '(5)',
            ],
          ],
        },
      },
      '(1)': {
        scalars: { a: 1.1, b: 2.1, c: 3.1 },
        references: {},
      },
      '(2)': {
        scalars: { a: 1.2, b: 2.2, c: 3.2 },
        references: {},
      },
      'root.foo[2]': {
        scalars: { a: 1.3, b: 2.3, c: 3.3 },
        references: {},
      },
      'root.bar[0][0]': {
        scalars: { d: 4.1, e: 5.1, f: 6.1 },
        references: {},
      },
      '(3)': {
        scalars: { d: 4.2, e: 5.2, f: 6.2 },
        references: {},
      },
      'root.bar[1][0][1]': {
        scalars: { d: 4.3, e: 5.3, f: 6.3 },
        references: {},
      },
      '(4)': {
        scalars: { d: 4.4, e: 5.4, f: 6.4 },
        references: {},
      },
      'root.bar[2][0]': {
        scalars: { d: 4.5, e: 5.5, f: 6.5 },
        references: {},
      },
      '(5)': {
        scalars: { d: 4.6, e: 5.6, f: 6.6 },
        references: {},
      },
    });
  });

  it('will write nested array references where some items have type names', () => {
    const graph = createMockGraphPrimitives();
    writeToGraph({
      graph,
      id: 'root',
      data: {
        foo: [
          { a: 1.1, b: 2.1, c: 3.1, __typename: 'Type1' },
          { a: 1.2, b: 2.2, c: 3.2, __typename: 'Type2' },
          { a: 1.3, b: 2.3, c: 3.3 },
        ],
        bar: [
          [
            { d: 4.1, e: 5.1, f: 6.1 },
          ],
          [
            [
              { d: 4.2, e: 5.2, f: 6.2, __typename: 'Type3' },
              { d: 4.3, e: 5.3, f: 6.3 },
            ],
            [
              { d: 4.4, e: 5.4, f: 6.4, __typename: 'Type4' },
            ],
          ],
          [
            { d: 4.5, e: 5.5, f: 6.5 },
            { d: 4.6, e: 5.6, f: 6.6, __typename: 'Type5' },
          ],
        ],
      },
      selectionSet: parseSelectionSet(`{
        foo { a b c }
        bar { d e f }
      }`),
      getDataID,
    });
    assert.deepEqual(graph.data, {
      root: {
        scalars: {},
        references: {
          foo: [
            'root.foo[0]:Type1',
            'root.foo[1]:Type2',
            'root.foo[2]',
          ],
          bar: [
            [
              'root.bar[0][0]',
            ],
            [
              [
                'root.bar[1][0][0]:Type3',
                'root.bar[1][0][1]',
              ],
              [
                'root.bar[1][1][0]:Type4',
              ],
            ],
            [
              'root.bar[2][0]',
              'root.bar[2][1]:Type5',
            ],
          ],
        },
      },
      'root.foo[0]:Type1': {
        scalars: { a: 1.1, b: 2.1, c: 3.1 },
        references: {},
      },
      'root.foo[1]:Type2': {
        scalars: { a: 1.2, b: 2.2, c: 3.2 },
        references: {},
      },
      'root.foo[2]': {
        scalars: { a: 1.3, b: 2.3, c: 3.3 },
        references: {},
      },
      'root.bar[0][0]': {
        scalars: { d: 4.1, e: 5.1, f: 6.1 },
        references: {},
      },
      'root.bar[1][0][0]:Type3': {
        scalars: { d: 4.2, e: 5.2, f: 6.2 },
        references: {},
      },
      'root.bar[1][0][1]': {
        scalars: { d: 4.3, e: 5.3, f: 6.3 },
        references: {},
      },
      'root.bar[1][1][0]:Type4': {
        scalars: { d: 4.4, e: 5.4, f: 6.4 },
        references: {},
      },
      'root.bar[2][0]': {
        scalars: { d: 4.5, e: 5.5, f: 6.5 },
        references: {},
      },
      'root.bar[2][1]:Type5': {
        scalars: { d: 4.6, e: 5.6, f: 6.6 },
        references: {},
      },
    });
  });

  it('will write data from merged selections', () => {
    const graph = createMockGraphPrimitives();
    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{
        array {
          a
          b
          object { d }
          object { e }
        }
        array {
          c
          object { f }
        }
      }`),
      data: {
        array: [
          { a: 1.1, b: 2.1, c: 3.1, object: { d: 4.1, e: 5.1, f: 6.1 } },
          { a: 1.2, b: 2.2, c: 3.2, object: { d: 4.2, e: 5.2, f: 6.2 } },
          { a: 1.3, b: 2.3, c: 3.3, object: { d: 4.3, e: 5.3, f: 6.3 } },
        ],
      },
    });
    assert.deepEqual(graph.data, {
      root: {
        scalars: {},
        references: {
          array: [
            'root.array[0]',
            'root.array[1]',
            'root.array[2]',
          ],
        },
      },
      'root.array[0]': {
        scalars: { a: 1.1, b: 2.1, c: 3.1 },
        references: { object: 'root.array[0].object' },
      },
      'root.array[0].object': {
        scalars: { d: 4.1, e: 5.1, f: 6.1 },
        references: {},
      },
      'root.array[1]': {
        scalars: { a: 1.2, b: 2.2, c: 3.2 },
        references: { object: 'root.array[1].object' },
      },
      'root.array[1].object': {
        scalars: { d: 4.2, e: 5.2, f: 6.2 },
        references: {},
      },
      'root.array[2]': {
        scalars: { a: 1.3, b: 2.3, c: 3.3 },
        references: { object: 'root.array[2].object' },
      },
      'root.array[2].object': {
        scalars: { d: 4.3, e: 5.3, f: 6.3 },
        references: {},
      },
    });
  });

  it('will write data from merged selections and return the written data', () => {
    const graph = createMockGraphPrimitives();
    assert.deepEqual(writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{
        array {
          a
          b
          object { d }
          object { e }
        }
        array {
          c
          object { f }
        }
      }`),
      data: {
        array: [
          { a: 1.1, b: 2.1, c: 3.1, object: { d: 4.1, e: 5.1, f: 6.1 } },
          { a: 1.2, b: 2.2, c: 3.2, object: { d: 4.2, e: 5.2, f: 6.2 } },
          { a: 1.3, b: 2.3, c: 3.3, object: { d: 4.3, e: 5.3, f: 6.3 } },
        ],
      },
    }), {
      data: {
        array: [
          { a: 1.1, b: 2.1, c: 3.1, object: { d: 4.1, e: 5.1, f: 6.1 } },
          { a: 1.2, b: 2.2, c: 3.2, object: { d: 4.2, e: 5.2, f: 6.2 } },
          { a: 1.3, b: 2.3, c: 3.3, object: { d: 4.3, e: 5.3, f: 6.3 } },
        ],
      },
    });
  });

  it('properly normalizes a trivial item', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          id,
          stringField,
          numberField,
          nullField
        }
      `),
      data: {
        id: 'abcd',
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {},
      },
    });
  });

  it('properly normalizes an aliased field', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          id,
          aliasedField: stringField,
          numberField,
          nullField
        }
      `),
      data: {
        id: 'abcd',
        aliasedField: 'This is a string!',
        numberField: 5,
        nullField: null,
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {},
      },
    });
  });

  it('properly normalizes a aliased fields with arguments', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          id,
          aliasedField1: stringField(arg: 1),
          aliasedField2: stringField(arg: 2),
          numberField,
          nullField
        }
      `),
      data: {
        id: 'abcd',
        aliasedField1: 'The arg was 1!',
        aliasedField2: 'The arg was 2!',
        numberField: 5,
        nullField: null,
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          'stringField({"arg":1})': 'The arg was 1!',
          'stringField({"arg":2})': 'The arg was 2!',
          numberField: 5,
          nullField: null,
        },
        references: {},
      },
    });
  });

  it('properly normalizes a query with variables', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      variables: {
        intArg: 5,
        floatArg: 3.14,
        stringArg: 'This is a string!',
      },
      selectionSet: parseSelectionSet(`
        {
          id,
          stringField(arg: $stringArg),
          numberField(intArg: $intArg, floatArg: $floatArg),
          nullField
        }
      `),
      data: {
        id: 'abcd',
        stringField: 'Heyo',
        numberField: 5,
        nullField: null,
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          nullField: null,
          'numberField({"intArg":5,"floatArg":3.14})': 5,
          'stringField({"arg":"This is a string!"})': 'Heyo',
        },
        references: {},
      },
    });
  });

  it('properly normalizes a nested object with an ID', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
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
      `),
      data: {
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
      },
      getDataID: ({ id }: { id: string }) => id,
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {
          nestedObj: '(abcde)',
        },
      },
      '(abcde)': {
        scalars: {
          id: 'abcde',
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
        },
        references: {},
      },
    });
  });

  it('properly normalizes a nested object without an ID', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
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
      `),
      data: {
        id: 'abcd',
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
        nestedObj: {
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
        },
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {
          nestedObj: 'root.nestedObj',
        },
      },
      'root.nestedObj': {
        scalars: {
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
        },
        references: {},
      },
    });
  });

  it('properly normalizes a nested object with arguments but without an ID', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
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
      `),
      data: {
        id: 'abcd',
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
        nestedObj: {
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
        },
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {
          'nestedObj({"arg":"val"})': 'root.nestedObj({"arg":"val"})',
        },
      },
      'root.nestedObj({"arg":"val"})': {
        scalars: {
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
        },
        references: {},
      },
    });
  });

  it('properly normalizes a nested array with IDs', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
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
      `),
      data: {
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
      },
      getDataID: ({ id }: { id: string }) => id,
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {
          nestedArray: [
            '(abcde)',
            '(abcdef)',
          ],
        },
      },
      '(abcde)': {
        scalars: {
          id: 'abcde',
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
        },
        references: {},
      },
      '(abcdef)': {
        scalars: {
          id: 'abcdef',
          stringField: 'This is a string also!',
          numberField: 7,
          nullField: null,
        },
        references: {},
      },
    });
  });

  it('properly normalizes a nested array with IDs and a null', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
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
      `),
      data: {
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
      },
      getDataID: ({ id }: { id: string }) => id,
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {
          nestedArray: ['(abcde)', null],
        },
      },
      '(abcde)': {
        scalars: {
          id: 'abcde',
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
        },
        references: {},
      },
    });
  });

  it('properly normalizes a nested array without IDs', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
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
      `),
      data: {
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
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {
          nestedArray: [
            'root.nestedArray[0]',
            'root.nestedArray[1]',
          ],
        },
      },
      'root.nestedArray[0]': {
        scalars: {
          stringField: 'This is a string too!',
          numberField: 6,
          nullField: null,
        },
        references: {},
      },
      'root.nestedArray[1]': {
        scalars: {
          stringField: 'This is a string also!',
          numberField: 7,
          nullField: null,
        },
        references: {},
      },
    });
  });

  it('properly normalizes a nested array without IDs and a null item', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
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
      `),
      data: {
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
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {
          nestedArray: [
            null,
            'root.nestedArray[1]',
          ],
        },
      },
      'root.nestedArray[1]': {
        scalars: {
          stringField: 'This is a string also!',
          numberField: 7,
          nullField: null,
        },
        references: {},
      },
    });
  });

  it('properly normalizes an array of non-objects', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          id,
          stringField,
          numberField,
          nullField,
          simpleArray
        }
      `),
      data: {
        id: 'abcd',
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
        simpleArray: ['one', 'two', 'three'],
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
          simpleArray: ['one', 'two', 'three'],
        },
        references: {},
      },
    });
  });

  it('properly normalizes an array of non-objects with null', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          id,
          stringField,
          numberField,
          nullField,
          simpleArray
        }
      `),
      data: {
        id: 'abcd',
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
        simpleArray: [null, 'two', 'three'],
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
          simpleArray: [null, 'two', 'three'],
        },
        references: {},
      },
    });
  });

  it('merges nodes', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          id,
          numberField,
          nullField
        }
      `),
      data: {
        id: 'abcd',
        numberField: 5,
        nullField: null,
      },
    });

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          id,
          stringField,
          nullField
        }
      `),
      data: {
        id: 'abcd',
        stringField: 'This is a string!',
        nullField: null,
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          numberField: 5,
          stringField: 'This is a string!',
          nullField: null,
        },
        references: {},
      },
    });
  });

  it('properly normalizes a nested object that returns null', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
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
      `),
      data: {
        id: 'abcd',
        stringField: 'This is a string!',
        numberField: 5,
        nullField: null,
        nestedObj: null,
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
          numberField: 5,
          nullField: null,
        },
        references: {
          nestedObj: null,
        },
      },
    });
  });

  it('properly normalizes an object with an ID when no extension is passed', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          people_one(id: "5") {
            id
            stringField
          }
        }
      `),
      data: {
        people_one: {
          id: 'abcd',
          stringField: 'This is a string!',
        },
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {},
        references: {
          'people_one({"id":"5"})': 'root.people_one({"id":"5"})',
        },
      },
      'root.people_one({"id":"5"})': {
        scalars: {
          id: 'abcd',
          stringField: 'This is a string!',
        },
        references: {},
      },
    });
  });

  it('consistently serialize different types of input when passed inlined or as variable', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{
        mut1: mut(inline: 5, variable: $in1) { id }
        mut2: mut(inline: 5.5, variable: $in2) { id }
        mut3: mut(inline: "abc", variable: $in3) { id }
        mut4: mut(inline: [1, 2], variable: $in4) { id }
        mut5: mut(inline: { a: 1 }, variable: $in5) { id }
        mut6: mut(inline: true, variable: $in6) { id }
      }`),
      variables: {
        in1: 5,
        in2: 5.5,
        in3: 'abc',
        in4: [1, 2],
        in5: { a: 1 },
        in6: true,
      },
      data: {
        mut1: null,
        mut2: null,
        mut3: null,
        mut4: null,
        mut5: null,
        mut6: null,
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {},
        references: {
          'mut({"inline":5,"variable":5})': null,
          'mut({"inline":5.5,"variable":5.5})': null,
          'mut({"inline":"abc","variable":"abc"})': null,
          'mut({"inline":[1,2],"variable":[1,2]})': null,
          'mut({"inline":{"a":1},"variable":{"a":1}})': null,
          'mut({"inline":true,"variable":true})': null,
        },
      },
    });
  });

  it('properly normalizes an operation with object or array parameters and variables', () => {
    const graph = createMockGraphPrimitives();

    writeToGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`
        {
          some_mutation(
            input: {
              id: "5",
              arr: [1,{a:"b"}],
              obj: {a:"b"},
              num: 5.5,
              nil: $nil,
              bo: true
            },
          ) {
            id,
          }
          some_mutation_with_variables(
            input: $in,
          ) {
            id,
          }
        }
      `),
      variables: {
        nil: null,
        in: {
          id: '5',
          arr: [1, { a: 'b' }],
          obj: { a: 'b' },
          num: 5.5,
          nil: null,
          bo: true,
        },
      },
      data: {
        some_mutation: {
          id: 'id',
        },
        some_mutation_with_variables: {
          id: 'id',
        },
      },
    });

    assert.deepEqual(graph.data, {
      root: {
        scalars: {},
        references: {
          'some_mutation({"input":{"id":"5","arr":[1,{"a":"b"}],"obj":{"a":"b"},"num":5.5,"nil":null,"bo":true}})':
            'root.some_mutation({"input":{"id":"5","arr":[1,{"a":"b"}],"obj":{"a":"b"},"num":5.5,"nil":null,"bo":true}})',
          'some_mutation_with_variables({"input":{"id":"5","arr":[1,{"a":"b"}],"obj":{"a":"b"},"num":5.5,"nil":null,"bo":true}})':
            'root.some_mutation_with_variables({"input":{"id":"5","arr":[1,{"a":"b"}],"obj":{"a":"b"},"num":5.5,"nil":null,"bo":true}})',
        },
      },
      'root.some_mutation({"input":{"id":"5","arr":[1,{"a":"b"}],"obj":{"a":"b"},"num":5.5,"nil":null,"bo":true}})': {
        scalars: { id: 'id' },
        references: {},
      },
      'root.some_mutation_with_variables({"input":{"id":"5","arr":[1,{"a":"b"}],"obj":{"a":"b"},"num":5.5,"nil":null,"bo":true}})': {
        scalars: { id: 'id' },
        references: {},
      },
    });
  });

  describe('type escaping', () => {
    it('should correctly escape generated ids', () => {
      const graph = createMockGraphPrimitives();

      writeToGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{
          author {
            firstName
            lastName
          }
        }`),
        data: {
          author: {
            firstName: 'John',
            lastName: 'Smith',
          },
        },
      });

      assert.deepEqual(graph.data, {
        root: {
          scalars: {},
          references: {
            author: 'root.author',
          },
        },
        'root.author': {
          scalars: {
            firstName: 'John',
            lastName: 'Smith',
          },
          references: {},
        },
      });
    });

    it('should correctly escape real ids', () => {
      const graph = createMockGraphPrimitives();

      writeToGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{
          author {
            firstName
            id
            __typename
          }
        }`),
        data: {
          author: {
            firstName: 'John',
            id: '129',
            __typename: 'Author',
          },
        },
        getDataID: (object: any) => {
          if (object.__typename && object.id) {
            return object.__typename + '__' + object.id;
          }
          return undefined;
        },
      });

      assert.deepEqual(graph.data, {
        root: {
          scalars: {},
          references: {
            author: '(Author__129)',
          },
        },
        '(Author__129)': {
          scalars: {
            firstName: 'John',
            id: '129',
            __typename: 'Author',
          },
          references: {},
        },
      });
    });

    it('should correctly escape json blobs', () => {
      const graph = createMockGraphPrimitives();

      writeToGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{
          author {
            info
            id
            __typename
          }
        }`),
        data: {
          author: {
            info: {
              name: 'John',
            },
            id: '129',
            __typename: 'Author',
          },
        },
        getDataID: (object: any) => {
          if (object.__typename && object.id) {
            return object.__typename + '__' + object.id;
          }
          return undefined;
        },
      });

      assert.deepEqual(graph.data, {
        root: {
          scalars: {},
          references: {
            author: '(Author__129)',
          },
        },
        '(Author__129)': {
          scalars: {
            info: {
              name: 'John',
            },
            id: '129',
            __typename: 'Author',
          },
          references: {},
        },
      });
    });
  });

  it('does not swallow errors other than field errors', () => {
    assert.throws(() => {
      writeToGraph({
        graph: createMockGraphPrimitives(),
        id: 'root',
        selectionSet: parseSelectionSet(`{
          ...notARealFragment
          fortuneCookie
        }`),
        data: {
          fortuneCookie: 'Star Wars unit tests are boring',
        },
      });
    }, 'Could not find fragment named \'notARealFragment\'.');
  });
});
