import { gql } from "graphql-tag";
import { of } from "rxjs";

import { ApolloClient } from "@apollo/client";
import { InMemoryCache, isReference } from "@apollo/client/cache";
import { ApolloLink } from "@apollo/client/link/core";
import { LocalResolversLink } from "@apollo/client/link/local-resolvers";
import { MockLink } from "@apollo/client/testing";
import {
  executeWithDefaultContext as execute,
  ObservableStream,
} from "@apollo/client/testing/internal";

test("runs resolvers for @client queries", async () => {
  const query = gql`
    query Test {
      foo @client {
        bar
      }
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ bar: true }),
      },
    },
  });

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: { foo: { bar: true } },
  });

  await expect(stream).toComplete();
});

test("can add resolvers after the link is instantiated", async () => {
  const query = gql`
    query Test {
      foo @client {
        bar
      }
    }
  `;

  const link = new LocalResolversLink({ resolvers: {} });

  link.addResolvers({
    Query: {
      foo: () => ({ bar: true }),
    },
  });

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: { foo: { bar: true } },
  });

  await expect(stream).toComplete();
});

test("handles queries with a mix of @client and server fields", async () => {
  const query = gql`
    query Mixed {
      foo @client {
        bar
      }
      bar {
        baz
      }
    }
  `;

  const serverQuery = gql`
    query Mixed {
      bar {
        baz
      }
    }
  `;

  const mockLink = new MockLink([
    {
      request: { query: serverQuery },
      result: { data: { bar: { baz: true } } },
    },
  ]);

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ bar: true }),
      },
    },
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      foo: { bar: true },
      bar: { baz: true },
    },
  });

  await expect(stream).toComplete();
});

test("handles a mix of @client fields with fragments and server fields", async () => {
  const query = gql`
    fragment client on ClientData {
      bar
      __typename
    }

    query Mixed {
      foo @client {
        ...client
      }
      bar {
        baz
      }
    }
  `;

  const serverQuery = gql`
    query Mixed {
      bar {
        baz
      }
    }
  `;

  const mockLink = new MockLink([
    {
      request: { query: serverQuery },
      result: { data: { bar: { baz: true, __typename: "Bar" } } },
    },
  ]);

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ bar: true, __typename: "ClientData" }),
      },
    },
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      foo: { bar: true, __typename: "ClientData" },
      bar: { baz: true, __typename: "Bar" },
    },
  });

  await expect(stream).toComplete();
});

test("handles @client fields inside fragments", async () => {
  const query = gql`
    fragment Foo on Foo {
      bar
      ...Foo2
    }
    fragment Foo2 on Foo {
      __typename
      baz @client
    }
    query Mixed {
      foo {
        ...Foo
      }
      bar {
        baz
      }
    }
  `;

  const serverQuery = gql`
    fragment Foo on Foo {
      bar
    }
    query Mixed {
      foo {
        ...Foo
      }
      bar {
        baz
      }
    }
  `;

  const mockLink = new MockLink([
    {
      request: { query: serverQuery },
      result: {
        data: { foo: { bar: true, __typename: `Foo` }, bar: { baz: true } },
      },
    },
  ]);

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Foo: {
        baz: () => false,
      },
    },
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      foo: { bar: true, baz: false, __typename: "Foo" },
      bar: { baz: true },
    },
  });

  await expect(stream).toComplete();
});

test("has access to query variables in @client resolvers", async () => {
  const query = gql`
    query WithVariables($id: ID!) {
      foo @client {
        bar(id: $id)
      }
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ __typename: "Foo" }),
      },
      Foo: {
        bar: (_: any, { id }: { id: number }) => id,
      },
    },
  });

  const stream = new ObservableStream(
    execute(link, { query, variables: { id: 1 } })
  );

  await expect(stream).toEmitTypedValue({
    data: { foo: { __typename: "Foo", bar: 1 } },
  });

  await expect(stream).toComplete();
});

test("passes context to @client resolvers", async () => {
  const query = gql`
    query WithContext {
      foo @client {
        bar
      }
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ __typename: "Foo" }),
      },
      Foo: {
        // @ts-expect-error FIXME before this is merged
        bar: (_data: any, _args: any, { id }: { id: number }) => id,
      },
    },
  });

  const stream = new ObservableStream(
    execute(link, { query, context: { id: 1 } })
  );

  await expect(stream).toEmitTypedValue({
    data: { foo: { __typename: "Foo", bar: 1 } },
  });

  await expect(stream).toComplete();
});

test("combines local @client resolver results with server results, for the same field", async () => {
  const query = gql`
    query author {
      author {
        name
        stats {
          totalPosts
          postsToday @client
        }
      }
    }
  `;

  const serverQuery = gql`
    query author {
      author {
        name
        stats {
          totalPosts
        }
      }
    }
  `;

  const mockLink = new MockLink([
    {
      request: { query: serverQuery },
      result: {
        data: {
          author: {
            name: "John Smith",
            stats: {
              totalPosts: 100,
              __typename: "Stats",
            },
            __typename: "Author",
          },
        },
      },
    },
  ]);

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Stats: {
        postsToday: () => 10,
      },
    },
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      author: {
        __typename: "Author",
        name: "John Smith",
        stats: {
          __typename: "Stats",
          totalPosts: 100,
          postsToday: 10,
        },
      },
    },
  });

  await expect(stream).toComplete();
});

test("handles resolvers that work with booleans properly", async () => {
  const query = gql`
    query CartDetails {
      isInCart @client
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        isInCart: () => false,
      },
    },
  });

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({ data: { isInCart: false } });
  await expect(stream).toComplete();
});

test("handles nested asynchronous @client resolvers", async () => {
  const query = gql`
    query DeveloperTicketComments($id: ID) {
      developer(id: $id) @client {
        id
        handle
        tickets @client {
          id
          comments @client {
            id
          }
        }
      }
    }
  `;

  function randomDelay(range: number) {
    return new Promise((resolve) =>
      setTimeout(resolve, Math.round(Math.random() * range))
    );
  }

  function uuid() {
    return Math.random().toString(36).slice(2);
  }

  const developerId = uuid();

  function times<T>(n: number, thunk: () => T): T[] {
    const result: T[] = [];
    for (let i = 0; i < n; ++i) {
      result.push(thunk());
    }
    return result;
  }

  const ticketsPerDev = 5;
  const commentsPerTicket = 5;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        async developer(_, { id }) {
          await randomDelay(50);
          expect(id).toBe(developerId);
          return {
            __typename: "Developer",
            id,
            handle: "@benjamn",
          };
        },
      },
      Developer: {
        async tickets(developer) {
          await randomDelay(50);
          expect(developer.__typename).toBe("Developer");

          return Promise.all(
            times(ticketsPerDev, () => ({
              __typename: "Ticket",
              id: uuid(),
            }))
          );
        },
      },
      Ticket: {
        async comments(ticket) {
          await randomDelay(50);
          expect(ticket.__typename).toBe("Ticket");

          return Promise.all(
            times(commentsPerTicket, () => ({
              __typename: "Comment",
              id: uuid(),
            }))
          );
        },
      },
    },
  });

  const stream = new ObservableStream(
    execute(link, { query, variables: { id: developerId } })
  );

  await expect(stream).toEmitTypedValue(
    {
      data: {
        developer: {
          __typename: "Developer",
          id: developerId,
          handle: "@benjamn",
          tickets: times(ticketsPerDev, () => ({
            __typename: "Ticket",
            id: expect.any(String),
            comments: times(commentsPerTicket, () => ({
              __typename: "Comment",
              id: expect.any(String),
            })),
          })),
        },
      },
    },
    { timeout: 1000 }
  );

  await expect(stream).toComplete();
});

test("does not run resolvers without @client directive", async () => {
  const query = gql`
    query Mixed {
      foo @client {
        bar
      }
      bar {
        baz
      }
    }
  `;

  const serverQuery = gql`
    query Mixed {
      bar {
        baz
      }
    }
  `;

  const mockLink = new MockLink([
    {
      request: { query: serverQuery },
      result: { data: { bar: { __typename: "Bar", baz: true } } },
    },
  ]);

  const barResolver = jest.fn(() => ({ __typename: `Bar`, baz: false }));
  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ __typename: `Foo`, bar: true }),
        bar: barResolver,
      },
    },
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      foo: { __typename: "Foo", bar: true },
      bar: { __typename: "Bar", baz: true },
    },
  });
  await expect(stream).toComplete();

  expect(barResolver).not.toHaveBeenCalled();
});

test("can write to the cache with a mutation", async () => {
  const query = gql`
    {
      field
    }
  `;

  const mutation = gql`
    mutation start {
      start @client
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Mutation: {
        start(_data, _args, { cache }) {
          cache.writeQuery({ query, data: { field: 1 } });
          return true;
        },
      },
    },
  });

  const client = new ApolloClient({ cache: new InMemoryCache() });

  const stream = new ObservableStream(
    execute(link, { query: mutation }, { client })
  );

  await expect(stream).toEmitTypedValue({ data: { start: true } });
  await expect(stream).toComplete();

  expect(client.readQuery({ query })).toStrictEqualTyped({ field: 1 });
});

test("can write to the cache with a mutation using an ID", async () => {
  const query = gql`
    {
      obj {
        field
      }
    }
  `;

  const mutation = gql`
    mutation start {
      start @client
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Mutation: {
        start(_, __, { cache }) {
          cache.writeQuery({
            query,
            data: {
              obj: { field: 1, id: "uniqueId", __typename: "Object" },
            },
          });

          cache.modify<{ id: string; field: number }>({
            id: "Object:uniqueId",
            fields: {
              field(value) {
                return value + 2;
              },
            },
          });

          return true;
        },
      },
    },
  });

  const client = new ApolloClient({ cache: new InMemoryCache() });
  const stream = new ObservableStream(
    execute(link, { query: mutation }, { client })
  );

  await expect(stream).toEmitTypedValue({ data: { start: true } });

  expect(client.readQuery({ query })).toStrictEqualTyped({
    obj: { __typename: "Object", field: 3 },
  });
});

test("does not overwrite __typename when writing to the cache with an id", async () => {
  const query = gql`
    {
      obj @client {
        field {
          field2
        }
        id
      }
    }
  `;

  const mutation = gql`
    mutation start {
      start @client
    }
  `;

  const client = new ApolloClient({ cache: new InMemoryCache() });

  const link = new LocalResolversLink({
    resolvers: {
      Mutation: {
        start(_, __, { cache }) {
          cache.writeQuery({
            query,
            data: {
              obj: {
                field: { field2: 1, __typename: "Field" },
                id: "uniqueId",
                __typename: "Object",
              },
            },
          });
          cache.modify<{ field: { field2: number } }>({
            id: "Object:uniqueId",
            fields: {
              field(value) {
                if (isReference(value)) {
                  fail("Should not be a reference");
                }
                expect(value.field2).toBe(1);
                return { ...value, field2: 2 };
              },
            },
          });
          return true;
        },
      },
    },
  });

  const stream = new ObservableStream(
    execute(link, { query: mutation }, { client })
  );

  await expect(stream).toEmitTypedValue({ data: { start: true } });
  await expect(stream).toComplete();

  expect(client.readQuery({ query })).toStrictEqualTyped({
    data: {
      obj: {
        __typename: "Object",
        field: { __typename: "Field", field2: 2 },
        id: "uniqueId",
      },
    },
  });
});

test("run resolvers for missing client queries with aliased field", async () => {
  const query = gql`
    query Aliased {
      foo @client {
        bar
      }
      baz: bar {
        foo
      }
    }
  `;

  const mockLink = new ApolloLink(() =>
    // Each link is responsible for implementing their own aliasing so it
    // returns baz not bar
    of({ data: { baz: { foo: true, __typename: "Baz" } } })
  );

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ bar: true, __typename: "Foo" }),
      },
    },
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      foo: { bar: true, __typename: "Foo" },
      baz: { foo: true, __typename: "Baz" },
    },
  });
  await expect(stream).toComplete();
});

test("runs resolvers for client queries when aliases are in use on the @client-tagged node", async () => {
  const aliasedQuery = gql`
    query Test {
      fie: foo @client {
        bar
      }
    }
  `;

  const fie = jest.fn();
  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ bar: true, __typename: "Foo" }),
        fie,
      },
    },
  });
  const stream = new ObservableStream(execute(link, { query: aliasedQuery }));

  await expect(stream).toEmitTypedValue({
    data: { fie: { bar: true, __typename: "Foo" } },
  });
  await expect(stream).toComplete();

  expect(fie).not.toHaveBeenCalled();
});

test("respects aliases for *nested fields* on the @client-tagged node", async () => {
  const aliasedQuery = gql`
    query Test {
      fie: foo @client {
        fum: bar
      }
      baz: bar {
        foo
      }
    }
  `;

  const mockLink = new ApolloLink(() =>
    of({ data: { baz: { foo: true, __typename: "Baz" } } })
  );

  const fie = jest.fn();
  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ bar: true, __typename: "Foo" }),
        fie,
      },
    },
  });
  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query: aliasedQuery }));

  await expect(stream).toEmitTypedValue({
    data: {
      fie: { fum: true, __typename: "Foo" },
      baz: { foo: true, __typename: "Baz" },
    },
  });
  await expect(stream).toComplete();

  expect(fie).not.toHaveBeenCalled();
});

test("allows child resolvers from a parent resolved from a local resolver", async () => {
  const query = gql`
    query UserData {
      userData @client {
        firstName
        lastName
        fullName
      }
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        userData() {
          return {
            __typename: "User",
            firstName: "Ben",
            lastName: "Newman",
          };
        },
      },
      User: {
        fullName(data) {
          return data.firstName + " " + data.lastName;
        },
      },
    },
  });

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      userData: {
        __typename: "User",
        firstName: "Ben",
        lastName: "Newman",
        fullName: "Ben Newman",
      },
    },
  });
  await expect(stream).toComplete();
});

test("supports async @client resolvers", async () => {
  const query = gql`
    query Member {
      isLoggedIn @client
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        async isLoggedIn() {
          return Promise.resolve(true);
        },
      },
    },
  });

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: { isLoggedIn: true },
  });
  await expect(stream).toComplete();
});

test("supports async @client resolvers mixed with remotely resolved data", async () => {
  const query = gql`
    query Member {
      member {
        name
        sessionCount @client
        isLoggedIn @client
      }
    }
  `;

  const testMember = {
    name: "John Smithsonian",
    isLoggedIn: true,
    sessionCount: 10,
  };

  const mockLink = new ApolloLink(() =>
    of({
      data: {
        member: {
          name: testMember.name,
          __typename: "Member",
        },
      },
    })
  );

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Member: {
        async isLoggedIn() {
          return Promise.resolve(testMember.isLoggedIn);
        },
        sessionCount() {
          return testMember.sessionCount;
        },
      },
    },
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      member: {
        name: testMember.name,
        isLoggedIn: testMember.isLoggedIn,
        sessionCount: testMember.sessionCount,
        __typename: "Member",
      },
    },
  });
  await expect(stream).toComplete();
});

test("can use remote result to resolve @client field", async () => {
  const query = gql`
    query Member {
      member {
        firstName
        lastName
        fullName @client
      }
    }
  `;

  const mockLink = new ApolloLink(() =>
    of({
      data: {
        member: {
          __typename: "Member",
          firstName: "John",
          lastName: "Smithsonian",
        },
      },
    })
  );

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Member: {
        fullName(member) {
          return `${member.firstName} ${member.lastName}`;
        },
      },
    },
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      member: {
        __typename: "Member",
        firstName: "John",
        lastName: "Smithsonian",
        fullName: "John Smithsonian",
      },
    },
  });
  await expect(stream).toComplete();
});
