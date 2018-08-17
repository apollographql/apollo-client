import gql from 'graphql-tag';
import { ApolloLink, Observable } from 'apollo-link';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { stripSymbols } from 'apollo-utilities';

import { withWarning } from '../util/wrap';

import ApolloClient from '../';
import { DefaultOptions } from '../ApolloClient';
import { FetchPolicy, QueryOptions } from '../core/watchQueryOptions';

describe('ApolloClient', () => {
  describe('constructor', () => {
    it('will throw an error if link is not passed in', () => {
      expect(() => {
        const client = new ApolloClient({ cache: new InMemoryCache() });
      }).toThrowErrorMatchingSnapshot();
    });

    it('will throw an error if cache is not passed in', () => {
      expect(() => {
        const client = new ApolloClient({ link: new ApolloLink.empty() });
      }).toThrowErrorMatchingSnapshot();
    });
  });

  describe('readQuery', () => {
    it('will read some data from the store', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache().restore({
          ROOT_QUERY: {
            a: 1,
            b: 2,
            c: 3,
          },
        }),
      });

      expect(
        stripSymbols(
          client.readQuery({
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
          client.readQuery({
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
          client.readQuery({
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
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache().restore({
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
        }),
      });

      expect(
        stripSymbols(
          client.readQuery({
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
      ).toEqual({ a: 1, d: { e: 4, __typename: 'Foo' } });
      expect(
        stripSymbols(
          client.readQuery({
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
      ).toEqual({
        a: 1,
        d: { __typename: 'Foo', e: 4, h: { i: 7, __typename: 'Bar' } },
      });
      expect(
        stripSymbols(
          client.readQuery({
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
        d: {
          __typename: 'Foo',
          e: 4,
          f: 5,
          g: 6,
          h: { __typename: 'Bar', i: 7, j: 8, k: 9 },
        },
      });
    });

    it('will read some data from the store with variables', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache().restore({
          ROOT_QUERY: {
            'field({"literal":true,"value":42})': 1,
            'field({"literal":false,"value":42})': 2,
          },
        }),
      });

      expect(
        stripSymbols(
          client.readQuery({
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
  });

  it('will read some data from the store with default values', () => {
    const client = new ApolloClient({
      link: ApolloLink.empty(),
      cache: new InMemoryCache().restore({
        ROOT_QUERY: {
          'field({"literal":true,"value":-1})': 1,
          'field({"literal":false,"value":42})': 2,
        },
      }),
    });

    expect(
      stripSymbols(
        client.readQuery({
          query: gql`
            query($literal: Boolean, $value: Int = -1) {
              a: field(literal: $literal, value: $value)
            }
          `,
          variables: {
            literal: false,
            value: 42,
          },
        }),
      ),
    ).toEqual({ a: 2 });

    expect(
      stripSymbols(
        client.readQuery({
          query: gql`
            query($literal: Boolean, $value: Int = -1) {
              a: field(literal: $literal, value: $value)
            }
          `,
          variables: {
            literal: true,
          },
        }),
      ),
    ).toEqual({ a: 1 });
  });

  describe('readFragment', () => {
    it('will throw an error when there is no fragment', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });

      expect(() => {
        client.readFragment({
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
        client.readFragment({
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
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });

      expect(() => {
        client.readFragment({
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
        client.readFragment({
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
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache().restore({
          ROOT_QUERY: {
            __typename: 'Foo',
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
        }),
      });

      expect(
        stripSymbols(
          client.readFragment({
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
      ).toEqual({ __typename: 'Foo', e: 4, h: { __typename: 'Bar', i: 7 } });
      expect(
        stripSymbols(
          client.readFragment({
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
      ).toEqual({
        __typename: 'Foo',
        e: 4,
        f: 5,
        g: 6,
        h: { __typename: 'Bar', i: 7, j: 8, k: 9 },
      });
      expect(
        stripSymbols(
          client.readFragment({
            id: 'bar',
            fragment: gql`
              fragment fragmentBar on Bar {
                i
              }
            `,
          }),
        ),
      ).toEqual({ __typename: 'Bar', i: 7 });
      expect(
        stripSymbols(
          client.readFragment({
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
      ).toEqual({ __typename: 'Bar', i: 7, j: 8, k: 9 });
      expect(
        stripSymbols(
          client.readFragment({
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
      ).toEqual({
        __typename: 'Foo',
        e: 4,
        f: 5,
        g: 6,
        h: { __typename: 'Bar', i: 7, j: 8, k: 9 },
      });
      expect(
        stripSymbols(
          client.readFragment({
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
      ).toEqual({ __typename: 'Bar', i: 7, j: 8, k: 9 });
    });

    it('will read some data from the store with variables', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache().restore({
          foo: {
            __typename: 'Foo',
            'field({"literal":true,"value":42})': 1,
            'field({"literal":false,"value":42})': 2,
          },
        }),
      });

      expect(
        stripSymbols(
          client.readFragment({
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
      ).toEqual({ __typename: 'Foo', a: 1, b: 2 });
    });

    it('will return null when an id that can’t be found is provided', () => {
      const client1 = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });
      const client2 = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache().restore({
          bar: { __typename: 'Foo', a: 1, b: 2, c: 3 },
        }),
      });
      const client3 = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache().restore({
          foo: { __typename: 'Foo', a: 1, b: 2, c: 3 },
        }),
      });

      expect(
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
      ).toBe(null);
      expect(
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
      ).toBe(null);
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
      ).toEqual({ __typename: 'Foo', a: 1, b: 2, c: 3 });
    });
  });

  describe('writeQuery', () => {
    it('will write some data to the store', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });

      client.writeQuery({
        data: { a: 1 },
        query: gql`
          {
            a
          }
        `,
      });

      expect((client.cache as InMemoryCache).extract()).toEqual({
        ROOT_QUERY: {
          a: 1,
        },
      });

      client.writeQuery({
        data: { b: 2, c: 3 },
        query: gql`
          {
            b
            c
          }
        `,
      });

      expect((client.cache as InMemoryCache).extract()).toEqual({
        ROOT_QUERY: {
          a: 1,
          b: 2,
          c: 3,
        },
      });

      client.writeQuery({
        data: { a: 4, b: 5, c: 6 },
        query: gql`
          {
            a
            b
            c
          }
        `,
      });

      expect((client.cache as InMemoryCache).extract()).toEqual({
        ROOT_QUERY: {
          a: 4,
          b: 5,
          c: 6,
        },
      });
    });

    it('will write some deeply nested data to the store', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });

      client.writeQuery({
        data: { a: 1, d: { __typename: 'D', e: 4 } },
        query: gql`
          {
            a
            d {
              e
            }
          }
        `,
      });

      expect((client.cache as InMemoryCache).extract()).toMatchSnapshot();

      client.writeQuery({
        data: { a: 1, d: { __typename: 'D', h: { __typename: 'H', i: 7 } } },
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

      expect((client.cache as InMemoryCache).extract()).toMatchSnapshot();

      client.writeQuery({
        data: {
          a: 1,
          b: 2,
          c: 3,
          d: {
            __typename: 'D',
            e: 4,
            f: 5,
            g: 6,
            h: {
              __typename: 'H',
              i: 7,
              j: 8,
              k: 9,
            },
          },
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

      expect((client.cache as InMemoryCache).extract()).toMatchSnapshot();
    });

    it('will write some data to the store with variables', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });

      client.writeQuery({
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

      expect((client.cache as InMemoryCache).extract()).toEqual({
        ROOT_QUERY: {
          'field({"literal":true,"value":42})': 1,
          'field({"literal":false,"value":42})': 2,
        },
      });
    });

    it('will write some data to the store with default values for variables', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });

      client.writeQuery({
        data: {
          a: 2,
        },
        query: gql`
          query($literal: Boolean, $value: Int = -1) {
            a: field(literal: $literal, value: $value)
          }
        `,
        variables: {
          literal: true,
          value: 42,
        },
      });

      client.writeQuery({
        data: {
          a: 1,
        },
        query: gql`
          query($literal: Boolean, $value: Int = -1) {
            a: field(literal: $literal, value: $value)
          }
        `,
        variables: {
          literal: false,
        },
      });

      expect((client.cache as InMemoryCache).extract()).toEqual({
        ROOT_QUERY: {
          'field({"literal":true,"value":42})': 2,
          'field({"literal":false,"value":-1})': 1,
        },
      });
    });

    it('should warn when the data provided does not match the query shape', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });

      return withWarning(() => {
        client.writeQuery({
          data: {
            todos: [
              {
                id: '1',
                name: 'Todo 1',
                __typename: 'Todo',
              },
            ],
          },
          query: gql`
            query {
              todos {
                id
                name
                description
              }
            }
          `,
        });
      }, /Missing field description/);
    });
  });

  describe('writeFragment', () => {
    it('will throw an error when there is no fragment', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });

      expect(() => {
        client.writeFragment({
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
        client.writeFragment({
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
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });

      expect(() => {
        client.writeFragment({
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
        client.writeFragment({
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
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache({ dataIdFromObject: (o: any) => o.id }),
      });

      client.writeFragment({
        data: {
          __typename: 'Foo',
          e: 4,
          h: { __typename: 'Bar', id: 'bar', i: 7 },
        },
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

      expect((client.cache as InMemoryCache).extract()).toMatchSnapshot();

      client.writeFragment({
        data: {
          __typename: 'Foo',
          f: 5,
          g: 6,
          h: { __typename: 'Bar', id: 'bar', j: 8, k: 9 },
        },
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

      expect((client.cache as InMemoryCache).extract()).toMatchSnapshot();

      client.writeFragment({
        data: { __typename: 'Bar', i: 10 },
        id: 'bar',
        fragment: gql`
          fragment fragmentBar on Bar {
            i
          }
        `,
      });

      expect((client.cache as InMemoryCache).extract()).toMatchSnapshot();

      client.writeFragment({
        data: { __typename: 'Bar', j: 11, k: 12 },
        id: 'bar',
        fragment: gql`
          fragment fragmentBar on Bar {
            j
            k
          }
        `,
      });

      expect((client.cache as InMemoryCache).extract()).toMatchSnapshot();

      client.writeFragment({
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

      expect((client.cache as InMemoryCache).extract()).toMatchSnapshot();

      client.writeFragment({
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

      expect((client.cache as InMemoryCache).extract()).toMatchSnapshot();
    });

    it('will write some data to the store with variables', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });

      client.writeFragment({
        data: {
          __typename: 'Foo',
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

      expect((client.cache as InMemoryCache).extract()).toEqual({
        foo: {
          __typename: 'Foo',
          'field({"literal":true,"value":42})': 1,
          'field({"literal":false,"value":42})': 2,
        },
      });
    });

    it('should warn when the data provided does not match the fragment shape', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });

      return withWarning(() => {
        client.writeFragment({
          data: { __typename: 'Bar', i: 10 },
          id: 'bar',
          fragment: gql`
            fragment fragmentBar on Bar {
              i
              e
            }
          `,
        });
      }, /Missing field e/);
    });

    it('will correctly call the next observable after a change', done => {
      const query = gql`
        query nestedData {
          people {
            id
            friends {
              id
              type
            }
          }
        }
      `;
      const data = {
        people: {
          id: 1,
          __typename: 'Person',
          friends: [
            { id: 1, type: 'best', __typename: 'Friend' },
            { id: 2, type: 'bad', __typename: 'Friend' },
          ],
        },
      };
      const link = new ApolloLink(() => {
        return Observable.of({ data });
      });
      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({
          dataIdFromObject: result => {
            if (result.id && result.__typename) {
              return result.__typename + result.id;
            }
            return null;
          },
          addTypename: true,
        }),
      });

      let count = 0;
      const observable = client.watchQuery({ query });
      observable.subscribe({
        next: result => {
          count++;
          if (count === 1) {
            expect(stripSymbols(result.data)).toEqual(data);
            expect(stripSymbols(observable.currentResult().data)).toEqual(data);
            const bestFriends = result.data.people.friends.filter(
              x => x.type === 'best',
            );
            // this should re call next
            client.writeFragment({
              id: `Person${result.data.people.id}`,
              fragment: gql`
                fragment bestFriends on Person {
                  friends {
                    id
                  }
                }
              `,
              data: {
                friends: bestFriends,
                __typename: 'Person',
              },
            });

            setTimeout(() => {
              if (count === 1)
                done.fail(new Error('fragment did not recall observable'));
            }, 50);
          }

          if (count === 2) {
            expect(stripSymbols(result.data.people.friends)).toEqual([
              data.people.friends[0],
            ]);
            done();
          }
        },
      });
    });
  });

  describe('writeData', () => {
    it('lets you write to the cache by passing in data', () => {
      const query = gql`
        {
          field
        }
      `;

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: ApolloLink.empty(),
      });

      client.writeData({ data: { field: 1 } });

      return client.query({ query }).then(({ data }) => {
        expect(stripSymbols({ ...data })).toEqual({ field: 1 });
      });
    });

    it('lets you write to an existing object in the cache using an ID', () => {
      const query = gql`
        {
          obj {
            field
          }
        }
      `;

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: ApolloLink.empty(),
      });

      client.writeQuery({
        query,
        data: {
          obj: { field: 1, id: 'uniqueId', __typename: 'Object' },
        },
      });

      client.writeData({ id: 'Object:uniqueId', data: { field: 2 } });

      return client.query({ query }).then(({ data }: any) => {
        expect(data.obj.field).toEqual(2);
      });
    });

    it(`doesn't overwrite __typename when writing to the cache with an id`, () => {
      const query = gql`
        {
          obj {
            field {
              field2
            }
            id
          }
        }
      `;

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: ApolloLink.empty(),
      });

      client.writeQuery({
        query,
        data: {
          obj: {
            field: { field2: 1, __typename: 'Field' },
            id: 'uniqueId',
            __typename: 'Object',
          },
        },
      });

      client.writeData({
        id: 'Object:uniqueId',
        data: { field: { field2: 2, __typename: 'Field' } },
      });

      return client
        .query({ query })
        .then(({ data }: any) => {
          expect(data.obj.__typename).toEqual('Object');
          expect(data.obj.field.__typename).toEqual('Field');
        })
        .catch(e => console.log(e));
    });

    it(`adds a __typename for an object without one when writing to the cache with an id`, () => {
      const query = gql`
        {
          obj {
            field {
              field2
            }
            id
          }
        }
      `;

      // This would cause a warning to be printed because we don't have
      // __typename on the obj field. But that's intentional because
      // that's exactly the situation we're trying to test...

      // Let's swap out console.warn to suppress this one message

      const suppressString = '__typename';
      const originalWarn = console.warn;
      console.warn = (...args: any[]) => {
        if (
          args.find(element => {
            if (typeof element === 'string') {
              return element.indexOf(suppressString) !== -1;
            }
            return false;
          }) != null
        ) {
          // Found a thing in the args we told it to exclude
          return;
        }
        originalWarn.apply(console, args);
      };

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: ApolloLink.empty(),
      });

      client.writeQuery({
        query,
        data: {
          obj: {
            field: {
              field2: 1,
              __typename: 'Field',
            },
            id: 'uniqueId',
          },
        },
      });

      client.writeData({
        id: '$ROOT_QUERY.obj',
        data: {
          field: {
            field2: 2,
            __typename: 'Field',
          },
        },
      });

      return client
        .query({ query })
        .then(({ data }: any) => {
          console.warn = originalWarn;
          expect(data.obj.__typename).toEqual('__ClientData');
          expect(data.obj.field.__typename).toEqual('Field');
        })
        .catch(e => console.log(e));
    });
  });

  describe('write then read', () => {
    it('will write data locally which will then be read back', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache().restore({
          foo: {
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
        }),
      });

      expect(
        stripSymbols(
          client.readFragment({
            id: 'foo',
            fragment: gql`
              fragment x on Foo {
                a
                b
                c
                bar {
                  d
                  e
                  f
                }
              }
            `,
          }),
        ),
      ).toEqual({
        __typename: 'Foo',
        a: 1,
        b: 2,
        c: 3,
        bar: { d: 4, e: 5, f: 6, __typename: 'Bar' },
      });

      client.writeFragment({
        id: 'foo',
        fragment: gql`
          fragment x on Foo {
            a
          }
        `,
        data: { __typename: 'Foo', a: 7 },
      });

      expect(
        stripSymbols(
          client.readFragment({
            id: 'foo',
            fragment: gql`
              fragment x on Foo {
                a
                b
                c
                bar {
                  d
                  e
                  f
                }
              }
            `,
          }),
        ),
      ).toEqual({
        __typename: 'Foo',
        a: 7,
        b: 2,
        c: 3,
        bar: { __typename: 'Bar', d: 4, e: 5, f: 6 },
      });

      client.writeFragment({
        id: 'foo',
        fragment: gql`
          fragment x on Foo {
            bar {
              d
            }
          }
        `,
        data: { __typename: 'Foo', bar: { __typename: 'Bar', d: 8 } },
      });

      expect(
        stripSymbols(
          client.readFragment({
            id: 'foo',
            fragment: gql`
              fragment x on Foo {
                a
                b
                c
                bar {
                  d
                  e
                  f
                }
              }
            `,
          }),
        ),
      ).toEqual({
        __typename: 'Foo',
        a: 7,
        b: 2,
        c: 3,
        bar: { __typename: 'Bar', d: 8, e: 5, f: 6 },
      });

      client.writeFragment({
        id: '$foo.bar',
        fragment: gql`
          fragment y on Bar {
            e
          }
        `,
        data: { __typename: 'Bar', e: 9 },
      });

      expect(
        stripSymbols(
          client.readFragment({
            id: 'foo',
            fragment: gql`
              fragment x on Foo {
                a
                b
                c
                bar {
                  d
                  e
                  f
                }
              }
            `,
          }),
        ),
      ).toEqual({
        __typename: 'Foo',
        a: 7,
        b: 2,
        c: 3,
        bar: { __typename: 'Bar', d: 8, e: 9, f: 6 },
      });

      expect((client.cache as InMemoryCache).extract()).toMatchSnapshot();
    });

    it('will write data to a specific id', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache({
          dataIdFromObject: (o: any) => o.key,
        }),
      });

      client.writeQuery({
        query: gql`
          {
            a
            b
            foo {
              c
              d
              bar {
                key
                e
                f
              }
            }
          }
        `,
        data: {
          a: 1,
          b: 2,
          foo: {
            __typename: 'foo',
            c: 3,
            d: 4,
            bar: { key: 'foobar', __typename: 'bar', e: 5, f: 6 },
          },
        },
      });

      expect(
        stripSymbols(
          client.readQuery({
            query: gql`
              {
                a
                b
                foo {
                  c
                  d
                  bar {
                    key
                    e
                    f
                  }
                }
              }
            `,
          }),
        ),
      ).toEqual({
        a: 1,
        b: 2,
        foo: {
          __typename: 'foo',
          c: 3,
          d: 4,
          bar: { __typename: 'bar', key: 'foobar', e: 5, f: 6 },
        },
      });

      expect((client.cache as InMemoryCache).extract()).toMatchSnapshot();
    });

    it('will not use a default id getter if __typename is not present', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache({
          addTypename: false,
        }),
      });

      client.writeQuery({
        query: gql`
          {
            a
            b
            foo {
              c
              d
              bar {
                id
                e
                f
              }
            }
          }
        `,
        data: {
          a: 1,
          b: 2,
          foo: { c: 3, d: 4, bar: { id: 'foobar', e: 5, f: 6 } },
        },
      });

      client.writeQuery({
        query: gql`
          {
            g
            h
            bar {
              i
              j
              foo {
                _id
                k
                l
              }
            }
          }
        `,
        data: {
          g: 8,
          h: 9,
          bar: { i: 10, j: 11, foo: { _id: 'barfoo', k: 12, l: 13 } },
        },
      });

      expect((client.cache as InMemoryCache).extract()).toEqual({
        ROOT_QUERY: {
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
            id: '$ROOT_QUERY.foo.bar',
            generated: true,
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
        '$ROOT_QUERY.foo.bar': {
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

    it('will not use a default id getter if id and _id are not present', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });

      client.writeQuery({
        query: gql`
          {
            a
            b
            foo {
              c
              d
              bar {
                e
                f
              }
            }
          }
        `,
        data: {
          a: 1,
          b: 2,
          foo: {
            __typename: 'foo',
            c: 3,
            d: 4,
            bar: { __typename: 'bar', e: 5, f: 6 },
          },
        },
      });

      client.writeQuery({
        query: gql`
          {
            g
            h
            bar {
              i
              j
              foo {
                k
                l
              }
            }
          }
        `,
        data: {
          g: 8,
          h: 9,
          bar: {
            __typename: 'bar',
            i: 10,
            j: 11,
            foo: { __typename: 'foo', k: 12, l: 13 },
          },
        },
      });

      expect((client.cache as InMemoryCache).extract()).toMatchSnapshot();
    });

    it('will use a default id getter if __typename and id are present', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });

      client.writeQuery({
        query: gql`
          {
            a
            b
            foo {
              c
              d
              bar {
                id
                e
                f
              }
            }
          }
        `,
        data: {
          a: 1,
          b: 2,
          foo: {
            __typename: 'foo',
            c: 3,
            d: 4,
            bar: { __typename: 'bar', id: 'foobar', e: 5, f: 6 },
          },
        },
      });

      expect((client.cache as InMemoryCache).extract()).toMatchSnapshot();
    });

    it('will use a default id getter if __typename and _id are present', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });

      client.writeQuery({
        query: gql`
          {
            a
            b
            foo {
              c
              d
              bar {
                _id
                e
                f
              }
            }
          }
        `,
        data: {
          a: 1,
          b: 2,
          foo: {
            __typename: 'foo',
            c: 3,
            d: 4,
            bar: { __typename: 'bar', _id: 'foobar', e: 5, f: 6 },
          },
        },
      });

      expect((client.cache as InMemoryCache).extract()).toMatchSnapshot();
    });

    it('will not use a default id getter if id is present and __typename is not present', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache({
          addTypename: false,
        }),
      });

      client.writeQuery({
        query: gql`
          {
            a
            b
            foo {
              c
              d
              bar {
                id
                e
                f
              }
            }
          }
        `,
        data: {
          a: 1,
          b: 2,
          foo: { c: 3, d: 4, bar: { id: 'foobar', e: 5, f: 6 } },
        },
      });

      expect((client.cache as InMemoryCache).extract()).toEqual({
        ROOT_QUERY: {
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
            id: '$ROOT_QUERY.foo.bar',
            generated: true,
          },
        },
        '$ROOT_QUERY.foo.bar': {
          id: 'foobar',
          e: 5,
          f: 6,
        },
      });
    });

    it('will not use a default id getter if _id is present but __typename is not present', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache({
          addTypename: false,
        }),
      });

      client.writeQuery({
        query: gql`
          {
            a
            b
            foo {
              c
              d
              bar {
                _id
                e
                f
              }
            }
          }
        `,
        data: {
          a: 1,
          b: 2,
          foo: { c: 3, d: 4, bar: { _id: 'foobar', e: 5, f: 6 } },
        },
      });

      expect((client.cache as InMemoryCache).extract()).toEqual({
        ROOT_QUERY: {
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
            id: '$ROOT_QUERY.foo.bar',
            generated: true,
          },
        },
        '$ROOT_QUERY.foo.bar': {
          _id: 'foobar',
          e: 5,
          f: 6,
        },
      });
    });

    it('will not use a default id getter if either _id or id is present when __typename is not also present', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache({
          addTypename: false,
        }),
      });

      client.writeQuery({
        query: gql`
          {
            a
            b
            foo {
              c
              d
              bar {
                id
                e
                f
              }
            }
          }
        `,
        data: {
          a: 1,
          b: 2,
          foo: {
            c: 3,
            d: 4,
            bar: { __typename: 'bar', id: 'foobar', e: 5, f: 6 },
          },
        },
      });

      client.writeQuery({
        query: gql`
          {
            g
            h
            bar {
              i
              j
              foo {
                _id
                k
                l
              }
            }
          }
        `,
        data: {
          g: 8,
          h: 9,
          bar: { i: 10, j: 11, foo: { _id: 'barfoo', k: 12, l: 13 } },
        },
      });

      expect((client.cache as InMemoryCache).extract()).toMatchSnapshot();
    });

    it('will use a default id getter if one is not specified and __typename is present along with either _id or id', () => {
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
      });

      client.writeQuery({
        query: gql`
          {
            a
            b
            foo {
              c
              d
              bar {
                id
                e
                f
              }
            }
          }
        `,
        data: {
          a: 1,
          b: 2,
          foo: {
            __typename: 'foo',
            c: 3,
            d: 4,
            bar: { __typename: 'bar', id: 'foobar', e: 5, f: 6 },
          },
        },
      });

      client.writeQuery({
        query: gql`
          {
            g
            h
            bar {
              i
              j
              foo {
                _id
                k
                l
              }
            }
          }
        `,
        data: {
          g: 8,
          h: 9,
          bar: {
            __typename: 'bar',
            i: 10,
            j: 11,
            foo: { __typename: 'foo', _id: 'barfoo', k: 12, l: 13 },
          },
        },
      });

      expect((client.cache as InMemoryCache).extract()).toMatchSnapshot();
    });
  });

  describe('watchQuery', () => {
    it(
      'should change the `fetchPolicy` to `cache-first` if network fetching ' +
        'is disabled, and the incoming `fetchPolicy` is set to ' +
        '`network-only` or `cache-and-network`',
      () => {
        const client = new ApolloClient({
          link: ApolloLink.empty(),
          cache: new InMemoryCache(),
        });
        client.disableNetworkFetches = true;

        const query = gql`
          query someData {
            foo {
              bar
            }
          }
        `;

        ['network-only', 'cache-and-network'].forEach(
          (fetchPolicy: FetchPolicy) => {
            const observable = client.watchQuery({
              query,
              fetchPolicy,
            });
            expect(observable.options.fetchPolicy).toEqual('cache-first');
          },
        );
      },
    );

    it(
      'should not change the incoming `fetchPolicy` if network fetching ' +
        'is enabled',
      () => {
        const client = new ApolloClient({
          link: ApolloLink.empty(),
          cache: new InMemoryCache(),
        });
        client.disableNetworkFetches = false;

        const query = gql`
          query someData {
            foo {
              bar
            }
          }
        `;

        [
          'cache-first',
          'cache-and-network',
          'network-only',
          'cache-only',
          'no-cache',
        ].forEach((fetchPolicy: FetchPolicy) => {
          const observable = client.watchQuery({
            query,
            fetchPolicy,
          });
          expect(observable.options.fetchPolicy).toEqual(fetchPolicy);
        });
      },
    );
  });

  describe('defaultOptions', () => {
    it(
      'should set `defaultOptions` to an empty object if not provided in ' +
        'the constructor',
      () => {
        const client = new ApolloClient({
          link: ApolloLink.empty(),
          cache: new InMemoryCache(),
        });
        expect(client.defaultOptions).toEqual({});
      },
    );

    it('should set `defaultOptions` using options passed into the constructor', () => {
      const defaultOptions: DefaultOptions = {
        query: {
          fetchPolicy: 'no-cache',
        },
      };
      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
        defaultOptions,
      });
      expect(client.defaultOptions).toEqual(defaultOptions);
    });

    it('should use default options (unless overridden) when querying', async () => {
      const defaultOptions: DefaultOptions = {
        query: {
          fetchPolicy: 'no-cache',
        },
      };

      const client = new ApolloClient({
        link: ApolloLink.empty(),
        cache: new InMemoryCache(),
        defaultOptions,
      });

      client.initQueryManager();

      let queryOptions: QueryOptions = {
        query: gql`
          {
            a
          }
        `,
      };
      const _query = client.queryManager!.query;
      client.queryManager!.query = options => {
        queryOptions = options;
        return _query(options);
      };

      try {
        await client.query({
          query: gql`
            {
              a
            }
          `,
        });
      } catch (error) {
        // Swallow errors caused by mocking; not part of this test
      }

      expect(queryOptions.fetchPolicy).toEqual(
        defaultOptions.query!.fetchPolicy,
      );
    });
  });
});
