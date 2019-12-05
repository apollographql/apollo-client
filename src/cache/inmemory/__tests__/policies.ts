import gql from "graphql-tag";
import { InMemoryCache } from "../inMemoryCache";
import { StoreValue } from "../../../utilities";
import { FieldPolicy, Policies } from "../policies";
import { Reference } from "../../../utilities/graphql/storeUtils";

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
            expect(context.policies).toBeInstanceOf(Policies);
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

    it("can use stable storage in read functions", function () {
      const storageSet = new Set<Record<string, any>>();

      const cache = new InMemoryCache({
        typePolicies: {
          Task: {
            fields: {
              result(existing, { args, storage }) {
                storageSet.add(storage);
                if (storage.result) return storage.result;
                return storage.result = compute(args);
              },
            },
          },
        },
      });

      let computeCount = 0;
      function compute(args) {
        return `expensive result ${++computeCount}`;
      }

      cache.writeQuery({
        query: gql`
          query {
            tasks {
              id
            }
          }
        `,
        data: {
          tasks: [{
            __typename: "Task",
            id: 1,
          }, {
            __typename: "Task",
            id: 2,
          }],
        },
      });

      expect(cache.extract()).toEqual({
        ROOT_QUERY: {
          __typename: "Query",
          tasks: [
            { __ref: "Task:1" },
            { __ref: "Task:2" },
          ],
        },
        "Task:1": {
          __typename: "Task",
          id: 1,
        },
        "Task:2": {
          __typename: "Task",
          id: 2,
        },
      });

      const result1 = cache.readQuery({
        query: gql`
          query {
            tasks {
              result
            }
          }
        `,
      });

      expect(result1).toEqual({
        tasks: [{
          __typename: "Task",
          result: "expensive result 1",
        }, {
          __typename: "Task",
          result: "expensive result 2",
        }],
      });

      const result2 = cache.readQuery({
        query: gql`
          query {
            tasks {
              id
              result
            }
          }
        `,
      });

      expect(result2).toEqual({
        tasks: [{
          __typename: "Task",
          id: 1,
          result: "expensive result 1",
        }, {
          __typename: "Task",
          id: 2,
          result: "expensive result 2",
        }],
      });

      // Clear the cached results.
      storageSet.forEach(storage => {
        delete storage.result;
      });

      const result3 = cache.readQuery({
        query: gql`
          query {
            tasks {
              __typename
              result
            }
          }
        `,
      });

      expect(result3).toEqual({
        tasks: [{
          __typename: "Task",
          result: "expensive result 3",
        }, {
          __typename: "Task",
          result: "expensive result 4",
        }],
      });
    });

    it("can use read function to implement synthetic/computed keys", function () {
      const cache = new InMemoryCache({
        typePolicies: {
          Person: {
            keyFields: ["firstName", "lastName"],
            fields: {
              fullName(_, { getFieldValue }) {
                const firstName = getFieldValue("firstName");
                const lastName = getFieldValue("lastName");
                return `${firstName} ${lastName}`;
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

                read(existing: any[], {
                  args,
                  toReference,
                  isReference,
                  policies,
                }) {
                  expect(!existing || Object.isFrozen(existing)).toBe(true);
                  expect(typeof toReference).toBe("function");
                  expect(policies).toBeInstanceOf(Policies);
                  const slice = existing.slice(
                    args.offset,
                    args.offset + args.limit,
                  );
                  slice.forEach(ref => expect(isReference(ref)).toBe(true));
                  return slice;
                },

                merge(existing: any[], incoming: any[], {
                  args,
                  toReference,
                  isReference,
                  policies,
                }) {
                  expect(!existing || Object.isFrozen(existing)).toBe(true);
                  expect(typeof toReference).toBe("function");
                  expect(policies).toBeInstanceOf(Policies);
                  const copy = existing ? existing.slice(0) : [];
                  const limit = args.offset + args.limit;
                  for (let i = args.offset; i < limit; ++i) {
                    copy[i] = incoming[i - args.offset];
                  }
                  copy.forEach(todo => expect(isReference(todo)).toBe(true));
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

    it("runs nested merge functions as well as ancestors", function () {
      let eventMergeCount = 0;
      let attendeeMergeCount = 0;

      const cache = new InMemoryCache({
        typePolicies: {
          Event: {
            fields: {
              attendees: {
                merge(existing: any[], incoming: any[]) {
                  ++eventMergeCount;
                  expect(Array.isArray(incoming)).toBe(true);
                  return existing ? existing.concat(incoming) : incoming;
                },
              },
            },
          },

          Attendee: {
            fields: {
              events: {
                merge(existing: any[], incoming: any[]) {
                  ++attendeeMergeCount;
                  expect(Array.isArray(incoming)).toBe(true);
                  return existing ? existing.concat(incoming) : incoming;
                },
              },
            },
          },
        },
      });

      cache.writeQuery({
        query: gql`
          query {
            eventsToday {
              name
              attendees {
                name
                events {
                  time
                }
              }
            }
          }
        `,
        data: {
          eventsToday: [{
            __typename: "Event",
            id: 123,
            name: "One-person party",
            time: "noonish",
            attendees: [{
              __typename: "Attendee",
              id: 234,
              name: "Ben Newman",
              events: [
                { __typename: "Event", id: 123 },
              ],
            }],
          }],
        },
      });

      expect(eventMergeCount).toBe(1);
      expect(attendeeMergeCount).toBe(1);

      expect(cache.extract()).toEqual({
        ROOT_QUERY: {
          __typename: "Query",
          eventsToday: [
            { __ref: "Event:123" },
          ],
        },
        "Event:123": {
          __typename: "Event",
          name: "One-person party",
          attendees: [
            { __ref: "Attendee:234" },
          ],
        },
        "Attendee:234": {
          __typename: "Attendee",
          name: "Ben Newman",
          events: [
            { __ref: "Event:123" },
          ],
        },
      });

      cache.writeQuery({
        query: gql`
          query {
            people {
              name
              events {
                time
                attendees {
                  name
                }
              }
            }
          }
        `,
        data: {
          people: [{
            __typename: "Attendee",
            id: 234,
            name: "Ben Newman",
            events: [{
              __typename: "Event",
              id: 345,
              name: "Rooftop dog party",
              attendees: [{
                __typename: "Attendee",
                id: 456,
                name: "Inspector Beckett",
              }, {
                __typename: "Attendee",
                id: 234,
              }],
            }],
          }],
        },
      });

      expect(eventMergeCount).toBe(2);
      expect(attendeeMergeCount).toBe(2);

      expect(cache.extract()).toEqual({
        ROOT_QUERY: {
          __typename: "Query",
          eventsToday: [
            { __ref: "Event:123" },
          ],
          people: [
            { __ref: "Attendee:234" },
          ],
        },
        "Event:123": {
          __typename: "Event",
          name: "One-person party",
          attendees: [
            { __ref: "Attendee:234" },
          ],
        },
        "Event:345": {
          __typename: "Event",
          attendees: [
            { __ref: "Attendee:456" },
            { __ref: "Attendee:234" },
          ],
        },
        "Attendee:234": {
          __typename: "Attendee",
          name: "Ben Newman",
          events: [
            { __ref: "Event:123" },
            { __ref: "Event:345" },
          ],
        },
        "Attendee:456": {
          __typename: "Attendee",
          name: "Inspector Beckett",
        },
      });

      expect(cache.gc()).toEqual([]);
    });
  });

  it("runs read and merge functions for unidentified data", function () {
    function reverse(s: string) {
      return s.split("").reverse().join("");
    }

    const cache = new InMemoryCache({
      typePolicies: {
        Book: {
          keyFields: ["isbn"],
        },

        Author: {
          // Passing false for keyFields disables normalization of Author
          // objects, which should not interfere with the operation of
          // their read and/or merge functions. However, disabling
          // normalization means the merge function for the name field
          // will be called only once, because we never merge fields when
          // the IDs of the enclosing objects are unknown or unequal.
          keyFields: false,

          fields: {
            name: {
              read(name: string) {
                return reverse(name).toUpperCase();
              },
              merge(oldName, newName: string) {
                expect(oldName).toBe(void 0);
                expect(typeof newName).toBe("string");
                return reverse(newName);
              },
            },
          },
        },
      },
    });

    const query = gql`
      query {
        currentlyReading {
          title
          authors {
            name
          }
        }
      }
    `;

    cache.writeQuery({
      query,
      data: {
        currentlyReading: [{
          __typename: "Book",
          isbn: "0525558616",
          title: "Human Compatible: Artificial Intelligence and the Problem of Control",
          authors: [{
            __typename: "Author",
            name: "Stuart Russell",
          }],
        }, {
          __typename: "Book",
          isbn: "1541698967",
          title: "The Book of Why: The New Science of Cause and Effect",
          authors: [{
            __typename: "Author",
            name: "Judea Pearl",
          }, {
            __typename: "Author",
            name: "Dana Mackenzie",
          }],
        }],
      },
    });

    expect(cache.extract()).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        currentlyReading: [
          { __ref: 'Book:{"isbn":"0525558616"}' },
          { __ref: 'Book:{"isbn":"1541698967"}' },
        ],
      },
      'Book:{"isbn":"0525558616"}': {
        __typename: "Book",
        authors: [{
          __typename: "Author",
          // Note the successful reversal of the Author names.
          name: "llessuR trautS",
        }],
        title: "Human Compatible: Artificial Intelligence and the Problem of Control",
      },
      'Book:{"isbn":"1541698967"}': {
        __typename: "Book",
        authors: [{
          __typename: "Author",
          name: "lraeP aeduJ",
        }, {
          __typename: "Author",
          name: "eiznekcaM anaD",
        }],
        title: "The Book of Why: The New Science of Cause and Effect",
      },
    });

    expect(cache.readQuery({ query })).toEqual({
      currentlyReading: [{
        __typename: "Book",
        title: "Human Compatible: Artificial Intelligence and the Problem of Control",
        authors: [{
          __typename: "Author",
          name: "STUART RUSSELL",
        }],
      }, {
        __typename: "Book",
        title: "The Book of Why: The New Science of Cause and Effect",
        authors: [{
          __typename: "Author",
          // Note the successful re-reversal and uppercasing, thanks to
          // the custom read function.
          name: "JUDEA PEARL",
        }, {
          __typename: "Author",
          name: "DANA MACKENZIE",
        }],
      }],
    });
  });

  it("can read from foreign references using getFieldValue", function () {
    const cache = new InMemoryCache({
      typePolicies: {
        Author: {
          keyFields: ["name"],

          fields: {
            books: {
              merge(existing: Reference[] = [], incoming: Reference[]) {
                return [...existing, ...incoming];
              },
            },

            // A dynamically computed field that returns the Book
            // Reference with the earliest year, which requires reading
            // fields from foreign references.
            firstBook(_, { isReference, getFieldValue }) {
              let firstBook: Reference;
              let firstYear: number;
              const bookRefs = getFieldValue<Reference[]>("books") || [];
              bookRefs.forEach(bookRef => {
                expect(isReference(bookRef)).toBe(true);
                const year = getFieldValue<number>("year", bookRef);
                if (firstYear === void 0 || year < firstYear) {
                  firstBook = bookRef;
                  firstYear = year;
                }
              });
              // Return a Book Reference, which can have a nested
              // selection set applied to it.
              return firstBook;
            },
          },
        },

        Book: {
          keyFields: ["isbn"],
        },
      },
    });

    function addBook(bookData) {
      cache.writeQuery({
        query: gql`
          query {
            author {
              name
              books {
                isbn
                title
                year
              }
            }
          }
        `,
        data: {
          author: {
            __typename: "Author",
            name: "Virginia Woolf",
            books: [{
              __typename: "Book",
              ...bookData,
            }],
          },
        },
      });
    }

    addBook({
      __typename: "Book",
      isbn: "1853262390",
      title: "Orlando",
      year: 1928,
    });

    addBook({
      __typename: "Book",
      isbn: "9353420717",
      title: "A Room of One's Own",
      year: 1929,
    });

    addBook({
      __typename: "Book",
      isbn: "0156907399",
      title: "To the Lighthouse",
      year: 1927,
    });

    expect(cache.extract()).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        author: {
          __ref: 'Author:{"name":"Virginia Woolf"}',
        },
      },
      'Author:{"name":"Virginia Woolf"}': {
        __typename: "Author",
        name: "Virginia Woolf",
        books: [
          { __ref: 'Book:{"isbn":"1853262390"}' },
          { __ref: 'Book:{"isbn":"9353420717"}' },
          { __ref: 'Book:{"isbn":"0156907399"}' },
        ],
      },
      'Book:{"isbn":"1853262390"}': {
        __typename: "Book",
        isbn: "1853262390",
        title: "Orlando",
        year: 1928,
      },
      'Book:{"isbn":"9353420717"}': {
        __typename: "Book",
        isbn: "9353420717",
        title: "A Room of One's Own",
        year: 1929,
      },
      'Book:{"isbn":"0156907399"}': {
        __typename: "Book",
        isbn: "0156907399",
        title: "To the Lighthouse",
        year: 1927,
      },
    });

    const firstBookQuery = gql`
      query {
        author {
          name
          firstBook {
            title
            year
          }
        }
      }
    `;

    function readFirstBookResult() {
      return cache.readQuery<{ author: any }>({
        query: firstBookQuery,
      });
    }

    const firstBookResult = readFirstBookResult();
    expect(firstBookResult).toEqual({
      author: {
        __typename: "Author",
        name: "Virginia Woolf",
        firstBook: {
          __typename: "Book",
          title: "To the Lighthouse",
          year: 1927,
        },
      },
    });

    expect(readFirstBookResult()).toBe(firstBookResult);

    // Add an even earlier book.
    addBook({
      isbn: "1420959719",
      title: "The Voyage Out",
      year: 1915,
    });

    const secondFirstBookResult = readFirstBookResult();
    expect(secondFirstBookResult).not.toBe(firstBookResult);
    expect(secondFirstBookResult).toEqual({
      author: {
        __typename: "Author",
        name: "Virginia Woolf",
        firstBook: {
          __typename: "Book",
          title: "The Voyage Out",
          year: 1915,
        },
      },
    });

    // Write a new, unrelated field.
    cache.writeQuery({
      query: gql`query { author { afraidCount } }`,
      data: {
        author: {
          __typename: "Author",
          name: "Virginia Woolf",
          afraidCount: 2,
        },
      },
    });

    // Make sure afraidCount was written.
    expect(cache.readFragment({
      id: cache.identify({
        __typename: "Author",
        name: "Virginia Woolf",
      }),
      fragment: gql`
        fragment AfraidFragment on Author {
          name
          afraidCount
        }
      `,
    })).toEqual({
      __typename: "Author",
      name: "Virginia Woolf",
      afraidCount: 2,
    });

    // Since we wrote only the afraidCount field, the firstBook result
    // should be completely unchanged.
    expect(readFirstBookResult()).toBe(secondFirstBookResult);

    // Add another book, not published first.
    addBook({
      isbn: "9780156949606",
      title: "The Waves",
      year: 1931,
    });

    const thirdFirstBookResult = readFirstBookResult();

    // A change in VW's books field triggers rereading of result objects
    // that previously involved her books field.
    expect(thirdFirstBookResult).not.toBe(secondFirstBookResult);

    // However, since the new Book was not the earliest published, the
    // second and third results are structurally the same.
    expect(thirdFirstBookResult).toEqual(secondFirstBookResult);

    // In fact, the original author.firstBook object has been reused!
    expect(thirdFirstBookResult.author.firstBook).toBe(
      secondFirstBookResult.author.firstBook,
    );
  });
});
