import { assert } from 'chai';
import { createStore } from 'redux';
import gql from 'graphql-tag';
import { print } from 'graphql/language/printer';
import { createApolloStore, ApolloReducerConfig } from '../src/store';
import { ReduxDataProxy, TransactionDataProxy } from '../src/data/proxy';
import { toIdValue } from '../src/data/storeUtils';
import { HeuristicFragmentMatcher } from '../src/data/fragmentMatcher';
import { addTypenameToDocument } from '../src/queries/queryTransform';

describe('ReduxDataProxy', () => {
  function createDataProxy({
    initialState,
    config,
  }: {
    initialState?: any,
    config?: ApolloReducerConfig,
  } = {}) {
    const store = createApolloStore({
      initialState,
      config,
    });
    const fm = new HeuristicFragmentMatcher();
    return new ReduxDataProxy(store, ({ apollo }) => apollo, fm, config || {});
  }

  describe('readQuery', () => {
    it('will read some data from the store', () => {
      const proxy = createDataProxy({
        initialState: {
          apollo: {
            data: {
              'ROOT_QUERY': {
                a: 1,
                b: 2,
                c: 3,
              },
            },
          },
        },
      });

      assert.deepEqual(proxy.readQuery({ query: gql`{ a }` }), { a: 1 });
      assert.deepEqual(proxy.readQuery({ query: gql`{ b c }` }), { b: 2, c: 3 });
      assert.deepEqual(proxy.readQuery({ query: gql`{ a b c }` }), { a: 1, b: 2, c: 3 });
    });

    it('will read some deeply nested data from the store', () => {
      const proxy = createDataProxy({
        initialState: {
          apollo: {
            data: {
              'ROOT_QUERY': {
                a: 1,
                b: 2,
                c: 3,
                d: {
                  type: 'id',
                  id: 'foo',
                  generated: false,
                },
              },
              'foo': {
                e: 4,
                f: 5,
                g: 6,
                h: {
                  type: 'id',
                  id: 'bar',
                  generated: false,
                },
              },
              'bar': {
                i: 7,
                j: 8,
                k: 9,
              },
            },
          },
        },
      });

      assert.deepEqual(
        proxy.readQuery({ query: gql`{ a d { e } }` }),
        { a: 1, d: { e: 4 } },
      );
      assert.deepEqual(
        proxy.readQuery({ query: gql`{ a d { e h { i } } }` }),
        { a: 1, d: { e: 4, h: { i: 7 } } },
      );
      assert.deepEqual(
        proxy.readQuery({ query: gql`{ a b c d { e f g h { i j k } } }` }),
        { a: 1, b: 2, c: 3, d: { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } } },
      );
    });

    it('will read data using custom resolvers', () => {
      const proxy = createDataProxy({
        initialState: {
          apollo: {
            data: {
              'ROOT_QUERY': {
                __typename: 'Query',
              },
              foo: {
                id: 'foo',
                a: 1,
                b: '2',
                c: null,
              },
            },
          },
        },
        config: {
          dataIdFromObject: (object: any) => object.id,
          customResolvers: {
            Query: {
              thing: (_, args) => toIdValue(args.id),
            },
          },
        },
      });

      const queryResult = proxy.readQuery({
        query: gql`
          query {
            thing(id: "foo") {
              a b c
            }
          }
        `,
      });

      assert.deepEqual(queryResult, {
        thing: { a: 1, b: '2', c: null },
      });
    });

    it('will read some data from the store with variables', () => {
      const proxy = createDataProxy({
        initialState: {
          apollo: {
            data: {
              'ROOT_QUERY': {
                'field({"literal":true,"value":42})': 1,
                'field({"literal":false,"value":42})': 2,
              },
            },
          },
        },
      });

      assert.deepEqual(proxy.readQuery({
        query: gql`query ($literal: Boolean, $value: Int) {
          a: field(literal: true, value: 42)
          b: field(literal: $literal, value: $value)
        }`,
        variables: {
          literal: false,
          value: 42,
        },
      }), { a: 1, b: 2 });
    });
  });

  describe('readFragment', () => {
    it('will throw an error when there is no fragment', () => {
      const proxy = createDataProxy();

      assert.throws(() => {
        proxy.readFragment({ id: 'x', fragment: gql`query { a b c }` });
      }, 'Found a query operation. No operations are allowed when using a fragment as a query. Only fragments are allowed.');
      assert.throws(() => {
        proxy.readFragment({ id: 'x', fragment: gql`schema { query: Query }` });
      }, 'Found 0 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
    });

    it('will throw an error when there is more than one fragment but no fragment name', () => {
      const proxy = createDataProxy();

      assert.throws(() => {
        proxy.readFragment({ id: 'x', fragment: gql`fragment a on A { a } fragment b on B { b }` });
      }, 'Found 2 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
      assert.throws(() => {
        proxy.readFragment({ id: 'x', fragment: gql`fragment a on A { a } fragment b on B { b } fragment c on C { c }` });
      }, 'Found 3 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
    });

    it('will read some deeply nested data from the store at any id', () => {
      const proxy = createDataProxy({
        initialState: {
          apollo: {
            data: {
              'ROOT_QUERY': {
                __typename: 'Type1',
                a: 1,
                b: 2,
                c: 3,
                d: {
                  type: 'id',
                  id: 'foo',
                  generated: false,
                },
              },
              'foo': {
                __typename: 'Foo',
                e: 4,
                f: 5,
                g: 6,
                h: {
                  type: 'id',
                  id: 'bar',
                  generated: false,
                },
              },
              'bar': {
                __typename: 'Bar',
                i: 7,
                j: 8,
                k: 9,
              },
            },
          },
        },
      });

      assert.deepEqual(
        proxy.readFragment({ id: 'foo', fragment: gql`fragment fragmentFoo on Foo { e h { i } }` }),
        { e: 4, h: { i: 7 } },
      );
      assert.deepEqual(
        proxy.readFragment({ id: 'foo', fragment: gql`fragment fragmentFoo on Foo { e f g h { i j k } }` }),
        { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } },
      );
      assert.deepEqual(
        proxy.readFragment({ id: 'bar', fragment: gql`fragment fragmentBar on Bar { i }` }),
        { i: 7 },
      );
      assert.deepEqual(
        proxy.readFragment({ id: 'bar', fragment: gql`fragment fragmentBar on Bar { i j k }` }),
        { i: 7, j: 8, k: 9 },
      );
      assert.deepEqual(
        proxy.readFragment({
          id: 'foo',
          fragment: gql`fragment fragmentFoo on Foo { e f g h { i j k } } fragment fragmentBar on Bar { i j k }`,
          fragmentName: 'fragmentFoo',
        }),
        { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } },
      );
      assert.deepEqual(
        proxy.readFragment({
          id: 'bar',
          fragment: gql`fragment fragmentFoo on Foo { e f g h { i j k } } fragment fragmentBar on Bar { i j k }`,
          fragmentName: 'fragmentBar',
        }),
        { i: 7, j: 8, k: 9 },
      );
    });

    it('will read some data from the store with variables', () => {
      const proxy = createDataProxy({
        initialState: {
          apollo: {
            data: {
              'foo': {
                __typename: 'Foo',
                'field({"literal":true,"value":42})': 1,
                'field({"literal":false,"value":42})': 2,
              },
            },
          },
        },
      });

      assert.deepEqual(proxy.readFragment({
        id: 'foo',
        fragment: gql`
          fragment foo on Foo {
            a: field(literal: true, value: 42)
            b: field(literal: $literal, value: $value)
          }
        `,
        variables: {
          literal: false,
          value: 42,
        },
      }), { a: 1, b: 2 });
    });

    it('will return null when an id that can’t be found is provided', () => {
      const client1 = createDataProxy();
      const client2 = createDataProxy({
        initialState: {
          apollo: {
            data: {
              'bar': { __typename: 'Bar', a: 1, b: 2, c: 3 },
            },
          },
        },
      });
      const client3 = createDataProxy({
        initialState: {
          apollo: {
            data: {
              'foo': { __typename: 'Foo', a: 1, b: 2, c: 3 },
            },
          },
        },
      });

      assert.equal(client1.readFragment({ id: 'foo', fragment: gql`fragment fooFragment on Foo { a b c }` }), null);
      assert.equal(client2.readFragment({ id: 'foo', fragment: gql`fragment fooFragment on Foo { a b c }` }), null);
      assert.deepEqual(client3.readFragment({ id: 'foo', fragment: gql`fragment fooFragment on Foo { a b c }` }), { a: 1, b: 2, c: 3 });
    });

    it('will read data using custom resolvers', () => {
      const proxy = createDataProxy({
        initialState: {
          apollo: {
            data: {
              'ROOT_QUERY': {
                __typename: 'Query',
              },
              foo: {
                __typename: 'Query',
                id: 'foo',
              },
              bar: {
                __typename: 'Thing',
                id: 'foo',
                a: 1,
                b: '2',
                c: null,
              },
            },
          },
        },
        config: {
          dataIdFromObject: (object: any) => object.id,
          customResolvers: {
            Query: {
              thing: (_, args) => toIdValue(args.id),
            },
          },
        },
      });

      const queryResult = proxy.readFragment({
        id: 'foo',
        fragment: gql`fragment fooFragment on Query {
          thing(id: "bar") { a b c }
        }`,
      });

      assert.deepEqual(queryResult, {
        thing: { a: 1, b: '2', c: null },
      });
    });
  });

  describe('writeQuery', () => {
    it('will write some data to the store', () => {
      const proxy = createDataProxy();

      proxy.writeQuery({ data: { a: 1 }, query: gql`{ a }` });

      assert.deepEqual((proxy as any).store.getState().apollo.data, {
        'ROOT_QUERY': {
          a: 1,
        },
      });

      proxy.writeQuery({ data: { b: 2, c: 3 }, query: gql`{ b c }` });

      assert.deepEqual((proxy as any).store.getState().apollo.data, {
        'ROOT_QUERY': {
          a: 1,
          b: 2,
          c: 3,
        },
      });

      proxy.writeQuery({ data: { a: 4, b: 5, c: 6 }, query: gql`{ a b c }` });

      assert.deepEqual((proxy as any).store.getState().apollo.data, {
        'ROOT_QUERY': {
          a: 4,
          b: 5,
          c: 6,
        },
      });
    });

    it('will write some deeply nested data to the store', () => {
      const proxy = createDataProxy();

      proxy.writeQuery({
        data: { a: 1, d: { e: 4 } },
        query: gql`{ a d { e } }`,
      });

      assert.deepEqual((proxy as any).store.getState().apollo.data, {
        'ROOT_QUERY': {
          a: 1,
          d: {
            type: 'id',
            id: '$ROOT_QUERY.d',
            generated: true,
          },
        },
        '$ROOT_QUERY.d': {
          e: 4,
        },
      });

      proxy.writeQuery({
        data: { a: 1, d: { h: { i: 7 } } },
        query: gql`{ a d { h { i } } }`,
      });

      assert.deepEqual((proxy as any).store.getState().apollo.data, {
        'ROOT_QUERY': {
          a: 1,
          d: {
            type: 'id',
            id: '$ROOT_QUERY.d',
            generated: true,
          },
        },
        '$ROOT_QUERY.d': {
          e: 4,
          h: {
            type: 'id',
            id: '$ROOT_QUERY.d.h',
            generated: true,
          },
        },
        '$ROOT_QUERY.d.h': {
          i: 7,
        },
      });

      proxy.writeQuery({
        data: { a: 1, b: 2, c: 3, d: { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } } },
        query: gql`{ a b c d { e f g h { i j k } } }`,
      });

      assert.deepEqual((proxy as any).store.getState().apollo.data, {
        'ROOT_QUERY': {
          a: 1,
          b: 2,
          c: 3,
          d: {
            type: 'id',
            id: '$ROOT_QUERY.d',
            generated: true,
          },
        },
        '$ROOT_QUERY.d': {
          e: 4,
          f: 5,
          g: 6,
          h: {
            type: 'id',
            id: '$ROOT_QUERY.d.h',
            generated: true,
          },
        },
        '$ROOT_QUERY.d.h': {
          i: 7,
          j: 8,
          k: 9,
        },
      });
    });

    it('will write some data to the store with variables', () => {
      const proxy = createDataProxy();

      proxy.writeQuery({
        data: {
          a: 1,
          b: 2,
        },
        query: gql`
          query ($literal: Boolean, $value: Int) {
            a: field(literal: true, value: 42)
            b: field(literal: $literal, value: $value)
          }
        `,
        variables: {
          literal: false,
          value: 42,
        },
      });

      assert.deepEqual((proxy as any).store.getState().apollo.data, {
        'ROOT_QUERY': {
          'field({"literal":true,"value":42})': 1,
          'field({"literal":false,"value":42})': 2,
        },
      });
    });
  });

  describe('writeFragment', () => {
    it('will throw an error when there is no fragment', () => {
      const proxy = createDataProxy();

      assert.throws(() => {
        proxy.writeFragment({ data: {}, id: 'x', fragment: gql`query { a b c }` });
      }, 'Found a query operation. No operations are allowed when using a fragment as a query. Only fragments are allowed.');
      assert.throws(() => {
        proxy.writeFragment({ data: {}, id: 'x', fragment: gql`schema { query: Query }` });
      }, 'Found 0 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
    });

    it('will throw an error when there is more than one fragment but no fragment name', () => {
      const proxy = createDataProxy();

      assert.throws(() => {
        proxy.writeFragment({ data: {}, id: 'x', fragment: gql`fragment a on A { a } fragment b on B { b }` });
      }, 'Found 2 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
      assert.throws(() => {
        proxy.writeFragment({ data: {}, id: 'x', fragment: gql`fragment a on A { a } fragment b on B { b } fragment c on C { c }` });
      }, 'Found 3 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
    });

    it('will write some deeply nested data into the store at any id', () => {
      const proxy = createDataProxy({
        config : { dataIdFromObject: (o: any) => o.id },
      });

      proxy.writeFragment({
        data: { __typename: 'Foo', e: 4, h: { id: 'bar', i: 7 } },
        id: 'foo',
        fragment: gql`fragment fragmentFoo on Foo { e h { i } }`,
      });

      assert.deepEqual((proxy as any).store.getState().apollo.data, {
        'foo': {
          e: 4,
          h: {
            type: 'id',
            id: 'bar',
            generated: false,
          },
        },
        'bar': {
          i: 7,
        },
      });
      proxy.writeFragment({
        data: { __typename: 'Foo', f: 5, g: 6, h: { id: 'bar', j: 8, k: 9 } },
        id: 'foo',
        fragment: gql`fragment fragmentFoo on Foo { f g h { j k } }`,
      });

      assert.deepEqual((proxy as any).store.getState().apollo.data, {
        'foo': {
          e: 4,
          f: 5,
          g: 6,
          h: {
            type: 'id',
            id: 'bar',
            generated: false,
          },
        },
        'bar': {
          i: 7,
          j: 8,
          k: 9,
        },
      });

      proxy.writeFragment({
        data: { i: 10, __typename: 'Bar' },
        id: 'bar',
        fragment: gql`fragment fragmentBar on Bar { i }`,
      });

      assert.deepEqual((proxy as any).store.getState().apollo.data, {
        'foo': {
          e: 4,
          f: 5,
          g: 6,
          h: {
            type: 'id',
            id: 'bar',
            generated: false,
          },
        },
        'bar': {
          i: 10,
          j: 8,
          k: 9,
        },
      });

      proxy.writeFragment({
        data: { j: 11, k: 12, __typename: 'Bar' },
        id: 'bar',
        fragment: gql`fragment fragmentBar on Bar { j k }`,
      });

      assert.deepEqual((proxy as any).store.getState().apollo.data, {
        'foo': {
          e: 4,
          f: 5,
          g: 6,
          h: {
            type: 'id',
            id: 'bar',
            generated: false,
          },
        },
        'bar': {
          i: 10,
          j: 11,
          k: 12,
        },
      });

      proxy.writeFragment({
        data: { __typename: 'Foo', e: 4, f: 5, g: 6, h: { __typename: 'Bar', id: 'bar', i: 7, j: 8, k: 9 } },
        id: 'foo',
        fragment: gql`fragment fooFragment on Foo { e f g h { i j k } } fragment barFragment on Bar { i j k }`,
        fragmentName: 'fooFragment',
      });

      assert.deepEqual((proxy as any).store.getState().apollo.data, {
        'foo': {
          e: 4,
          f: 5,
          g: 6,
          h: {
            type: 'id',
            id: 'bar',
            generated: false,
          },
        },
        'bar': {
          i: 7,
          j: 8,
          k: 9,
        },
      });

      proxy.writeFragment({
        data: { __typename: 'Bar', i: 10, j: 11, k: 12 },
        id: 'bar',
        fragment: gql`fragment fooFragment on Foo { e f g h { i j k } } fragment barFragment on Bar { i j k }`,
        fragmentName: 'barFragment',
      });

      assert.deepEqual((proxy as any).store.getState().apollo.data, {
        'foo': {
          e: 4,
          f: 5,
          g: 6,
          h: {
            type: 'id',
            id: 'bar',
            generated: false,
          },
        },
        'bar': {
          i: 10,
          j: 11,
          k: 12,
        },
      });
    });

    it('will write some data to the store with variables', () => {
      const proxy = createDataProxy();

      proxy.writeFragment({
        data: {
          a: 1,
          b: 2,
        },
        id: 'foo',
        fragment: gql`
          fragment foo on Foo {
            a: field(literal: true, value: 42)
            b: field(literal: $literal, value: $value)
          }
        `,
        variables: {
          literal: false,
          value: 42,
        },
      });

      assert.deepEqual((proxy as any).store.getState().apollo.data, {
        'foo': {
          'field({"literal":true,"value":42})': 1,
          'field({"literal":false,"value":42})': 2,
        },
      });
    });
  });
});

describe('TransactionDataProxy', () => {
  describe('readQuery', () => {
    it('will throw an error if the transaction has finished', () => {
      const proxy: any = new TransactionDataProxy({}, {});
      proxy.finish();

      assert.throws(() => {
        proxy.readQuery({});
      }, 'Cannot call transaction methods after the transaction has finished.');
    });

    it('will read some data from the store', () => {
      const proxy = new TransactionDataProxy({
        'ROOT_QUERY': {
          a: 1,
          b: 2,
          c: 3,
        },
      }, {});

      assert.deepEqual(proxy.readQuery({ query: gql`{ a }` }), { a: 1 });
      assert.deepEqual(proxy.readQuery({ query: gql`{ b c }` }), { b: 2, c: 3 });
      assert.deepEqual(proxy.readQuery({ query: gql`{ a b c }` }), { a: 1, b: 2, c: 3 });
    });

    it('will read some deeply nested data from the store', () => {
      const proxy = new TransactionDataProxy({
        'ROOT_QUERY': {
          a: 1,
          b: 2,
          c: 3,
          d: {
            type: 'id',
            id: 'foo',
            generated: false,
          },
        },
        'foo': {
          __typename: 'Foo',
          e: 4,
          f: 5,
          g: 6,
          h: {
            type: 'id',
            id: 'bar',
            generated: false,
          },
        },
        'bar': {
          __typename: 'Bar',
          i: 7,
          j: 8,
          k: 9,
        },
      }, { addTypename: true });

      assert.deepEqual(
        proxy.readQuery({ query: gql`{ a d { e } }` }),
        { a: 1, d: { __typename: 'Foo', e: 4 } },
      );
      assert.deepEqual(
        proxy.readQuery({ query: gql`{ a d { e h { i } } }` }),
        { a: 1, d: { __typename: 'Foo', e: 4, h: { __typename: 'Bar', i: 7 } } },
      );
      assert.deepEqual(
        proxy.readQuery({ query: gql`{ a b c d { e f g h { i j k } } }` }),
        { a: 1, b: 2, c: 3, d: { __typename: 'Foo',  e: 4, f: 5, g: 6, h: { __typename: 'Bar',  i: 7, j: 8, k: 9 } } },
      );
    });

    it('will read some data from the store with variables', () => {
      const proxy = new TransactionDataProxy({
        'ROOT_QUERY': {
          'field({"literal":true,"value":42})': 1,
          'field({"literal":false,"value":42})': 2,
        },
      }, { addTypename: true });

      assert.deepEqual(proxy.readQuery({
        query: gql`query ($literal: Boolean, $value: Int) {
          a: field(literal: true, value: 42)
          b: field(literal: $literal, value: $value)
        }`,
        variables: {
          literal: false,
          value: 42,
        },
      }), { a: 1, b: 2 });
    });

    it('will read data using custom resolvers', () => {
      const proxy = new TransactionDataProxy({
        'ROOT_QUERY': {
          __typename: 'Query',
        },
        foo: {
          __typename: 'Foo',
          id: 'foo',
          a: 1,
          b: '2',
          c: null,
        },
      }, {
        dataIdFromObject: (object: any) => object.id,
        customResolvers: {
          Query: {
            thing: (_, args) => toIdValue(args.id),
          },
        },
        addTypename: true,
      });

      const queryResult = proxy.readQuery({
        query: gql`
          query {
            thing(id: "foo") {
              a b c
            }
          }
        `,
      });

      assert.deepEqual(queryResult, {
        thing: {__typename: 'Foo', a: 1, b: '2', c: null },
      });
    });
  });

  describe('readFragment', () => {
    it('will throw an error if the transaction has finished', () => {
      const proxy: any = new TransactionDataProxy({}, {});
      proxy.finish();

      assert.throws(() => {
        proxy.readFragment({});
      }, 'Cannot call transaction methods after the transaction has finished.');
    });

    it('will throw an error when there is no fragment', () => {
      const proxy = new TransactionDataProxy({}, {});

      assert.throws(() => {
        proxy.readFragment({ id: 'x', fragment: gql`query { a b c }` });
      }, 'Found a query operation. No operations are allowed when using a fragment as a query. Only fragments are allowed.');
      assert.throws(() => {
        proxy.readFragment({ id: 'x', fragment: gql`schema { query: Query }` });
      }, 'Found 0 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
    });

    it('will throw an error when there is more than one fragment but no fragment name', () => {
      const proxy = new TransactionDataProxy({}, {});

      assert.throws(() => {
        proxy.readFragment({ id: 'x', fragment: gql`fragment a on A { a } fragment b on B { b }` });
      }, 'Found 2 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
      assert.throws(() => {
        proxy.readFragment({ id: 'x', fragment: gql`fragment a on A { a } fragment b on B { b } fragment c on C { c }` });
      }, 'Found 3 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
    });

    it('will read some deeply nested data from the store at any id', () => {
      const proxy = new TransactionDataProxy({
        'ROOT_QUERY': {
          a: 1,
          b: 2,
          c: 3,
          d: {
            type: 'id',
            id: 'foo',
            generated: false,
          },
        },
        'foo': {
          __typename: 'Foo',
          e: 4,
          f: 5,
          g: 6,
          h: {
            type: 'id',
            id: 'bar',
            generated: false,
          },
        },
        'bar': {
          __typename: 'Bar',
          i: 7,
          j: 8,
          k: 9,
        },
      }, { addTypename: true });

      assert.deepEqual(
        proxy.readFragment({ id: 'foo', fragment: gql`fragment fragmentFoo on Foo { e h { i } }` }),
        { __typename: 'Foo', e: 4, h: { __typename: 'Bar', i: 7 } },
      );
      assert.deepEqual(
        proxy.readFragment({ id: 'foo', fragment: gql`fragment fragmentFoo on Foo { e f g h { i j k } }` }),
        { __typename: 'Foo', e: 4, f: 5, g: 6, h: { __typename: 'Bar', i: 7, j: 8, k: 9 } },
      );
      assert.deepEqual(
        proxy.readFragment({ id: 'bar', fragment: gql`fragment fragmentBar on Bar { i }` }),
        { __typename: 'Bar', i: 7 },
      );
      assert.deepEqual(
        proxy.readFragment({ id: 'bar', fragment: gql`fragment fragmentBar on Bar { i j k }` }),
        { __typename: 'Bar', i: 7, j: 8, k: 9 },
      );
      assert.deepEqual(
        proxy.readFragment({
          id: 'foo',
          fragment: gql`fragment fragmentFoo on Foo { e f g h { i j k } } fragment fragmentBar on Bar { i j k }`,
          fragmentName: 'fragmentFoo',
        }),
        { __typename: 'Foo', e: 4, f: 5, g: 6, h: { __typename: 'Bar', i: 7, j: 8, k: 9 } },
      );
      assert.deepEqual(
        proxy.readFragment({
          id: 'bar',
          fragment: gql`fragment fragmentFoo on Foo { e f g h { i j k } } fragment fragmentBar on Bar { i j k }`,
          fragmentName: 'fragmentBar',
        }),
        { __typename: 'Bar', i: 7, j: 8, k: 9 },
      );
    });

    it('will read some data from the store with variables', () => {
      const proxy = new TransactionDataProxy({
        'foo': {
          __typename: 'Foo',
          'field({"literal":true,"value":42})': 1,
          'field({"literal":false,"value":42})': 2,
        },
      }, { addTypename: true });

      assert.deepEqual(proxy.readFragment({
        id: 'foo',
        fragment: gql`
          fragment foo on Foo {
            a: field(literal: true, value: 42)
            b: field(literal: $literal, value: $value)
          }
        `,
        variables: {
          literal: false,
          value: 42,
        },
      }), { a: 1, b: 2, __typename: 'Foo' });
    });

    it('will return null when an id that can’t be found is provided', () => {
      const client1 = new TransactionDataProxy({}, {});
      const client2 = new TransactionDataProxy({
        'bar': { __typename: 'Type1', a: 1, b: 2, c: 3 },
      }, {});
      const client3 = new TransactionDataProxy({
        'foo': { __typename: 'Type1', a: 1, b: 2, c: 3 },
      }, {});

      assert.equal(client1.readFragment({ id: 'foo', fragment: gql`fragment fooFragment on Foo { a b c }` }), null);
      assert.equal(client2.readFragment({ id: 'foo', fragment: gql`fragment fooFragment on Foo { a b c }` }), null);
      assert.deepEqual(client3.readFragment({ id: 'foo', fragment: gql`fragment fooFragment on Foo { a b c }` }), { a: 1, b: 2, c: 3 });
    });

    it('will read data using custom resolvers', () => {
      const proxy = new TransactionDataProxy({
        'ROOT_QUERY': {
          __typename: 'Query',
        },
        foo: {
          __typename: 'Query',
          id: 'foo',
        },
        bar: {
          __typename: 'Thing',
          id: 'bar',
          a: 1,
          b: '2',
          c: null,
        },
      }, {
        dataIdFromObject: (object: any) => object.id,
        customResolvers: {
          Query: {
            thing: (_, args) => toIdValue(args.id),
          },
        },
        addTypename: true,
      });

      const queryResult = proxy.readFragment({
        id: 'foo',
        fragment: gql`fragment fooFragment on Query {
          thing(id: "bar") { a b c }
        }`,
      });

      assert.deepEqual(queryResult, {
        __typename: 'Query',
        thing: { __typename: 'Thing', a: 1, b: '2', c: null },
      });
    });
  });

  describe('writeQuery', () => {
    it('will throw an error if the transaction has finished', () => {
      const proxy: any = new TransactionDataProxy({}, {});
      proxy.finish();

      assert.throws(() => {
        proxy.writeQuery({});
      }, 'Cannot call transaction methods after the transaction has finished.');
    });

    it('will create writes that get returned when finished', () => {
      const proxy = new TransactionDataProxy({}, { addTypename: true });

      proxy.writeQuery({
        data: { a: 1, b: 2, c: 3 },
        query: gql`{ a b c }`,
      });

      proxy.writeQuery({
        data: { foo: { d: 4, e: 5, bar: { f: 6, g: 7 } } },
        query: gql`{ foo(id: $id) { d e bar { f g } } }`,
        variables: { id: 7 },
      });

      const writes = proxy.finish();

      assert.deepEqual(writes, [
        {
          rootId: 'ROOT_QUERY',
          result: { a: 1, b: 2, c: 3 },
          document: addTypenameToDocument(gql`{ a b c }`),
          variables: {},
        },
        {
          rootId: 'ROOT_QUERY',
          result: { foo: { d: 4, e: 5, bar: { f: 6, g: 7 } } },
          document: addTypenameToDocument(gql`{ foo(id: $id) { d e bar { f g } } }`),
          variables: { id: 7 },
        },
      ]);
    });
  });

  describe('writeFragment', () => {
    it('will throw an error if the transaction has finished', () => {
      const proxy: any = new TransactionDataProxy({}, { addTypename: true });
      proxy.finish();

      assert.throws(() => {
        proxy.writeFragment({});
      }, 'Cannot call transaction methods after the transaction has finished.');
    });

    it('will create writes that get returned when finished', () => {
      const proxy = new TransactionDataProxy({}, {});

      proxy.writeFragment({
        data: { a: 1, b: 2, c: 3 },
        id: 'foo',
        fragment: gql`fragment fragment1 on Foo { a b c }`,
      });

      proxy.writeFragment({
        data: { foo: { d: 4, e: 5, bar: { f: 6, g: 7 } } },
        id: 'bar',
        fragment: gql`
          fragment fragment1 on Foo { a b c }
          fragment fragment2 on Bar { foo(id: $id) { d e bar { f g } } }
        `,
        fragmentName: 'fragment2',
        variables: { id: 7 },
      });

      const writes = proxy.finish();

      assert.equal(writes.length, 2);
      assert.deepEqual(Object.keys(writes[0]), ['rootId', 'result', 'document', 'variables']);
      assert.equal(writes[0].rootId, 'foo');
      assert.deepEqual(writes[0].result, { a: 1, b: 2, c: 3 });
      assert.deepEqual(writes[0].variables, {});
      assert.equal(print(writes[0].document), print(gql`
        { ...fragment1 }
        fragment fragment1 on Foo { a b c }
      `));
      assert.deepEqual(Object.keys(writes[1]), ['rootId', 'result', 'document', 'variables']);
      assert.equal(writes[1].rootId, 'bar');
      assert.deepEqual(writes[1].result, { foo: { d: 4, e: 5, bar: { f: 6, g: 7 } } });
      assert.deepEqual(writes[1].variables, { id: 7 });
      assert.equal(print(writes[1].document), print(gql`
        { ...fragment2 }
        fragment fragment1 on Foo { a b c }
        fragment fragment2 on Bar { foo(id: $id) { d e bar { f g } } }
      `));
    });
  });

  describe('write then read', () => {
    it('will write data locally which will then be read back', () => {
      const data: any = {
        'foo': {
          __typename: 'Foo',
          a: 1,
          b: 2,
          c: 3,
          bar: {
            type: 'id',
            id: '$foo.bar',
            generated: true,
          },
        },
        '$foo.bar': {
          __typename: 'Bar',
          d: 4,
          e: 5,
          f: 6,
        },
      };

      const proxy = new TransactionDataProxy(data, { addTypename: true });

      assert.deepEqual(
        proxy.readFragment({ id: 'foo', fragment: gql`fragment x on Foo { a b c bar { d e f } }` }),
        { __typename: 'Foo', a: 1, b: 2, c: 3, bar: { __typename: 'Bar', d: 4, e: 5, f: 6 } },
      );

      proxy.writeFragment({
        id: 'foo',
        fragment: gql`fragment x on Foo { a }`,
        data: { a: 7 },
      });

      assert.deepEqual(
        proxy.readFragment({ id: 'foo', fragment: gql`fragment x on Foo { a b c bar { d e f } }` }),
        { __typename: 'Foo', a: 7, b: 2, c: 3, bar: { __typename: 'Bar', d: 4, e: 5, f: 6 } },
      );

      proxy.writeFragment({
        id: 'foo',
        fragment: gql`fragment x on Foo { bar { d } }`,
        data: { __typename: 'Foo', bar: { __typename: 'Bar', d: 8 } },
      });

      assert.deepEqual(
        proxy.readFragment({ id: 'foo', fragment: gql`fragment x on Foo { a b c bar { d e f } }` }),
        { __typename: 'Foo', a: 7, b: 2, c: 3, bar: { __typename: 'Bar', d: 8, e: 5, f: 6 } },
      );

      proxy.writeFragment({
        id: '$foo.bar',
        fragment: gql`fragment y on Bar { e }`,
        data: { __typename: 'Bar', e: 9 },
      });

      assert.deepEqual(
        proxy.readFragment({ id: 'foo', fragment: gql`fragment x on Foo { a b c bar { d e f } }` }),
        { __typename: 'Foo', a: 7, b: 2, c: 3, bar: { __typename: 'Bar', d: 8, e: 9, f: 6 } },
      );

      assert.deepEqual((proxy as any).data, {
        'foo': {
          __typename: 'Foo',
          a: 7,
          b: 2,
          c: 3,
          bar: {
            type: 'id',
            id: '$foo.bar',
            generated: true,
          },
        },
        '$foo.bar': {
          __typename: 'Bar',
          d: 8,
          e: 9,
          f: 6,
        },
      });

      assert.deepEqual(data, {
        'foo': {
          __typename: 'Foo',
          a: 1,
          b: 2,
          c: 3,
          bar: {
            type: 'id',
            id: '$foo.bar',
            generated: true,
          },
        },
        '$foo.bar': {
          __typename: 'Bar',
          d: 4,
          e: 5,
          f: 6,
        },
      });
    });

    it('will write data to a specific id', () => {
      const data = {};
      const proxy = new TransactionDataProxy(data, { dataIdFromObject : (o: any) => o.id, addTypename: true });

      proxy.writeQuery({
        query: gql`{ a b foo { c d bar { id e f } } }`,
        data: { a: 1, b: 2, foo: { __typename: 'Foo', c: 3, d: 4, bar: { __typename: 'Bar', id: 'foobar', e: 5, f: 6 } } },
      });

      assert.deepEqual(
        proxy.readQuery({ query: gql`{ a b foo { c d bar { id e f } } }` }),
        { a: 1, b: 2, foo: { __typename: 'Foo', c: 3, d: 4, bar: { __typename: 'Bar', id: 'foobar', e: 5, f: 6 } } },
      );

      assert.deepEqual((proxy as any).data, {
        'ROOT_QUERY': {
          a: 1,
          b: 2,
          foo: {
            type: 'id',
            id: '$ROOT_QUERY.foo',
            generated: true,
          },
        },
        '$ROOT_QUERY.foo': {
          __typename: 'Foo',
          c: 3,
          d: 4,
          bar: {
            type: 'id',
            id: 'foobar',
            generated: false,
          },
        },
        'foobar': {
          __typename: 'Bar',
          id: 'foobar',
          e: 5,
          f: 6,
        },
      });

      assert.deepEqual(data, {});
    });
  });
});
