import { assert } from 'chai';
import gql from 'graphql-tag';
import { Store } from '../src/store';
import ApolloClient from '../src/ApolloClient';

describe('ApolloClient', () => {
  describe('read', () => {
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

      assert.deepEqual(client.read({ selection: gql`{ a }` }), { a: 1 });
      assert.deepEqual(client.read({ selection: gql`{ b c }` }), { b: 2, c: 3 });
      assert.deepEqual(client.read({ selection: gql`{ a b c }` }), { a: 1, b: 2, c: 3 });
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
        client.read({ selection: gql`{ a d { e } }` }),
        { a: 1, d: { e: 4 } },
      );
      assert.deepEqual(
        client.read({ selection: gql`{ a d { e h { i } } }` }),
        { a: 1, d: { e: 4, h: { i: 7 } } },
      );
      assert.deepEqual(
        client.read({ selection: gql`{ a b c d { e f g h { i j k } } }` }),
        { a: 1, b: 2, c: 3, d: { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } } },
      );
    });

    it('will read some deeply nested data from state at any id', () => {
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
        client.read({ selection: gql`{ e h { i } }`, id: 'foo' }),
        { e: 4, h: { i: 7 } },
      );
      assert.deepEqual(
        client.read({ selection: gql`{ e f g h { i j k } }`, id: 'foo' }),
        { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } },
      );
      assert.deepEqual(
        client.read({ selection: gql`{ i }`, id: 'bar' }),
        { i: 7 },
      );
      assert.deepEqual(
        client.read({ selection: gql`{ i j k }`, id: 'bar' }),
        { i: 7, j: 8, k: 9 },
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

      assert.deepEqual(client.read({
        selection: gql`{
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

      assert.deepEqual(client.read({ selection: gql`{ a }`, returnPartialData: true }), { a: 1 });
      assert.deepEqual(client.read({ selection: gql`{ b c }`, returnPartialData: true }), { b: 2, c: 3 });
      assert.deepEqual(client.read({ selection: gql`{ a b c }`, returnPartialData: true }), { a: 1, b: 2, c: 3 });
      assert.deepEqual(client.read({ selection: gql`{ a d }`, returnPartialData: true }), { a: 1 });
      assert.deepEqual(client.read({ selection: gql`{ b c d }`, returnPartialData: true }), { b: 2, c: 3 });
      assert.deepEqual(client.read({ selection: gql`{ a b c d }`, returnPartialData: true }), { a: 1, b: 2, c: 3 });
    });
  });
});
