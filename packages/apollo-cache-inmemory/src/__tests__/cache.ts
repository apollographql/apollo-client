import { ApolloCache } from 'apollo-cache';
import gql, { disableFragmentWarnings } from 'graphql-tag';
import { stripSymbols } from 'apollo-utilities';

import { InMemoryCache, ApolloReducerConfig, NormalizedCache } from '..';

disableFragmentWarnings();

describe('Cache', () => {
  function createCache({
    initialState,
    config,
  }: {
    initialState?: any;
    config?: ApolloReducerConfig;
  } = {}): ApolloCache<NormalizedCache> {
    return new InMemoryCache(
      config || { addTypename: false },
      // XXX this is the old format. The tests need to be updated but since it is mapped down
    ).restore(initialState ? initialState.apollo.data : {});
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
      expect(
        stripSymbols(
          proxy.readQuery({
            query: gql`
              {
                a
              }
            `,
          }),
        ),
      ).toEqual({ a: 1 });
      expect(
        stripSymbols(
          proxy.readQuery({
            query: gql`
              {
                b
                c
              }
            `,
          }),
        ),
      ).toEqual({ b: 2, c: 3 });
      expect(
        stripSymbols(
          proxy.readQuery({
            query: gql`
              {
                a
                b
                c
              }
            `,
          }),
        ),
      ).toEqual({ a: 1, b: 2, c: 3 });
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

      expect(
        stripSymbols(
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
        ),
      ).toEqual({ a: 1, d: { e: 4 } });
      expect(
        stripSymbols(
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
        ),
      ).toEqual({ a: 1, d: { e: 4, h: { i: 7 } } });
      expect(
        stripSymbols(
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
        ),
      ).toEqual({
        a: 1,
        b: 2,
        c: 3,
        d: { e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } },
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

      expect(
        stripSymbols(
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
        ),
      ).toEqual({ a: 1, b: 2 });
    });
    it('will read some data from the store with null variables', () => {
      const proxy = createCache({
        initialState: {
          apollo: {
            data: {
              ROOT_QUERY: {
                'field({"literal":false,"value":null})': 1,
              },
            },
          },
        },
      });

      expect(
        stripSymbols(
          proxy.readQuery({
            query: gql`
              query($literal: Boolean, $value: Int) {
                a: field(literal: $literal, value: $value)
              }
            `,
            variables: {
              literal: false,
              value: null,
            },
          }),
        ),
      ).toEqual({ a: 1 });
    });
  });

  describe('readFragment', () => {
    it('will throw an error when there is no fragment', () => {
      const proxy = createCache();

      expect(() => {
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
      }).toThrowError(
        'Found a query operation. No operations are allowed when using a fragment as a query. Only fragments are allowed.',
      );
      expect(() => {
        proxy.readFragment({
          id: 'x',
          fragment: gql`
            schema {
              query: Query
            }
          `,
        });
      }).toThrowError(
        'Found 0 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.',
      );
    });

    it('will throw an error when there is more than one fragment but no fragment name', () => {
      const proxy = createCache();

      expect(() => {
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
      }).toThrowError(
        'Found 2 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.',
      );
      expect(() => {
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
      }).toThrowError(
        'Found 3 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.',
      );
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

      expect(
        stripSymbols(
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
        ),
      ).toEqual({ e: 4, h: { i: 7 } });
      expect(
        stripSymbols(
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
        ),
      ).toEqual({ e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } });
      expect(
        stripSymbols(
          proxy.readFragment({
            id: 'bar',
            fragment: gql`
              fragment fragmentBar on Bar {
                i
              }
            `,
          }),
        ),
      ).toEqual({ i: 7 });
      expect(
        stripSymbols(
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
        ),
      ).toEqual({ i: 7, j: 8, k: 9 });
      expect(
        stripSymbols(
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
        ),
      ).toEqual({ e: 4, f: 5, g: 6, h: { i: 7, j: 8, k: 9 } });
      expect(
        stripSymbols(
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
        ),
      ).toEqual({ i: 7, j: 8, k: 9 });
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

      expect(
        stripSymbols(
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
        ),
      ).toEqual({ a: 1, b: 2 });
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

      expect(
        stripSymbols(
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
        ),
      ).toEqual(null);
      expect(
        stripSymbols(
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
        ),
      ).toEqual(null);
      expect(
        stripSymbols(
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
        ),
      ).toEqual({ a: 1, b: 2, c: 3 });
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

      expect((proxy as InMemoryCache).extract()).toEqual({
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

      expect((proxy as InMemoryCache).extract()).toEqual({
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

      expect((proxy as InMemoryCache).extract()).toEqual({
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

      expect((proxy as InMemoryCache).extract()).toEqual({
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

      expect((proxy as InMemoryCache).extract()).toEqual({
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

      expect((proxy as InMemoryCache).extract()).toEqual({
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

      expect((proxy as InMemoryCache).extract()).toEqual({
        ROOT_QUERY: {
          'field({"literal":true,"value":42})': 1,
          'field({"literal":false,"value":42})': 2,
        },
      });
    });
    it('will write some data to the store with variables where some are null', () => {
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
          value: null,
        },
      });

      expect((proxy as InMemoryCache).extract()).toEqual({
        ROOT_QUERY: {
          'field({"literal":true,"value":42})': 1,
          'field({"literal":false,"value":null})': 2,
        },
      });
    });
  });

  describe('writeFragment', () => {
    it('will throw an error when there is no fragment', () => {
      const proxy = createCache();

      expect(() => {
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
      }).toThrowError(
        'Found a query operation. No operations are allowed when using a fragment as a query. Only fragments are allowed.',
      );
      expect(() => {
        proxy.writeFragment({
          data: {},
          id: 'x',
          fragment: gql`
            schema {
              query: Query
            }
          `,
        });
      }).toThrowError(
        'Found 0 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.',
      );
    });

    it('will throw an error when there is more than one fragment but no fragment name', () => {
      const proxy = createCache();

      expect(() => {
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
      }).toThrowError(
        'Found 2 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.',
      );
      expect(() => {
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
      }).toThrowError(
        'Found 3 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.',
      );
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

      expect((proxy as InMemoryCache).extract()).toMatchSnapshot();
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

      expect((proxy as InMemoryCache).extract()).toMatchSnapshot();

      proxy.writeFragment({
        data: { i: 10, __typename: 'Bar' },
        id: 'bar',
        fragment: gql`
          fragment fragmentBar on Bar {
            i
          }
        `,
      });

      expect((proxy as InMemoryCache).extract()).toMatchSnapshot();

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

      expect((proxy as InMemoryCache).extract()).toMatchSnapshot();

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

      expect((proxy as InMemoryCache).extract()).toMatchSnapshot();

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

      expect((proxy as InMemoryCache).extract()).toMatchSnapshot();
    });
    it('writes data that can be read back', () => {
      const proxy = createCache({
        config: { addTypename: true },
      });
      const readWriteFragment = gql`
        fragment aFragment on query {
          getSomething {
            id
          }
        }
      `;
      const data = {
        __typename: 'query',
        getSomething: { id: '123', __typename: 'Something' },
      };
      proxy.writeFragment({
        data,
        id: 'query',
        fragment: readWriteFragment,
      });

      const result = proxy.readFragment({
        fragment: readWriteFragment,
        id: 'query',
      });
      expect(stripSymbols(result)).toEqual(data);
    });

    it('will write some data to the store with variables', () => {
      const proxy = createCache({
        config: { addTypename: true },
      });

      proxy.writeFragment({
        data: {
          a: 1,
          b: 2,
          __typename: 'Foo',
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

      expect((proxy as InMemoryCache).extract()).toEqual({
        foo: {
          __typename: 'Foo',
          'field({"literal":true,"value":42})': 1,
          'field({"literal":false,"value":42})': 2,
        },
      });
    });
  });

  describe('performTransaction', () => {
    it('will not broadcast mid-transaction', () => {
      const cache = createCache();

      let numBroadcasts = 0;

      const query = gql`
        {
          a
        }
      `;

      cache.watch({
        query,
        optimistic: false,
        callback: () => {
          numBroadcasts++;
        },
      });

      expect(numBroadcasts).toEqual(0);

      cache.performTransaction(proxy => {
        proxy.writeQuery({
          data: { a: 1 },
          query,
        });

        expect(numBroadcasts).toEqual(0);

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

        expect(numBroadcasts).toEqual(0);
      });

      expect(numBroadcasts).toEqual(1);
    });
  });

  describe('performOptimisticTransaction', () => {
    it('will only broadcast once', () => {
      const cache = createCache();

      let numBroadcasts = 0;

      const query = gql`
        {
          a
        }
      `;

      cache.watch({
        query,
        optimistic: true,
        callback: () => {
          numBroadcasts++;
        },
      });

      expect(numBroadcasts).toEqual(0);

      cache.recordOptimisticTransaction(proxy => {
        proxy.writeQuery({
          data: { a: 1 },
          query,
        });

        expect(numBroadcasts).toEqual(0);

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

        expect(numBroadcasts).toEqual(0);
      }, 1);

      expect(numBroadcasts).toEqual(1);
    });
  });
});
