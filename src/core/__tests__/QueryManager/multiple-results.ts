// externals
import gql from "graphql-tag";
import { InMemoryCache } from "../../../cache/inmemory/inMemoryCache";

// mocks
import { itAsync, MockSubscriptionLink } from "../../../testing/core";

// core
import { QueryManager } from "../../QueryManager";
import { GraphQLError } from "graphql";
import { getDefaultOptionsForQueryManagerTests } from "../../../testing/core/mocking/mockQueryManager";

describe("mutiple results", () => {
  itAsync("allows multiple query results from link", (resolve, reject) => {
    const query = gql`
      query LazyLoadLuke {
        people_one(id: 1) {
          name
          friends @defer {
            name
          }
        }
      }
    `;

    const initialData = {
      people_one: {
        name: "Luke Skywalker",
        friends: null,
      },
    };

    const laterData = {
      people_one: {
        // XXX true defer's wouldn't send this
        name: "Luke Skywalker",
        friends: [{ name: "Leia Skywalker" }],
      },
    };
    const link = new MockSubscriptionLink();
    const queryManager = new QueryManager(
      getDefaultOptionsForQueryManagerTests({
        cache: new InMemoryCache({ addTypename: false }),
        link,
      })
    );

    const observable = queryManager.watchQuery<any>({
      query,
      variables: {},
    });

    let count = 0;
    observable.subscribe({
      next: (result) => {
        count++;
        if (count === 1) {
          link.simulateResult({ result: { data: laterData } });
        }
        if (count === 2) {
          resolve();
        }
      },
      error: (e) => {
        console.error(e);
      },
    });

    // fire off first result
    link.simulateResult({ result: { data: initialData } });
  });

  itAsync(
    "allows multiple query results from link with ignored errors",
    (resolve, reject) => {
      const query = gql`
        query LazyLoadLuke {
          people_one(id: 1) {
            name
            friends @defer {
              name
            }
          }
        }
      `;

      const initialData = {
        people_one: {
          name: "Luke Skywalker",
          friends: null,
        },
      };

      const laterData = {
        people_one: {
          // XXX true defer's wouldn't send this
          name: "Luke Skywalker",
          friends: [{ name: "Leia Skywalker" }],
        },
      };
      const link = new MockSubscriptionLink();
      const queryManager = new QueryManager(
        getDefaultOptionsForQueryManagerTests({
          cache: new InMemoryCache({ addTypename: false }),
          link,
        })
      );

      const observable = queryManager.watchQuery<any>({
        query,
        variables: {},
        errorPolicy: "ignore",
      });

      let count = 0;
      observable.subscribe({
        next: (result) => {
          // errors should never be passed since they are ignored
          expect(result.errors).toBeUndefined();
          count++;
          if (count === 1) {
            // this shouldn't fire the next event again
            link.simulateResult({
              result: { errors: [new GraphQLError("defer failed")] },
            });
            setTimeout(() => {
              link.simulateResult({ result: { data: laterData } });
            }, 20);
          }
          if (count === 2) {
            // make sure the count doesn't go up by accident
            setTimeout(() => {
              if (count === 3) throw new Error("error was not ignored");
              resolve();
            });
          }
        },
        error: (e) => {
          console.error(e);
        },
      });

      // fire off first result
      link.simulateResult({ result: { data: initialData } });
    }
  );
  itAsync("strips errors from a result if ignored", (resolve, reject) => {
    const query = gql`
      query LazyLoadLuke {
        people_one(id: 1) {
          name
          friends @defer {
            name
          }
        }
      }
    `;

    const initialData = {
      people_one: {
        name: "Luke Skywalker",
        friends: null,
      },
    };

    const laterData = {
      people_one: {
        // XXX true defer's wouldn't send this
        name: "Luke Skywalker",
        friends: [{ name: "Leia Skywalker" }],
      },
    };
    const link = new MockSubscriptionLink();
    const queryManager = new QueryManager(
      getDefaultOptionsForQueryManagerTests({
        cache: new InMemoryCache({ addTypename: false }),
        link,
      })
    );

    const observable = queryManager.watchQuery<any>({
      query,
      variables: {},
      errorPolicy: "ignore",
    });

    let count = 0;
    observable.subscribe({
      next: (result) => {
        // errors should never be passed since they are ignored
        expect(result.errors).toBeUndefined();
        count++;

        if (count === 1) {
          expect(result.data).toEqual(initialData);
          // this should fire the `next` event without this error
          link.simulateResult({
            result: {
              errors: [new GraphQLError("defer failed")],
              data: laterData,
            },
          });
        }
        if (count === 2) {
          expect(result.data).toEqual(laterData);
          expect(result.errors).toBeUndefined();
          // make sure the count doesn't go up by accident
          setTimeout(() => {
            if (count === 3) reject(new Error("error was not ignored"));
            resolve();
          }, 10);
        }
      },
      error: (e) => {
        console.error(e);
      },
    });

    // fire off first result
    link.simulateResult({ result: { data: initialData } });
  });

  itAsync.skip(
    "allows multiple query results from link with all errors",
    (resolve, reject) => {
      const query = gql`
        query LazyLoadLuke {
          people_one(id: 1) {
            name
            friends @defer {
              name
            }
          }
        }
      `;

      const initialData = {
        people_one: {
          name: "Luke Skywalker",
          friends: null,
        },
      };

      const laterData = {
        people_one: {
          // XXX true defer's wouldn't send this
          name: "Luke Skywalker",
          friends: [{ name: "Leia Skywalker" }],
        },
      };
      const link = new MockSubscriptionLink();
      const queryManager = new QueryManager(
        getDefaultOptionsForQueryManagerTests({
          cache: new InMemoryCache({ addTypename: false }),
          link,
        })
      );

      const observable = queryManager.watchQuery<any>({
        query,
        variables: {},
        errorPolicy: "all",
      });

      let count = 0;
      observable.subscribe({
        next: (result) => {
          try {
            // errors should never be passed since they are ignored
            count++;
            if (count === 1) {
              expect(result.errors).toBeUndefined();
              // this should fire the next event again
              link.simulateResult({
                error: new Error("defer failed"),
              });
            }
            if (count === 2) {
              expect(result.errors).toBeDefined();
              link.simulateResult({ result: { data: laterData } });
            }
            if (count === 3) {
              expect(result.errors).toBeUndefined();
              // make sure the count doesn't go up by accident
              setTimeout(() => {
                if (count === 4) reject(new Error("error was not ignored"));
                resolve();
              });
            }
          } catch (e) {
            reject(e);
          }
        },
        error: (e) => {
          reject(e);
        },
      });

      // fire off first result
      link.simulateResult({ result: { data: initialData } });
    }
  );
  itAsync(
    "closes the observable if an error is set with the none policy",
    (resolve, reject) => {
      const query = gql`
        query LazyLoadLuke {
          people_one(id: 1) {
            name
            friends @defer {
              name
            }
          }
        }
      `;

      const initialData = {
        people_one: {
          name: "Luke Skywalker",
          friends: null,
        },
      };

      const link = new MockSubscriptionLink();
      const queryManager = new QueryManager(
        getDefaultOptionsForQueryManagerTests({
          cache: new InMemoryCache({ addTypename: false }),
          link,
        })
      );

      const observable = queryManager.watchQuery<any>({
        query,
        variables: {},
        // errorPolicy: 'none', // this is the default
      });

      let count = 0;
      observable.subscribe({
        next: (result) => {
          // errors should never be passed since they are ignored
          count++;
          if (count === 1) {
            expect(result.errors).toBeUndefined();
            // this should fire the next event again
            link.simulateResult({
              error: new Error("defer failed"),
            });
          }
          if (count === 2) {
            console.log(new Error("result came after an error"));
          }
        },
        error: (e) => {
          expect(e).toBeDefined();
          expect(e.graphQLErrors).toBeDefined();
          resolve();
        },
      });

      // fire off first result
      link.simulateResult({ result: { data: initialData } });
    }
  );
});
