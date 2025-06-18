import { GraphQLError } from "graphql";
import { gql } from "graphql-tag";

import { ApolloClient, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { Defer20220824Handler } from "@apollo/client/incremental";
import { MockSubscriptionLink } from "@apollo/client/testing";
import { ObservableStream, wait } from "@apollo/client/testing/internal";

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
      cache: new InMemoryCache(),
      link,
      incrementalHandler: new Defer20220824Handler(),
    });

    const observable = client.watchQuery({
      query,
      variables: {},
    });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    // fire off first result
    link.simulateResult({ result: { data: initialData } });

    await expect(stream).toEmitTypedValue({
      data: initialData,
      dataState: "complete",
      loading: false,
      networkStatus: 7,
      partial: false,
    });

    link.simulateResult({ result: { data: laterData } });

    await expect(stream).toEmitTypedValue({
      data: laterData,
      dataState: "complete",
      loading: false,
      networkStatus: 7,
      partial: false,
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
      cache: new InMemoryCache(),
      link,
      incrementalHandler: new Defer20220824Handler(),
    });

    const observable = client.watchQuery({
      query,
      variables: {},
      errorPolicy: "ignore",
    });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    // fire off first result
    link.simulateResult({ result: { data: initialData } });

    await expect(stream).toEmitTypedValue({
      data: initialData,
      dataState: "complete",
      loading: false,
      networkStatus: 7,
      partial: false,
    });

    link.simulateResult({
      result: { errors: [new GraphQLError("defer failed")] },
    });

    await expect(stream).toEmitTypedValue({
      data: undefined,
      dataState: "empty",
      loading: false,
      networkStatus: 7,
      partial: true,
    });

    await wait(20);
    link.simulateResult({ result: { data: laterData } });

    await expect(stream).toEmitTypedValue({
      data: laterData,
      dataState: "complete",
      loading: false,
      networkStatus: 7,
      partial: false,
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
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      incrementalHandler: new Defer20220824Handler(),
    });

    const observable = client.watchQuery({
      query,
      variables: {},
      errorPolicy: "ignore",
    });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    // fire off first result
    link.simulateResult({ result: { data: initialData } });

    await expect(stream).toEmitTypedValue({
      data: initialData,
      dataState: "complete",
      loading: false,
      networkStatus: 7,
      partial: false,
    });

    // this should fire the `next` event without this error
    link.simulateResult({
      result: {
        errors: [new GraphQLError("defer failed")],
        data: laterData,
      },
    });

    await expect(stream).toEmitTypedValue({
      data: laterData,
      dataState: "complete",
      loading: false,
      networkStatus: 7,
      partial: false,
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
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      incrementalHandler: new Defer20220824Handler(),
    });

    const observable = client.watchQuery({
      query,
      variables: {},
      errorPolicy: "all",
    });
    const stream = new ObservableStream(observable);

    // fire off first result
    link.simulateResult({ result: { data: initialData } });

    await expect(stream).toEmitTypedValue({
      data: initialData,
      dataState: "complete",
      loading: false,
      networkStatus: 7,
      partial: false,
    });

    // this should fire the next event again
    link.simulateResult({
      error: new Error("defer failed"),
    });

    await expect(stream).toEmitTypedValue({
      data: initialData,
      dataState: "complete",
      loading: false,
      networkStatus: 7,
      error: new Error("defer failed"),
      partial: false,
    });

    link.simulateResult({ result: { data: laterData } });

    await expect(stream).toEmitTypedValue({
      data: laterData,
      dataState: "complete",
      loading: false,
      networkStatus: 7,
      partial: false,
    });
  });

  it("emits error if an error is set with the none policy", async () => {
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
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      incrementalHandler: new Defer20220824Handler(),
    });

    const observable = client.watchQuery({
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
        // loading
        if (count === 1) {
          expect(result.error).toBeUndefined();
        }
        // first result
        if (count === 2) {
          expect(result.error).toBeUndefined();
        }
        // error
        if (count === 3) {
          expect(result.error).toBeDefined();
        }
      },
    });

    await expect(stream).toEmitTypedValue({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    // fire off first result
    link.simulateResult({ result: { data: initialData } });

    await expect(stream).toEmitTypedValue({
      data: initialData,
      dataState: "complete",
      loading: false,
      networkStatus: 7,
      partial: false,
    });

    link.simulateResult({ error: new Error("defer failed") });

    await expect(stream).toEmitTypedValue({
      data: initialData,
      dataState: "complete",
      error: new Error("defer failed"),
      loading: false,
      networkStatus: NetworkStatus.error,
      partial: false,
    });

    await expect(stream).not.toEmitAnything();
  });
});
