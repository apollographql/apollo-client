// externals
import gql from "graphql-tag";
import { InMemoryCache } from "../../../cache/inmemory/inMemoryCache";

// mocks
import { MockSubscriptionLink, wait } from "../../../testing/core";

// core
import { QueryManager } from "../../QueryManager";
import { GraphQLError } from "graphql";
import { getDefaultOptionsForQueryManagerTests } from "../../../testing/core/mocking/mockQueryManager";
import { ObservableStream } from "../../../testing/internal";
import { ApolloError } from "../../../errors";
import { ApolloClient } from "../../ApolloClient";

describe("mutiple results", () => {
  it("allows multiple query results from link", async () => {
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
    const client = new ApolloClient({
      cache: new InMemoryCache({ addTypename: false }),
      link,
    });

    const observable = client.watchQuery({
      query,
      variables: {},
    });
    const stream = new ObservableStream(observable);

    // fire off first result
    link.simulateResult({ result: { data: initialData } });

    await expect(stream).toEmitApolloQueryResult({
      data: initialData,
      loading: false,
      networkStatus: 7,
    });

    link.simulateResult({ result: { data: laterData } });

    await expect(stream).toEmitApolloQueryResult({
      data: laterData,
      loading: false,
      networkStatus: 7,
    });
  });

  it("allows multiple query results from link with ignored errors", async () => {
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
    const client = new ApolloClient({
      cache: new InMemoryCache({ addTypename: false }),
      link,
    });

    const observable = client.watchQuery({
      query,
      variables: {},
      errorPolicy: "ignore",
    });
    const stream = new ObservableStream(observable);

    // fire off first result
    link.simulateResult({ result: { data: initialData } });

    await expect(stream).toEmitApolloQueryResult({
      data: initialData,
      loading: false,
      networkStatus: 7,
    });

    link.simulateResult({
      result: { errors: [new GraphQLError("defer failed")] },
    });

    await expect(stream).toEmitApolloQueryResult({
      data: undefined,
      loading: false,
      networkStatus: 7,
    });

    await wait(20);
    link.simulateResult({ result: { data: laterData } });

    await expect(stream).toEmitApolloQueryResult({
      data: laterData,
      loading: false,
      networkStatus: 7,
    });
  });

  it("strips errors from a result if ignored", async () => {
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
    const stream = new ObservableStream(observable);

    // fire off first result
    link.simulateResult({ result: { data: initialData } });

    await expect(stream).toEmitValue({
      data: initialData,
      loading: false,
      networkStatus: 7,
    });

    // this should fire the `next` event without this error
    link.simulateResult({
      result: {
        errors: [new GraphQLError("defer failed")],
        data: laterData,
      },
    });

    await expect(stream).toEmitValueStrict({
      data: laterData,
      loading: false,
      networkStatus: 7,
    });
  });

  it.skip("allows multiple query results from link with all errors", async () => {
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
    const stream = new ObservableStream(observable);

    // fire off first result
    link.simulateResult({ result: { data: initialData } });

    await expect(stream).toEmitValue({
      data: initialData,
      loading: false,
      networkStatus: 7,
    });

    // this should fire the next event again
    link.simulateResult({
      error: new Error("defer failed"),
    });

    await expect(stream).toEmitValue({
      data: initialData,
      loading: false,
      networkStatus: 7,
      errors: [new Error("defer failed")],
    });

    link.simulateResult({ result: { data: laterData } });

    await expect(stream).toEmitValueStrict({
      data: laterData,
      loading: false,
      networkStatus: 7,
    });
  });

  it("closes the observable if an error is set with the none policy", async () => {
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
    const stream = new ObservableStream(observable);

    let count = 0;
    observable.subscribe({
      next: (result) => {
        // errors should never be passed since they are ignored
        count++;
        if (count === 1) {
          expect(result.errors).toBeUndefined();
        }
        if (count === 2) {
          console.log(new Error("result came after an error"));
        }
      },
      error: (e) => {
        expect(e).toBeDefined();
        expect(e.graphQLErrors).toBeDefined();
      },
    });

    // fire off first result
    link.simulateResult({ result: { data: initialData } });

    await expect(stream).toEmitValue({
      data: initialData,
      loading: false,
      networkStatus: 7,
    });

    link.simulateResult({ error: new Error("defer failed") });

    await expect(stream).toEmitError(
      new ApolloError({ networkError: new Error("defer failed") })
    );
  });
});
