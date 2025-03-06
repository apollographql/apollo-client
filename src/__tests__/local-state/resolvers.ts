import { gql } from "graphql-tag";
import { DocumentNode, ExecutionResult } from "graphql";

import { LocalState } from "../../core/LocalState.js";

import {
  ApolloClient,
  ApolloQueryResult,
  NetworkStatus,
  Resolvers,
} from "../../core/index.js";

import { InMemoryCache, isReference } from "../../cache/index.js";
import { Observable } from "../../utilities/index.js";
import { ApolloLink } from "../../link/core/index.js";
import { ObservableStream } from "../../testing/internal/index.js";
import { MockLink } from "../../testing/index.js";

const setupTestWithResolvers = ({
  resolvers,
  query,
  serverQuery,
  variables = {},
  queryOptions = {},
  serverResult,
  error,
  delay,
}: {
  resolvers: Resolvers;
  query: DocumentNode;
  serverQuery?: DocumentNode;
  variables?: object;
  queryOptions?: object;
  error?: Error;
  serverResult?: ExecutionResult;
  delay?: number;
}) => {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query: serverQuery || query, variables },
        result: serverResult,
        error,
        delay,
      },
    ]),
  });

  client.addResolvers(resolvers);

  return new ObservableStream(
    client.watchQuery<any>({ query, variables, ...queryOptions })
  );
};

describe("Basic resolver capabilities", () => {
  it("should run resolvers for @client queries", async () => {
    const query = gql`
      query Test {
        foo @client {
          bar
        }
      }
    `;

    const resolvers = {
      Query: {
        foo: () => ({ bar: true }),
      },
    };

    const stream = setupTestWithResolvers({ resolvers, query });

    await expect(stream).toEmitApolloQueryResult({
      data: { foo: { bar: true } },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await expect(stream).not.toEmitAnything();
  });

  it("should handle queries with a mix of @client and server fields", async () => {
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

    const resolvers = {
      Query: {
        foo: () => ({ bar: true }),
      },
    };

    const stream = setupTestWithResolvers({
      resolvers,
      query,
      serverQuery,
      serverResult: { data: { bar: { baz: true } } },
    });

    await expect(stream).toEmitApolloQueryResult({
      data: {
        foo: { bar: true },
        bar: { baz: true },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await expect(stream).not.toEmitAnything();
  });

  it("should handle a mix of @client fields with fragments and server fields", async () => {
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

    const resolvers = {
      Query: {
        foo: () => ({ bar: true, __typename: "ClientData" }),
      },
    };

    const stream = setupTestWithResolvers({
      resolvers,
      query,
      serverQuery,
      serverResult: { data: { bar: { baz: true, __typename: "Bar" } } },
    });

    await expect(stream).toEmitApolloQueryResult({
      data: {
        foo: { bar: true, __typename: "ClientData" },
        bar: { baz: true, __typename: "Bar" },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await expect(stream).not.toEmitAnything();
  });

  it("should handle @client fields inside fragments", async () => {
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

    const resolvers = {
      Foo: {
        baz: () => false,
      },
    };

    const stream = setupTestWithResolvers({
      resolvers,
      query,
      serverQuery,
      serverResult: {
        data: { foo: { bar: true, __typename: `Foo` }, bar: { baz: true } },
      },
    });

    await expect(stream).toEmitApolloQueryResult({
      data: {
        foo: { bar: true, baz: false, __typename: "Foo" },
        bar: { baz: true },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await expect(stream).not.toEmitAnything();
  });

  it("should have access to query variables when running @client resolvers", async () => {
    const query = gql`
      query WithVariables($id: ID!) {
        foo @client {
          bar(id: $id)
        }
      }
    `;

    const resolvers = {
      Query: {
        foo: () => ({ __typename: "Foo" }),
      },
      Foo: {
        bar: (_data: any, { id }: { id: number }) => id,
      },
    };

    const stream = setupTestWithResolvers({
      resolvers,
      query,
      variables: { id: 1 },
    });

    await expect(stream).toEmitApolloQueryResult({
      data: { foo: { __typename: "Foo", bar: 1 } },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await expect(stream).not.toEmitAnything();
  });

  it("should pass context to @client resolvers", async () => {
    const query = gql`
      query WithContext {
        foo @client {
          bar
        }
      }
    `;

    const resolvers = {
      Query: {
        foo: () => ({ __typename: "Foo" }),
      },
      Foo: {
        bar: (_data: any, _args: any, { id }: { id: number }) => id,
      },
    };

    const stream = setupTestWithResolvers({
      resolvers,
      query,
      queryOptions: { context: { id: 1 } },
    });

    await expect(stream).toEmitApolloQueryResult({
      data: { foo: { __typename: "Foo", bar: 1 } },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await expect(stream).not.toEmitAnything();
  });

  it("should combine local @client resolver results with server results, for the same field", async () => {
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

    const resolvers = {
      Stats: {
        postsToday: () => 10,
      },
    };

    const stream = setupTestWithResolvers({
      resolvers,
      query,
      serverQuery,
      serverResult: {
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
    });

    await expect(stream).toEmitApolloQueryResult({
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
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await expect(stream).not.toEmitAnything();
  });

  it("should handle resolvers that work with booleans properly", async () => {
    const query = gql`
      query CartDetails {
        isInCart @client
      }
    `;

    const cache = new InMemoryCache();
    cache.writeQuery({ query, data: { isInCart: true } });

    const client = new ApolloClient({
      cache,
      resolvers: {
        Query: {
          isInCart: () => false,
        },
      },
    });

    const result = await client.query({ query, fetchPolicy: "network-only" });

    expect(result).toEqualApolloQueryResult({
      data: { isInCart: false },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });

  it("should handle nested asynchronous @client resolvers (issue #4841)", () => {
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

    function times<T>(n: number, thunk: () => T): Promise<T[]> {
      const result: T[] = [];
      for (let i = 0; i < n; ++i) {
        result.push(thunk());
      }
      return Promise.all(result);
    }

    const ticketsPerDev = 5;
    const commentsPerTicket = 5;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
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
            return times(ticketsPerDev, () => ({
              __typename: "Ticket",
              id: uuid(),
            }));
          },
        },
        Ticket: {
          async comments(ticket) {
            await randomDelay(50);
            expect(ticket.__typename).toBe("Ticket");
            return times(commentsPerTicket, () => ({
              __typename: "Comment",
              id: uuid(),
            }));
          },
        },
      },
    });

    function check(result: ApolloQueryResult<any>) {
      return new Promise<void>((resolve) => {
        expect(result.data.developer.id).toBe(developerId);
        expect(result.data.developer.handle).toBe("@benjamn");
        expect(result.data.developer.tickets.length).toBe(ticketsPerDev);
        const commentIds = new Set<string>();
        result.data.developer.tickets.forEach((ticket: any) => {
          expect(ticket.__typename).toBe("Ticket");
          expect(ticket.comments.length).toBe(commentsPerTicket);
          ticket.comments.forEach((comment: any) => {
            expect(comment.__typename).toBe("Comment");
            commentIds.add(comment.id);
          });
        });
        expect(commentIds.size).toBe(ticketsPerDev * commentsPerTicket);
        resolve();
      });
    }

    return Promise.all([
      new Promise((resolve, reject) => {
        client
          .watchQuery({
            query,
            variables: {
              id: developerId,
            },
          })
          .subscribe({
            next(result) {
              check(result).then(resolve, reject);
            },
            error: reject,
          });
      }),
      client
        .query({
          query,
          variables: {
            id: developerId,
          },
        })
        .then(check),
    ]);
  });

  it("should not run resolvers without @client directive (issue #9571)", async () => {
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

    const barResolver = jest.fn(() => ({ __typename: `Bar`, baz: false }));

    const resolvers = {
      Query: {
        foo: () => ({ __typename: `Foo`, bar: true }),
        bar: barResolver,
      },
    };

    const stream = setupTestWithResolvers({
      resolvers,
      query,
      serverQuery,
      serverResult: { data: { bar: { __typename: "Bar", baz: true } } },
    });

    await expect(stream).toEmitApolloQueryResult({
      data: {
        foo: { __typename: "Foo", bar: true },
        bar: { __typename: "Bar", baz: true },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
    expect(barResolver).not.toHaveBeenCalled();
  });
});

describe("Writing cache data from resolvers", () => {
  it("should let you write to the cache with a mutation", async () => {
    const query = gql`
      {
        field @client
      }
    `;

    const mutation = gql`
      mutation start {
        start @client
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      resolvers: {
        Mutation: {
          start(_data, _args, { cache }) {
            cache.writeQuery({ query, data: { field: 1 } });
            return { start: true };
          },
        },
      },
    });

    await client.mutate({ mutation });
    const result = await client.query({ query });

    expect(result).toEqualApolloQueryResult({
      data: { field: 1 },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });

  it("should let you write to the cache with a mutation using an ID", async () => {
    const query = gql`
      {
        obj @client {
          field
        }
      }
    `;

    const mutation = gql`
      mutation start {
        start @client
      }
    `;

    const cache = new InMemoryCache();

    const client = new ApolloClient({
      cache,
      link: ApolloLink.empty(),
      resolvers: {
        Mutation: {
          start() {
            cache.writeQuery({
              query,
              data: {
                obj: { field: 1, id: "uniqueId", __typename: "Object" },
              },
            });

            cache.modify({
              id: "Object:uniqueId",
              fields: {
                field(value) {
                  expect(value).toBe(1);
                  return 2;
                },
              },
            });

            return { start: true };
          },
        },
      },
    });

    await client.mutate({ mutation });

    const result = await client.query({ query });

    expect(result).toEqualApolloQueryResult({
      data: { obj: { __typename: "Object", field: 2 } },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });

  it("should not overwrite __typename when writing to the cache with an id", async () => {
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

    const cache = new InMemoryCache();

    const client = new ApolloClient({
      cache,
      link: ApolloLink.empty(),
      resolvers: {
        Mutation: {
          start() {
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
            return { start: true };
          },
        },
      },
    });

    await client.mutate({ mutation });
    const result = await client.query({ query });

    expect(result).toEqualApolloQueryResult({
      data: {
        obj: {
          __typename: "Object",
          field: { __typename: "Field", field2: 2 },
          id: "uniqueId",
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });
});

describe("Resolving field aliases", () => {
  it("should run resolvers for missing client queries with aliased field", async () => {
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

    const link = new ApolloLink(() =>
      // Each link is responsible for implementing their own aliasing so it
      // returns baz not bar
      Observable.of({ data: { baz: { foo: true, __typename: "Baz" } } })
    );

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      resolvers: {
        Query: {
          foo: () => ({ bar: true, __typename: "Foo" }),
        },
      },
    });

    const result = await client.query({ query });

    expect(result).toEqualApolloQueryResult({
      data: {
        foo: { bar: true, __typename: "Foo" },
        baz: { foo: true, __typename: "Baz" },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });

  it("should run resolvers for client queries when aliases are in use on the @client-tagged node", async () => {
    const aliasedQuery = gql`
      query Test {
        fie: foo @client {
          bar
        }
      }
    `;

    const fie = jest.fn();
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      resolvers: {
        Query: {
          foo: () => ({ bar: true, __typename: "Foo" }),
          fie,
        },
      },
    });

    const result = await client.query({ query: aliasedQuery });

    expect(result).toEqualApolloQueryResult({
      data: { fie: { bar: true, __typename: "Foo" } },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
    expect(fie).not.toHaveBeenCalled();
  });

  it("should respect aliases for *nested fields* on the @client-tagged node", async () => {
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

    const link = new ApolloLink(() =>
      Observable.of({ data: { baz: { foo: true, __typename: "Baz" } } })
    );

    const fie = jest.fn();
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      resolvers: {
        Query: {
          foo: () => ({ bar: true, __typename: "Foo" }),
          fie,
        },
      },
    });

    const result = await client.query({ query: aliasedQuery });

    expect(result).toEqualApolloQueryResult({
      data: {
        fie: { fum: true, __typename: "Foo" },
        baz: { foo: true, __typename: "Baz" },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
    expect(fie).not.toHaveBeenCalled();
  });

  it("should pull initialized values for aliased fields tagged with @client from the cache", async () => {
    const query = gql`
      {
        fie: foo @client {
          bar
        }
      }
    `;

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link: ApolloLink.empty(),
      resolvers: {},
    });

    cache.writeQuery({
      query: gql`
        {
          foo {
            bar
          }
        }
      `,
      data: {
        foo: {
          bar: "yo",
          __typename: "Foo",
        },
      },
    });

    const result = await client.query({ query });

    expect(result).toEqualApolloQueryResult({
      data: { fie: { bar: "yo", __typename: "Foo" } },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });

  it("should resolve @client fields using local resolvers and not have their value overridden when a fragment is loaded", async () => {
    const query = gql`
      fragment LaunchDetails on Launch {
        id
        __typename
      }
      query Launch {
        launch {
          isInCart @client
          ...LaunchDetails
        }
      }
    `;

    const link = new ApolloLink(() =>
      Observable.of({
        data: {
          launch: {
            id: 1,
            __typename: "Launch",
          },
        },
      })
    );

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      resolvers: {
        Launch: {
          isInCart() {
            return true;
          },
        },
      },
    });

    client.writeQuery({
      query: gql`
        {
          launch {
            isInCart
          }
        }
      `,
      data: {
        launch: {
          isInCart: false,
          __typename: "Launch",
        },
      },
    });

    // `isInCart` resolver is fired, returning `true` (which is then
    // stored in the cache).
    await expect(client.query({ query })).resolves.toEqualApolloQueryResult({
      data: { launch: { __typename: "Launch", id: 1, isInCart: true } },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    // When the same query fires again, `isInCart` should be pulled from
    // the cache and have a value of `true`.
    await expect(client.query({ query })).resolves.toEqualApolloQueryResult({
      data: { launch: { __typename: "Launch", id: 1, isInCart: true } },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });
});

describe("Force local resolvers", () => {
  it("should force the running of local resolvers marked with `@client(always: true)` when using `ApolloClient.query`", async () => {
    const query = gql`
      query Author {
        author {
          name
          isLoggedIn @client(always: true)
        }
      }
    `;

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link: ApolloLink.empty(),
      resolvers: {},
    });

    cache.writeQuery({
      query,
      data: {
        author: {
          name: "John Smith",
          isLoggedIn: false,
          __typename: "Author",
        },
      },
    });

    // When the resolver isn't defined, there isn't anything to force, so
    // make sure the query resolves from the cache properly.
    await expect(client.query({ query })).resolves.toEqualApolloQueryResult({
      data: {
        author: { __typename: "Author", isLoggedIn: false, name: "John Smith" },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    client.addResolvers({
      Author: {
        isLoggedIn() {
          return true;
        },
      },
    });

    // A resolver is defined, so make sure it's forced, and the result
    // resolves properly as a combination of cache and local resolver
    // data.
    await expect(client.query({ query })).resolves.toEqualApolloQueryResult({
      data: {
        author: { __typename: "Author", isLoggedIn: true, name: "John Smith" },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });

  it("should avoid running forced resolvers a second time when loading results over the network (so not from the cache)", async () => {
    const query = gql`
      query Author {
        author {
          name
          isLoggedIn @client(always: true)
        }
      }
    `;

    const link = new ApolloLink(() =>
      Observable.of({
        data: {
          author: {
            name: "John Smith",
            __typename: "Author",
          },
        },
      })
    );

    let count = 0;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      resolvers: {
        Author: {
          isLoggedIn() {
            count += 1;
            return true;
          },
        },
      },
    });

    await expect(client.query({ query })).resolves.toEqualApolloQueryResult({
      data: {
        author: {
          __typename: "Author",
          isLoggedIn: true,
          name: "John Smith",
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
    expect(count).toEqual(1);
  });

  it("should only force resolvers for fields marked with `@client(always: true)`, not all `@client` fields", async () => {
    const query = gql`
      query UserDetails {
        name @client
        isLoggedIn @client(always: true)
      }
    `;

    let nameCount = 0;
    let isLoggedInCount = 0;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      resolvers: {
        Query: {
          name() {
            nameCount += 1;
            return "John Smith";
          },
          isLoggedIn() {
            isLoggedInCount += 1;
            return true;
          },
        },
      },
    });

    await client.query({ query });
    expect(nameCount).toEqual(1);
    expect(isLoggedInCount).toEqual(1);

    // On the next request, `name` will be loaded from the cache only,
    // whereas `isLoggedIn` will be loaded from the cache then overwritten
    // by running its forced local resolver.
    await client.query({ query });
    expect(nameCount).toEqual(1);
    expect(isLoggedInCount).toEqual(2);
  });

  it("should force the running of local resolvers marked with `@client(always: true)` when using `ApolloClient.watchQuery`", async () => {
    const query = gql`
      query IsUserLoggedIn {
        isUserLoggedIn @client(always: true)
      }
    `;

    const queryNoForce = gql`
      query IsUserLoggedIn {
        isUserLoggedIn @client
      }
    `;

    let callCount = 0;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      resolvers: {
        Query: {
          isUserLoggedIn() {
            callCount += 1;
            return true;
          },
        },
      },
    });

    {
      const stream = new ObservableStream(client.watchQuery({ query }));

      await expect(stream).toEmitNext();
      expect(callCount).toBe(1);
    }

    {
      const stream = new ObservableStream(client.watchQuery({ query }));

      await expect(stream).toEmitNext();
      expect(callCount).toBe(2);
    }

    {
      const stream = new ObservableStream(
        client.watchQuery({ query: queryNoForce })
      );

      await expect(stream).toEmitNext();
      // Result is loaded from the cache since the resolver
      // isn't being forced.
      expect(callCount).toBe(2);
    }
  });

  it("should allow client-only virtual resolvers (#4731)", async () => {
    const query = gql`
      query UserData {
        userData @client {
          firstName
          lastName
          fullName
        }
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
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

    const result = await client.query({ query });

    expect(result).toEqualApolloQueryResult({
      data: {
        userData: {
          __typename: "User",
          firstName: "Ben",
          lastName: "Newman",
          fullName: "Ben Newman",
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });
});

describe("Async resolvers", () => {
  it("should support async @client resolvers", async () => {
    const query = gql`
      query Member {
        isLoggedIn @client
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      resolvers: {
        Query: {
          isLoggedIn() {
            return Promise.resolve(true);
          },
        },
      },
    });

    const result = await client.query({ query })!;

    expect(result).toEqualApolloQueryResult({
      data: { isLoggedIn: true },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });

  it("should support async @client resolvers mixed with remotely resolved data", async () => {
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

    const link = new ApolloLink(() =>
      Observable.of({
        data: {
          member: {
            name: testMember.name,
            __typename: "Member",
          },
        },
      })
    );

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      resolvers: {
        Member: {
          isLoggedIn() {
            return Promise.resolve(testMember.isLoggedIn);
          },
          sessionCount() {
            return testMember.sessionCount;
          },
        },
      },
    });

    const result = await client.query({ query })!;

    expect(result).toEqualApolloQueryResult({
      data: {
        member: {
          name: testMember.name,
          isLoggedIn: testMember.isLoggedIn,
          sessionCount: testMember.sessionCount,
          __typename: "Member",
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });
});

describe("LocalState helpers", () => {
  describe("#shouldForceResolvers", () => {
    it(
      "should return true if the document contains any @client directives " +
        "with an `always` variable of true",
      () => {
        const localState = new LocalState({ cache: new InMemoryCache() });
        const query = gql`
          query Author {
            name
            isLoggedIn @client(always: true)
          }
        `;
        expect(localState.shouldForceResolvers(query)).toBe(true);
      }
    );

    it(
      "should return false if the document contains any @client directives " +
        "without an `always` variable",
      () => {
        const localState = new LocalState({ cache: new InMemoryCache() });
        const query = gql`
          query Author {
            name
            isLoggedIn @client
          }
        `;
        expect(localState.shouldForceResolvers(query)).toBe(false);
      }
    );

    it(
      "should return false if the document contains any @client directives " +
        "with an `always` variable of false",
      () => {
        const localState = new LocalState({ cache: new InMemoryCache() });
        const query = gql`
          query Author {
            name
            isLoggedIn @client(always: false)
          }
        `;
        expect(localState.shouldForceResolvers(query)).toBe(false);
      }
    );
  });
});
