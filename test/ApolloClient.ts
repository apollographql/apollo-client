import { assert } from 'chai';
import gql from 'graphql-tag';
import { Store } from '../src/store';
import ApolloClient from '../src/ApolloClient';

describe('ApolloClient', () => {
  describe('readQuery', () => {
    it('will read some data from the store', () => {
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

      assert.deepEqual(client.readQuery({ query: gql`{ a }` }), { a: 1 });
      assert.deepEqual(client.readQuery({ query: gql`{ b c }` }), { b: 2, c: 3 });
      assert.deepEqual(client.readQuery({ query: gql`{ a b c }` }), { a: 1, b: 2, c: 3 });
    });

    it('will read some deeply nested data from the store', () => {
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
        client.readQuery({ query: gql`{ a d { e } }` }),
        { a: 1, d: { e: 4 } },
      );
      assert.deepEqual(
        client.readQuery({ query: gql`{ a d { e h { i } } }` }),
        { a: 1, d: { e: 4, h: { i: 7 } } },
      );
      assert.deepEqual(
        client.readQuery({ query: gql`{ a b c d { e f g h { i j k } } }` }),
        { a: 1, b: 2, c: 3, d: { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } } },
      );
    });

    it('will read some data from the store with variables', () => {
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

      assert.deepEqual(client.readQuery({
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
      const client = new ApolloClient();

      assert.throws(() => {
        client.readFragment({ id: 'x', fragment: gql`query { a b c }` });
      }, 'Found a query operation. No operations are allowed when using a fragment as a query. Only fragments are allowed.');
      assert.throws(() => {
        client.readFragment({ id: 'x', fragment: gql`schema { query: Query }` });
      }, 'Found 0 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
    });

    it('will throw an error when there is more than one fragment but no fragment name', () => {
      const client = new ApolloClient();

      assert.throws(() => {
        client.readFragment({ id: 'x', fragment: gql`fragment a on A { a } fragment b on B { b }` });
      }, 'Found 2 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
      assert.throws(() => {
        client.readFragment({ id: 'x', fragment: gql`fragment a on A { a } fragment b on B { b } fragment c on C { c }` });
      }, 'Found 3 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
    });

    it('will read some deeply nested data from the store at any id', () => {
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
        client.readFragment({ id: 'foo', fragment: gql`fragment fragmentFoo on Foo { e h { i } }` }),
        { e: 4, h: { i: 7 } },
      );
      assert.deepEqual(
        client.readFragment({ id: 'foo', fragment: gql`fragment fragmentFoo on Foo { e f g h { i j k } }` }),
        { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } },
      );
      assert.deepEqual(
        client.readFragment({ id: 'bar', fragment: gql`fragment fragmentBar on Bar { i }` }),
        { i: 7 },
      );
      assert.deepEqual(
        client.readFragment({ id: 'bar', fragment: gql`fragment fragmentBar on Bar { i j k }` }),
        { i: 7, j: 8, k: 9 },
      );
      assert.deepEqual(
        client.readFragment({
          id: 'foo',
          fragment: gql`fragment fragmentFoo on Foo { e f g h { i j k } } fragment fragmentBar on Bar { i j k }`,
          fragmentName: 'fragmentFoo',
        }),
        { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } },
      );
      assert.deepEqual(
        client.readFragment({
          id: 'bar',
          fragment: gql`fragment fragmentFoo on Foo { e f g h { i j k } } fragment fragmentBar on Bar { i j k }`,
          fragmentName: 'fragmentBar',
        }),
        { i: 7, j: 8, k: 9 },
      );
    });

    it('will read some data from the store with variables', () => {
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

      assert.deepEqual(client.readFragment({
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
      const client1 = new ApolloClient();
      const client2 = new ApolloClient({
        initialState: {
          apollo: {
            data: {
              'bar': { __typename: 'Type1', a: 1, b: 2, c: 3 },
            },
          },
        },
      });
      const client3 = new ApolloClient({
        initialState: {
          apollo: {
            data: {
              'foo': { __typename: 'Type1', a: 1, b: 2, c: 3 },
            },
          },
        },
      });

      assert.equal(client1.readFragment({ id: 'foo', fragment: gql`fragment fooFragment on Foo { a b c }` }), null);
      assert.equal(client2.readFragment({ id: 'foo', fragment: gql`fragment fooFragment on Foo { a b c }` }), null);
      assert.deepEqual(client3.readFragment({ id: 'foo', fragment: gql`fragment fooFragment on Foo { a b c }` }), { a: 1, b: 2, c: 3 });
    });
  });

  describe('writeQuery', () => {
    it('will write some data to the store', () => {
      const client = new ApolloClient();

      client.writeQuery({ data: { a: 1 }, query: gql`{ a }` });

      assert.deepEqual(client.store.getState().apollo.data, {
        'ROOT_QUERY': {
          a: 1,
        },
      });

      client.writeQuery({ data: { b: 2, c: 3 }, query: gql`{ b c }` });

      assert.deepEqual(client.store.getState().apollo.data, {
        'ROOT_QUERY': {
          a: 1,
          b: 2,
          c: 3,
        },
      });

      client.writeQuery({ data: { a: 4, b: 5, c: 6 }, query: gql`{ a b c }` });

      assert.deepEqual(client.store.getState().apollo.data, {
        'ROOT_QUERY': {
          a: 4,
          b: 5,
          c: 6,
        },
      });
    });

    it('will write some deeply nested data to the store', () => {
      const client = new ApolloClient();

      client.writeQuery({
        data: { a: 1, d: { e: 4 } },
        query: gql`{ a d { e } }`,
      });

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

      client.writeQuery({
        data: { a: 1, d: { h: { i: 7 } } },
        query: gql`{ a d { h { i } } }`,
      });

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

      client.writeQuery({
        data: { a: 1, b: 2, c: 3, d: { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } } },
        query: gql`{ a b c d { e f g h { i j k } } }`,
      });

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

    it('will write some data to the store with variables', () => {
      const client = new ApolloClient();

      client.writeQuery({
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

      assert.deepEqual(client.store.getState().apollo.data, {
        'ROOT_QUERY': {
          'field({"literal":true,"value":42})': 1,
          'field({"literal":false,"value":42})': 2,
        },
      });
    });
  });

  describe('writeFragment', () => {
    it('will throw an error when there is no fragment', () => {
      const client = new ApolloClient();

      assert.throws(() => {
        client.writeFragment({ data: {}, id: 'x', fragment: gql`query { a b c }` });
      }, 'Found a query operation. No operations are allowed when using a fragment as a query. Only fragments are allowed.');
      assert.throws(() => {
        client.writeFragment({ data: {}, id: 'x', fragment: gql`schema { query: Query }` });
      }, 'Found 0 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
    });

    it('will throw an error when there is more than one fragment but no fragment name', () => {
      const client = new ApolloClient();

      assert.throws(() => {
        client.writeFragment({ data: {}, id: 'x', fragment: gql`fragment a on A { a } fragment b on B { b }` });
      }, 'Found 2 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
      assert.throws(() => {
        client.writeFragment({ data: {}, id: 'x', fragment: gql`fragment a on A { a } fragment b on B { b } fragment c on C { c }` });
      }, 'Found 3 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
    });

    it('will write some deeply nested data into the store at any id', () => {
      const client = new ApolloClient({
        dataIdFromObject: (o: any) => o.id,
      });

      client.writeFragment({
        data: { e: 4, h: { id: 'bar', i: 7 } },
        id: 'foo',
        fragment: gql`fragment fragmentFoo on Foo { e h { i } }`,
      });

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

      client.writeFragment({
        data: { f: 5, g: 6, h: { id: 'bar', j: 8, k: 9 } },
        id: 'foo',
        fragment: gql`fragment fragmentFoo on Foo { f g h { j k } }`,
      });

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

      client.writeFragment({
        data: { i: 10 },
        id: 'bar',
        fragment: gql`fragment fragmentBar on Bar { i }`,
      });

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

      client.writeFragment({
        data: { j: 11, k: 12 },
        id: 'bar',
        fragment: gql`fragment fragmentBar on Bar { j k }`,
      });

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

      client.writeFragment({
        data: { e: 4, f: 5, g: 6, h: { id: 'bar', i: 7, j: 8, k: 9 } },
        id: 'foo',
        fragment: gql`fragment fooFragment on Foo { e f g h { i j k } } fragment barFragment on Bar { i j k }`,
        fragmentName: 'fooFragment',
      });

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

      client.writeFragment({
        data: { i: 10, j: 11, k: 12 },
        id: 'bar',
        fragment: gql`fragment fooFragment on Foo { e f g h { i j k } } fragment barFragment on Bar { i j k }`,
        fragmentName: 'barFragment',
      });

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

    it('will write some data to the store with variables', () => {
      const client = new ApolloClient();

      client.writeFragment({
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

      assert.deepEqual(client.store.getState().apollo.data, {
        'foo': {
          'field({"literal":true,"value":42})': 1,
          'field({"literal":false,"value":42})': 2,
        },
      });
    });
  });

  describe('write then read', () => {
    it('will write data locally which will then be read back', () => {
      const client = new ApolloClient({
        initialState: {
          apollo: {
            data: {
              'foo': {
                __typename: 'Type1',
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
                __typename: 'Type2',
                d: 4,
                e: 5,
                f: 6,
              },
            },
          },
        },
      });

      assert.deepEqual(
        client.readFragment({ id: 'foo', fragment: gql`fragment x on Foo { a b c bar { d e f } }` }),
        { a: 1, b: 2, c: 3, bar: { d: 4, e: 5, f: 6 } },
      );

      client.writeFragment({
        id: 'foo',
        fragment: gql`fragment x on Foo { a }`,
        data: { a: 7 },
      });

      assert.deepEqual(
        client.readFragment({ id: 'foo', fragment: gql`fragment x on Foo { a b c bar { d e f } }` }),
        { a: 7, b: 2, c: 3, bar: { d: 4, e: 5, f: 6 } },
      );

      client.writeFragment({
        id: 'foo',
        fragment: gql`fragment x on Foo { bar { d } }`,
        data: { bar: { d: 8 } },
      });

      assert.deepEqual(
        client.readFragment({ id: 'foo', fragment: gql`fragment x on Foo { a b c bar { d e f } }` }),
        { a: 7, b: 2, c: 3, bar: { d: 8, e: 5, f: 6 } },
      );

      client.writeFragment({
        id: '$foo.bar',
        fragment: gql`fragment y on Bar { e }`,
        data: { __typename: 'Type2', e: 9 },
      });

      assert.deepEqual(
        client.readFragment({ id: 'foo', fragment: gql`fragment x on Foo { a b c bar { d e f } }` }),
        { a: 7, b: 2, c: 3, bar: { d: 8, e: 9, f: 6 } },
      );

      assert.deepEqual(client.store.getState().apollo.data, {
        'foo': {
          __typename: 'Type1',
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
          __typename: 'Type2',
          d: 8,
          e: 9,
          f: 6,
        },
      });
    });

    it('will write data to a specific id', () => {
      const client = new ApolloClient({
        initialState: { apollo: { data: {} } },
        dataIdFromObject: (o: any) => o.id,
      });

      client.writeQuery({
        query: gql`{ a b foo { c d bar { id e f } } }`,
        data: { a: 1, b: 2, foo: { c: 3, d: 4, bar: { id: 'foobar', e: 5, f: 6 } } },
      });

      assert.deepEqual(
        client.readQuery({ query: gql`{ a b foo { c d bar { id e f } } }` }),
        { a: 1, b: 2, foo: { c: 3, d: 4, bar: { id: 'foobar', e: 5, f: 6 } } },
      );

      assert.deepEqual(client.store.getState().apollo.data, {
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
          c: 3,
          d: 4,
          bar: {
            type: 'id',
            id: 'foobar',
            generated: false,
          },
        },
        'foobar': {
          id: 'foobar',
          e: 5,
          f: 6,
        },
      });
    });
    it('will not use a default id getter if either _id or id is present when __typename is not also present', () => {
      const client = new ApolloClient({
        initialState: { apollo: { data: {} } },
      });

      client.writeQuery({
        query: gql`{ a b foo { c d bar { id e f } } }`,
        data: { a: 1, b: 2, foo: { c: 3, d: 4, bar: { __typename: 'bar', id: 'foobar', e: 5, f: 6 } } },
      });

      client.writeQuery({
        query: gql`{ g h bar { i j foo { _id k l } } }`,
        data: { g: 8, h: 9, bar: { i: 10, j: 11, foo: { _id: 'barfoo', k: 12, l: 13 } } },
      });

      assert.deepEqual(
        client.readQuery({
          query: gql`{ a b g h bar { i j foo { _id k l } } foo { c d bar { id e f } } }`,
        }), {
          a: 1,
          b: 2,
          g: 8,
          h: 9,
          bar: {
            i: 10,
            j: 11,
            foo: {
              _id: 'barfoo',
              k: 12,
              l: 13,
            },
          },
          foo: {
            c: 3,
            d: 4,
            bar: {
              id: 'foobar',
              e: 5,
              f: 6,
            },
          },
        },
      );

      assert.deepEqual(client.store.getState().apollo.data, {
        'ROOT_QUERY': {
          a: 1,
          b: 2,
          g: 8,
          h: 9,
          bar: {
            type: 'id',
            id: '$ROOT_QUERY.bar',
            generated: true,
          },
          foo: {
            type: 'id',
            id: '$ROOT_QUERY.foo',
            generated: true,
          },
        },
        '$ROOT_QUERY.foo': {
          c: 3,
          d: 4,
          bar: {
            type: 'id',
            id: 'bar:foobar',
            generated: false,
          },
        },
        '$ROOT_QUERY.bar': {
          i: 10,
          j: 11,
          foo: {
            type: 'id',
            id: '$ROOT_QUERY.bar.foo',
            generated: true,
          },
        },
        'bar:foobar': {
          id: 'foobar',
          e: 5,
          f: 6,
        },
        '$ROOT_QUERY.bar.foo': {
          _id: 'barfoo',
          k: 12,
          l: 13,
        },
      });
    });
    it('will use a default id getter if one is not specified and __typename is present along with either _id or id', () => {
      const client = new ApolloClient({
        initialState: { apollo: { data: {} } },
      });

      client.writeQuery({
        query: gql`{ a b foo { c d bar { id e f } } }`,
        data: { a: 1, b: 2, foo: { c: 3, d: 4, bar: { __typename: 'bar', id: 'foobar', e: 5, f: 6 } } },
      });

      client.writeQuery({
        query: gql`{ g h bar { i j foo { _id k l } } }`,
        data: { g: 8, h: 9, bar: { i: 10, j: 11, foo: { __typename: 'foo', _id: 'barfoo', k: 12, l: 13 } } },
      });

      assert.deepEqual(
        client.readQuery({
          query: gql`{ a b g h bar { i j foo { _id k l } } foo { c d bar { id e f } } }`,
        }), {
          a: 1,
          b: 2,
          g: 8,
          h: 9,
          bar: {
            i: 10,
            j: 11,
            foo: {
              _id: 'barfoo',
              k: 12,
              l: 13,
            },
          },
          foo: {
            c: 3,
            d: 4,
            bar: {
              id: 'foobar',
              e: 5,
              f: 6,
            },
          },
        },
      );

      assert.deepEqual(client.store.getState().apollo.data, {
        'ROOT_QUERY': {
          a: 1,
          b: 2,
          g: 8,
          h: 9,
          bar: {
            type: 'id',
            id: '$ROOT_QUERY.bar',
            generated: true,
          },
          foo: {
            type: 'id',
            id: '$ROOT_QUERY.foo',
            generated: true,
          },
        },
        '$ROOT_QUERY.foo': {
          c: 3,
          d: 4,
          bar: {
            type: 'id',
            id: 'bar:foobar',
            generated: false,
          },
        },
        '$ROOT_QUERY.bar': {
          i: 10,
          j: 11,
          foo: {
            type: 'id',
            id: 'foo:barfoo',
            generated: false,
          },
        },
        'bar:foobar': {
          id: 'foobar',
          e: 5,
          f: 6,
        },
        'foo:barfoo': {
          _id: 'barfoo',
          k: 12,
          l: 13,
        },
      });
    });
  });
});
