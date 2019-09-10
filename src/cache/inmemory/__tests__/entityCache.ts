import gql from 'graphql-tag';
import { EntityCache, supportsResultCaching } from '../entityCache';
import { InMemoryCache } from '../inMemoryCache';

describe('EntityCache', () => {
  it('should support result caching if so configured', () => {
    const cacheWithResultCaching = new EntityCache.Root({
      resultCaching: true,
    });

    const cacheWithoutResultCaching = new EntityCache.Root({
      resultCaching: false,
    });

    expect(supportsResultCaching({ some: "arbitrary object " })).toBe(false);
    expect(supportsResultCaching(cacheWithResultCaching)).toBe(true);
    expect(supportsResultCaching(cacheWithoutResultCaching)).toBe(false);

    const layerWithCaching = cacheWithResultCaching.addLayer("with caching", () => {});
    expect(supportsResultCaching(layerWithCaching)).toBe(true);
    const anotherLayer = layerWithCaching.addLayer("another layer", () => {});
    expect(supportsResultCaching(anotherLayer)).toBe(true);
    expect(
      anotherLayer
        .removeLayer("with caching")
        .removeLayer("another layer")
    ).toBe(cacheWithResultCaching);
    expect(supportsResultCaching(cacheWithResultCaching)).toBe(true);

    const layerWithoutCaching = cacheWithoutResultCaching.addLayer("with caching", () => {});
    expect(supportsResultCaching(layerWithoutCaching)).toBe(false);
    expect(layerWithoutCaching.removeLayer("with caching")).toBe(cacheWithoutResultCaching);
    expect(supportsResultCaching(cacheWithoutResultCaching)).toBe(false);
  });

  it('should reclaim no-longer-reachable, unretained entities', () => {
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
      query {
        book {
          title
          author {
            name
          }
        }
      }
    `;

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
          }
        },
      },
    });

    expect(cache.extract()).toEqual({
      ROOT_QUERY: {
        'book': {
          __ref: "Book:9781451673319",
        },
      },
      "Book:9781451673319": {
        __typename: "Book",
        title: "Fahrenheit 451",
        author: {
          __ref: 'Author:Ray Bradbury',
        }
      },
      "Author:Ray Bradbury": {
        __typename: "Author",
        name: "Ray Bradbury",
      },
    });

    cache.writeQuery({
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

    const snapshot = cache.extract();

    expect(snapshot).toEqual({
      ROOT_QUERY: {
        'book': {
          __ref: "Book:0312429215",
        },
      },
      "Book:9781451673319": {
        __typename: "Book",
        title: "Fahrenheit 451",
        author: {
          __ref: 'Author:Ray Bradbury',
        }
      },
      "Author:Ray Bradbury": {
        __typename: "Author",
        name: "Ray Bradbury",
      },
      "Book:0312429215": {
        __typename: "Book",
        author: {
          __ref: "Author:Roberto Bolaño",
        },
        title: "2666",
      },
      "Author:Roberto Bolaño": {
        __typename: "Author",
        name: "Roberto Bolaño",
      },
    });

    expect(cache.gc().sort()).toEqual([
      'Author:Ray Bradbury',
      'Book:9781451673319',
    ]);

    expect(cache.extract()).toEqual({
      ROOT_QUERY: {
        'book': {
          __ref: "Book:0312429215",
        },
      },
      "Book:0312429215": {
        __typename: "Book",
        author: {
          __ref: "Author:Roberto Bolaño",
        },
        title: "2666",
      },
      "Author:Roberto Bolaño": {
        __typename: "Author",
        name: "Roberto Bolaño",
      },
    });

    // Nothing left to garbage collect.
    expect(cache.gc()).toEqual([]);

    // Go back to the pre-GC snapshot.
    cache.restore(snapshot);
    expect(cache.extract()).toEqual(snapshot);

    // Reading a specific fragment causes it to be retained during garbage collection.
    const authorNameFragment = gql`
      fragment AuthorName on Author {
        name
      }
    `;
    const ray = cache.readFragment({
      id: 'Author:Ray Bradbury',
      fragment: authorNameFragment,
    });

    expect(ray).toEqual({
      __typename: 'Author',
      name: 'Ray Bradbury',
    });

    expect(cache.gc()).toEqual([
      // Only Fahrenheit 451 (the book) is reclaimed this time.
      'Book:9781451673319',
    ]);

    expect(cache.extract()).toEqual({
      ROOT_QUERY: {
        'book': {
          __ref: "Book:0312429215",
        },
      },
      "Author:Ray Bradbury": {
        __typename: "Author",
        name: "Ray Bradbury",
      },
      "Book:0312429215": {
        __typename: "Book",
        author: {
          __ref: "Author:Roberto Bolaño",
        },
        title: "2666",
      },
      "Author:Roberto Bolaño": {
        __typename: "Author",
        name: "Roberto Bolaño",
      },
    });

    // Nothing left to garbage collect.
    expect(cache.gc()).toEqual([]);
  });

  it('should respect optimistic updates, when active', () => {
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
      query {
        book {
          title
          author {
            name
          }
        }
      }
    `;

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
          }
        },
      },
    });

    expect(cache.gc()).toEqual([]);

    // Orphan the F451 / Ray Bradbury data, but avoid collecting garbage yet.
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
        }
      }
    });

    cache.recordOptimisticTransaction(proxy => {
      proxy.writeFragment({
        id: 'Author:Ray Bradbury',
        fragment: gql`
          fragment AuthorBooks on Author {
            books {
              title
            }
          }
        `,
        data: {
          books: [
            {
              __typename: 'Book',
              isbn: '9781451673319',
            },
          ],
        },
      });
    }, "ray books");

    expect(cache.extract(true)).toEqual({
      ROOT_QUERY: {
        book: {
          __ref: "Book:1980719802",
        },
      },
      "Author:Ray Bradbury": {
        __typename: "Author",
        name: "Ray Bradbury",
        books: [
          {
            __ref: "Book:9781451673319",
          },
        ],
      },
      "Book:9781451673319": {
        __typename: "Book",
        title: "Fahrenheit 451",
        author: {
          __ref: "Author:Ray Bradbury",
        },
      },
      "Author:George Orwell": {
        __typename: "Author",
        name: "George Orwell",
      },
      "Book:1980719802": {
        __typename: "Book",
        title: "1984",
        author: {
          __ref: "Author:George Orwell",
        },
      },
    });

    // Nothing can be reclaimed while the optimistic update is retaining
    // Fahrenheit 451.
    expect(cache.gc()).toEqual([]);

    cache.removeOptimistic("ray books");

    expect(cache.extract(true)).toEqual({
      ROOT_QUERY: {
        book: {
          __ref: "Book:1980719802",
        },
      },
      "Author:Ray Bradbury": {
        __typename: "Author",
        name: "Ray Bradbury",
        // Note that the optimistic books field has disappeared, as expected.
      },
      "Book:9781451673319": {
        __typename: "Book",
        title: "Fahrenheit 451",
        author: {
          __ref: "Author:Ray Bradbury",
        },
      },
      "Author:George Orwell": {
        __typename: "Author",
        name: "George Orwell",
      },
      "Book:1980719802": {
        __typename: "Book",
        title: "1984",
        author: {
          __ref: "Author:George Orwell",
        },
      },
    });

    expect(cache.gc().sort()).toEqual([
      "Author:Ray Bradbury",
      "Book:9781451673319",
    ]);

    expect(cache.extract(true)).toEqual({
      ROOT_QUERY: {
        book: {
          __ref: "Book:1980719802",
        },
      },
      "Author:George Orwell": {
        __typename: "Author",
        name: "George Orwell",
      },
      "Book:1980719802": {
        __typename: "Book",
        title: "1984",
        author: {
          __ref: "Author:George Orwell",
        },
      },
    });

    expect(cache.gc()).toEqual([]);
  });
});
