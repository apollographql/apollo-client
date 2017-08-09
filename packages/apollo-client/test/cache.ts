import { assert } from 'chai';
import gql from 'graphql-tag';

import InMemoryCache from '../src/cache-inmemory';
import { DataProxy } from 'apollo-cache-core';

import { ApolloReducerConfig } from '../src/data/types';
import { toIdValue } from '../src/data/storeUtils';

describe('Cache', () => {
  function createCache(
    {
      initialState,
      config,
    }: {
      initialState?: any;
      config?: ApolloReducerConfig;
    } = {},
  ): DataProxy {
    return new InMemoryCache(
      // XXX this is the old format. The tests need to be updated but since it is mapped down
      initialState ? initialState.apollo.data : {},
      config || { addTypename: false },
    );
  }

  describe('readQuery', () => {
    it('will read some data from the store', () => {
      const proxy = createCache({
        initialState: {
          apollo: {
            data: {
              ROOT_QUERY: {
                a: 1,
                b: 2,
                c: 3,
              },
            },
          },
        },
      });

      assert.deepEqual<{}>(
        proxy.readQuery({
          query: gql`
            {
              a
            }
          `,
        }),
        { a: 1 },
      );
      assert.deepEqual<{}>(
        proxy.readQuery({
          query: gql`
            {
              b
              c
            }
          `,
        }),
        { b: 2, c: 3 },
      );
      assert.deepEqual<{}>(
        proxy.readQuery({
          query: gql`
            {
              a
              b
              c
            }
          `,
        }),
        { a: 1, b: 2, c: 3 },
      );
    });

    it('will read some deeply nested data from the store', () => {
      const proxy = createCache({
        initialState: {
          apollo: {
            data: {
              ROOT_QUERY: {
                a: 1,
                b: 2,
                c: 3,
                d: {
                  type: 'id',
                  id: 'foo',
                  generated: false,
                },
              },
              foo: {
                e: 4,
                f: 5,
                g: 6,
                h: {
                  type: 'id',
                  id: 'bar',
                  generated: false,
                },
              },
              bar: {
                i: 7,
                j: 8,
                k: 9,
              },
            },
          },
        },
      });

      assert.deepEqual<{}>(
        proxy.readQuery({
          query: gql`
            {
              a
              d {
                e
              }
            }
          `,
        }),
        { a: 1, d: { e: 4 } },
      );
      assert.deepEqual<{}>(
        proxy.readQuery({
          query: gql`
            {
              a
              d {
                e
                h {
                  i
                }
              }
            }
          `,
        }),
        { a: 1, d: { e: 4, h: { i: 7 } } },
      );
      assert.deepEqual<{}>(
        proxy.readQuery({
          query: gql`
            {
              a
              b
              c
              d {
                e
                f
                g
                h {
                  i
                  j
                  k
                }
              }
            }
          `,
        }),
        { a: 1, b: 2, c: 3, d: { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } } },
      );
    });

    it('will read data using custom resolvers', () => {
      const proxy = createCache({
        initialState: {
          apollo: {
            data: {
              ROOT_QUERY: {
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
          addTypename: false,
        },
      });

      const queryResult = proxy.readQuery({
        query: gql`
          query {
            thing(id: "foo") {
              a
              b
              c
            }
          }
        `,
      });

      assert.deepEqual<{}>(queryResult, {
        thing: { a: 1, b: '2', c: null },
      });
    });

    it('will read some data from the store with variables', () => {
      const proxy = createCache({
        initialState: {
          apollo: {
            data: {
              ROOT_QUERY: {
                'field({"literal":true,"value":42})': 1,
                'field({"literal":false,"value":42})': 2,
              },
            },
          },
        },
      });

      assert.deepEqual<{}>(
        proxy.readQuery({
          query: gql`
            query($literal: Boolean, $value: Int) {
              a: field(literal: true, value: 42)
              b: field(literal: $literal, value: $value)
            }
          `,
          variables: {
            literal: false,
            value: 42,
          },
        }),
        { a: 1, b: 2 },
      );
    });
  });

  describe('readFragment', () => {
    it('will throw an error when there is no fragment', () => {
      const proxy = createCache();

      assert.throws(() => {
        proxy.readFragment({
          id: 'x',
          fragment: gql`
            query {
              a
              b
              c
            }
          `,
        });
      }, 'Found a query operation. No operations are allowed when using a fragment as a query. Only fragments are allowed.');
      assert.throws(() => {
        proxy.readFragment({
          id: 'x',
          fragment: gql`
            schema {
              query: Query
            }
          `,
        });
      }, 'Found 0 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
    });

    it('will throw an error when there is more than one fragment but no fragment name', () => {
      const proxy = createCache();

      assert.throws(() => {
        proxy.readFragment({
          id: 'x',
          fragment: gql`
            fragment a on A {
              a
            }

            fragment b on B {
              b
            }
          `,
        });
      }, 'Found 2 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
      assert.throws(() => {
        proxy.readFragment({
          id: 'x',
          fragment: gql`
            fragment a on A {
              a
            }

            fragment b on B {
              b
            }

            fragment c on C {
              c
            }
          `,
        });
      }, 'Found 3 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
    });

    it('will read some deeply nested data from the store at any id', () => {
      const proxy = createCache({
        initialState: {
          apollo: {
            data: {
              ROOT_QUERY: {
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
              foo: {
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
              bar: {
                __typename: 'Bar',
                i: 7,
                j: 8,
                k: 9,
              },
            },
          },
        },
      });

      assert.deepEqual<{} | null>(
        proxy.readFragment({
          id: 'foo',
          fragment: gql`
            fragment fragmentFoo on Foo {
              e
              h {
                i
              }
            }
          `,
        }),
        { e: 4, h: { i: 7 } },
      );
      assert.deepEqual<{} | null>(
        proxy.readFragment({
          id: 'foo',
          fragment: gql`
            fragment fragmentFoo on Foo {
              e
              f
              g
              h {
                i
                j
                k
              }
            }
          `,
        }),
        { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } },
      );
      assert.deepEqual<{} | null>(
        proxy.readFragment({
          id: 'bar',
          fragment: gql`
            fragment fragmentBar on Bar {
              i
            }
          `,
        }),
        { i: 7 },
      );
      assert.deepEqual<{} | null>(
        proxy.readFragment({
          id: 'bar',
          fragment: gql`
            fragment fragmentBar on Bar {
              i
              j
              k
            }
          `,
        }),
        { i: 7, j: 8, k: 9 },
      );
      assert.deepEqual<{} | null>(
        proxy.readFragment({
          id: 'foo',
          fragment: gql`
            fragment fragmentFoo on Foo {
              e
              f
              g
              h {
                i
                j
                k
              }
            }

            fragment fragmentBar on Bar {
              i
              j
              k
            }
          `,
          fragmentName: 'fragmentFoo',
        }),
        { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } },
      );
      assert.deepEqual<{} | null>(
        proxy.readFragment({
          id: 'bar',
          fragment: gql`
            fragment fragmentFoo on Foo {
              e
              f
              g
              h {
                i
                j
                k
              }
            }

            fragment fragmentBar on Bar {
              i
              j
              k
            }
          `,
          fragmentName: 'fragmentBar',
        }),
        { i: 7, j: 8, k: 9 },
      );
    });

    it('will read some data from the store with variables', () => {
      const proxy = createCache({
        initialState: {
          apollo: {
            data: {
              foo: {
                __typename: 'Foo',
                'field({"literal":true,"value":42})': 1,
                'field({"literal":false,"value":42})': 2,
              },
            },
          },
        },
      });

      assert.deepEqual<{} | null>(
        proxy.readFragment({
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
        }),
        { a: 1, b: 2 },
      );
    });

    it('will return null when an id that can’t be found is provided', () => {
      const client1 = createCache();
      const client2 = createCache({
        initialState: {
          apollo: {
            data: {
              bar: { __typename: 'Bar', a: 1, b: 2, c: 3 },
            },
          },
        },
      });
      const client3 = createCache({
        initialState: {
          apollo: {
            data: {
              foo: { __typename: 'Foo', a: 1, b: 2, c: 3 },
            },
          },
        },
      });

      assert.equal(
        client1.readFragment({
          id: 'foo',
          fragment: gql`
            fragment fooFragment on Foo {
              a
              b
              c
            }
          `,
        }),
        null,
      );
      assert.equal(
        client2.readFragment({
          id: 'foo',
          fragment: gql`
            fragment fooFragment on Foo {
              a
              b
              c
            }
          `,
        }),
        null,
      );
      assert.deepEqual<{} | null>(
        client3.readFragment({
          id: 'foo',
          fragment: gql`
            fragment fooFragment on Foo {
              a
              b
              c
            }
          `,
        }),
        { a: 1, b: 2, c: 3 },
      );
    });

    it('will read data using custom resolvers', () => {
      const proxy = createCache({
        initialState: {
          apollo: {
            data: {
              ROOT_QUERY: {
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
          addTypename: false,
        },
      });

      const queryResult = proxy.readFragment({
        id: 'foo',
        fragment: gql`
          fragment fooFragment on Query {
            thing(id: "bar") {
              a
              b
              c
            }
          }
        `,
      });

      assert.deepEqual<{} | null>(queryResult, {
        thing: { a: 1, b: '2', c: null },
      });
    });
  });

  describe('writeQuery', () => {
    it('will write some data to the store', () => {
      const proxy = createCache();

      proxy.writeQuery({
        data: { a: 1 },
        query: gql`
          {
            a
          }
        `,
      });

      assert.deepEqual((proxy as InMemoryCache).getData(), {
        ROOT_QUERY: {
          a: 1,
        },
      });

      proxy.writeQuery({
        data: { b: 2, c: 3 },
        query: gql`
          {
            b
            c
          }
        `,
      });

      assert.deepEqual((proxy as InMemoryCache).getData(), {
        ROOT_QUERY: {
          a: 1,
          b: 2,
          c: 3,
        },
      });

      proxy.writeQuery({
        data: { a: 4, b: 5, c: 6 },
        query: gql`
          {
            a
            b
            c
          }
        `,
      });

      assert.deepEqual((proxy as InMemoryCache).getData(), {
        ROOT_QUERY: {
          a: 4,
          b: 5,
          c: 6,
        },
      });
    });

    it('will write some deeply nested data to the store', () => {
      const proxy = createCache();

      proxy.writeQuery({
        data: { a: 1, d: { e: 4 } },
        query: gql`
          {
            a
            d {
              e
            }
          }
        `,
      });

      assert.deepEqual((proxy as InMemoryCache).getData(), {
        ROOT_QUERY: {
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
        query: gql`
          {
            a
            d {
              h {
                i
              }
            }
          }
        `,
      });

      assert.deepEqual((proxy as InMemoryCache).getData(), {
        ROOT_QUERY: {
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
        data: {
          a: 1,
          b: 2,
          c: 3,
          d: { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } },
        },
        query: gql`
          {
            a
            b
            c
            d {
              e
              f
              g
              h {
                i
                j
                k
              }
            }
          }
        `,
      });

      assert.deepEqual((proxy as InMemoryCache).getData(), {
        ROOT_QUERY: {
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
      const proxy = createCache();

      proxy.writeQuery({
        data: {
          a: 1,
          b: 2,
        },
        query: gql`
          query($literal: Boolean, $value: Int) {
            a: field(literal: true, value: 42)
            b: field(literal: $literal, value: $value)
          }
        `,
        variables: {
          literal: false,
          value: 42,
        },
      });

      assert.deepEqual((proxy as InMemoryCache).getData(), {
        ROOT_QUERY: {
          'field({"literal":true,"value":42})': 1,
          'field({"literal":false,"value":42})': 2,
        },
      });
    });
  });

  describe('writeFragment', () => {
    it('will throw an error when there is no fragment', () => {
      const proxy = createCache();

      assert.throws(() => {
        proxy.writeFragment({
          data: {},
          id: 'x',
          fragment: gql`
            query {
              a
              b
              c
            }
          `,
        });
      }, 'Found a query operation. No operations are allowed when using a fragment as a query. Only fragments are allowed.');
      assert.throws(() => {
        proxy.writeFragment({
          data: {},
          id: 'x',
          fragment: gql`
            schema {
              query: Query
            }
          `,
        });
      }, 'Found 0 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
    });

    it('will throw an error when there is more than one fragment but no fragment name', () => {
      const proxy = createCache();

      assert.throws(() => {
        proxy.writeFragment({
          data: {},
          id: 'x',
          fragment: gql`
            fragment a on A {
              a
            }

            fragment b on B {
              b
            }
          `,
        });
      }, 'Found 2 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
      assert.throws(() => {
        proxy.writeFragment({
          data: {},
          id: 'x',
          fragment: gql`
            fragment a on A {
              a
            }

            fragment b on B {
              b
            }

            fragment c on C {
              c
            }
          `,
        });
      }, 'Found 3 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
    });

    it('will write some deeply nested data into the store at any id', () => {
      const proxy = createCache({
        config: { dataIdFromObject: (o: any) => o.id, addTypename: false },
      });

      proxy.writeFragment({
        data: { __typename: 'Foo', e: 4, h: { id: 'bar', i: 7 } },
        id: 'foo',
        fragment: gql`
          fragment fragmentFoo on Foo {
            e
            h {
              i
            }
          }
        `,
      });

      assert.deepEqual((proxy as InMemoryCache).getData(), {
        foo: {
          e: 4,
          h: {
            type: 'id',
            id: 'bar',
            generated: false,
          },
        },
        bar: {
          i: 7,
        },
      });
      proxy.writeFragment({
        data: { __typename: 'Foo', f: 5, g: 6, h: { id: 'bar', j: 8, k: 9 } },
        id: 'foo',
        fragment: gql`
          fragment fragmentFoo on Foo {
            f
            g
            h {
              j
              k
            }
          }
        `,
      });

      assert.deepEqual((proxy as InMemoryCache).getData(), {
        foo: {
          e: 4,
          f: 5,
          g: 6,
          h: {
            type: 'id',
            id: 'bar',
            generated: false,
          },
        },
        bar: {
          i: 7,
          j: 8,
          k: 9,
        },
      });

      proxy.writeFragment({
        data: { i: 10, __typename: 'Bar' },
        id: 'bar',
        fragment: gql`
          fragment fragmentBar on Bar {
            i
          }
        `,
      });

      assert.deepEqual((proxy as InMemoryCache).getData(), {
        foo: {
          e: 4,
          f: 5,
          g: 6,
          h: {
            type: 'id',
            id: 'bar',
            generated: false,
          },
        },
        bar: {
          i: 10,
          j: 8,
          k: 9,
        },
      });

      proxy.writeFragment({
        data: { j: 11, k: 12, __typename: 'Bar' },
        id: 'bar',
        fragment: gql`
          fragment fragmentBar on Bar {
            j
            k
          }
        `,
      });

      assert.deepEqual((proxy as InMemoryCache).getData(), {
        foo: {
          e: 4,
          f: 5,
          g: 6,
          h: {
            type: 'id',
            id: 'bar',
            generated: false,
          },
        },
        bar: {
          i: 10,
          j: 11,
          k: 12,
        },
      });

      proxy.writeFragment({
        data: {
          __typename: 'Foo',
          e: 4,
          f: 5,
          g: 6,
          h: { __typename: 'Bar', id: 'bar', i: 7, j: 8, k: 9 },
        },
        id: 'foo',
        fragment: gql`
          fragment fooFragment on Foo {
            e
            f
            g
            h {
              i
              j
              k
            }
          }

          fragment barFragment on Bar {
            i
            j
            k
          }
        `,
        fragmentName: 'fooFragment',
      });

      assert.deepEqual((proxy as InMemoryCache).getData(), {
        foo: {
          e: 4,
          f: 5,
          g: 6,
          h: {
            type: 'id',
            id: 'bar',
            generated: false,
          },
        },
        bar: {
          i: 7,
          j: 8,
          k: 9,
        },
      });

      proxy.writeFragment({
        data: { __typename: 'Bar', i: 10, j: 11, k: 12 },
        id: 'bar',
        fragment: gql`
          fragment fooFragment on Foo {
            e
            f
            g
            h {
              i
              j
              k
            }
          }

          fragment barFragment on Bar {
            i
            j
            k
          }
        `,
        fragmentName: 'barFragment',
      });

      assert.deepEqual((proxy as InMemoryCache).getData(), {
        foo: {
          e: 4,
          f: 5,
          g: 6,
          h: {
            type: 'id',
            id: 'bar',
            generated: false,
          },
        },
        bar: {
          i: 10,
          j: 11,
          k: 12,
        },
      });
    });

    it.skip('will write some data to the store with variables', () => {
      const proxy = createCache();

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

      assert.deepEqual((proxy as InMemoryCache).getData(), {
        foo: {
          'field({"literal":true,"value":42})': 1,
          'field({"literal":false,"value":42})': 2,
        },
      });
    });
  });
});
