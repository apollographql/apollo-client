import { assert } from 'chai';
import { parse, SelectionSetNode, FragmentDefinitionNode } from 'graphql/language';
import { GraphData } from '../src/graph/types';
import { ID_KEY } from '../src/graph/common';
import { writeToGraph } from '../src/graph/write';

const TEST_ID_KEY = Symbol('testIdKey');
const getDataID = (object: any) => object[TEST_ID_KEY];

function parseSelectionSet (source: string): SelectionSetNode {
  const document = parse(source);
  if (document.definitions.length !== 1) {
    throw new Error('There should only be one definition.');
  }
  const definition = document.definitions[0];
  if (definition.kind !== 'OperationDefinition' || definition.operation !== 'query' || definition.name) {
    throw new Error('The single definition must be a nameless query operation definition.');
  }
  return definition.selectionSet;
}

function parseFragmentDefinitionMap (source: string): { [fragmentName: string]: FragmentDefinitionNode } {
  const document = parse(source);
  const fragments: { [fragmentName: string]: FragmentDefinitionNode } = {};

  document.definitions.forEach(definition => {
    if (definition.kind !== 'FragmentDefinition') {
      throw new Error('Only fragment definitions are allowed.');
    }
    fragments[definition.name.value] = definition;
  });

  return fragments;
}

describe('writeToGraph', () => {
  it('will perform basic scalar writes', () => {
    const graph: GraphData = {};
    const foo: any = Symbol();
    const bar: any = Symbol();
    const buz: any = Symbol();
    writeToGraph({
      graph,
      id: 'a',
      data: { foo },
      selectionSet: parseSelectionSet(`{ foo }`),
    });
    assert.deepEqual(graph, {
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
    assert.deepEqual(graph, {
      a: {
        scalars: { foo },
        references: {},
      },
      b: {
        scalars: { bar },
        references: {},
      },
    });
    const graphNodeA = graph['a'];
    const graphNodeB = graph['b'];
    writeToGraph({
      graph,
      id: 'a',
      data: { buz },
      selectionSet: parseSelectionSet(`{ buz }`),
    });
    assert.deepEqual(graph, {
      a: {
        scalars: { foo, buz },
        references: {},
      },
      b: {
        scalars: { bar },
        references: {},
      },
    });
    assert.strictEqual(graph['a'], graphNodeA);
    assert.strictEqual(graph['b'], graphNodeB);
  });

  it('will perform basic scalar writes with aliases', () => {
    const graph: GraphData = {};
    const foo: any = Symbol();
    const bar: any = Symbol();
    const buz: any = Symbol();
    writeToGraph({
      graph,
      id: 'a',
      data: { x: foo },
      selectionSet: parseSelectionSet(`{ x: foo }`),
    });
    assert.deepEqual(graph, {
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
    assert.deepEqual(graph, {
      a: {
        scalars: { foo },
        references: {},
      },
      b: {
        scalars: { bar },
        references: {},
      },
    });
    const graphNodeA = graph['a'];
    const graphNodeB = graph['b'];
    writeToGraph({
      graph,
      id: 'a',
      data: { z: buz },
      selectionSet: parseSelectionSet(`{ z: buz }`),
    });
    assert.deepEqual(graph, {
      a: {
        scalars: { foo, buz },
        references: {},
      },
      b: {
        scalars: { bar },
        references: {},
      },
    });
    assert.strictEqual(graph['a'], graphNodeA);
    assert.strictEqual(graph['b'], graphNodeB);
  });

  it('will perform basic scalar writes with arguments', () => {
    const graph: GraphData = {};
    const foo: any = Symbol();
    const bar: any = Symbol();
    const buz: any = Symbol();
    writeToGraph({
      graph,
      id: 'a',
      data: { foo },
      selectionSet: parseSelectionSet(`{ foo(a: 1, b: 2, c: 3) }`),
    });
    assert.deepEqual(graph, {
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
    assert.deepEqual(graph, {
      a: {
        scalars: { 'foo({"a":1,"b":2,"c":3})': foo },
        references: {},
      },
      b: {
        scalars: { 'bar({"var":{"x":"a","y":"b","z":"c"}})': bar },
        references: {},
      },
    });
    const graphNodeA = graph['a'];
    const graphNodeB = graph['b'];
    writeToGraph({
      graph,
      id: 'a',
      data: { alias: buz },
      selectionSet: parseSelectionSet(`{ alias: buz(array: [1, 2, 3], enum: YES, null: null, string: "yolo") }`),
    });
    assert.deepEqual(graph, {
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
    assert.strictEqual(graph['a'], graphNodeA);
    assert.strictEqual(graph['b'], graphNodeB);
  });

  it('will write nothing with a null id', () => {
    const graph: GraphData = {};
    const foo: any = Symbol();
    const bar: any = Symbol();
    const buz: any = Symbol();
    writeToGraph({
      graph,
      id: null,
      data: { foo },
      selectionSet: parseSelectionSet(`{ foo }`),
    });
    assert.deepEqual(graph, {});
    writeToGraph({
      graph,
      id: 'b',
      data: { bar },
      selectionSet: parseSelectionSet(`{ bar }`),
    });
    assert.deepEqual(graph, {
      b: {
        scalars: { bar },
        references: {},
      },
    });
    const graphNodeA = graph['a'];
    const graphNodeB = graph['b'];
    writeToGraph({
      graph,
      id: null,
      data: { buz },
      selectionSet: parseSelectionSet(`{ buz }`),
    });
    assert.deepEqual(graph, {
      b: {
        scalars: { bar },
        references: {},
      },
    });
    assert.strictEqual(graph['a'], graphNodeA);
    assert.strictEqual(graph['b'], graphNodeB);
  });

  it('will write complex scalars', () => {
    const graph: GraphData = {};
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
    assert.deepEqual(graph, {
      foo: {
        scalars,
        references: {},
      },
    });
    assert.notStrictEqual(graph['foo'].scalars, scalars);
  });

  it('will write nested object scalars', () => {
    const graph: GraphData = {};
    writeToGraph({
      graph,
      id: 'root',
      data: { foo: { a: 1, b1: { c: 2 }, b2: { c: -2, d: { e: -3 } } } },
      selectionSet: parseSelectionSet(`{ foo { a b1: b { c } b2: b(arg: YES) { c d { e } } } }`),
    });
    assert.deepEqual(graph, {
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
    assert.deepEqual(graph, {
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
    assert.deepEqual(graph, {
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
    const graph: GraphData = {};
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
    assert.deepEqual(graph, {
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
    assert.deepEqual(graph, {
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
    assert.deepEqual(graph, {
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
    const graph: GraphData = {};
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
    assert.deepEqual(graph, {
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
    const graph: GraphData = {};
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
    assert.deepEqual(graph, {
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
    assert.deepEqual(graph, {
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
    const graph: GraphData = {};
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
    assert.deepEqual(graph, {
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
    assert.deepEqual(graph, {
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
    const graph: GraphData = {};
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
    assert.deepEqual(graph, {
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
    assert.deepEqual(graph, {
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
    const graph: GraphData = {};
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
        graph: {},
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
        graph: {},
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
      graph: {},
      id: 'root',
      data: { a: 1, b: 2 },
      selectionSet: parseSelectionSet(`{ a b ... { c d { e } } }`),
    });
    writeToGraph({
      graph: {},
      id: 'root',
      data: { a: 1, b: 2 },
      selectionSet: parseSelectionSet(`{ a b ... on Foo { c d { e } } }`),
    });
    writeToGraph({
      graph: {},
      id: 'root',
      data: { a: 1, b: 2 },
      selectionSet: parseSelectionSet(`{ a b ...foo }`),
      fragments: parseFragmentDefinitionMap(`fragment foo on Foo { c d { e } }`),
    });
    writeToGraph({
      graph: {},
      id: 'root',
      data: { a: 1, b: 2, c: { d: 3, e: 4 } },
      selectionSet: parseSelectionSet(`{ a b c { d e ... { f g { h } } } }`),
    });
    writeToGraph({
      graph: {},
      id: 'root',
      data: { a: 1, b: 2, c: { d: 3, e: 4 } },
      selectionSet: parseSelectionSet(`{ a b c { d e ... on Bar { f g { h } } } }`),
    });
    writeToGraph({
      graph: {},
      id: 'root',
      data: { a: 1, b: 2, c: { d: 3, e: 4 } },
      selectionSet: parseSelectionSet(`{ a b c { d e ...bar } }`),
      fragments: parseFragmentDefinitionMap(`fragment bar on Bar { f g { h } }`),
    });
  });

  it('will write fields in fragments to the store', () => {
    const graph: GraphData = {};
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
    assert.deepEqual(graph, {
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
        graph: {},
        id: 'root',
        data: {},
        selectionSet: parseSelectionSet(`{ ...doesNotExist }`),
      });
    });
    assert.throws(() => {
      writeToGraph({
        graph: {},
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
        graph: {},
        id: 'root',
        data: {},
        selectionSet: parseSelectionSet(`{ field(variable: $doesNotExist) }`),
      });
    });
    assert.throws(() => {
      writeToGraph({
        graph: {},
        id: 'root',
        data: {},
        selectionSet: parseSelectionSet(`{ field(variable: $doesNotExist) }`),
        variables: { foo: { a: 1, b: 2, c: 3 } },
      });
    });
  });

  it('will write nested array references', () => {
    const graph: GraphData = {};
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
    assert.deepEqual(graph, {
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
    const graph: GraphData = {};
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
    assert.deepEqual(graph, {
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
    const graph: GraphData = {};
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
    assert.deepEqual(graph, {
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
});
