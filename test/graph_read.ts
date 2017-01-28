import { assert } from 'chai';
import { parse, SelectionSetNode, FragmentDefinitionNode } from 'graphql/language';
import { GraphData } from '../src/graph/types';
import { ID_KEY } from '../src/graph/common';
import { readFromGraph } from '../src/graph/read';

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

describe('readFromGraph', () => {
  it('will perform basic scalar reads', () => {
    const foo: any = Symbol();
    const bar: any = Symbol();
    const buz: any = Symbol();
    const graph: GraphData = {
      a: {
        scalars: { foo, buz },
        references: {},
      },
      b: {
        scalars: { bar },
        references: {},
      },
    };
    assert.deepEqual(readFromGraph({
      graph,
      id: 'a',
      selectionSet: parseSelectionSet(`{ foo buz }`),
    }), {
      stale: false,
      data: { foo, buz },
    });
    assert.deepEqual(readFromGraph({
      graph,
      id: 'b',
      selectionSet: parseSelectionSet(`{ bar }`),
    }), {
      stale: false,
      data: { bar },
    });
  });

  it('will perform basic scalar reads with aliases', () => {
    const foo: any = Symbol();
    const bar: any = Symbol();
    const buz: any = Symbol();
    const graph: GraphData = {
      a: {
        scalars: { foo, buz },
        references: {},
      },
      b: {
        scalars: { bar },
        references: {},
      },
    };
    assert.deepEqual(readFromGraph({
      graph,
      id: 'a',
      selectionSet: parseSelectionSet(`{ x: foo y: buz }`),
    }), {
      stale: false,
      data: { x: foo, y: buz },
    });
    assert.deepEqual(readFromGraph({
      graph,
      id: 'b',
      selectionSet: parseSelectionSet(`{ z: bar }`),
    }), {
      stale: false,
      data: { z: bar },
    });
  });

  it('will perform basic scalar reads with arguments', () => {
    const foo: any = Symbol();
    const bar: any = Symbol();
    const buz: any = Symbol();
    const graph: GraphData = {
      a: {
        scalars: {
          'foo({"a":1,"b":2,"c":3})': foo,
          'buz({"array":[1,2,3],"enum":"YES","null":null,"string":"yolo"})': buz,
        },
        references: {},
      },
      b: {
        scalars: {
          'bar({"var":{"x":"a","y":"b","z":"c"}})': bar,
        },
        references: {},
      },
    };
    assert.deepEqual(readFromGraph({
      graph,
      id: 'a',
      selectionSet: parseSelectionSet(`{
        foo(a: 1, b: 2, c: 3)
        alias: buz(array: [1, 2, 3], enum: YES, null: null, string: "yolo")
      }`),
    }), {
      stale: false,
      data: { foo, alias: buz },
    });
    assert.deepEqual(readFromGraph({
      graph,
      id: 'b',
      selectionSet: parseSelectionSet(`{
        bar(var: $var)
      }`),
      variables: {
        var: { x: 'a', y: 'b', z: 'c' },
      },
    }), {
      stale: false,
      data: { bar },
    });
  });

  it('will read complex scalars', () => {
    const scalars = {
      a: true,
      b: null,
      c: 2,
      d: 'Hello, world!',
      e: [1, 2, 3, 4],
      f: { a: 1, b: 2, c: 3 },
      g: [[1, [2, 3]], [[{ a: 1, b: 2, c: { d: 3, e: 4 } }]]],
    };
    const graph: GraphData = {
      foo: {
        scalars,
        references: {},
      },
    };
    const result = readFromGraph({
      graph,
      id: 'foo',
      selectionSet: parseSelectionSet(`{ a b c d e f g }`),
    });
    assert.deepEqual(result, {
      stale: false,
      data: scalars,
    });
    assert.notStrictEqual(result.data, scalars);
  });

  it('will read nested object scalars', () => {
    const graph: GraphData = {
      root: {
        scalars: {},
        references: {
          foo: 'ref1',
          bar: 'ref7',
        },
      },
      'ref1': {
        scalars: { a: 1 },
        references: {
          b: 'ref2',
          'b({"arg":"YES"})': 'ref3',
          baz: 'ref5',
        },
      },
      'ref2': {
        scalars: {
          c: 2,
          j: 7,
          k: 8,
        },
        references: {},
      },
      'ref3': {
        scalars: { c: -2 },
        references: {
          d: 'ref4',
        },
      },
      'ref4': {
        scalars: { e: -3 },
        references: {},
      },
      'ref5': {
        scalars: { g: 5 },
        references: { h: 'ref6' },
      },
      'ref6': {
        scalars: { i: 6 },
        references: {},
      },
      'ref7': {
        scalars: { 'd({"var":true})': 3 },
        references: { e: 'ref8' },
      },
      'ref8': {
        scalars: { f: 4 },
        references: {},
      },
    };
    assert.deepEqual(readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{
        foo {
          a
          b1: b { c }
          b2: b(arg: YES) {
            c
            d { e }
          }
          baz {
            g
            h { i }
          }
          alias: b { j k }
        }
        bar {
          d(var: $var)
          e { alias: f }
        }
      }`),
      variables: { var: true },
    }), {
      stale: false,
      data: {
        foo: {
          a: 1,
          b1: { c: 2 },
          b2: {
            c: -2,
            d: { e: -3 },
          },
          baz: {
            g: 5,
            h: { i: 6 },
          },
          alias: {
            j: 7,
            k: 8,
          },
        },
        bar: {
          d: 3,
          e: { alias: 4 },
        },
      },
    });
  });

  it('will read a null value from a null reference', () => {
    const graph: GraphData = {
      foo: {
        scalars: {},
        references: {
          bar: null,
          buz: null,
          'buz({"a":1,"b":2,"c":3})': null,
        },
      },
    };
    assert.deepEqual(readFromGraph({
      graph,
      id: 'foo',
      selectionSet: parseSelectionSet(`{
        bar { a b c { d } }
        buz1: buz { a b c { d } }
        buz2: buz(a: 1, b: 2, c: 3) { a b c { d } }
      }`),
    }), {
      stale: false,
      data: {
        bar: null,
        buz1: null,
        buz2: null,
      },
    });
  });

  it('will throw a partial read error if there are missing values', () => {
    try {
      readFromGraph({
        graph: {
          root: {
            scalars: { a: 1, b: 2 },
            references: {},
          },
        },
        id: 'root',
        selectionSet: parseSelectionSet(`{ a b c }`),
      });
      throw new Error('This should have failed.');
    } catch (error) {
      assert.equal(error._partialRead, true);
      assert.equal(error.message, 'No scalar value found for field \'c\'.');
    }
    try {
      readFromGraph({
        graph: {
          root: {
            scalars: { a: 1, b: 2 },
            references: { c: 'root.c' },
          },
          'root.c': {
            scalars: { d: 3, e: 4 },
            references: {},
          },
        },
        id: 'root',
        selectionSet: parseSelectionSet(`{ a b c { d e f } }`),
      });
      throw new Error('This should have failed.');
    } catch (error) {
      assert.equal(error._partialRead, true);
      assert.equal(error.message, 'No scalar value found for field \'f\'.');
    }
    try {
      readFromGraph({
        graph: {
          root: {
            scalars: { a: 1 },
            references: {},
          },
        },
        id: 'root',
        selectionSet: parseSelectionSet(`{ a { b } }`),
      });
      throw new Error('This should have failed.');
    } catch (error) {
      assert.equal(error._partialRead, true);
      assert.equal(error.message, 'No graph reference found for field \'a\'.');
    }
    try {
      readFromGraph({
        graph: {
          root: {
            scalars: {},
            references: { a: 'root.a' },
          },
          'root.a': {
            scalars: { b: 1 },
            references: {},
          },
        },
        id: 'root',
        selectionSet: parseSelectionSet(`{ a { b { c } } }`),
      });
      throw new Error('This should have failed.');
    } catch (error) {
      assert.equal(error._partialRead, true);
      assert.equal(error.message, 'No graph reference found for field \'b\'.');
    }
  });

  it('will not throw an error if there are missing values in a fragment', () => {
    const graph: GraphData = {
      root: {
        scalars: { a: 1, b: 2 },
        references: { c: 'root.c' },
      },
      'root.c': {
        scalars: { d: 3, e: 4 },
        references: {},
      },
    };
    readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{ a b ... { c d { e } } }`),
    });
    readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{ a b ... on Foo { c d { e } } }`),
    });
    readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{ a b ...foo }`),
      fragments: parseFragmentDefinitionMap(`fragment foo on Foo { c d { e } }`),
    });
    readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{ a b c { d e ... { f g { h } } } }`),
    });
    readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{ a b c { d e ... on Bar { f g { h } } } }`),
    });
    readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{ a b c { d e ...bar } }`),
      fragments: parseFragmentDefinitionMap(`fragment bar on Bar { f g { h } }`),
    });
  });

  it('will read fields in fragments', () => {
    const graph: GraphData = {
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
    };
    assert.deepEqual(readFromGraph({
      graph,
      id: 'root',
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
    }), {
      stale: false,
      data: {
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
      },
    });
  });

  it('will error when referencing a fragment that does not exist', () => {
    const graph = {
      root: {
        scalars: {},
        references: {},
      },
    };
    assert.throws(() => {
      readFromGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{ ...doesNotExist }`),
      });
    });
    assert.throws(() => {
      readFromGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{ ...doesNotExist }`),
        fragments: parseFragmentDefinitionMap(`fragment foo on Foo { a b c }`),
      });
    });
  });

  it('will error when referencing a variable that does not exist', () => {
    const graph = {
      root: {
        scalars: {},
        references: {},
      },
    };
    assert.throws(() => {
      readFromGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{ field(variable: $doesNotExist) }`),
      });
    });
    assert.throws(() => {
      readFromGraph({
        graph,
        id: 'root',
        selectionSet: parseSelectionSet(`{ field(variable: $doesNotExist) }`),
        variables: { foo: { a: 1, b: 2, c: 3 } },
      });
    });
  });

  it('will read nested array references', () => {
    assert.deepEqual(readFromGraph({
      graph: {
        root: {
          scalars: {},
          references: {
            foo: [
              'ref1',
              'ref2',
              'ref3',
            ],
            bar: [
              [
                'ref4',
              ],
              [
                [
                  'ref5',
                  'ref6',
                ],
                [
                  'ref7',
                ],
              ],
              [
                'ref8',
                'ref9',
              ],
            ],
          },
        },
        'ref1': {
          scalars: { a: 1.1, b: 2.1, c: 3.1 },
          references: {},
        },
        'ref2': {
          scalars: { a: 1.2, b: 2.2, c: 3.2 },
          references: {},
        },
        'ref3': {
          scalars: { a: 1.3, b: 2.3, c: 3.3 },
          references: {},
        },
        'ref4': {
          scalars: { d: 4.1, e: 5.1, f: 6.1 },
          references: {},
        },
        'ref5': {
          scalars: { d: 4.2, e: 5.2, f: 6.2 },
          references: {},
        },
        'ref6': {
          scalars: { d: 4.3, e: 5.3, f: 6.3 },
          references: {},
        },
        'ref7': {
          scalars: { d: 4.4, e: 5.4, f: 6.4 },
          references: {},
        },
        'ref8': {
          scalars: { d: 4.5, e: 5.5, f: 6.5 },
          references: {},
        },
        'ref9': {
          scalars: { d: 4.6, e: 5.6, f: 6.6 },
          references: {},
        },
      },
      id: 'root',
      selectionSet: parseSelectionSet(`{
        foo { a b c }
        bar { d e f }
      }`),
    }), {
      stale: false,
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
    });
  });

  it('will throw a partial read error when a node is missing', () => {
    try {
      readFromGraph({
        graph: {},
        id: 'foo',
        selectionSet: parseSelectionSet(`{ a b c }`),
      });
      throw new Error('This should have failed.');
    } catch (error) {
      assert.equal(error._partialRead, true);
      assert.equal(error.message, 'No store item for id \'foo\'.');
    }
  });

  it('will return the previous data if scalars are the same', () => {
    const scalars1 = {
      a: true,
      b: null,
      c: 2,
      d: 'Hello, world!',
      e: [1, 2, 3, 4],
      f: { a: 1, b: 2, c: 3 },
      g: [[1, [2, 3]], [[{ a: 1, b: 2, c: { d: 3, e: 4 } }]]],
    };
    const scalars2 = {
      a: true,
      b: null,
      c: 2,
      d: 'Hello, world!',
      e: [1, 2, 3, 4],
      f: { a: 1, b: 2, c: 3 },
      g: [[1, [2, 3]], [[{ a: 1, b: 2, c: { d: 3, e: 4 } }]]],
    };
    const graph: GraphData = {
      foo: {
        scalars: scalars1,
        references: {},
      },
    };
    const result1 = readFromGraph({
      graph,
      id: 'foo',
      selectionSet: parseSelectionSet(`{ a b c d e f g }`),
      previousData: scalars1,
    });
    assert.deepEqual(result1, { stale: false, data: scalars1 });
    assert.strictEqual(result1.data, scalars1);
    assert.notStrictEqual(result1.data, scalars2);
    const result2 = readFromGraph({
      graph,
      id: 'foo',
      selectionSet: parseSelectionSet(`{ a b c d e f g }`),
      previousData: scalars2,
    });
    assert.deepEqual(result2, { stale: false, data: scalars1 });
    assert.notStrictEqual(result2.data, scalars1);
    assert.strictEqual(result2.data, scalars2);
  });

  it('will return the previous data if scalars are the same even if there is an extra field', () => {
    const scalars1 = {
      a: true,
      b: null,
      c: 2,
      d: 'Hello, world!',
      e: [1, 2, 3, 4],
      f: { a: 1, b: 2, c: 3 },
      g: [[1, [2, 3]], [[{ a: 1, b: 2, c: { d: 3, e: 4 } }]]],
    };
    const scalars2 = {
      a: true,
      b: null,
      c: 2,
      d: 'Hello, world!',
      e: [1, 2, 3, 4],
      f: { a: 1, b: 2, c: 3 },
      g: [[1, [2, 3]], [[{ a: 1, b: 2, c: { d: 3, e: 4 } }]]],
      extraField: 'yes',
    };
    const graph: GraphData = {
      foo: {
        scalars: scalars1,
        references: {},
      },
    };
    const result = readFromGraph({
      graph,
      id: 'foo',
      selectionSet: parseSelectionSet(`{ a b c d e f g }`),
      previousData: scalars2,
    });
    assert.deepEqual(result, { stale: false, data: { ...scalars1, extraField: 'yes' } });
    assert.notStrictEqual(result.data, scalars1);
    assert.strictEqual(result.data, scalars2);
  });

  it('will return referentially equal nested object data', () => {
    const previousData = {
      a: { b: 1, c: 2 },
      d: { e: -3, f: { g: 4, h: 5 } },
    };
    const graph: GraphData = {
      root: {
        scalars: {},
        references: { a: 'ref1', d: 'ref2' },
      },
      ref1: {
        scalars: { b: 1, c: 2 },
        references: {},
      },
      ref2: {
        scalars: { e: 3 },
        references: { f: 'ref3' },
      },
      ref3: {
        scalars: { g: 4, h: 5 },
        references: {},
      },
    };
    const result = readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{ a { b c } d { e f { g h } } }`),
      previousData,
    });
    assert.deepEqual(result, {
      stale: false,
      data: {
        a: { b: 1, c: 2 },
        d: { e: 3, f: { g: 4, h: 5 } },
      },
    });
    assert.notStrictEqual(result.data, previousData);
    assert.strictEqual((result.data as any).a, previousData.a);
    assert.notStrictEqual((result.data as any).d, previousData.d);
    assert.strictEqual((result.data as any).d.f, previousData.d.f);
  });

  it('will preserve referential equality with arrays', () => {
    const graph: GraphData = {
      root: {
        scalars: {},
        references: {
          foo: [
            'ref1',
            'ref2',
            'ref3',
          ],
          bar: [
            [
              'ref4',
            ],
            [
              [
                'ref5',
                'ref6',
              ],
              [
                'ref7',
              ],
            ],
            [
              'ref8',
              'ref9',
            ],
          ],
        },
      },
      ref1: {
        scalars: { a: 1.1, b: 2.1, c: 3.1 },
        references: {},
      },
      ref2: {
        scalars: { a: 1.2, b: 2.2, c: 3.2 },
        references: {},
      },
      ref3: {
        scalars: { a: 1.3, b: 2.3, c: 3.3 },
        references: {},
      },
      ref4: {
        scalars: { d: 4.1, e: 5.1, f: 6.1 },
        references: {},
      },
      ref5: {
        scalars: { d: 4.2, e: 5.2, f: 6.2 },
        references: {},
      },
      ref6: {
        scalars: { d: 4.3, e: 5.3, f: 6.3 },
        references: {},
      },
      ref7: {
        scalars: { d: 4.4, e: 5.4, f: 6.4 },
        references: {},
      },
      ref8: {
        scalars: { d: 4.5, e: 5.5, f: 6.5 },
        references: {},
      },
      ref9: {
        scalars: { d: 4.6, e: 5.6, f: 6.6 },
        references: {},
      },
    };
    const previousData: any = {
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
    };
    const result = readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{
        foo { a b c }
        bar { d e f }
      }`),
      previousData,
    });
    assert.deepEqual(result, {
      stale: false,
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
    });
    assert.strictEqual(result.data, previousData);
  });

  it('will preserve referential equality with out of order nested array items with `ID_KEY`s', () => {
    const graph: GraphData = {
      root: {
        scalars: {},
        references: {
          foo: [
            'ref1',
            'ref2',
            'ref3',
          ],
          bar: [
            [
              'ref4',
            ],
            [
              [
                'ref5',
                'ref6',
              ],
              [
                'ref7',
              ],
            ],
            [
              'ref8',
              'ref9',
            ],
          ],
        },
      },
      ref1: {
        scalars: { a: 1.1, b: 2.1, c: 3.1 },
        references: {},
      },
      ref2: {
        scalars: { a: 1.2, b: 2.2, c: 3.2 },
        references: {},
      },
      ref3: {
        scalars: { a: 1.3, b: 2.3, c: 3.3 },
        references: {},
      },
      ref4: {
        scalars: { d: 4.1, e: 5.1, f: 6.1 },
        references: {},
      },
      ref5: {
        scalars: { d: 4.2, e: 5.2, f: 6.2 },
        references: {},
      },
      ref6: {
        scalars: { d: 4.3, e: 5.3, f: 6.3 },
        references: {},
      },
      ref7: {
        scalars: { d: 4.4, e: 5.4, f: 6.4 },
        references: {},
      },
      ref8: {
        scalars: { d: 4.5, e: 5.5, f: 6.5 },
        references: {},
      },
      ref9: {
        scalars: { d: 4.6, e: 5.6, f: 6.6 },
        references: {},
      },
    };
    const previousData: any = {
      foo: [
        { a: 1.2, b: 2.2, c: 3.2, [ID_KEY]: 'ref2' },
        { a: 1.1, b: 2.1, c: 3.1, [ID_KEY]: 'ref1' },
        { a: 1.3, b: 2.3, c: 3.3, [ID_KEY]: 'ref3' },
      ],
      bar: [
        [],
        [
          [
            { d: 4.3, e: 5.3, f: 6.3, [ID_KEY]: 'ref6' },
          ],
          [
            { d: 4.2, e: 5.2, f: 6.2, [ID_KEY]: 'ref5' },
            { d: 4.1, e: 5.1, f: 6.1, [ID_KEY]: 'ref4' },
            { d: 4.4, e: 5.4, f: 6.4, [ID_KEY]: 'ref7' },
          ],
        ],
        [
          { d: 4.5, e: 5.5, f: 6.5, [ID_KEY]: 'ref8' },
          { d: 4.6, e: 5.6, f: 6.6, [ID_KEY]: 'ref9' },
        ],
      ],
    };
    const result = readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{
        foo { a b c }
        bar { d e f }
      }`),
      previousData,
    });
    assert.deepEqual(result, {
      stale: false,
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
    });
    const data: any = result.data;
    assert.notStrictEqual(data, previousData);
    assert.notStrictEqual(data.foo, previousData.foo);
    assert.strictEqual(data.foo[0], previousData.foo[1]);
    assert.strictEqual(data.foo[1], previousData.foo[0]);
    assert.strictEqual(data.foo[2], previousData.foo[2]);
    assert.notStrictEqual(data.bar, previousData.bar);
    assert.notStrictEqual(data.bar[0], previousData.bar[0]);
    assert.notStrictEqual(data.bar[0][0], previousData.bar[1][1][1]);
    assert.notStrictEqual(data.bar[1], previousData.bar[1]);
    assert.notStrictEqual(data.bar[1][0], previousData.bar[1][0]);
    assert.notStrictEqual(data.bar[1][0][0], previousData.bar[1][1][0]);
    assert.strictEqual(data.bar[1][0][1], previousData.bar[1][0][0]);
    assert.strictEqual(data.bar[1][1][0], previousData.bar[1][1][2]);
    assert.strictEqual(data.bar[2], previousData.bar[2]);
  });

  it('will add `ID_KEY`s to results', () => {
    const graph: GraphData = {
      root: {
        scalars: {},
        references: {
          foo: 'ref1',
          bar: 'ref7',
        },
      },
      ref1: {
        scalars: { a: 1 },
        references: {
          b: 'ref2',
          'b({"arg":"YES"})': 'ref3',
          baz: 'ref5',
        },
      },
      ref2: {
        scalars: {
          c: 2,
          j: 7,
          k: 8,
        },
        references: {},
      },
      ref3: {
        scalars: { c: -2 },
        references: {
          d: 'ref4',
        },
      },
      ref4: {
        scalars: { e: -3 },
        references: {},
      },
      ref5: {
        scalars: { g: 5 },
        references: { h: 'ref6' },
      },
      ref6: {
        scalars: { i: 6 },
        references: {},
      },
      ref7: {
        scalars: { 'd({"var":true})': 3 },
        references: { e: 'ref8' },
      },
      ref8: {
        scalars: { f: 4 },
        references: {},
      },
    };
    const data: any = readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{
        foo {
          a
          b1: b { c }
          b2: b(arg: YES) {
            c
            d { e }
          }
          baz {
            g
            h { i }
          }
          alias: b { j k }
        }
        bar {
          d(var: $var)
          e { alias: f }
        }
      }`),
      variables: { var: true },
    }).data;
    assert.equal(data[ID_KEY], 'root');
    assert.equal(data.foo[ID_KEY], 'ref1');
    assert.equal(data.foo.b1[ID_KEY], 'ref2');
    assert.equal(data.foo.b2[ID_KEY], 'ref3');
    assert.equal(data.foo.b2.d[ID_KEY], 'ref4');
    assert.equal(data.foo.baz[ID_KEY], 'ref5');
    assert.equal(data.foo.baz.h[ID_KEY], 'ref6');
    assert.equal(data.foo.alias[ID_KEY], 'ref2');
    assert.equal(data.bar[ID_KEY], 'ref7');
    assert.equal(data.bar.e[ID_KEY], 'ref8');
  });

  it('will add `ID_KEY`s to result arrays', () => {
    const graph: GraphData = {
      root: {
        scalars: {},
        references: {
          foo: [
            'ref1',
            'ref2',
            'ref3',
          ],
          bar: [
            [
              'ref4',
            ],
            [
              [
                'ref5',
                'ref6',
              ],
              [
                'ref7',
              ],
            ],
            [
              'ref8',
              'ref9',
            ],
          ],
        },
      },
      ref1: {
        scalars: { a: 1.1, b: 2.1, c: 3.1 },
        references: {},
      },
      ref2: {
        scalars: { a: 1.2, b: 2.2, c: 3.2 },
        references: {},
      },
      ref3: {
        scalars: { a: 1.3, b: 2.3, c: 3.3 },
        references: {},
      },
      ref4: {
        scalars: { d: 4.1, e: 5.1, f: 6.1 },
        references: {},
      },
      ref5: {
        scalars: { d: 4.2, e: 5.2, f: 6.2 },
        references: {},
      },
      ref6: {
        scalars: { d: 4.3, e: 5.3, f: 6.3 },
        references: {},
      },
      ref7: {
        scalars: { d: 4.4, e: 5.4, f: 6.4 },
        references: {},
      },
      ref8: {
        scalars: { d: 4.5, e: 5.5, f: 6.5 },
        references: {},
      },
      ref9: {
        scalars: { d: 4.6, e: 5.6, f: 6.6 },
        references: {},
      },
    };
    const data: any = readFromGraph({
      graph,
      id: 'root',
      selectionSet: parseSelectionSet(`{
        foo { a b c }
        bar { d e f }
      }`),
    }).data;
    assert.equal(data[ID_KEY], 'root');
    assert.equal(data.foo[0][ID_KEY], 'ref1');
    assert.equal(data.foo[1][ID_KEY], 'ref2');
    assert.equal(data.foo[2][ID_KEY], 'ref3');
    assert.equal(data.bar[0][0][ID_KEY], 'ref4');
    assert.equal(data.bar[1][0][0][ID_KEY], 'ref5');
    assert.equal(data.bar[1][0][1][ID_KEY], 'ref6');
    assert.equal(data.bar[1][1][0][ID_KEY], 'ref7');
    assert.equal(data.bar[2][0][ID_KEY], 'ref8');
    assert.equal(data.bar[2][1][ID_KEY], 'ref9');
  });

  it('will prefer stale data over partial data', () => {
    assert.deepEqual(readFromGraph({
      graph: {
        root: {
          scalars: {},
          references: { foo: 'ref1' },
        },
        ref1: {
          scalars: { a: 1, b: 2 },
          references: {},
        },
        ref2: {
          scalars: { a: 3, b: 4, c: 5 },
          references: {},
        },
      },
      id: 'root',
      selectionSet: parseSelectionSet('{ foo { a b c } }'),
      previousData: {
        foo: { [ID_KEY]: 'ref2', a: 6, b: 7, c: 8 },
      },
    }), {
      stale: true,
      data: { foo: { a: 3, b: 4, c: 5 } },
    });
    assert.deepEqual(readFromGraph({
      graph: {
        root: {
          scalars: {},
          references: { foo: 'ref1' },
        },
        ref2: {
          scalars: { a: 3, b: 4, c: 5 },
          references: {},
        },
      },
      id: 'root',
      selectionSet: parseSelectionSet('{ foo { a b c } }'),
      previousData: {
        foo: { [ID_KEY]: 'ref2', a: 6, b: 7, c: 8 },
      },
    }), {
      stale: true,
      data: { foo: { a: 3, b: 4, c: 5 } },
    });
    assert.deepEqual(readFromGraph({
      graph: {
        root: {
          scalars: {},
          references: { foo: 'ref1' },
        },
        ref1: {
          scalars: { a: 1, b: 2 },
          references: {},
        },
        ref2: {
          scalars: { a: 3 },
          references: { b: 'ref3' },
        },
        ref3: {
          scalars: { c: 4 },
          references: {},
        },
      },
      id: 'root',
      selectionSet: parseSelectionSet('{ foo { a b { c } } }'),
      previousData: {
        foo: { [ID_KEY]: 'ref2', a: 5, b: { c: 6 } },
      },
    }), {
      stale: true,
      data: { foo: { a: 3, b: { c: 4 } } },
    });
  });

  it('will prefer stale data over partial data even when it is null', () => {
    assert.deepEqual(readFromGraph({
      graph: {
        root: {
          scalars: {},
          references: { foo: 'ref1' },
        },
        ref1: {
          scalars: { a: 1, b: 2 },
          references: {},
        },
      },
      id: 'root',
      selectionSet: parseSelectionSet('{ foo { a b c } }'),
      previousData: { foo: null },
    }), {
      stale: true,
      data: { foo: null },
    });
  });

  it('will prefer stale data over partial data for whole arrays', () => {
    assert.deepEqual(readFromGraph({
      graph: {
        root: {
          scalars: {},
          references: { foo: ['ref1', 'ref2'] },
        },
        ref1: {
          scalars: { a: 1, b: 2 },
          references: {},
        },
        ref2: {
          scalars: { a: 3, b: 4 },
          references: {},
        },
        ref3: {
          scalars: { a: 5, b: 6, c: 7 },
          references: {},
        },
        ref4: {
          scalars: { a: 8, b: 9, c: 10 },
          references: {},
        },
        ref5: {
          scalars: { a: 11, b: 12, c: 13 },
          references: {},
        },
      },
      id: 'root',
      selectionSet: parseSelectionSet('{ foo { a b c } }'),
      previousData: {
        foo: [
          { [ID_KEY]: 'ref3', a: 5, b: 6, c: 7 },
          { [ID_KEY]: 'ref4', a: 8, b: 9, c: 10 },
          { [ID_KEY]: 'ref5', a: 11, b: 12, c: 13 },
        ],
      },
    }), {
      stale: true,
      data: {
        foo: [
          { a: 5, b: 6, c: 7 },
          { a: 8, b: 9, c: 10 },
          { a: 11, b: 12, c: 13 },
        ],
      },
    });
  });

  it('will prefer stale data over partial data for whole arrays even when null', () => {
    assert.deepEqual(readFromGraph({
      graph: {
        root: {
          scalars: {},
          references: { foo: ['ref1', 'ref2'] },
        },
        ref1: {
          scalars: { a: 1, b: 2 },
          references: {},
        },
        ref2: {
          scalars: { a: 3, b: 4 },
          references: {},
        },
      },
      id: 'root',
      selectionSet: parseSelectionSet('{ foo { a b c } }'),
      previousData: {
        foo: null,
      },
    }), {
      stale: true,
      data: {
        foo: null,
      },
    });
  });

  it('will prefer stale data over partial data for single items in an array', () => {
    assert.deepEqual(readFromGraph({
      graph: {
        root: {
          scalars: {},
          references: { foo: ['ref1', 'ref2'] },
        },
        ref1: {
          scalars: { a: 1, b: 2 },
          references: {},
        },
        ref2: {
          scalars: { a: 3, b: 4, c: 5 },
          references: {},
        },
        ref3: {
          scalars: { a: 6, b: 7, c: 8 },
          references: {},
        },
      },
      id: 'root',
      selectionSet: parseSelectionSet('{ foo { a b c } }'),
      previousData: {
        foo: [
          { [ID_KEY]: 'ref3', a: 9, b: 10, c: 11 },
          { [ID_KEY]: 'ref2', a: 12, b: 13, c: 14 },
        ],
      },
    }), {
      stale: true,
      data: {
        foo: [
          { a: 6, b: 7, c: 8 },
          { a: 3, b: 4, c: 5 },
        ],
      },
    });
  });

  it('will prefer stale data over partial data for single items in array even when the item is null', () => {
    assert.deepEqual(readFromGraph({
      graph: {
        root: {
          scalars: {},
          references: { foo: ['ref1', 'ref2'] },
        },
        ref1: {
          scalars: { a: 1, b: 2 },
          references: {},
        },
        ref2: {
          scalars: { a: 3, b: 4, c: 5 },
          references: {},
        },
      },
      id: 'root',
      selectionSet: parseSelectionSet('{ foo { a b c } }'),
      previousData: {
        foo: [
          null,
          { [ID_KEY]: 'ref2', a: 12, b: 13, c: 14 },
        ],
      },
    }), {
      stale: true,
      data: {
        foo: [
          null,
          { a: 3, b: 4, c: 5 },
        ],
      },
    });
  });
});
