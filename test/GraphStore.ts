import { assert } from 'chai';
import { Store, createStore } from 'redux';
import { parse, SelectionSetNode, FragmentDefinitionNode } from 'graphql/language';
import { testObservable } from './util/testObservable';
import { deepFreeze } from '../src/util/maybeDeepFreeze';
import { ApolloAction } from '../src/actions';
import { GraphQLData, GraphQLObjectData } from '../src/graphql/types';
import { ReduxGraphStore, ReduxState } from '../src/graph/store';

const TEST_ID_KEY = Symbol('testIdKey');
const getDataID = (object: any) => object[TEST_ID_KEY];

/**
 * Creates an instance of `ReduxGraphStore` with a simple backing Redux store
 * instance.
 */
function createGraphStore (): ReduxGraphStore {
  let store: Store<ReduxState>;

  // Create the instance of our redux graph store using the actual Redux store
  // to provide the `dispatch` and `getState` functions.
  const graphStore: ReduxGraphStore = new ReduxGraphStore({
    reduxDispatch: action => store.dispatch(action),
    reduxGetState: () => store.getState(),
    getDataID,
  });

  // Create the redux store.
  store = createStore<ReduxState>(
    (state: ReduxState, action: ApolloAction): ReduxState => {
      // Redux our state using the reducer from the `graphStore` which we set
      // below. Deep freeze the result so that we can test that our Redux state
      // never gets mutated.
      return deepFreeze(graphStore.reduxReduce(state, action));
    },
    // Deep freeze the initial state.
    deepFreeze(ReduxGraphStore.initialState),
  );

  return graphStore;
}

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

describe.only('ReduxGraphStore', () => {
  describe('write then read', () => {
    function assertWriteThenRead ({
      selectionSet,
      fragments,
      variables,
      data,
    }: {
      selectionSet: SelectionSetNode,
      fragments?: { [fragmentName: string]: FragmentDefinitionNode },
      variables?: { [variableName: string]: GraphQLData },
      data: GraphQLObjectData,
    }) {
      const graphStore1 = createGraphStore();
      const graphStore2 = createGraphStore();

      // Test writing and reading normally.
      assert.deepEqual(graphStore1.write({
        data,
        selectionSet,
        fragments,
        variables,
      }), {
        data,
      });
      assert.deepEqual(graphStore1.read({
        selectionSet,
        fragments,
        variables,
      }), {
        stale: false,
        data,
      });

      // Test writing without committing.
      assert.deepEqual(graphStore2.writeWithoutCommit({
        data,
        selectionSet,
        fragments,
        variables,
      }).data, data);
      assert.deepEqual(graphStore2.read({
        selectionSet,
        fragments,
        variables,
      }), {
        stale: false,
        data,
      });
    }

    it('basic scalars', () => {
      const foo: any = Symbol();
      const bar: any = Symbol();
      const buz: any = Symbol();
      assertWriteThenRead({
        selectionSet: parseSelectionSet(`{ foo, bar, buz }`),
        data: { foo, bar, buz },
      });
    });

    it('basic scalars with aliases', () => {
      const graphStore = createGraphStore();
      const foo: any = Symbol();
      const bar: any = Symbol();
      const buz: any = Symbol();
      assertWriteThenRead({
        selectionSet: parseSelectionSet(`{ x: foo, y: bar, z: buz }`),
        data: { x: foo, y: bar, z: buz },
      });
    });

    it('basic scalars with arguments', () => {
      const foo: any = Symbol();
      const bar: any = Symbol();
      const buz: any = Symbol();
      assertWriteThenRead({
        selectionSet: parseSelectionSet(`{
          foo(a: 1, b: 2, c: 3)
          bar(var: $var)
          alias: buz(array: [1, 2, 3], enum: YES, null: null, string: "yolo")
        }`),
        variables: {
          var: { x: 'a', y: 'b', z: 'c' },
        },
        data: {
          foo,
          bar,
          alias: buz,
        },
      });
    });

    it('complex scalars', () => {
      assertWriteThenRead({
        selectionSet: parseSelectionSet(`{ a b c d e f g }`),
        data: {
          a: true,
          b: null,
          c: 2,
          d: 'Hello, world!',
          e: [1, 2, 3, 4],
          f: { a: 1, b: 2, c: 3 },
          g: [[1, [2, 3]], [[{ a: 1, b: 2, c: { d: 3, e: 4 } }]]],
        },
      });
    });

    it('nested objects', () => {
      assertWriteThenRead({
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

    it('null object', () => {
      assertWriteThenRead({
        selectionSet: parseSelectionSet(`{
          bar { a b c { d } }
          buz1: buz { a b c { d } }
          buz2: buz(a: 1, b: 2, c: 3) { a b c { d } }
        }`),
        data: {
          bar: null,
          buz1: null,
          buz2: null,
        },
      });
    });

    it('fragment data', () => {
      const foo: any = Symbol();
      const bar: any = Symbol();
      const buz: any = Symbol();
      assertWriteThenRead({
        selectionSet: parseSelectionSet(`{ foo ... { bar ... { buz } } }`),
        data: { foo, bar, buz },
      });
      assertWriteThenRead({
        selectionSet: parseSelectionSet(`{ foo ... on Bar { bar ... on Buz { buz } } }`),
        data: { foo, bar, buz },
      });
      assertWriteThenRead({
        selectionSet: parseSelectionSet(`{ foo ...bar }`),
        fragments: parseFragmentDefinitionMap(`fragment bar on Bar { bar ...buz } fragment buz on Buz { buz }`),
        data: { foo, bar, buz },
      });
      assertWriteThenRead({
        selectionSet: parseSelectionSet(`{ foo nested { ... { bar ... { buz } } } }`),
        data: { foo, nested: { bar, buz } },
      });
      assertWriteThenRead({
        selectionSet: parseSelectionSet(`{ foo nested { ... on Bar { bar ... on Buz { buz } } } }`),
        data: { foo, nested: { bar, buz } },
      });
      assertWriteThenRead({
        selectionSet: parseSelectionSet(`{ foo nested { ...bar } }`),
        fragments: parseFragmentDefinitionMap(`fragment bar on Bar { bar ...buz } fragment buz on Buz { buz }`),
        data: { foo, nested: { bar, buz } },
      });
    });

    it('missing fragment data', () => {
      const foo: any = Symbol();
      const bar: any = Symbol();
      const buz: any = Symbol();
      assertWriteThenRead({
        selectionSet: parseSelectionSet(`{ foo ... { bar ... { buz } } }`),
        data: { foo, bar },
      });
      assertWriteThenRead({
        selectionSet: parseSelectionSet(`{ foo ... on Bar { bar ... on Buz { buz } } }`),
        data: { foo },
      });
      assertWriteThenRead({
        selectionSet: parseSelectionSet(`{ foo ...bar }`),
        fragments: parseFragmentDefinitionMap(`fragment bar on Bar { bar ...buz } fragment buz on Buz { buz }`),
        data: { foo, bar },
      });
      assertWriteThenRead({
        selectionSet: parseSelectionSet(`{ foo nested { ... { bar ... { buz } } } }`),
        data: { foo, nested: { bar } },
      });
      assertWriteThenRead({
        selectionSet: parseSelectionSet(`{ foo nested { ... on Bar { bar ... on Buz { buz } } } }`),
        data: { foo, nested: {} },
      });
      assertWriteThenRead({
        selectionSet: parseSelectionSet(`{ foo nested { ...bar } }`),
        fragments: parseFragmentDefinitionMap(`fragment bar on Bar { bar ...buz } fragment buz on Buz { buz }`),
        data: { foo, nested: { bar } },
      });
    });

    it('nested array', () => {
      assertWriteThenRead({
        selectionSet: parseSelectionSet(`{
          foo { a b c }
          bar { d e f }
        }`),
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
                null,
              ],
              [
                { d: 4.4, e: 5.4, f: 6.4 },
              ],
            ],
            [
              null,
              null,
              { d: 4.5, e: 5.5, f: 6.5 },
              { d: 4.6, e: 5.6, f: 6.6 },
            ],
          ],
        },
      });
    });
  });

  it('will read data that has not been commit', () => {
    const graphStore = createGraphStore();

    graphStore.write({
      selectionSet: parseSelectionSet(`{ a b c d { e f { g h i } } }`),
      data: { a: 1, b: 2, c: 3, d: { e: 4, f: { g: 5, h: 6, i: 7 } } },
    });

    assert.deepEqual(graphStore.read({
      selectionSet: parseSelectionSet(`{ a b c d { e f { g h i } } }`),
    }), {
      stale: false,
      data: { a: 1, b: 2, c: 3, d: { e: 4, f: { g: 5, h: 6, i: 7 } } },
    });

    const { rollback } = graphStore.writeWithoutCommit({
      selectionSet: parseSelectionSet(`{ c d { f { g i } } }`),
      data: { c: -3, d: { f: { g: -5, i: -7 } } },
    });

    assert.deepEqual(graphStore.read({
      selectionSet: parseSelectionSet(`{ a b c d { e f { g h i } } }`),
    }), {
      stale: false,
      data: { a: 1, b: 2, c: -3, d: { e: 4, f: { g: -5, h: 6, i: -7 } } },
    });

    assert.deepEqual(graphStore.read({
      selectionSet: parseSelectionSet(`{ a b c d { e f { g h i } } }`),
      skipUncommitWrites: true,
    }), {
      stale: false,
      data: { a: 1, b: 2, c: 3, d: { e: 4, f: { g: 5, h: 6, i: 7 } } },
    });

    rollback();

    assert.deepEqual(graphStore.read({
      selectionSet: parseSelectionSet(`{ a b c d { e f { g h i } } }`),
    }), {
      stale: false,
      data: { a: 1, b: 2, c: 3, d: { e: 4, f: { g: 5, h: 6, i: 7 } } },
    });
  });

  it('will read data that has not been commit from multiple transactions', () => {
    const graphStore = createGraphStore();

    graphStore.write({
      selectionSet: parseSelectionSet(`{ a b c d { e f { g h i } } }`),
      data: { a: 1, b: 2, c: 3, d: { e: 4, f: { g: 5, h: 6, i: 7 } } },
    });

    assert.deepEqual(graphStore.read({
      selectionSet: parseSelectionSet(`{ a b c d { e f { g h i } } }`),
    }), {
      stale: false,
      data: { a: 1, b: 2, c: 3, d: { e: 4, f: { g: 5, h: 6, i: 7 } } },
    });

    const { rollback: rollback1 } = graphStore.writeWithoutCommit({
      selectionSet: parseSelectionSet(`{ c }`),
      data: { c: -3 },
    });

    assert.deepEqual(graphStore.read({
      selectionSet: parseSelectionSet(`{ a b c d { e f { g h i } } }`),
    }), {
      stale: false,
      data: { a: 1, b: 2, c: -3, d: { e: 4, f: { g: 5, h: 6, i: 7 } } },
    });

    assert.deepEqual(graphStore.read({
      selectionSet: parseSelectionSet(`{ a b c d { e f { g h i } } }`),
      skipUncommitWrites: true,
    }), {
      stale: false,
      data: { a: 1, b: 2, c: 3, d: { e: 4, f: { g: 5, h: 6, i: 7 } } },
    });

    const { rollback: rollback2 } = graphStore.writeWithoutCommit({
      selectionSet: parseSelectionSet(`{ d { f { g i } } }`),
      data: { d: { f: { g: -5, i: -7 } } },
    });

    assert.deepEqual(graphStore.read({
      selectionSet: parseSelectionSet(`{ a b c d { e f { g h i } } }`),
    }), {
      stale: false,
      data: { a: 1, b: 2, c: -3, d: { e: 4, f: { g: -5, h: 6, i: -7 } } },
    });

    assert.deepEqual(graphStore.read({
      selectionSet: parseSelectionSet(`{ a b c d { e f { g h i } } }`),
      skipUncommitWrites: true,
    }), {
      stale: false,
      data: { a: 1, b: 2, c: 3, d: { e: 4, f: { g: 5, h: 6, i: 7 } } },
    });

    rollback1();

    assert.deepEqual(graphStore.read({
      selectionSet: parseSelectionSet(`{ a b c d { e f { g h i } } }`),
    }), {
      stale: false,
      data: { a: 1, b: 2, c: 3, d: { e: 4, f: { g: -5, h: 6, i: -7 } } },
    });

    assert.deepEqual(graphStore.read({
      selectionSet: parseSelectionSet(`{ a b c d { e f { g h i } } }`),
      skipUncommitWrites: true,
    }), {
      stale: false,
      data: { a: 1, b: 2, c: 3, d: { e: 4, f: { g: 5, h: 6, i: 7 } } },
    });

    rollback2();

    assert.deepEqual(graphStore.read({
      selectionSet: parseSelectionSet(`{ a b c d { e f { g h i } } }`),
    }), {
      stale: false,
      data: { a: 1, b: 2, c: 3, d: { e: 4, f: { g: 5, h: 6, i: 7 } } },
    });
  });

  it('will update data with common ids', () => {
    const graphStore = createGraphStore();

    graphStore.write({
      selectionSet: parseSelectionSet(`{
        foo {
          a b c
          bar {
            d e f
          }
        }
      }`),
      data: {
        foo: {
          [TEST_ID_KEY]: 'foo',
          a: 1, b: 2, c: 3,
          bar: {
            [TEST_ID_KEY]: 'bar',
            d: 4, e: 5, f: 6,
          },
        },
      },
    });

    assert.deepEqual(graphStore.read({
      selectionSet: parseSelectionSet(`{
        foo {
          a b c
          bar {
            d e f
          }
        }
      }`),
    }), {
      stale: false,
      data: {
        foo: {
          a: 1, b: 2, c: 3,
          bar: {
            d: 4, e: 5, f: 6,
          },
        },
      },
    });

    graphStore.write({
      selectionSet: parseSelectionSet(`{
        bar {
          d barBonus
          foo {
            a fooBonus
          }
        }
      }`),
      data: {
        bar: {
          [TEST_ID_KEY]: 'bar',
          d: -4, barBonus: 'extra data for bar!',
          foo: {
            [TEST_ID_KEY]: 'foo',
            a: -1, fooBonus: 'extra data for foo!',
          },
        },
      },
    });

    assert.deepEqual(graphStore.read({
      selectionSet: parseSelectionSet(`{
        foo {
          a b c fooBonus
          bar {
            d e f barBonus
          }
        }
      }`),
    }), {
      stale: false,
      data: {
        foo: {
          a: -1, b: 2, c: 3, fooBonus: 'extra data for foo!',
          bar: {
            d: -4, e: 5, f: 6, barBonus: 'extra data for bar!',
          },
        },
      },
    });
  });

  it('will update data with common ids that has not been commit', () => {
    const graphStore = createGraphStore();

    graphStore.write({
      selectionSet: parseSelectionSet(`{
        foo {
          a b c
          bar {
            d e f
          }
        }
      }`),
      data: {
        foo: {
          [TEST_ID_KEY]: 'foo',
          a: 1, b: 2, c: 3,
          bar: {
            [TEST_ID_KEY]: 'bar',
            d: 4, e: 5, f: 6,
          },
        },
      },
    });

    assert.deepEqual(graphStore.read({
      selectionSet: parseSelectionSet(`{
        foo {
          a b c
          bar {
            d e f
          }
        }
      }`),
    }), {
      stale: false,
      data: {
        foo: {
          a: 1, b: 2, c: 3,
          bar: {
            d: 4, e: 5, f: 6,
          },
        },
      },
    });

    const { rollback } = graphStore.writeWithoutCommit({
      selectionSet: parseSelectionSet(`{
        bar {
          d barBonus
          foo {
            a fooBonus
          }
        }
      }`),
      data: {
        bar: {
          [TEST_ID_KEY]: 'bar',
          d: -4, barBonus: 'extra data for bar!',
          foo: {
            [TEST_ID_KEY]: 'foo',
            a: -1, fooBonus: 'extra data for foo!',
          },
        },
      },
    });

    assert.deepEqual(graphStore.read({
      selectionSet: parseSelectionSet(`{
        foo {
          a b c fooBonus
          bar {
            d e f barBonus
          }
        }
      }`),
    }), {
      stale: false,
      data: {
        foo: {
          a: -1, b: 2, c: 3, fooBonus: 'extra data for foo!',
          bar: {
            d: -4, e: 5, f: 6, barBonus: 'extra data for bar!',
          },
        },
      },
    });

    rollback();

    assert.deepEqual(graphStore.read({
      selectionSet: parseSelectionSet(`{
        foo {
          a b c
          bar {
            d e f
          }
        }
      }`),
    }), {
      stale: false,
      data: {
        foo: {
          a: 1, b: 2, c: 3,
          bar: {
            d: 4, e: 5, f: 6,
          },
        },
      },
    });
  });

  describe('watch', () => {
    it('will throw an error if there is no data for a first read', () => {
      const graph = createGraphStore();
      try {
        graph.watch({
          selectionSet: parseSelectionSet(`{ a b c }`),
        });
      } catch (error) {
        assert.equal(error._partialRead, true);
        assert.equal(error.message, 'No scalar value found for field \'a\'.');
      }
    });

    it('will get updates from writes', done => {
      const graph = createGraphStore();

      graph.write({
        selectionSet: parseSelectionSet(`{ a b c }`),
        data: { a: 1, b: 2, c: 3 },
      });

      testObservable(
        done,
        graph.watch({
          selectionSet: parseSelectionSet(`{ a b c }`),
        }),
        data => {
          assert.deepEqual(data, { stale: false, data: { a: 1, b: 2, c: 3 } });
          graph.write({
            selectionSet: parseSelectionSet(`{ a b c }`),
            data: { a: 4, b: 5, c: 6 },
          });
        },
        data => {
          assert.deepEqual(data, { stale: false, data: { a: 4, b: 5, c: 6 } });
          graph.write({
            selectionSet: parseSelectionSet(`{ a }`),
            data: { a: 1 },
          });
        },
        data => {
          assert.deepEqual(data, { stale: false, data: { a: 1, b: 5, c: 6 } });
          graph.write({
            selectionSet: parseSelectionSet(`{ b }`),
            data: { b: 2 },
          });
        },
        data => {
          assert.deepEqual(data, { stale: false, data: { a: 1, b: 2, c: 6 } });
          graph.write({
            selectionSet: parseSelectionSet(`{ c }`),
            data: { c: 3 },
          });
        },
        data => {
          assert.deepEqual(data, { stale: false, data: { a: 1, b: 2, c: 3 } });
        },
      );
    });

    it('will not see updates that don’t change anything', done => {
      const graph = createGraphStore();

      graph.write({
        selectionSet: parseSelectionSet(`{ a b c }`),
        data: { a: 1, b: 2, c: 3 },
      });

      let deadZone = false;

      testObservable(
        done,
        graph.watch({
          selectionSet: parseSelectionSet(`{ a b c }`),
        }),
        data => {
          assert.deepEqual(data, { stale: false, data: { a: 1, b: 2, c: 3 } });
          deadZone = true;
          graph.write({
            selectionSet: parseSelectionSet(`{ a b c }`),
            data: { a: 1, b: 2, c: 3 },
          });
          // Nothing should happen...
          setTimeout(() => {
            graph.write({
              selectionSet: parseSelectionSet(`{ d }`),
              data: { d: 4 },
            });
            // Nothing should happen again...
            setTimeout(() => {
              deadZone = false;
              // This actually changes things and should trigger an update.
              graph.write({
                selectionSet: parseSelectionSet(`{ a b c }`),
                data: { a: 4, b: 5, c: 6 },
              });
            }, 5);
          }, 5);
        },
        data => {
          if (deadZone) {
            throw new Error('In the dead zone. There should be no new values!');
          }
          assert.deepEqual(data, { stale: false, data: { a: 4, b: 5, c: 6 } });
        },
      );
    });

    it('will take some initial data', done => {
      const graph = createGraphStore();

      testObservable(
        done,
        graph.watch({
          selectionSet: parseSelectionSet(`{ a b c }`),
          initialData: { a: 1, b: 2, c: 3 },
        }),
        data => {
          assert.deepEqual(data, { stale: false, data: { a: 1, b: 2, c: 3 } });
          graph.write({
            selectionSet: parseSelectionSet(`{ a b c }`),
            data: { a: 4, b: 5, c: 6 },
          });
        },
        data => {
          assert.deepEqual(data, { stale: false, data: { a: 4, b: 5, c: 6 } });
        },
      );
    });
  });
});
