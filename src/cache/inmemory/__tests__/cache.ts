import gql, { disableFragmentWarnings } from 'graphql-tag';

import { stripSymbols } from '../../../utilities/testing/stripSymbols';
import { cloneDeep } from '../../../utilities/common/cloneDeep';
import { makeReference } from '../../../core';
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

      const firstNameFragment = gql`
        fragment FirstNameFragment on Person {
          firstName
        }
      `;

      const lastNameFragment = gql`
        fragment LastNameFragment on Person {
          lastName
        }
      `;

      const bothNamesData = {
        __typename: "Person",
        id: 123,
        firstName: "Ben",
        lastName: "Newman",
      };

      const id = cache.identify(bothNamesData);

      cache.writeFragment({
        id,
        fragment: firstNameFragment,
        data: bothNamesData,
      });

      expect(cache.extract()).toEqual({
        "Person:123": {
          __typename: "Person",
          firstName: "Ben",
        },
      });

      const firstNameResult = cache.readFragment({
        id,
        fragment: firstNameFragment,
      });

      expect(firstNameResult).toEqual({
        __typename: "Person",
        firstName: "Ben",
      });

      cache.writeFragment({
        id,
        fragment: lastNameFragment,
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
      expect(cache.readFragment({
        id,
        fragment: firstNameFragment,
      })).toBe(firstNameResult);

      const lastNameResult = cache.readFragment({
        id,
        fragment: lastNameFragment,
      });

      expect(lastNameResult).toEqual({
        __typename: "Person",
        lastName: "Newman",
      });

      cache.writeFragment({
        id,
        fragment: firstNameFragment,
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

      const benjaminResult = cache.readFragment({
        id,
        fragment: firstNameFragment,
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
      expect(cache.readFragment({
        id,
        fragment: lastNameFragment,
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

      const id = cache.identify(data);

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
    function watch(arg) {
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

describe("cache.makeLocalVar", () => {
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

    const nameVar = cache.makeLocalVar("Ben");

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
