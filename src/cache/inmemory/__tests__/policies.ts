import gql from "graphql-tag";
import { InMemoryCache } from "../inMemoryCache";
import { StoreValue } from "../../../utilities";
import { FieldPolicy } from "../policies";

describe("type policies", function () {
  const bookQuery = gql`
    query {
      book {
        title
        author {
          name
        }
      }
    }
  `;

  const theInformationBookData = {
    __typename: "Book",
    isbn: "1400096235",
    title: "The Information",
    subtitle: "A History, a Theory, a Flood",
    author: {
      name: "James Gleick"
    },
  };

  function checkAuthorName(cache: InMemoryCache) {
    expect(cache.readQuery({
      query: gql`
        query {
          book {
            author {
              name
            }
          }
        }
      `,
    })).toEqual({
      book: {
        __typename: "Book",
        author: {
          name: theInformationBookData.author.name,
        },
      },
    });
  }

  it("can specify basic keyFields", function () {
    const cache = new InMemoryCache({
      typePolicies: {
        Book: {
          keyFields: ["isbn"],
        },
      },
    });

    cache.writeQuery({
      query: bookQuery,
      data: {
        book: theInformationBookData,
      },
    });

    expect(cache.extract(true)).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        book: {
          __ref: 'Book:{"isbn":"1400096235"}',
        },
      },
      'Book:{"isbn":"1400096235"}': {
        __typename: "Book",
        title: "The Information",
        author: {
          name: "James Gleick"
        },
      },
    });

    checkAuthorName(cache);
  });

  it("can specify composite keyFields", function () {
    const cache = new InMemoryCache({
      typePolicies: {
        Book: {
          keyFields: ["title", "author", ["name"]],
        },
      },
    });

    cache.writeQuery({
      query: bookQuery,
      data: {
        book: theInformationBookData,
      },
    });

    expect(cache.extract(true)).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        book: {
          __ref: 'Book:{"title":"The Information","author":{"name":"James Gleick"}}',
        },
      },
      'Book:{"title":"The Information","author":{"name":"James Gleick"}}': {
        __typename: "Book",
        title: "The Information",
        author: {
          name: "James Gleick"
        },
      },
    });

    checkAuthorName(cache);
  });

  it("keeps keyFields in specified order", function () {
    const cache = new InMemoryCache({
      typePolicies: {
        Book: {
          keyFields: ["author", ["name"], "title"],
        },
      },
    });

    cache.writeQuery({
      query: bookQuery,
      data: {
        book: theInformationBookData,
      },
    });

    expect(cache.extract(true)).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        book: {
          __ref: 'Book:{"author":{"name":"James Gleick"},"title":"The Information"}',
        },
      },
      'Book:{"author":{"name":"James Gleick"},"title":"The Information"}': {
        __typename: "Book",
        title: "The Information",
        author: {
          name: "James Gleick"
        },
      },
    });

    checkAuthorName(cache);
  });

  it("accepts keyFields functions", function () {
    const cache = new InMemoryCache({
      typePolicies: {
        Book: {
          keyFields(book, context) {
            expect(context.selectionSet.kind).toBe("SelectionSet");
            expect(context.fragmentMap).toEqual({});
            return context.typename + ":" + book.isbn;
          },
        },
      },
    });

    cache.writeQuery({
      query: bookQuery,
      data: {
        book: theInformationBookData,
      },
    });

    expect(cache.extract(true)).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        book: {
          __ref: "Book:1400096235",
        },
      },
      "Book:1400096235": {
        __typename: "Book",
        title: "The Information",
        author: {
          name: "James Gleick"
        },
      },
    });

    checkAuthorName(cache);
  });

  it("works with fragments that contain aliased key fields", function () {
    const cache = new InMemoryCache({
      typePolicies: {
        Book: {
          keyFields: ["ISBN", "title"],
        },
      },
    });

    cache.writeQuery({
      query: gql`
        query {
          book {
            ...BookFragment
            author {
              name
            }
          }
        }
        fragment BookFragment on Book {
          isbn: ISBN
          title
        }
      `,
      data: {
        book: theInformationBookData,
      },
    });

    expect(cache.extract(true)).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        book: {
          __ref: 'Book:{"ISBN":"1400096235","title":"The Information"}',
        },
      },
      'Book:{"ISBN":"1400096235","title":"The Information"}': {
        __typename: "Book",
        ISBN: "1400096235",
        title: "The Information",
        author: {
          name: "James Gleick"
        },
      },
    });

    checkAuthorName(cache);
  });

  it("complains about missing key fields", function () {
    const cache = new InMemoryCache({
      typePolicies: {
        Book: {
          keyFields: ["title", "year"],
        },
      },
    });

    const query = gql`
      query {
        book {
          title
          year
        }
      }
    `;

    cache.writeQuery({
      query,
      data: {
        book: {
          year: 2011,
          theInformationBookData,
        },
      },
    });

    expect(() => {
      cache.writeQuery({
        query,
        data: {
          book: theInformationBookData,
        },
      });
    }).toThrow("Missing field year while computing key fields");
  });

  describe("field policies", function () {
    it("can filter key arguments", function () {
      const cache = new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              book: {
                keyArgs: ["isbn"],
              },
            },
          },
        },
      });

      cache.writeQuery({
        query: gql`
          query {
            book(junk: "ignored", isbn: "0465030793") {
              title
            }
          }
        `,
        data: {
          book: {
            __typename: "Book",
            isbn: "0465030793",
            title: "I Am a Strange Loop",
          },
        },
      });

      expect(cache.extract(true)).toEqual({
        ROOT_QUERY: {
          __typename: "Query",
          'book:{"isbn":"0465030793"}': {
            __typename: "Book",
            title: "I Am a Strange Loop",
          },
        },
      });
    });

    it("can filter key arguments in non-Query fields", function () {
      const cache = new InMemoryCache({
        typePolicies: {
          Book: {
            keyFields: ["isbn"],
            fields: {
              author: {
                keyArgs: ["firstName", "lastName"],
              },
            },
          },
          Author: {
            keyFields: ["name"],
          },
        },
      });

      const query = gql`
        query {
          book {
            isbn
            title
            author(
              firstName: "Douglas",
              middleName: "Richard",
              lastName: "Hofstadter"
            ) {
              name
            }
          }
        }
      `;

      const data = {
        book: {
          __typename: "Book",
          isbn: "0465030793",
          title: "I Am a Strange Loop",
          author: {
            __typename: "Author",
            name: "Douglas Hofstadter",
          },
        },
      };

      cache.writeQuery({ query, data });

      expect(cache.extract(true)).toEqual({
        ROOT_QUERY: {
          __typename: "Query",
          book: {
            __ref: 'Book:{"isbn":"0465030793"}',
          },
        },
        'Book:{"isbn":"0465030793"}': {
          __typename: "Book",
          isbn: "0465030793",
          title: "I Am a Strange Loop",
          'author:{"firstName":"Douglas","lastName":"Hofstadter"}': {
            __ref: 'Author:{"name":"Douglas Hofstadter"}',
          },
        },
        'Author:{"name":"Douglas Hofstadter"}': {
          __typename: "Author",
          name: "Douglas Hofstadter",
        },
      });

      const result = cache.readQuery({ query });
      expect(result).toEqual(data);
    });

    it("can use read function to implement synthetic/computed keys", function () {
      const cache = new InMemoryCache({
        typePolicies: {
          Person: {
            keyFields: ["firstName", "lastName"],
            fields: {
              fullName(_, { parentObject: person }) {
                return `${person.firstName} ${person.lastName}`;
              },
            },
          },
        },
      });

      cache.writeQuery({
        query: gql`
          query {
            me {
              firstName
              lastName
            }
          }
        `,
        data: {
          me: {
            __typename: "Person",
            firstName: "Ben",
            lastName: "Newman",
          },
        },
      });

      const expectedExtraction = {
        ROOT_QUERY: {
          __typename: "Query",
          me: {
            __ref: 'Person:{"firstName":"Ben","lastName":"Newman"}',
          },
        },
        'Person:{"firstName":"Ben","lastName":"Newman"}': {
          __typename: "Person",
          firstName: "Ben",
          lastName: "Newman",
        },
      };

      expect(cache.extract(true)).toEqual(expectedExtraction);

      const expectedResult = {
        me: {
          __typename: "Person",
          fullName: "Ben Newman",
        },
      };

      expect(cache.readQuery({
        query: gql`
          query {
            me {
              fullName
            }
          }
        `,
      })).toEqual(expectedResult);

      expect(cache.readQuery({
        query: gql`
          query {
            me {
              fullName @client
            }
          }
        `,
      })).toEqual(expectedResult);

      expect(cache.extract(true)).toEqual(expectedExtraction);
    });

    it("can return void to indicate missing field", function () {
      let secretReadAttempted = false;

      const cache = new InMemoryCache({
        typePolicies: {
          Person: {
            fields: {
              secret() {
                secretReadAttempted = true;
                // Return nothing to signal field is missing.
              },
            },
          },
        },
      });

      const query = gql`
        query {
          me {
            name
          }
        }
      `;

      cache.writeQuery({
        query,
        data: {
          me: {
            __typename: "Person",
            name: "Ben Newman",
          },
        },
      });

      expect(secretReadAttempted).toBe(false);

      expect(() => {
        cache.readQuery({
          query: gql`
            query {
              me {
                secret
              }
            }
          `
        });
      }).toThrow("Can't find field secret");

      expect(secretReadAttempted).toBe(true);
    });

    it("can define custom merge functions", function () {
      const cache = new InMemoryCache({
        typePolicies: {
          Person: {
            // Disables normalization for the Person type, which means the
            // todos field will be nested inside a non-normalized object
            // (with __typename "Person") directly under the ROOT_QUERY.me
            // field, which exercises what happens when mergeOverrides
            // becomes nested (see writeToStore.ts).
            keyFields: false,

            fields: {
              todos: {
                keyArgs: [],

                read(existing: any[], { args }) {
                  return existing.slice(
                    args.offset,
                    args.offset + args.limit,
                  );
                },

                merge(existing: any[], incoming: any[], { args }) {
                  const copy = existing ? existing.slice(0) : [];
                  const limit = args.offset + args.limit;
                  for (let i = args.offset; i < limit; ++i) {
                    copy[i] = incoming[i - args.offset];
                  }
                  return copy;
                }
              },
            },
          },

          Todo: {
            keyFields: ["id"],
          },
        },
      });

      const query = gql`
        query {
          me {
            todos(offset: $offset, limit: $limit) {
              text
            }
          }
        }
      `;

      cache.writeQuery({
        query,
        data: {
          me: {
            __typename: "Person",
            id: "ignored",
            todos: [
              { __typename: "Todo", id: 1, text: "Write more merge tests" },
              { __typename: "Todo", id: 2, text: "Write pagination tests" },
            ],
          },
        },
        variables: {
          offset: 0,
          limit: 2,
        },
      });

      expect(cache.extract(true)).toEqual({
        ROOT_QUERY: {
          __typename: "Query",
          me: {
            __typename: "Person",
            "todos:{}": [
              { __ref: 'Todo:{"id":1}' },
              { __ref: 'Todo:{"id":2}' },
            ],
          },
        },
        'Todo:{"id":1}': {
          __typename: "Todo",
          text: "Write more merge tests",
        },
        'Todo:{"id":2}': {
          __typename: "Todo",
          text: "Write pagination tests",
        },
      });

      cache.writeQuery({
        query,
        data: {
          me: {
            __typename: "Person",
            todos: [
              { __typename: "Todo", id: 5, text: "Submit pull request" },
              { __typename: "Todo", id: 6, text: "Merge pull request" },
            ],
          },
        },
        variables: {
          offset: 4,
          limit: 2,
        },
      });

      expect(cache.extract(true)).toEqual({
        ROOT_QUERY: {
          __typename: "Query",
          me: {
            __typename: "Person",
            "todos:{}": [
              { __ref: 'Todo:{"id":1}' },
              { __ref: 'Todo:{"id":2}' },
              void 0,
              void 0,
              { __ref: 'Todo:{"id":5}' },
              { __ref: 'Todo:{"id":6}' },
            ],
          },
        },
        'Todo:{"id":1}': {
          __typename: "Todo",
          text: "Write more merge tests",
        },
        'Todo:{"id":2}': {
          __typename: "Todo",
          text: "Write pagination tests",
        },
        'Todo:{"id":5}': {
          __typename: "Todo",
          text: "Submit pull request",
        },
        'Todo:{"id":6}': {
          __typename: "Todo",
          text: "Merge pull request",
        },
      });

      cache.writeQuery({
        query,
        data: {
          me: {
            __typename: "Person",
            todos: [
              { __typename: "Todo", id: 3, text: "Iron out merge API" },
              { __typename: "Todo", id: 4, text: "Take a nap" },
            ],
          },
        },
        variables: {
          offset: 2,
          limit: 2,
        },
      });

      expect(cache.extract(true)).toEqual({
        ROOT_QUERY: {
          __typename: "Query",
          me: {
            __typename: "Person",
            "todos:{}": [
              { __ref: 'Todo:{"id":1}' },
              { __ref: 'Todo:{"id":2}' },
              { __ref: 'Todo:{"id":3}' },
              { __ref: 'Todo:{"id":4}' },
              { __ref: 'Todo:{"id":5}' },
              { __ref: 'Todo:{"id":6}' },
            ],
          },
        },
        'Todo:{"id":1}': {
          __typename: "Todo",
          text: "Write more merge tests",
        },
        'Todo:{"id":2}': {
          __typename: "Todo",
          text: "Write pagination tests",
        },
        'Todo:{"id":3}': {
          __typename: "Todo",
          text: "Iron out merge API",
        },
        'Todo:{"id":4}': {
          __typename: "Todo",
          text: "Take a nap",
        },
        'Todo:{"id":5}': {
          __typename: "Todo",
          text: "Submit pull request",
        },
        'Todo:{"id":6}': {
          __typename: "Todo",
          text: "Merge pull request",
        },
      });

      expect(cache.gc()).toEqual([]);

      // The moment of truth!
      expect(
        cache.readQuery({
          query,
          variables: {
            offset: 1,
            limit: 4,
          },
        })
      ).toEqual({
        me: {
          __typename: "Person",
          todos: [
            { __typename: "Todo", text: "Write pagination tests" },
            { __typename: "Todo", text: "Iron out merge API" },
            { __typename: "Todo", text: "Take a nap" },
            { __typename: "Todo", text: "Submit pull request" },
          ],
        },
      });
    });
  });
});
