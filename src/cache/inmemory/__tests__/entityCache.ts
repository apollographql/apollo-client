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

  function newBookAuthorCache() {
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

    return {
      cache,
      query,
    };
  }

  it('should reclaim no-longer-reachable, unretained entities', () => {
    const { cache, query } = newBookAuthorCache();

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
        __typename: "Query",
        book: {
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
        __typename: "Query",
        book: {
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
        __typename: "Query",
        book: {
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

    expect(cache.retain('Author:Ray Bradbury')).toBe(1);

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
        __typename: "Query",
        book: {
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

    expect(cache.gc()).toEqual([]);

    expect(cache.release('Author:Ray Bradbury')).toBe(0);

    expect(cache.gc()).toEqual([
      'Author:Ray Bradbury',
    ]);

    expect(cache.gc()).toEqual([]);
  });

  it('should respect optimistic updates, when active', () => {
    const { cache, query } = newBookAuthorCache();

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
        __typename: "Query",
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
        __typename: "Query",
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
        __typename: "Query",
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

  it('should respect retain/release methods', () => {
    const { query, cache } = newBookAuthorCache();

    const eagerBookData = {
      __typename: 'Book',
      isbn: '1603589082',
      title: 'Eager',
      subtitle: 'The Surprising, Secret Life of Beavers and Why They Matter',
      author: {
        __typename: 'Author',
        name: 'Ben Goldfarb',
      },
    };

    const spinelessBookData = {
      __typename: 'Book',
      isbn: '0735211280',
      title: 'Spineless',
      subtitle: 'The Science of Jellyfish and the Art of Growing a Backbone',
      author: {
        __typename: 'Author',
        name: 'Juli Berwald',
      },
    };

    cache.writeQuery({
      query,
      data: {
        book: spinelessBookData,
      },
    });

    expect(cache.extract(true)).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        book: {
          __ref: "Book:0735211280",
        },
      },
      "Book:0735211280": {
        __typename: "Book",
        author: {
          __ref: "Author:Juli Berwald",
        },
        title: "Spineless",
      },
      "Author:Juli Berwald": {
        __typename: "Author",
        name: "Juli Berwald",
      },
    });

    cache.writeQuery({
      query,
      data: {
        book: eagerBookData,
      },
    });

    const snapshotWithBothBooksAndAuthors = {
      ROOT_QUERY: {
        __typename: "Query",
        book: {
          __ref: "Book:1603589082",
        },
      },
      "Book:0735211280": {
        __typename: "Book",
        author: {
          __ref: "Author:Juli Berwald",
        },
        title: "Spineless",
      },
      "Author:Juli Berwald": {
        __typename: "Author",
        name: "Juli Berwald",
      },
      "Book:1603589082": {
        __typename: "Book",
        author: {
          __ref: "Author:Ben Goldfarb",
        },
        title: "Eager",
      },
      "Author:Ben Goldfarb": {
        __typename: "Author",
        name: "Ben Goldfarb",
      },
    };

    expect(cache.extract(true)).toEqual(snapshotWithBothBooksAndAuthors);

    expect(cache.retain("Book:0735211280")).toBe(1);

    expect(cache.gc()).toEqual([]);

    expect(cache.retain("Author:Juli Berwald")).toBe(1);

    cache.recordOptimisticTransaction(proxy => {
      proxy.writeFragment({
        id: "Author:Juli Berwald",
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
              isbn: '0735211280',
            },
          ],
        },
      });
    }, "juli books");

    // Retain the Spineless book on the optimistic layer (for the first time)
    // but release it on the root layer.
    expect(cache.retain("Book:0735211280", true)).toBe(1);
    expect(cache.release("Book:0735211280")).toBe(0);

    // The Spineless book is still protected by the reference from author Juli
    // Berwald's optimistically-added author.books field.
    expect(cache.gc()).toEqual([]);

    expect(cache.extract(true)).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        book: {
          __ref: "Book:1603589082",
        },
      },
      "Book:0735211280": {
        __typename: "Book",
        author: {
          __ref: "Author:Juli Berwald",
        },
        title: "Spineless",
      },
      "Author:Juli Berwald": {
        __typename: "Author",
        name: "Juli Berwald",
        // Note this extra optimistic field.
        books: [
          {
            __ref: "Book:0735211280",
          },
        ],
      },
      "Book:1603589082": {
        __typename: "Book",
        author: {
          __ref: "Author:Ben Goldfarb",
        },
        title: "Eager",
      },
      "Author:Ben Goldfarb": {
        __typename: "Author",
        name: "Ben Goldfarb",
      },
    });

    // A non-optimistic snapshot will not have the extra books field.
    expect(cache.extract(false)).toEqual(snapshotWithBothBooksAndAuthors);

    cache.removeOptimistic("juli books");

    // The optimistic books field is gone now that we've removed the optimistic
    // layer that added it.
    expect(cache.extract(true)).toEqual(snapshotWithBothBooksAndAuthors);

    // The Spineless book is no longer retained or kept alive by any other root
    // IDs, so it can finally be collected.
    expect(cache.gc()).toEqual([
      "Book:0735211280",
    ]);

    expect(cache.release("Author:Juli Berwald")).toBe(0);

    // Now that Juli Berwald's author entity is no longer retained, garbage
    // collection cometh for her. Look out, Juli!
    expect(cache.gc()).toEqual([
      "Author:Juli Berwald",
    ]);

    expect(cache.gc()).toEqual([]);
  });

  it('allows cache eviction', () => {
    const { cache, query } = newBookAuthorCache();

    cache.writeQuery({
      query,
      data: {
        book: {
          __typename: "Book",
          isbn: "031648637X",
          title: "The Cuckoo's Calling",
          author: {
            __typename: "Author",
            name: "Robert Galbraith",
          },
        },
      },
    });

    expect(cache.evict("Author:J.K. Rowling")).toBe(false);

    const bookAuthorFragment = gql`
      fragment BookAuthor on Book {
        author {
          name
        }
      }
    `;

    const fragmentResult = cache.readFragment({
      id: "Book:031648637X",
      fragment: bookAuthorFragment,
    });

    expect(fragmentResult).toEqual({
      __typename: "Book",
      author: {
        __typename: "Author",
        name: "Robert Galbraith",
      },
    });

    cache.recordOptimisticTransaction(proxy => {
      proxy.writeFragment({
        id: "Book:031648637X",
        fragment: bookAuthorFragment,
        data: {
          ...fragmentResult,
          author: {
            __typename: "Author",
            name: "J.K. Rowling",
          },
        },
      });
    }, "real name");

    const snapshotWithBothNames = {
      ROOT_QUERY: {
        __typename: "Query",
        book: {
          __ref: "Book:031648637X",
        },
      },
      "Book:031648637X": {
        __typename: "Book",
        author: {
          __ref: "Author:J.K. Rowling",
        },
        title: "The Cuckoo's Calling",
      },
      "Author:Robert Galbraith": {
        __typename: "Author",
        name: "Robert Galbraith",
      },
      "Author:J.K. Rowling": {
        __typename: "Author",
        name: "J.K. Rowling",
      },
    };

    expect(cache.extract(true)).toEqual(snapshotWithBothNames);

    expect(cache.gc()).toEqual([]);

    expect(cache.retain('Author:Robert Galbraith')).toBe(1);

    expect(cache.gc()).toEqual([]);

    expect(cache.evict("Author:Robert Galbraith")).toBe(true);

    expect(cache.gc()).toEqual([]);

    cache.removeOptimistic("real name");

    expect(cache.extract(true)).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        book: {
          __ref: "Book:031648637X",
        },
      },
      "Book:031648637X": {
        __typename: "Book",
        author: {
          __ref: "Author:Robert Galbraith",
        },
        title: "The Cuckoo's Calling",
      },
      "Author:Robert Galbraith": {
        __typename: "Author",
        name: "Robert Galbraith",
      },
    });

    cache.writeFragment({
      id: "Book:031648637X",
      fragment: bookAuthorFragment,
      data: {
        ...fragmentResult,
        author: {
          __typename: "Author",
          name: "J.K. Rowling",
        },
      },
    });

    expect(cache.extract(true)).toEqual(snapshotWithBothNames);

    expect(cache.retain("Author:Robert Galbraith")).toBe(2);

    expect(cache.gc()).toEqual([]);

    expect(cache.release("Author:Robert Galbraith")).toBe(1);
    expect(cache.release("Author:Robert Galbraith")).toBe(0);

    expect(cache.gc()).toEqual([
      "Author:Robert Galbraith",
    ]);

    // If you're ever tempted to do this, you probably want to use cache.clear()
    // instead, but evicting the ROOT_QUERY should work at least.
    expect(cache.evict("ROOT_QUERY")).toBe(true);

    expect(cache.extract(true)).toEqual({
      "Book:031648637X": {
        __typename: "Book",
        author: {
          __ref: "Author:J.K. Rowling",
        },
        title: "The Cuckoo's Calling",
      },
      "Author:J.K. Rowling": {
        __typename: "Author",
        name: "J.K. Rowling",
      },
    });

    expect(cache.retain("Book:031648637X")).toBe(2);
    expect(cache.release("Book:031648637X")).toBe(1);
    expect(cache.release("Book:031648637X")).toBe(0);

    expect(cache.gc().sort()).toEqual([
      "Author:J.K. Rowling",
      "Book:031648637X",
    ]);
  });
});
