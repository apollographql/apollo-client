import gql, { disableFragmentWarnings } from 'graphql-tag';

import { stripSymbols } from '../../../utilities/testing/stripSymbols';
import { cloneDeep } from '../../../utilities/common/cloneDeep';
import { makeReference, Reference } from '../../../core';
import { InMemoryCache, InMemoryCacheConfig } from '../inMemoryCache';

disableFragmentWarnings();

describe('Cache', () => {
  function itWithInitialData(
    message: string,
    initialDataForCaches: ({ [key: string]: any })[],
    callback: (...caches: InMemoryCache[]) => any,
  ) {
    const cachesList: InMemoryCache[][] = [
      initialDataForCaches.map(data =>
        new InMemoryCache({
          addTypename: false,
        }).restore(cloneDeep(data)),
      ),
      initialDataForCaches.map(data =>
        new InMemoryCache({
          addTypename: false,
          resultCaching: false,
        }).restore(cloneDeep(data)),
      ),
    ];

    cachesList.forEach((caches, i) => {
      it(message + ` (${i + 1}/${cachesList.length})`, () =>
        callback(...caches),
      );
    });
  }

  function itWithCacheConfig(
    message: string,
    config: InMemoryCacheConfig,
    callback: (cache: InMemoryCache) => any,
  ) {
    const caches = [
      new InMemoryCache({
        addTypename: false,
        ...config,
        resultCaching: true,
      }),
      new InMemoryCache({
        addTypename: false,
        ...config,
        resultCaching: false,
      }),
    ];

    caches.forEach((cache, i) => {
      it(message + ` (${i + 1}/${caches.length})`, () => callback(cache));
    });
  }

  describe('readQuery', () => {
    itWithInitialData(
      'will read some data from the store',
      [
        {
          ROOT_QUERY: {
            a: 1,
            b: 2,
            c: 3,
          },
        },
      ],
      proxy => {
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
      },
    );

    itWithInitialData(
      'will read some deeply nested data from the store',
      [
        {
          ROOT_QUERY: {
            a: 1,
            b: 2,
            c: 3,
            d: makeReference('foo'),
          },
          foo: {
            e: 4,
            f: 5,
            g: 6,
            h: makeReference('bar'),
          },
          bar: {
            i: 7,
            j: 8,
            k: 9,
          },
        },
      ],
      proxy => {
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
      },
    );

    itWithInitialData(
      'will read some data from the store with variables',
      [
        {
          ROOT_QUERY: {
            'field({"literal":true,"value":42})': 1,
            'field({"literal":false,"value":42})': 2,
          },
        },
      ],
      proxy => {
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
      },
    );

    itWithInitialData(
      'will read some data from the store with null variables',
      [
        {
          ROOT_QUERY: {
            'field({"literal":false,"value":null})': 1,
          },
        },
      ],
      proxy => {
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
      },
    );

    itWithInitialData(
      'should not mutate arguments passed in',
      [
        {
          ROOT_QUERY: {
            'field({"literal":true,"value":42})': 1,
            'field({"literal":false,"value":42})': 2,
          },
        },
      ],
      proxy => {
        const options = {
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
        };

        const preQueryCopy = cloneDeep(options);
        expect(stripSymbols(proxy.readQuery(options))).toEqual({ a: 1, b: 2 });
        expect(preQueryCopy).toEqual(options);
      },
    );
  });

  describe('readFragment', () => {
    itWithInitialData(
      'will throw an error when there is no fragment',
      [
        // Empty data, but still want to test with/without result caching.
        {},
      ],
      proxy => {
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
      },
    );

    itWithInitialData(
      'will throw an error when there is more than one fragment but no fragment name',
      [{}],
      proxy => {
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
      },
    );

    itWithInitialData(
      'will read some deeply nested data from the store at any id',
      [
        {
          ROOT_QUERY: {
            __typename: 'Type1',
            a: 1,
            b: 2,
            c: 3,
            d: makeReference('foo'),
          },
          foo: {
            __typename: 'Foo',
            e: 4,
            f: 5,
            g: 6,
            h: makeReference('bar'),
          },
          bar: {
            __typename: 'Bar',
            i: 7,
            j: 8,
            k: 9,
          },
        },
      ],
      proxy => {
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
      },
    );

    itWithInitialData(
      'will read some data from the store with variables',
      [
        {
          foo: {
            __typename: 'Foo',
            'field({"literal":true,"value":42})': 1,
            'field({"literal":false,"value":42})': 2,
          },
        },
      ],
      proxy => {
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
      },
    );

    itWithInitialData(
      'will return null when an id that can’t be found is provided',
      [
        // client1
        {},
        // client2
        {
          bar: { __typename: 'Bar', a: 1, b: 2, c: 3 },
        },
        // client3
        {
          foo: { __typename: 'Foo', a: 1, b: 2, c: 3 },
        },
      ],
      (client1, client2, client3) => {
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
      },
    );

    it("should not accidentally depend on unrelated entity fields", () => {
      const cache = new InMemoryCache({
        resultCaching: true,
      });

      const bothNamesData = {
        __typename: "Person",
        id: 123,
        firstName: "Ben",
        lastName: "Newman",
      };

      const firstNameQuery = gql`{ firstName }`;
      const lastNameQuery = gql`{ lastName }`;

      const id = cache.identify(bothNamesData);

      cache.writeQuery({
        id,
        query: firstNameQuery,
        data: bothNamesData,
      });

      expect(cache.extract()).toEqual({
        "Person:123": {
          __typename: "Person",
          firstName: "Ben",
        },
      });

      const firstNameResult = cache.readQuery({
        id,
        query: firstNameQuery,
      });

      expect(firstNameResult).toEqual({
        __typename: "Person",
        firstName: "Ben",
      });

      cache.writeQuery({
        id,
        query: lastNameQuery,
        data: bothNamesData,
      });

      expect(cache.extract()).toEqual({
        "Person:123": {
          __typename: "Person",
          firstName: "Ben",
          lastName: "Newman",
        },
      });

      // This is the crucial test: modifying the lastName field should not
      // invalidate results that did not depend on the lastName field.
      expect(cache.readQuery({
        id,
        query: firstNameQuery,
      })).toBe(firstNameResult);

      const lastNameResult = cache.readQuery({
        id,
        query: lastNameQuery,
      });

      expect(lastNameResult).toEqual({
        __typename: "Person",
        lastName: "Newman",
      });

      cache.writeQuery({
        id,
        query: firstNameQuery,
        data: {
          ...bothNamesData,
          firstName: "Benjamin",
        },
      });

      expect(cache.extract()).toEqual({
        "Person:123": {
          __typename: "Person",
          firstName: "Benjamin",
          lastName: "Newman",
        },
      });

      const benjaminResult = cache.readQuery({
        id,
        query: firstNameQuery,
      });

      expect(benjaminResult).toEqual({
        __typename: "Person",
        firstName: "Benjamin",
      });

      // Still the same as it was?
      expect(firstNameResult).toEqual({
        __typename: "Person",
        firstName: "Ben",
      });

      // Updating the firstName should not have invalidated the
      // previously-read lastNameResult.
      expect(cache.readQuery({
        id,
        query: lastNameQuery,
      })).toBe(lastNameResult);
    });

    it("should not return null when ID found in optimistic layer", () => {
      const cache = new InMemoryCache();

      const fragment = gql`
        fragment NameFragment on Person {
          firstName
          lastName
        }
      `;

      const data = {
        __typename: "Person",
        id: 321,
        firstName: "Hugh",
        lastName: "Willson",
      };

      const id = cache.identify(data)!;

      cache.recordOptimisticTransaction(proxy => {
        proxy.writeFragment({ id, fragment, data });
      }, "optimistic Hugh");

      expect(cache.extract(false)).toEqual({});
      expect(cache.extract(true)).toEqual({
        "Person:321": {
          __typename: "Person",
          firstName: "Hugh",
          lastName: "Willson",
        },
      });

      expect(
        cache.readFragment(
          { id, fragment },
          false, // not optimistic
        ),
      ).toBe(null);

      expect(
        cache.readFragment(
          { id, fragment },
          true, // optimistic
        ),
      ).toEqual({
        __typename: "Person",
        firstName: "Hugh",
        lastName: "Willson",
      });

      cache.writeFragment({
        id,
        fragment,
        data: {
          ...data,
          firstName: "HUGH",
          lastName: "WILLSON",
        },
      });

      expect(
        cache.readFragment(
          { id, fragment },
          false, // not optimistic
        ),
      ).toEqual({
        __typename: "Person",
        firstName: "HUGH",
        lastName: "WILLSON",
      });

      expect(
        cache.readFragment(
          { id, fragment },
          true, // optimistic
        ),
      ).toEqual({
        __typename: "Person",
        firstName: "Hugh",
        lastName: "Willson",
      });

      cache.removeOptimistic("optimistic Hugh");

      expect(
        cache.readFragment(
          { id, fragment },
          true, // optimistic
        ),
      ).toEqual({
        __typename: "Person",
        firstName: "HUGH",
        lastName: "WILLSON",
      });
    });
  });

  describe('writeQuery', () => {
    itWithInitialData('will write some data to the store', [{}], proxy => {
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
          __typename: "Query",
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
          __typename: "Query",
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
          __typename: "Query",
          a: 4,
          b: 5,
          c: 6,
        },
      });
    });

    itWithInitialData(
      'will write some deeply nested data to the store',
      [{}],
      proxy => {
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
            __typename: "Query",
            a: 1,
            d: {
              e: 4,
            },
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
            __typename: "Query",
            a: 1,
            // The new value for d overwrites the old value, since there
            // is no custom merge function defined for Query.d.
            d: {
              h: {
                i: 7,
              },
            },
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
            __typename: "Query",
            a: 1,
            b: 2,
            c: 3,
            d: {
              e: 4,
              f: 5,
              g: 6,
              h: {
                i: 7,
                j: 8,
                k: 9,
              },
            },
          },
        });
      },
    );

    itWithInitialData(
      'will write some data to the store with variables',
      [{}],
      proxy => {
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
            __typename: "Query",
            'field({"literal":true,"value":42})': 1,
            'field({"literal":false,"value":42})': 2,
          },
        });
      },
    );

    itWithInitialData(
      'will write some data to the store with variables where some are null',
      [{}],
      proxy => {
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
            __typename: "Query",
            'field({"literal":true,"value":42})': 1,
            'field({"literal":false,"value":null})': 2,
          },
        });
      },
    );
  });

  describe('writeFragment', () => {
    itWithInitialData(
      'will throw an error when there is no fragment',
      [{}],
      proxy => {
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
      },
    );

    itWithInitialData(
      'will throw an error when there is more than one fragment but no fragment name',
      [{}],
      proxy => {
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
      },
    );

    itWithCacheConfig(
      'will write some deeply nested data into the store at any id',
      {
        dataIdFromObject: (o: any) => o.id,
        addTypename: false,
      },
      proxy => {
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
      },
    );

    itWithCacheConfig(
      'writes data that can be read back',
      {
        addTypename: true,
      },
      proxy => {
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
      },
    );

    itWithCacheConfig(
      'will write some data to the store with variables',
      {
        addTypename: true,
      },
      proxy => {
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
      },
    );
  });

  describe('performTransaction', () => {
    itWithInitialData('will not broadcast mid-transaction', [{}], cache => {
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
    itWithInitialData('will only broadcast once', [{}], cache => {
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

      cache.recordOptimisticTransaction(
        proxy => {
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
        },
        1 as any,
      );

      expect(numBroadcasts).toEqual(1);
    });
  });
});

describe("InMemoryCache#broadcastWatches", function () {
  it("should keep distinct consumers distinct (issue #5733)", function () {
    const cache = new InMemoryCache();
    const query = gql`
      query {
        value(arg: $arg) {
          name
        }
      }
    `;

    const receivedCallbackResults: [string, number, any][] = [];

    let nextWatchId = 1;
    function watch(arg: number) {
      const watchId = `id${nextWatchId++}`;
      cache.watch({
        query,
        variables: { arg },
        optimistic: false,
        callback(result) {
          receivedCallbackResults.push([watchId, arg, result]);
        },
      });
      return watchId;
    }

    const id1 = watch(1);
    expect(receivedCallbackResults).toEqual([]);

    function write(arg: number, name: string) {
      cache.writeQuery({
        query,
        variables: { arg },
        data: {
          value: { name },
        },
      });
    }

    write(1, "one");

    const received1 = [id1, 1, {
      result: {
        value: {
          name: "one",
        },
      },
      complete: true,
    }];

    expect(receivedCallbackResults).toEqual([
      received1,
    ]);

    const id2 = watch(2);

    expect(receivedCallbackResults).toEqual([
      received1,
    ]);

    write(2, "two");

    const received2 = [id2, 2, {
      result: {
        value: {
          name: "two",
        },
      },
      complete: true,
    }];

    expect(receivedCallbackResults).toEqual([
      received1,
      // New results:
      received1,
      received2,
    ]);

    const id3 = watch(1);
    const id4 = watch(1);

    write(1, "one");

    const received3 = [id3, 1, {
      result: {
        value: {
          name: "one",
        },
      },
      complete: true,
    }];

    const received4 = [id4, 1, {
      result: {
        value: {
          name: "one",
        },
      },
      complete: true,
    }];

    expect(receivedCallbackResults).toEqual([
      received1,
      received1,
      received2,
      // New results:
      received3,
      received4,
    ]);

    write(2, "TWO");

    const received2AllCaps = [id2, 2, {
      result: {
        value: {
          name: "TWO",
        },
      },
      complete: true,
    }];

    expect(receivedCallbackResults).toEqual([
      received1,
      received1,
      received2,
      received3,
      received4,
      // New results:
      received1,
      received2AllCaps,
      received3,
      received4,
    ]);
  });
});

describe("InMemoryCache#modify", () => {
  it("should work with single modifier function", () => {
    const cache = new InMemoryCache;
    const query = gql`
      query {
        a
        b
        c
      }
    `;

    cache.writeQuery({
      query,
      data: {
        a: 0,
        b: 0,
        c: 0,
      },
    });

    const resultBeforeModify = cache.readQuery({ query });
    expect(resultBeforeModify).toEqual({ a: 0, b: 0, c: 0 });

    cache.modify((value, { fieldName }) => {
      switch (fieldName) {
        case "a": return value + 1;
        case "b": return value - 1;
        default: return value;
      }
    });

    expect(cache.extract()).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        a: 1,
        b: -1,
        c: 0,
      },
    });

    const resultAfterModify = cache.readQuery({ query });
    expect(resultAfterModify).toEqual({ a: 1, b: -1, c: 0 });
  });

  it("should work with multiple modifier functions", () => {
    const cache = new InMemoryCache;
    const query = gql`
      query {
        a
        b
        c
      }
    `;

    cache.writeQuery({
      query,
      data: {
        a: 0,
        b: 0,
        c: 0,
      },
    });

    const resultBeforeModify = cache.readQuery({ query });
    expect(resultBeforeModify).toEqual({ a: 0, b: 0, c: 0 });

    let checkedTypename = false;
    cache.modify({
      a(value) { return value + 1 },
      b(value) { return value - 1 },
      __typename(t: string, { readField }) {
        expect(t).toBe("Query");
        expect(readField("c")).toBe(0);
        checkedTypename = true;
        return t;
      },
    });
    expect(checkedTypename).toBe(true);

    expect(cache.extract()).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        a: 1,
        b: -1,
        c: 0,
      },
    });

    const resultAfterModify = cache.readQuery({ query });
    expect(resultAfterModify).toEqual({ a: 1, b: -1, c: 0 });
  });

  it("should allow deletion using details.DELETE", () => {
    const cache = new InMemoryCache({
      typePolicies: {
        Book: {
          keyFields: ["isbn"],
        },
        Author: {
          keyFields: ["name"],
        },
      },
    });

    const query = gql`
      query {
        currentlyReading {
          title
          isbn
          author {
            name
            yearOfBirth
          }
        }
      }
    `;

    const currentlyReading = {
      __typename: "Book",
      isbn: "147670032X",
      title: "Why We're Polarized",
      author: {
        __typename: "Author",
        name: "Ezra Klein",
        yearOfBirth: 1983,
      },
    };

    cache.writeQuery({
      query,
      data: {
        currentlyReading,
      }
    });

    expect(cache.extract()).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        currentlyReading: {
          __ref: 'Book:{"isbn":"147670032X"}',
        },
      },
      'Book:{"isbn":"147670032X"}': {
        __typename: "Book",
        isbn: "147670032X",
        author: {
          __ref: 'Author:{"name":"Ezra Klein"}',
        },
        title: "Why We're Polarized",
      },
      'Author:{"name":"Ezra Klein"}': {
        __typename: "Author",
        name: "Ezra Klein",
        yearOfBirth: 1983,
      },
    });

    const authorId = cache.identify(currentlyReading.author)!;
    expect(authorId).toBe('Author:{"name":"Ezra Klein"}');

    cache.modify({
      yearOfBirth(yob) {
        return yob + 1;
      },
    }, authorId);

    const yobResult = cache.readFragment({
      id: authorId,
      fragment: gql`fragment YOB on Author { yearOfBirth }`,
    });

    expect(yobResult).toEqual({
      __typename: "Author",
      yearOfBirth: 1984,
    });

    const bookId = cache.identify(currentlyReading)!;

    // Modifying the Book in order to modify the Author is fancier than
    // necessary, but we want fancy use cases to work, too.
    cache.modify({
      author(author: Reference, { readField }) {
        expect(readField("title")).toBe("Why We're Polarized");
        expect(readField("name", author)).toBe("Ezra Klein");
        cache.modify({
          yearOfBirth(yob, { DELETE }) {
            expect(yob).toBe(1984);
            return DELETE;
          },
        }, cache.identify({
          __typename: readField("__typename", author),
          name: readField("name", author),
        }));
        return author;
      }
    }, bookId);

    const snapshotWithoutYOB = cache.extract();
    expect(snapshotWithoutYOB[authorId]!.yearOfBirth).toBeUndefined();
    expect("yearOfBirth" in snapshotWithoutYOB[authorId]!).toBe(false);
    expect(snapshotWithoutYOB).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        currentlyReading: {
          __ref: 'Book:{"isbn":"147670032X"}',
        },
      },
      'Book:{"isbn":"147670032X"}': {
        __typename: "Book",
        isbn: "147670032X",
        author: {
          __ref: 'Author:{"name":"Ezra Klein"}',
        },
        title: "Why We're Polarized",
      },
      'Author:{"name":"Ezra Klein"}': {
        __typename: "Author",
        name: "Ezra Klein",
        // yearOfBirth is gone now
      },
    });

    // Delete the whole Book.
    cache.modify((_, { DELETE }) => DELETE, bookId);

    const snapshotWithoutBook = cache.extract();
    expect(snapshotWithoutBook[bookId]).toBeUndefined();
    expect(bookId in snapshotWithoutBook).toBe(false);
    expect(snapshotWithoutBook).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        currentlyReading: {
          __ref: 'Book:{"isbn":"147670032X"}',
        },
      },
      'Author:{"name":"Ezra Klein"}': {
        __typename: "Author",
        name: "Ezra Klein",
      },
    });

    // Delete all fields of the Author, which also removes the object.
    cache.modify({
      __typename(_, { DELETE }) { return DELETE },
      name(_, { DELETE }) { return DELETE },
    }, authorId);

    const snapshotWithoutAuthor = cache.extract();
    expect(snapshotWithoutAuthor[authorId]).toBeUndefined();
    expect(authorId in snapshotWithoutAuthor).toBe(false);
    expect(snapshotWithoutAuthor).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        currentlyReading: {
          __ref: 'Book:{"isbn":"147670032X"}',
        },
      },
    });

    cache.modify((_, { DELETE }) => DELETE);
    expect(cache.extract()).toEqual({});
  });

  it("can remove specific items from paginated lists", () => {
    const cache = new InMemoryCache({
      typePolicies: {
        Thread: {
          keyFields: ["tid"],

          fields: {
            comments: {
              merge(existing: Reference[], incoming: Reference[], { args, mergeObjects }) {
                const merged = existing ? existing.slice(0) : [];
                const end = args!.offset + Math.min(args!.limit, incoming.length);
                for (let i = args!.offset; i < end; ++i) {
                  merged[i] = mergeObjects(merged[i], incoming[i - args!.offset]) as Reference;
                }
                return merged;
              },

              read(existing: Reference[], { args }) {
                const page = existing && existing.slice(
                  args!.offset,
                  args!.offset + args!.limit,
                );
                if (page && page.length > 0) {
                  return page;
                }
              },
            },
          },
        },

        Comment: {
          keyFields: ["id"],
        },
      },
    });

    const query = gql`
      query GetThread($offset: Int, $limit: Int) {
        thread {
          tid
          comments(offset: $offset, limit: $limit) {
            id
            text
          }
        }
      }
    `;

    cache.writeQuery({
      query,
      data: {
        thread: {
          __typename: "Thread",
          tid: 123,
          comments: [{
            __typename: "Comment",
            id: "c1",
            text: "first post",
          }, {
            __typename: "Comment",
            id: "c2",
            text: "I have thoughts",
          }, {
            __typename: "Comment",
            id: "c3",
            text: "friendly ping",
          }]
        }
      },
      variables: {
        offset: 0,
        limit: 3,
      },
    });

    expect(cache.extract()).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        thread: {
          __ref: 'Thread:{"tid":123}',
        },
      },
      'Thread:{"tid":123}': {
        __typename: "Thread",
        tid: 123,
        comments: [
          { __ref: 'Comment:{"id":"c1"}' },
          { __ref: 'Comment:{"id":"c2"}' },
          { __ref: 'Comment:{"id":"c3"}' },
        ],
      },
      'Comment:{"id":"c1"}': {
        __typename: "Comment",
        id: "c1",
        text: "first post",
      },
      'Comment:{"id":"c2"}': {
        __typename: "Comment",
        id: "c2",
        text: "I have thoughts",
      },
      'Comment:{"id":"c3"}': {
        __typename: "Comment",
        id: "c3",
        text: "friendly ping",
      },
    });

    cache.modify({
      comments(comments: Reference[], { readField }) {
        debugger;
        expect(Object.isFrozen(comments)).toBe(true);
        expect(comments.length).toBe(3);
        const filtered = comments.filter(comment => {
          return readField("id", comment) !== "c1";
        });
        expect(filtered.length).toBe(2);
        return filtered;
      },
    }, cache.identify({
      __typename: "Thread",
      tid: 123,
    }));

    expect(cache.gc()).toEqual(['Comment:{"id":"c1"}']);

    expect(cache.extract()).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        thread: {
          __ref: 'Thread:{"tid":123}',
        },
      },
      'Thread:{"tid":123}': {
        __typename: "Thread",
        tid: 123,
        comments: [
          { __ref: 'Comment:{"id":"c2"}' },
          { __ref: 'Comment:{"id":"c3"}' },
        ],
      },
      'Comment:{"id":"c2"}': {
        __typename: "Comment",
        id: "c2",
        text: "I have thoughts",
      },
      'Comment:{"id":"c3"}': {
        __typename: "Comment",
        id: "c3",
        text: "friendly ping",
      },
    });
  });

  it("should not revisit deleted fields", () => {
    const cache = new InMemoryCache;
    const query = gql`query { a b c }`;

    cache.recordOptimisticTransaction(cache => {
      cache.writeQuery({
        query,
        data: {
          a: 1,
          b: 2,
          c: 3,
        },
      })
    }, "transaction");

    cache.modify({
      b(value, { DELETE }) {
        expect(value).toBe(2);
        return DELETE;
      },
    }, "ROOT_QUERY", true);

    expect(cache.extract(true)).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        a: 1,
        c: 3,
      },
    });

    cache.modify((value, { fieldName }) => {
      expect(fieldName).not.toBe("b");
      if (fieldName === "a") expect(value).toBe(1);
      if (fieldName === "c") expect(value).toBe(3);
    }, "ROOT_QUERY", true);

    cache.removeOptimistic("transaction");

    expect(cache.extract(true)).toEqual({});
  });

  it("should broadcast watches for queries with changed fields", () => {
    const cache = new InMemoryCache;
    const queryA = gql`{ a { value } }`;
    const queryB = gql`{ b { value } }`;

    cache.writeQuery({
      query: queryA,
      data: {
        a: {
          __typename: "A",
          id: 1,
          value: 123,
        },
      }
    });

    cache.writeQuery({
      query: queryB,
      data: {
        b: {
          __typename: "B",
          id: 1,
          value: 321,
        },
      }
    });

    expect(cache.extract()).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        a: { __ref: "A:1" },
        b: { __ref: "B:1" },
      },
      "A:1": {
        __typename: "A",
        value: 123,
      },
      "B:1": {
        __typename: "B",
        value: 321,
      },
    });

    let aResults: any[] = [];
    cache.watch({
      query: queryA,
      optimistic: true,
      immediate: true,
      callback(data) {
        aResults.push(data);
      },
    });

    let bResults: any[] = [];
    cache.watch({
      query: queryB,
      optimistic: true,
      immediate: true,
      callback(data) {
        bResults.push(data);
      },
    });

    function makeResult(
      __typename: string,
      value: number,
      complete: boolean = true,
    ) {
      return {
        complete,
        result: {
          [__typename.toLowerCase()]: {
            __typename,
            value,
          },
        },
      };
    }

    const a123 = makeResult("A", 123);
    const b321 = makeResult("B", 321);

    expect(aResults).toEqual([a123]);
    expect(bResults).toEqual([b321]);

    const aId = cache.identify({ __typename: "A", id: 1 });
    const bId = cache.identify({ __typename: "B", id: 1 });

    cache.modify({
      value(x: number) {
        return x + 1;
      },
    }, aId);

    const a124 = makeResult("A", 124);

    expect(aResults).toEqual([a123, a124]);
    expect(bResults).toEqual([b321]);

    cache.modify({
      value(x: number) {
        return x + 1;
      },
    }, bId);

    const b322 = makeResult("B", 322);

    expect(aResults).toEqual([a123, a124]);
    expect(bResults).toEqual([b321, b322]);
  });

  it("should handle argument-determined field identities", () => {
    const cache = new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            book: {
              keyArgs: ["isbn"],
            },
          },
        },
        Book: {
          keyFields: ["isbn"],
        },
      },
    });

    function addBook(isbn: string, title: string) {
      cache.writeQuery({
        query: gql`
          query {
            book(isbn: $isbn) {
              isbn
              title
            }
          }
        `,
        data: {
          book: {
            __typename: "Book",
            isbn,
            title,
          },
        },
        variables: {
          isbn,
        },
      });
    }

    addBook("147670032X", "Why We're Polarized");
    addBook("1760641790", "How To Do Nothing");
    addBook("0735211280", "Spineless");

    const fullSnapshot = {
      ROOT_QUERY: {
        __typename: "Query",
        'book:{"isbn":"0735211280"}': {
          __ref: 'Book:{"isbn":"0735211280"}',
        },
        'book:{"isbn":"147670032X"}': {
          __ref: 'Book:{"isbn":"147670032X"}',
        },
        'book:{"isbn":"1760641790"}': {
          __ref: 'Book:{"isbn":"1760641790"}',
        },
      },
      'Book:{"isbn":"147670032X"}': {
        __typename: "Book",
        isbn: "147670032X",
        title: "Why We're Polarized",
      },
      'Book:{"isbn":"1760641790"}': {
        __typename: "Book",
        isbn: "1760641790",
        title: "How To Do Nothing",
      },
      'Book:{"isbn":"0735211280"}': {
        __typename: "Book",
        isbn: "0735211280",
        title: "Spineless",
      },
    };

    expect(cache.extract()).toEqual(fullSnapshot);

    function check(isbnToDelete?: string) {
      let bookCount = 0;

      cache.modify({
        book(book: Reference, {
          fieldName,
          storeFieldName,
          isReference,
          readField,
          DELETE,
        }) {
          expect(fieldName).toBe("book");
          expect(isReference(book)).toBe(true);
          expect(typeof readField("title", book)).toBe("string");
          expect(readField("__typename", book)).toBe("Book");

          const parts = storeFieldName.split(":");
          expect(parts.shift()).toBe("book");
          const keyArgs = JSON.parse(parts.join(":"));
          expect(typeof keyArgs.isbn).toBe("string");
          expect(Object.keys(keyArgs)).toEqual(["isbn"]);

          expect(readField("isbn", book)).toBe(keyArgs.isbn);

          if (isbnToDelete === keyArgs.isbn) {
            return DELETE;
          }

          ++bookCount;

          return book;
        },
      });

      return bookCount;
    }

    // No change from repeatedly calling check().
    expect(check()).toBe(3);
    expect(check()).toBe(3);

    expect(check("0735211280")).toBe(2);
    expect(check("147670032X")).toBe(1);

    // No change from re-deleting already-deleted ISBNs.
    expect(check("0735211280")).toBe(1);
    expect(check("147670032X")).toBe(1);

    expect(cache.extract()).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        'book:{"isbn":"1760641790"}': {
          __ref: 'Book:{"isbn":"1760641790"}',
        },
      },
      'Book:{"isbn":"147670032X"}': {
        __typename: "Book",
        isbn: "147670032X",
        title: "Why We're Polarized",
      },
      'Book:{"isbn":"1760641790"}': {
        __typename: "Book",
        isbn: "1760641790",
        title: "How To Do Nothing",
      },
      'Book:{"isbn":"0735211280"}': {
        __typename: "Book",
        isbn: "0735211280",
        title: "Spineless",
      },
    });

    expect(cache.gc().sort()).toEqual([
      'Book:{"isbn":"0735211280"}',
      'Book:{"isbn":"147670032X"}',
    ]);

    expect(cache.extract()).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        'book:{"isbn":"1760641790"}': {
          __ref: 'Book:{"isbn":"1760641790"}',
        },
      },
      'Book:{"isbn":"1760641790"}': {
        __typename: "Book",
        isbn: "1760641790",
        title: "How To Do Nothing",
      },
    });

    expect(check("1760641790")).toBe(0);

    expect(cache.extract()).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
      },
      'Book:{"isbn":"1760641790"}': {
        __typename: "Book",
        isbn: "1760641790",
        title: "How To Do Nothing",
      },
    });

    expect(cache.gc()).toEqual([
      'Book:{"isbn":"1760641790"}',
    ]);

    expect(cache.extract()).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
      },
    });
  });
});

describe("cache.makeVar", () => {
  function makeCacheAndVar(resultCaching: boolean) {
    const cache: InMemoryCache = new InMemoryCache({
      resultCaching,
      typePolicies: {
        Person: {
          fields: {
            name() {
              return nameVar();
            },
          },
        },
      },
    });

    const nameVar = cache.makeVar("Ben");

    const query = gql`
      query {
        onCall {
          name
        }
      }
    `;

    cache.writeQuery({
      query,
      data: {
        onCall: {
          __typename: "Person",
        },
      },
    });

    return {
      cache,
      nameVar,
      query,
    };
  }

  it("should work with resultCaching enabled (default)", () => {
    const { cache, nameVar, query } = makeCacheAndVar(true);

    const result1 = cache.readQuery({ query });
    expect(result1).toEqual({
      onCall: {
        __typename: "Person",
        name: "Ben",
      },
    });

    // No change before updating the nameVar.
    expect(cache.readQuery({ query })).toBe(result1);

    expect(nameVar()).toBe("Ben");
    expect(nameVar("Hugh")).toBe("Hugh");

    const result2 = cache.readQuery({ query });
    expect(result2).not.toBe(result1);
    expect(result2).toEqual({
      onCall: {
        __typename: "Person",
        name: "Hugh",
      },
    });

    expect(nameVar()).toBe("Hugh");
    expect(nameVar("James")).toBe("James");

    expect(cache.readQuery({ query })).toEqual({
      onCall: {
        __typename: "Person",
        name: "James",
      },
    });
  });

  it("should work with resultCaching disabled (unusual)", () => {
    const { cache, nameVar, query } = makeCacheAndVar(false);

    const result1 = cache.readQuery({ query });
    expect(result1).toEqual({
      onCall: {
        __typename: "Person",
        name: "Ben",
      },
    });

    const result2 = cache.readQuery({ query });
    // Without resultCaching, equivalent results will not be ===.
    expect(result2).not.toBe(result1);
    expect(result2).toEqual(result1);

    expect(nameVar()).toBe("Ben");
    expect(nameVar("Hugh")).toBe("Hugh");

    const result3 = cache.readQuery({ query });
    expect(result3).toEqual({
      onCall: {
        __typename: "Person",
        name: "Hugh",
      },
    });
  });
});
