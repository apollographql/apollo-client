import gql from 'graphql-tag';
import { InMemoryCache } from '../inMemoryCache';

describe('optimistic cache layers', () => {
  it('return === results for repeated reads', () => {
    const cache = new InMemoryCache({
      resultCaching: true,
      dataIdFromObject(value: any) {
        switch (value && value.__typename) {
          case 'Book':
            return 'Book:' + value.isbn;
          case 'Author':
            return 'Author:' + value.name;
        }
      },
    });

    const query = gql`
      {
        book {
          title
          author {
            name
          }
        }
      }
    `;

    function readOptimistic(cache: InMemoryCache) {
      return cache.readQuery<{ book: any }>({ query }, true);
    }

    function readRealistic(cache: InMemoryCache) {
      return cache.readQuery<{ book: any }>({ query }, false);
    }

    cache.writeQuery({
      query,
      data: {
        book: {
          __typename: 'Book',
          isbn: '1980719802',
          title: '1984',
          author: {
            __typename: 'Author',
            name: 'George Orwell',
          },
        },
      },
    });

    const result1984 = readOptimistic(cache);
    expect(result1984).toEqual({
      book: {
        __typename: 'Book',
        title: '1984',
        author: {
          __typename: 'Author',
          name: 'George Orwell',
        },
      },
    });

    expect(result1984).toBe(readOptimistic(cache));
    expect(result1984).toBe(readRealistic(cache));

    let result2666InTransaction: ReturnType<typeof readOptimistic>;
    cache.performTransaction(proxy => {
      expect(readOptimistic(cache)).toEqual(result1984);

      proxy.writeQuery({
        query,
        data: {
          book: {
            __typename: 'Book',
            isbn: '0312429215',
            title: '2666',
            author: {
              __typename: 'Author',
              name: 'Roberto Bolaño',
            },
          },
        },
      });

      result2666InTransaction = readOptimistic(cache);
      expect(result2666InTransaction).toEqual({
        book: {
          __typename: 'Book',
          title: '2666',
          author: {
            __typename: 'Author',
            name: 'Roberto Bolaño',
          },
        },
      });
    }, 'first');

    expect(readOptimistic(cache)).toBe(result2666InTransaction);

    expect(result1984).toBe(readRealistic(cache));

    let resultCatch22: ReturnType<typeof readOptimistic>;
    cache.performTransaction(proxy => {
      proxy.writeQuery({
        query,
        data: {
          book: {
            __typename: 'Book',
            isbn: '1451626657',
            title: 'Catch-22',
            author: {
              __typename: 'Author',
              name: 'Joseph Heller',
            },
          },
        },
      });

      expect((resultCatch22 = readOptimistic(cache))).toEqual({
        book: {
          __typename: 'Book',
          title: 'Catch-22',
          author: {
            __typename: 'Author',
            name: 'Joseph Heller',
          },
        },
      });
    }, 'second');

    expect(readOptimistic(cache)).toBe(resultCatch22);

    expect(result1984).toBe(readRealistic(cache));

    cache.removeOptimistic('first');

    expect(readOptimistic(cache)).toBe(resultCatch22);

    // Write a new book to the root Query.book field, which should not affect
    // the 'second' optimistic layer that is still applied.
    cache.writeQuery({
      query,
      data: {
        book: {
          __typename: 'Book',
          isbn: '9781451673319',
          title: 'Fahrenheit 451',
          author: {
            __typename: 'Author',
            name: 'Ray Bradbury',
          },
        },
      },
    });

    expect(readOptimistic(cache)).toBe(resultCatch22);

    const resultF451 = readRealistic(cache);
    expect(resultF451).toEqual({
      book: {
        __typename: 'Book',
        title: 'Fahrenheit 451',
        author: {
          __typename: 'Author',
          name: 'Ray Bradbury',
        },
      },
    });

    cache.removeOptimistic('second');

    expect(resultF451).toBe(readRealistic(cache));
    expect(resultF451).toBe(readOptimistic(cache));

    expect(cache.extract(true)).toEqual({
      ROOT_QUERY: {
        book: { __ref: 'Book:9781451673319' },
      },
      'Book:1980719802': {
        title: '1984',
        author: { __ref: 'Author:George Orwell' },
        __typename: 'Book',
      },
      'Book:9781451673319': {
        title: 'Fahrenheit 451',
        author: { __ref: 'Author:Ray Bradbury' },
        __typename: 'Book',
      },
      'Author:George Orwell': {
        __typename: 'Author',
        name: 'George Orwell',
      },
      'Author:Ray Bradbury': {
        __typename: 'Author',
        name: 'Ray Bradbury',
      },
    });
  });
});
