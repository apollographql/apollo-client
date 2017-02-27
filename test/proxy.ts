import { assert } from 'chai';
import { createStore } from 'redux';
import gql from 'graphql-tag';
import { print } from 'graphql-tag/printer';
import { createApolloStore } from '../src/store';
import { ReduxDataProxy, TransactionDataProxy } from '../src/data/proxy';

describe('ReduxDataProxy', () => {
  function createDataProxy({
    initialState,
    dataIdFromObject,
  }: {
    initialState?: any,
    dataIdFromObject?: (object: any) => string | null,
  } = {}) {
    const store = createApolloStore({
      initialState,
      config: { dataIdFromObject },
    });
    return new ReduxDataProxy(store, ({ apollo }) => apollo);
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

      assert.deepEqual(proxy.readQuery(gql`{ a }`), { a: 1 });
      assert.deepEqual(proxy.readQuery(gql`{ b c }`), { b: 2, c: 3 });
      assert.deepEqual(proxy.readQuery(gql`{ a b c }`), { a: 1, b: 2, c: 3 });
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
        proxy.readQuery(gql`{ a d { e } }`),
        { a: 1, d: { e: 4 } },
      );
      assert.deepEqual(
        proxy.readQuery(gql`{ a d { e h { i } } }`),
        { a: 1, d: { e: 4, h: { i: 7 } } },
      );
      assert.deepEqual(
        proxy.readQuery(gql`{ a b c d { e f g h { i j k } } }`),
        { a: 1, b: 2, c: 3, d: { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } } },
      );
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

      assert.deepEqual(proxy.readQuery(
        gql`query ($literal: Boolean, $value: Int) {
          a: field(literal: true, value: 42)
          b: field(literal: $literal, value: $value)
        }`,
        {
          literal: false,
          value: 42,
        },
      ), { a: 1, b: 2 });
    });
  });

  describe('readFragment', () => {
    it('will throw an error when there is no fragment', () => {
      const proxy = createDataProxy();

      assert.throws(() => {
        proxy.readFragment('x', gql`query { a b c }`);
      }, 'Found a query operation. No operations are allowed when using a fragment as a query. Only fragments are allowed.');
      assert.throws(() => {
        proxy.readFragment('x', gql`schema { query: Query }`);
      }, 'Found 0 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
    });

    it('will throw an error when there is more than one fragment but no fragment name', () => {
      const proxy = createDataProxy();

      assert.throws(() => {
        proxy.readFragment('x', gql`fragment a on A { a } fragment b on B { b }`);
      }, 'Found 2 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
      assert.throws(() => {
        proxy.readFragment('x', gql`fragment a on A { a } fragment b on B { b } fragment c on C { c }`);
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
                __typename: 'Type2',
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
                __typename: 'Type3',
                i: 7,
                j: 8,
                k: 9,
              },
            },
          },
        },
      });

      assert.deepEqual(
        proxy.readFragment('foo', gql`fragment fragmentFoo on Foo { e h { i } }`),
        { e: 4, h: { i: 7 } },
      );
      assert.deepEqual(
        proxy.readFragment('foo', gql`fragment fragmentFoo on Foo { e f g h { i j k } }`),
        { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } },
      );
      assert.deepEqual(
        proxy.readFragment('bar', gql`fragment fragmentBar on Bar { i }`),
        { i: 7 },
      );
      assert.deepEqual(
        proxy.readFragment('bar', gql`fragment fragmentBar on Bar { i j k }`),
        { i: 7, j: 8, k: 9 },
      );
      assert.deepEqual(
        proxy.readFragment(
          'foo',
          gql`fragment fragmentFoo on Foo { e f g h { i j k } } fragment fragmentBar on Bar { i j k }`,
          'fragmentFoo',
        ),
        { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } },
      );
      assert.deepEqual(
        proxy.readFragment(
          'bar',
          gql`fragment fragmentFoo on Foo { e f g h { i j k } } fragment fragmentBar on Bar { i j k }`,
          'fragmentBar',
        ),
        { i: 7, j: 8, k: 9 },
      );
    });

    it('will read some data from the store with variables', () => {
      const proxy = createDataProxy({
        initialState: {
          apollo: {
            data: {
              'foo': {
                __typename: 'Type1',
                'field({"literal":true,"value":42})': 1,
                'field({"literal":false,"value":42})': 2,
              },
            },
          },
        },
      });

      assert.deepEqual(proxy.readFragment(
        'foo',
        gql`
          fragment foo on Foo {
            a: field(literal: true, value: 42)
            b: field(literal: $literal, value: $value)
          }
        `,
        undefined,
        {
          literal: false,
          value: 42,
        },
      ), { a: 1, b: 2 });
    });

    it('will return null when an id that can’t be found is provided', () => {
      const client1 = createDataProxy();
      const client2 = createDataProxy({
        initialState: {
          apollo: {
            data: {
              'bar': { __typename: 'Type1', a: 1, b: 2, c: 3 },
            },
          },
        },
      });
      const client3 = createDataProxy({
        initialState: {
          apollo: {
            data: {
              'foo': { __typename: 'Type1', a: 1, b: 2, c: 3 },
            },
          },
        },
      });

      assert.equal(client1.readFragment('foo', gql`fragment fooFragment on Foo { a b c }`), null);
      assert.equal(client2.readFragment('foo', gql`fragment fooFragment on Foo { a b c }`), null);
      assert.deepEqual(client3.readFragment('foo', gql`fragment fooFragment on Foo { a b c }`), { a: 1, b: 2, c: 3 });
    });
  });

  describe('writeQuery', () => {
    it('will write some data to the store', () => {
      const proxy = createDataProxy();

      proxy.writeQuery({ a: 1 }, gql`{ a }`);

      assert.deepEqual((proxy as any).store.getState().apollo.data, {
        'ROOT_QUERY': {
          a: 1,
        },
      });

      proxy.writeQuery({ b: 2, c: 3 }, gql`{ b c }`);

      assert.deepEqual((proxy as any).store.getState().apollo.data, {
        'ROOT_QUERY': {
          a: 1,
          b: 2,
          c: 3,
        },
      });

      proxy.writeQuery({ a: 4, b: 5, c: 6 }, gql`{ a b c }`);

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

      proxy.writeQuery(
        { a: 1, d: { e: 4 } },
        gql`{ a d { e } }`,
      );

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

      proxy.writeQuery(
        { a: 1, d: { h: { i: 7 } } },
        gql`{ a d { h { i } } }`,
      );

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

      proxy.writeQuery(
        { a: 1, b: 2, c: 3, d: { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } } },
        gql`{ a b c d { e f g h { i j k } } }`,
      );

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

      proxy.writeQuery(
        {
          a: 1,
          b: 2,
        },
        gql`
          query ($literal: Boolean, $value: Int) {
            a: field(literal: true, value: 42)
            b: field(literal: $literal, value: $value)
          }
        `,
        {
          literal: false,
          value: 42,
        },
      );

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
        proxy.writeFragment({}, 'x', gql`query { a b c }`);
      }, 'Found a query operation. No operations are allowed when using a fragment as a query. Only fragments are allowed.');
      assert.throws(() => {
        proxy.writeFragment({}, 'x', gql`schema { query: Query }`);
      }, 'Found 0 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
    });

    it('will throw an error when there is more than one fragment but no fragment name', () => {
      const proxy = createDataProxy();

      assert.throws(() => {
        proxy.writeFragment({}, 'x', gql`fragment a on A { a } fragment b on B { b }`);
      }, 'Found 2 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
      assert.throws(() => {
        proxy.writeFragment({}, 'x', gql`fragment a on A { a } fragment b on B { b } fragment c on C { c }`);
      }, 'Found 3 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
    });

    it('will write some deeply nested data into the store at any id', () => {
      const proxy = createDataProxy({
        dataIdFromObject: (o: any) => o.id,
      });

      proxy.writeFragment(
        { e: 4, h: { id: 'bar', i: 7 } },
        'foo',
        gql`fragment fragmentFoo on Foo { e h { i } }`,
      );

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

      proxy.writeFragment(
        { f: 5, g: 6, h: { id: 'bar', j: 8, k: 9 } },
        'foo',
        gql`fragment fragmentFoo on Foo { f g h { j k } }`,
      );

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

      proxy.writeFragment(
        { i: 10 },
        'bar',
        gql`fragment fragmentBar on Bar { i }`,
      );

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

      proxy.writeFragment(
        { j: 11, k: 12 },
        'bar',
        gql`fragment fragmentBar on Bar { j k }`,
      );

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

      proxy.writeFragment(
        { e: 4, f: 5, g: 6, h: { id: 'bar', i: 7, j: 8, k: 9 } },
        'foo',
        gql`fragment fooFragment on Foo { e f g h { i j k } } fragment barFragment on Bar { i j k }`,
        'fooFragment',
      );

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

      proxy.writeFragment(
        { i: 10, j: 11, k: 12 },
        'bar',
        gql`fragment fooFragment on Foo { e f g h { i j k } } fragment barFragment on Bar { i j k }`,
        'barFragment',
      );

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

      proxy.writeFragment(
        {
          a: 1,
          b: 2,
        },
        'foo',
        gql`
          fragment foo on Foo {
            a: field(literal: true, value: 42)
            b: field(literal: $literal, value: $value)
          }
        `,
        undefined,
        {
          literal: false,
          value: 42,
        },
      );

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
      const proxy: any = new TransactionDataProxy({});
      proxy.finish();

      assert.throws(() => {
        proxy.readQuery();
      }, 'Cannot call transaction methods after the transaction has finished.');
    });

    it('will read some data from the store', () => {
      const proxy = new TransactionDataProxy({
        'ROOT_QUERY': {
          a: 1,
          b: 2,
          c: 3,
        },
      });

      assert.deepEqual(proxy.readQuery(gql`{ a }`), { a: 1 });
      assert.deepEqual(proxy.readQuery(gql`{ b c }`), { b: 2, c: 3 });
      assert.deepEqual(proxy.readQuery(gql`{ a b c }`), { a: 1, b: 2, c: 3 });
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

      assert.deepEqual(
        proxy.readQuery(gql`{ a d { e } }`),
        { a: 1, d: { e: 4 } },
      );
      assert.deepEqual(
        proxy.readQuery(gql`{ a d { e h { i } } }`),
        { a: 1, d: { e: 4, h: { i: 7 } } },
      );
      assert.deepEqual(
        proxy.readQuery(gql`{ a b c d { e f g h { i j k } } }`),
        { a: 1, b: 2, c: 3, d: { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } } },
      );
    });

    it('will read some data from the store with variables', () => {
      const proxy = new TransactionDataProxy({
        'ROOT_QUERY': {
          'field({"literal":true,"value":42})': 1,
          'field({"literal":false,"value":42})': 2,
        },
      });

      assert.deepEqual(proxy.readQuery(
        gql`query ($literal: Boolean, $value: Int) {
          a: field(literal: true, value: 42)
          b: field(literal: $literal, value: $value)
        }`,
        {
          literal: false,
          value: 42,
        },
      ), { a: 1, b: 2 });
    });
  });

  describe('readFragment', () => {
    it('will throw an error if the transaction has finished', () => {
      const proxy: any = new TransactionDataProxy({});
      proxy.finish();

      assert.throws(() => {
        proxy.readFragment();
      }, 'Cannot call transaction methods after the transaction has finished.');
    });

    it('will throw an error when there is no fragment', () => {
      const proxy = new TransactionDataProxy({});

      assert.throws(() => {
        proxy.readFragment('x', gql`query { a b c }`);
      }, 'Found a query operation. No operations are allowed when using a fragment as a query. Only fragments are allowed.');
      assert.throws(() => {
        proxy.readFragment('x', gql`schema { query: Query }`);
      }, 'Found 0 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
    });

    it('will throw an error when there is more than one fragment but no fragment name', () => {
      const proxy = new TransactionDataProxy({});

      assert.throws(() => {
        proxy.readFragment('x', gql`fragment a on A { a } fragment b on B { b }`);
      }, 'Found 2 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
      assert.throws(() => {
        proxy.readFragment('x', gql`fragment a on A { a } fragment b on B { b } fragment c on C { c }`);
      }, 'Found 3 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
    });

    it('will read some deeply nested data from the store at any id', () => {
      const proxy = new TransactionDataProxy({
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
          __typename: 'Type2',
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
          __typename: 'Type3',
          i: 7,
          j: 8,
          k: 9,
        },
      });

      assert.deepEqual(
        proxy.readFragment('foo', gql`fragment fragmentFoo on Foo { e h { i } }`),
        { e: 4, h: { i: 7 } },
      );
      assert.deepEqual(
        proxy.readFragment('foo', gql`fragment fragmentFoo on Foo { e f g h { i j k } }`),
        { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } },
      );
      assert.deepEqual(
        proxy.readFragment('bar', gql`fragment fragmentBar on Bar { i }`),
        { i: 7 },
      );
      assert.deepEqual(
        proxy.readFragment('bar', gql`fragment fragmentBar on Bar { i j k }`),
        { i: 7, j: 8, k: 9 },
      );
      assert.deepEqual(
        proxy.readFragment(
          'foo',
          gql`fragment fragmentFoo on Foo { e f g h { i j k } } fragment fragmentBar on Bar { i j k }`,
          'fragmentFoo',
        ),
        { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } },
      );
      assert.deepEqual(
        proxy.readFragment(
          'bar',
          gql`fragment fragmentFoo on Foo { e f g h { i j k } } fragment fragmentBar on Bar { i j k }`,
          'fragmentBar',
        ),
        { i: 7, j: 8, k: 9 },
      );
    });

    it('will read some data from the store with variables', () => {
      const proxy = new TransactionDataProxy({
        'foo': {
          __typename: 'Type1',
          'field({"literal":true,"value":42})': 1,
          'field({"literal":false,"value":42})': 2,
        },
      });

      assert.deepEqual(proxy.readFragment(
        'foo',
        gql`
          fragment foo on Foo {
            a: field(literal: true, value: 42)
            b: field(literal: $literal, value: $value)
          }
        `,
        undefined,
        {
          literal: false,
          value: 42,
        },
      ), { a: 1, b: 2 });
    });

    it('will return null when an id that can’t be found is provided', () => {
      const client1 = new TransactionDataProxy({});
      const client2 = new TransactionDataProxy({
        'bar': { __typename: 'Type1', a: 1, b: 2, c: 3 },
      });
      const client3 = new TransactionDataProxy({
        'foo': { __typename: 'Type1', a: 1, b: 2, c: 3 },
      });

      assert.equal(client1.readFragment('foo', gql`fragment fooFragment on Foo { a b c }`), null);
      assert.equal(client2.readFragment('foo', gql`fragment fooFragment on Foo { a b c }`), null);
      assert.deepEqual(client3.readFragment('foo', gql`fragment fooFragment on Foo { a b c }`), { a: 1, b: 2, c: 3 });
    });
  });

  describe('writeQuery', () => {
    it('will throw an error if the transaction has finished', () => {
      const proxy: any = new TransactionDataProxy({});
      proxy.finish();

      assert.throws(() => {
        proxy.writeQuery();
      }, 'Cannot call transaction methods after the transaction has finished.');
    });

    it('will create writes that get returned when finished', () => {
      const proxy = new TransactionDataProxy({});

      proxy.writeQuery(
        { a: 1, b: 2, c: 3 },
        gql`{ a b c }`,
      );

      proxy.writeQuery(
        { foo: { d: 4, e: 5, bar: { f: 6, g: 7 } } },
        gql`{ foo(id: $id) { d e bar { f g } } }`,
        { id: 7 },
      );

      const writes = proxy.finish();

      assert.deepEqual(writes, [
        {
          rootId: 'ROOT_QUERY',
          result: { a: 1, b: 2, c: 3 },
          document: gql`{ a b c }`,
          variables: {},
        },
        {
          rootId: 'ROOT_QUERY',
          result: { foo: { d: 4, e: 5, bar: { f: 6, g: 7 } } },
          document: gql`{ foo(id: $id) { d e bar { f g } } }`,
          variables: { id: 7 },
        },
      ]);
    });
  });

  describe('writeFragment', () => {
    it('will throw an error if the transaction has finished', () => {
      const proxy: any = new TransactionDataProxy({});
      proxy.finish();

      assert.throws(() => {
        proxy.writeFragment();
      }, 'Cannot call transaction methods after the transaction has finished.');
    });

    it('will create writes that get returned when finished', () => {
      const proxy = new TransactionDataProxy({});

      proxy.writeFragment(
        { a: 1, b: 2, c: 3 },
        'foo',
        gql`fragment fragment1 on Foo { a b c }`,
      );

      proxy.writeFragment(
        { foo: { d: 4, e: 5, bar: { f: 6, g: 7 } } },
        'bar',
        gql`
          fragment fragment1 on Foo { a b c }
          fragment fragment2 on Bar { foo(id: $id) { d e bar { f g } } }
        `,
        'fragment2',
        { id: 7 },
      );

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
});
