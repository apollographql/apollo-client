import gql from "graphql-tag";
import { print } from "graphql";
import {
  Observable,
  ObservableSubscription,
} from "../../../utilities/observables/Observable";
import { ApolloLink } from "../../../link/core";
import { InMemoryCache } from "../../../cache/inmemory/inMemoryCache";
import { MockSubscriptionLink } from "../../../testing/core";
import { ApolloClient, NextLink, Operation, Reference } from "../../../core";

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
      return forward(operation).map((result) => {
        setTimeout(() => {
          const cacheResult = cache.read({ query });
          expect(cacheResult).toEqual(initialData);
          expect(cacheResult).toEqual(result.data);
          if (count === 1) {
            done();
          }
        }, 10);
        return result;
      });
    };

    const mockLink = new MockSubscriptionLink();
    const link = ApolloLink.from([evictionLink, mockLink]);
    const client = new ApolloClient({
      cache: new InMemoryCache({ addTypename: false }),
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
      cache: new InMemoryCache({ addTypename: false }),
      link,
    });

    const observable = client.watchQuery({
      query,
      variables: {},
    });

    let count = 0;
    let four: ObservableSubscription;
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

      link.simulateResult({
        result: {
          data: {
            people_one: {
              name: "Luke Skywalker",
              friends: [{ name: "R2D2" }],
            },
          },
        },
      });
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
      cache: new InMemoryCache({ addTypename: false }),
      link,
    });

    const observable = client.watchQuery({
      query,
      variables: {},
    });

    let count = 0;
    let four: ObservableSubscription;
    // first watch
    const one = observable.subscribe((result) => count++);
    // second watch
    observable.subscribe({
      next: () => count++,
      error: () => {
        count = 0;
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

      setTimeout(() => {
        expect(count).toEqual(0);
        done();
      }, 10);
    }, 10);

    link.onUnsubscribe(() => {
      expect(count).toEqual(4);
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
      cache: new InMemoryCache({ addTypename: false }),
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
      cache: new InMemoryCache({ addTypename: false }),
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
      return Observable.of({ data: bookData });
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
        }
      }
    `;

    const link = new ApolloLink((operation) => {
      result.current = operation;

      return Observable.of({
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
      cache: new InMemoryCache({ addTypename: false }),
    });

    await client.query({ query });

    expect(print(result.current!.query)).toEqual(print(expectedQuery));
  });
});
