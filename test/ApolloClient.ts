import { assert } from 'chai';
import gql from 'graphql-tag';
import { Store } from '../src/store';
import ApolloClient from '../src/ApolloClient';

describe.only('ApolloClient', () => {
  describe('readQuery', () => {
    it('will read some data from state', () => {
      const client = new ApolloClient({
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

      assert.deepEqual(client.readQuery(gql`{ a }`), { a: 1 });
      assert.deepEqual(client.readQuery(gql`{ b c }`), { b: 2, c: 3 });
      assert.deepEqual(client.readQuery(gql`{ a b c }`), { a: 1, b: 2, c: 3 });
    });

    it('will read some deeply nested data from state', () => {
      const client = new ApolloClient({
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
        client.readQuery(gql`{ a d { e } }`),
        { a: 1, d: { e: 4 } },
      );
      assert.deepEqual(
        client.readQuery(gql`{ a d { e h { i } } }`),
        { a: 1, d: { e: 4, h: { i: 7 } } },
      );
      assert.deepEqual(
        client.readQuery(gql`{ a b c d { e f g h { i j k } } }`),
        { a: 1, b: 2, c: 3, d: { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } } },
      );
    });

    it('will read some data from state with variables', () => {
      const client = new ApolloClient({
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

      assert.deepEqual(client.readQuery(
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
    it('will read some deeply nested data from state at any id', () => {
      const client = new ApolloClient({
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
        client.readFragment('foo', gql`fragment fragmentFoo on Foo { e h { i } }`),
        { e: 4, h: { i: 7 } },
      );
      assert.deepEqual(
        client.readFragment('foo', gql`fragment fragmentFoo on Foo { e f g h { i j k } }`),
        { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } },
      );
      assert.deepEqual(
        client.readFragment('bar', gql`fragment fragmentBar on Bar { i }`),
        { i: 7 },
      );
      assert.deepEqual(
        client.readFragment('bar', gql`fragment fragmentBar on Bar { i j k }`),
        { i: 7, j: 8, k: 9 },
      );
      assert.deepEqual(
        client.readFragment(
          'foo',
          gql`fragment fragmentFoo on Foo { e f g h { i j k } } fragment fragmentBar on Bar { i j k }`,
          'fragmentFoo',
        ),
        { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } },
      );
      assert.deepEqual(
        client.readFragment(
          'bar',
          gql`fragment fragmentFoo on Foo { e f g h { i j k } } fragment fragmentBar on Bar { i j k }`,
          'fragmentBar',
        ),
        { i: 7, j: 8, k: 9 },
      );
    });

    it('will throw an error when there is no fragment', () => {
      const client = new ApolloClient();

      assert.throws(() => {
        client.readFragment('x', gql`query { a b c }`);
      }, 'Found 0 fragments. `fragmentName` must be provided when there are more then 1 fragments.');
      assert.throws(() => {
        client.readFragment('x', gql`schema { query: Query }`);
      }, 'Found 0 fragments. `fragmentName` must be provided when there are more then 1 fragments.');
    });

    it('will throw an error when there is more than one fragment but no fragment name', () => {
      const client = new ApolloClient();

      assert.throws(() => {
        client.readFragment('x', gql`fragment a on A { a } fragment b on B { b }`);
      }, 'Found 2 fragments. `fragmentName` must be provided when there are more then 1 fragments.');
      assert.throws(() => {
        client.readFragment('x', gql`fragment a on A { a } fragment b on B { b } fragment c on C { c }`);
      }, 'Found 3 fragments. `fragmentName` must be provided when there are more then 1 fragments.');
    });

    it('will read some data from state with variables', () => {
      const client = new ApolloClient({
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

      assert.deepEqual(client.readFragment(
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
  });

  describe('writeQuery', () => {
    it('will write some data to the state', () => {
      const client = new ApolloClient();

      client.writeQuery({ a: 1 }, gql`{ a }`);

      assert.deepEqual(client.store.getState().apollo.data, {
        'ROOT_QUERY': {
          a: 1,
        },
      });

      client.writeQuery({ b: 2, c: 3 }, gql`{ b c }`);

      assert.deepEqual(client.store.getState().apollo.data, {
        'ROOT_QUERY': {
          a: 1,
          b: 2,
          c: 3,
        },
      });

      client.writeQuery({ a: 4, b: 5, c: 6 }, gql`{ a b c }`);

      assert.deepEqual(client.store.getState().apollo.data, {
        'ROOT_QUERY': {
          a: 4,
          b: 5,
          c: 6,
        },
      });
    });

    it('will write some deeply nested data to state', () => {
      const client = new ApolloClient();

      client.writeQuery(
        { a: 1, d: { e: 4 } },
        gql`{ a d { e } }`,
      );

      assert.deepEqual(client.store.getState().apollo.data, {
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

      client.writeQuery(
        { a: 1, d: { h: { i: 7 } } },
        gql`{ a d { h { i } } }`,
      );

      assert.deepEqual(client.store.getState().apollo.data, {
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

      client.writeQuery(
        { a: 1, b: 2, c: 3, d: { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } } },
        gql`{ a b c d { e f g h { i j k } } }`,
      );

      assert.deepEqual(client.store.getState().apollo.data, {
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

    it('will write some data to state with variables', () => {
      const client = new ApolloClient();

      client.writeQuery(
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

      assert.deepEqual(client.store.getState().apollo.data, {
        'ROOT_QUERY': {
          'field({"literal":true,"value":42})': 1,
          'field({"literal":false,"value":42})': 2,
        },
      });
    });
  });

  describe('writeFragment', () => {
    it('will write some deeply nested data into state at any id', () => {
      const client = new ApolloClient({
        dataIdFromObject: (o: any) => o.id,
      });

      client.writeFragment(
        { e: 4, h: { id: 'bar', i: 7 } },
        'foo',
        gql`fragment fragmentFoo on Foo { e h { i } }`,
      );

      assert.deepEqual(client.store.getState().apollo.data, {
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

      client.writeFragment(
        { f: 5, g: 6, h: { id: 'bar', j: 8, k: 9 } },
        'foo',
        gql`fragment fragmentFoo on Foo { f g h { j k } }`,
      );

      assert.deepEqual(client.store.getState().apollo.data, {
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

      client.writeFragment(
        { i: 10 },
        'bar',
        gql`fragment fragmentBar on Bar { i }`,
      );

      assert.deepEqual(client.store.getState().apollo.data, {
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

      client.writeFragment(
        { j: 11, k: 12 },
        'bar',
        gql`fragment fragmentBar on Bar { j k }`,
      );

      assert.deepEqual(client.store.getState().apollo.data, {
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

      client.writeFragment(
        { e: 4, f: 5, g: 6, h: { id: 'bar', i: 7, j: 8, k: 9 } },
        'foo',
        gql`fragment fooFragment on Foo { e f g h { i j k } } fragment barFragment on Bar { i j k }`,
        'fooFragment',
      );

      assert.deepEqual(client.store.getState().apollo.data, {
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

      client.writeFragment(
        { i: 10, j: 11, k: 12 },
        'bar',
        gql`fragment fooFragment on Foo { e f g h { i j k } } fragment barFragment on Bar { i j k }`,
        'barFragment',
      );

      assert.deepEqual(client.store.getState().apollo.data, {
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

    it('will throw an error when there is no fragment', () => {
      const client = new ApolloClient();

      assert.throws(() => {
        client.writeFragment({}, 'x', gql`query { a b c }`);
      }, 'Found 0 fragments. `fragmentName` must be provided when there are more then 1 fragments.');
      assert.throws(() => {
        client.writeFragment({}, 'x', gql`schema { query: Query }`);
      }, 'Found 0 fragments. `fragmentName` must be provided when there are more then 1 fragments.');
    });

    it('will throw an error when there is more than one fragment but no fragment name', () => {
      const client = new ApolloClient();

      assert.throws(() => {
        client.writeFragment({}, 'x', gql`fragment a on A { a } fragment b on B { b }`);
      }, 'Found 2 fragments. `fragmentName` must be provided when there are more then 1 fragments.');
      assert.throws(() => {
        client.writeFragment({}, 'x', gql`fragment a on A { a } fragment b on B { b } fragment c on C { c }`);
      }, 'Found 3 fragments. `fragmentName` must be provided when there are more then 1 fragments.');
    });

    it('will write some data to state with variables', () => {
      const client = new ApolloClient();

      client.writeFragment(
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

      assert.deepEqual(client.store.getState().apollo.data, {
        'foo': {
          'field({"literal":true,"value":42})': 1,
          'field({"literal":false,"value":42})': 2,
        },
      });
    });
  });
});
