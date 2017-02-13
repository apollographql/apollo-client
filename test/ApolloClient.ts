import { assert } from 'chai';
import gql from 'graphql-tag';
import { Store } from '../src/store';
import ApolloClient from '../src/ApolloClient';

describe('ApolloClient', () => {
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

      assert.deepEqual(client.readQuery({ query: gql`{ a }` }), { a: 1 });
      assert.deepEqual(client.readQuery({ query: gql`{ b c }` }), { b: 2, c: 3 });
      assert.deepEqual(client.readQuery({ query: gql`{ a b c }` }), { a: 1, b: 2, c: 3 });
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

    it('will read some parital data from state', () => {
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

      assert.deepEqual(client.readQuery({ query: gql`{ a }`, returnPartialData: true }), { a: 1 });
      assert.deepEqual(client.readQuery({ query: gql`{ b c }`, returnPartialData: true }), { b: 2, c: 3 });
      assert.deepEqual(client.readQuery({ query: gql`{ a b c }`, returnPartialData: true }), { a: 1, b: 2, c: 3 });
      assert.deepEqual(client.readQuery({ query: gql`{ a d }`, returnPartialData: true }), { a: 1 });
      assert.deepEqual(client.readQuery({ query: gql`{ b c d }`, returnPartialData: true }), { b: 2, c: 3 });
      assert.deepEqual(client.readQuery({ query: gql`{ a b c d }`, returnPartialData: true }), { a: 1, b: 2, c: 3 });
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
        client.readFragment({ fragment: gql`fragment foo on Foo { e h { i } }`, id: 'foo' }),
        { e: 4, h: { i: 7 } },
      );
      assert.deepEqual(
        client.readFragment({ fragment: gql`fragment foo on Foo { e f g h { i j k } }`, id: 'foo' }),
        { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } },
      );
      assert.deepEqual(
        client.readFragment({ fragment: gql`fragment bar on Bar { i }`, id: 'bar' }),
        { i: 7 },
      );
      assert.deepEqual(
        client.readFragment({ fragment: gql`fragment bar on Bar { i j k }`, id: 'bar' }),
        { i: 7, j: 8, k: 9 },
      );
      assert.deepEqual(
        client.readFragment({
          fragment: gql`fragment foo on Foo { e f g h { i j k } } fragment bar on Bar { i j k }`,
          id: 'foo',
          fragmentName: 'foo',
        }),
        { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } },
      );
      assert.deepEqual(
        client.readFragment({
          fragment: gql`fragment foo on Foo { e f g h { i j k } } fragment bar on Bar { i j k }`,
          id: 'bar',
          fragmentName: 'bar',
        }),
        { i: 7, j: 8, k: 9 },
      );
    });

    it('will read some parital data from state', () => {
      const client = new ApolloClient({
        initialState: {
          apollo: {
            data: {
              'x': {
                __typename: 'Type1',
                a: 1,
                b: 2,
                c: 3,
              },
            },
          },
        },
      });

      assert.deepEqual(
        client.readFragment({ fragment: gql`fragment y on Y { a }`, returnPartialData: true, id: 'x' }),
        { a: 1 },
      );
      assert.deepEqual(
        client.readFragment({ fragment: gql`fragment y on Y { b c }`, returnPartialData: true, id: 'x' }),
        { b: 2, c: 3 },
      );
      assert.deepEqual(
        client.readFragment({ fragment: gql`fragment y on Y { a b c }`, returnPartialData: true, id: 'x' }),
        { a: 1, b: 2, c: 3 },
      );
      assert.deepEqual(
        client.readFragment({ fragment: gql`fragment y on Y { a d }`, returnPartialData: true, id: 'x' }),
        { a: 1 },
      );
      assert.deepEqual(
        client.readFragment({ fragment: gql`fragment y on Y { b c d }`, returnPartialData: true, id: 'x' }),
        { b: 2, c: 3 },
      );
      assert.deepEqual(
        client.readFragment({ fragment: gql`fragment y on Y { a b c d }`, returnPartialData: true, id: 'x' }),
        { a: 1, b: 2, c: 3 },
      );
    });

    it('will throw an error when there is no fragment', () => {
      const client = new ApolloClient();

      assert.throws(() => {
        client.readFragment({ id: 'x', fragment: gql`query { a b c }` });
      }, 'Found 0 fragments when exactly 1 was expected because `fragmentName` was not provided.');
      assert.throws(() => {
        client.readFragment({ id: 'x', fragment: gql`schema { query: Query }` });
      }, 'Found 0 fragments when exactly 1 was expected because `fragmentName` was not provided.');
    });

    it('will throw an error when there is more than one fragment but no fragment name', () => {
      const client = new ApolloClient();

      assert.throws(() => {
        client.readFragment({ id: 'x', fragment: gql`fragment a on A { a } fragment b on B { b }` });
      }, 'Found 2 fragments when exactly 1 was expected because `fragmentName` was not provided.');
      assert.throws(() => {
        client.readFragment({ id: 'x', fragment: gql`fragment a on A { a } fragment b on B { b } fragment c on C { c }` });
      }, 'Found 3 fragments when exactly 1 was expected because `fragmentName` was not provided.');
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
  });
});
