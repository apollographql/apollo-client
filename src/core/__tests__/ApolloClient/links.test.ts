import { print } from "graphql";
import { gql } from "graphql-tag";
import type { Subscription } from "rxjs";
import { map, of } from "rxjs";

import { InMemoryCache } from "@apollo/client/cache";
import type { NextLink, Operation, Reference } from "@apollo/client/core";
import { ApolloClient } from "@apollo/client/core";
import { ApolloLink } from "@apollo/client/link/core";
import { MockSubscriptionLink } from "@apollo/client/testing/core";

describe("Link interactions", () => {
  it("includes the cache on the context for eviction links", (done) => {
    expect.assertions(3);
    const query = gql`
      query CachedLuke {
        people_one(id: 1) {
          name
          friends {
            name
          }
        }
      }
    `;

    const initialData = {
      people_one: {
        name: "Luke Skywalker",
        friends: [{ name: "Leia Skywalker" }],
      },
    };

    const evictionLink = (operation: Operation, forward: NextLink) => {
      const { cache } = operation.getContext();
      expect(cache).toBeDefined();
      return forward(operation).pipe(
        map((result) => {
          setTimeout(() => {
            const cacheResult = cache.read({ query });
            expect(cacheResult).toEqual(initialData);
            expect(cacheResult).toEqual(result.data);
            if (count === 1) {
              done();
            }
          }, 10);
          return result;
        })
      );
    };

    const mockLink = new MockSubscriptionLink();
    const link = ApolloLink.from([evictionLink, mockLink]);
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.watchQuery({
      query,
      variables: {},
    });

    let count = 0;
    observable.subscribe({
      next: (result) => {
        count++;
      },
      error: (e) => {
        console.error(e);
      },
    });

    // fire off first result
    mockLink.simulateResult({ result: { data: initialData } });
  });

  it("cleans up all links on the final unsubscribe from watchQuery", (done) => {
    const query = gql`
      query WatchedLuke {
        people_one(id: 1) {
          name
          friends {
            name
          }
        }
      }
    `;

    const initialData = {
      people_one: {
        name: "Luke Skywalker",
        friends: [{ name: "Leia Skywalker" }],
      },
    };

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.watchQuery({
      query,
      variables: {},
    });

    let count = 0;
    let four: Subscription;
    // first watch
    const one = observable.subscribe((result) => count++);
    // second watch
    const two = observable.subscribe((result) => count++);
    // third watch (to be unsubscribed)
    const three = observable.subscribe((result) => {
      count++;
      three.unsubscribe();
      // fourth watch
      four = observable.subscribe((x) => count++);
    });

    // fire off first result
    link.simulateResult({ result: { data: initialData } });
    setTimeout(() => {
      one.unsubscribe();

      link.simulateResult(
        {
          result: {
            data: {
              people_one: {
                name: "Luke Skywalker",
                friends: [{ name: "R2D2" }],
              },
            },
          },
        },
        true
      );
      setTimeout(() => {
        four.unsubscribe();
        // final unsubscribe should be called now
        two.unsubscribe();
      }, 10);
    }, 10);

    link.onUnsubscribe(() => {
      expect(count).toEqual(6);
      done();
    });
  });

  it("cleans up all links on the final unsubscribe from watchQuery [error]", (done) => {
    const query = gql`
      query WatchedLuke {
        people_one(id: 1) {
          name
          friends {
            name
          }
        }
      }
    `;

    const initialData = {
      people_one: {
        name: "Luke Skywalker",
        friends: [{ name: "Leia Skywalker" }],
      },
    };

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    const observable = client.watchQuery({
      query,
      variables: {},
    });

    let count = 0;
    let four: Subscription;
    // first watch
    const one = observable.subscribe((result) => count++);
    // second watch
    observable.subscribe({
      next: () => count++,
      error: () => {
        throw new Error("Error should not be called");
      },
    });
    // third watch (to be unsubscribed)
    const three = observable.subscribe((result) => {
      count++;
      three.unsubscribe();
      // fourth watch
      four = observable.subscribe((x) => count++);
    });

    // fire off first result
    link.simulateResult({ result: { data: initialData } });
    setTimeout(() => {
      one.unsubscribe();
      four.unsubscribe();

      // final unsubscribe should be called now
      // since errors clean up subscriptions
      link.simulateResult({ error: new Error("dang") });
    }, 10);

    link.onUnsubscribe(() => {
      expect(count).toEqual(5);
      done();
    });
  });

  it("includes the cache on the context for mutations", (done) => {
    const mutation = gql`
      mutation UpdateLuke {
        people_one(id: 1) {
          name
          friends {
            name
          }
        }
      }
    `;

    const evictionLink = (operation: Operation, forward: NextLink) => {
      const { cache } = operation.getContext();
      expect(cache).toBeDefined();
      done();
      return forward(operation);
    };

    const mockLink = new MockSubscriptionLink();
    const link = ApolloLink.from([evictionLink, mockLink]);
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    void client.mutate({ mutation });
  });

  it("includes passed context in the context for mutations", (done) => {
    const mutation = gql`
      mutation UpdateLuke {
        people_one(id: 1) {
          name
          friends {
            name
          }
        }
      }
    `;

    const evictionLink = (operation: Operation, forward: NextLink) => {
      const { planet } = operation.getContext();
      expect(planet).toBe("Tatooine");
      done();
      return forward(operation);
    };

    const mockLink = new MockSubscriptionLink();
    const link = ApolloLink.from([evictionLink, mockLink]);
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    void client.mutate({ mutation, context: { planet: "Tatooine" } });
  });

  it("includes getCacheKey function on the context for cache resolvers", async () => {
    const query = gql`
      {
        books {
          id
          title
        }
      }
    `;

    const shouldHitCacheResolver = gql`
      {
        book(id: 1) {
          title
        }
      }
    `;

    const bookData = {
      books: [
        { id: 1, title: "Woo", __typename: "Book" },
        { id: 2, title: "Foo", __typename: "Book" },
      ],
    };

    const link = new ApolloLink((operation, forward) => {
      const { getCacheKey } = operation.getContext();
      expect(getCacheKey).toBeDefined();
      expect(getCacheKey({ id: 1, __typename: "Book" })).toEqual("Book:1");
      return of({ data: bookData });
    });

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              book(_, { args, toReference, readField }) {
                if (!args) {
                  throw new Error("arg must never be null");
                }

                const ref = toReference({ __typename: "Book", id: args.id });
                if (!ref) {
                  throw new Error("ref must never be null");
                }

                expect(ref).toEqual({ __ref: `Book:${args.id}` });
                const found = readField<Reference[]>("books")!.find(
                  (book) => book.__ref === ref.__ref
                );
                expect(found).toBeTruthy();
                return found;
              },
            },
          },
        },
      }),
    });

    await client.query({ query });

    const { data } = await client.query({ query: shouldHitCacheResolver });
    expect(data).toMatchObject({
      book: { title: "Woo", __typename: "Book" },
    });
  });

  it("removes @client fields from the query before it reaches the link", async () => {
    const result: { current: Operation | undefined } = {
      current: undefined,
    };

    const query = gql`
      query {
        books {
          id
          title
          isRead @client
        }
      }
    `;

    const expectedQuery = gql`
      query {
        books {
          id
          title
          __typename
        }
      }
    `;

    const link = new ApolloLink((operation) => {
      result.current = operation;

      return of({
        data: {
          books: [
            { id: 1, title: "Woo", __typename: "Book" },
            { id: 2, title: "Foo", __typename: "Book" },
          ],
        },
      });
    });

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    await client.query({ query });

    expect(print(result.current!.query)).toEqual(print(expectedQuery));
  });
});
