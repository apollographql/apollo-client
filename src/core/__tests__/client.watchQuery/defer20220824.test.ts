import { GraphQLError } from "graphql";
import { gql } from "graphql-tag";

import type { ObservableQuery } from "@apollo/client";
import { ApolloClient, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { Defer20220824Handler } from "@apollo/client/incremental";
import { ApolloLink } from "@apollo/client/link";
import { MockSubscriptionLink } from "@apollo/client/testing";
import {
  mockDefer20220824,
  ObservableStream,
  wait,
} from "@apollo/client/testing/internal";

test("allows multiple query results from link", async () => {
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

test("allows multiple query results from link with ignored errors", async () => {
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

test("strips errors from a result if ignored", async () => {
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

test.skip("allows multiple query results from link with all errors", async () => {
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

test("emits error if an error is set with the none policy", async () => {
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

test("deduplicates queries as long as a query still has deferred chunks", async () => {
  const query = gql`
    query LazyLoadLuke {
      people(id: 1) {
        id
        name
        friends {
          id
          ... @defer {
            name
          }
        }
      }
    }
  `;

  const outgoingRequestSpy = jest.fn(((operation, forward) =>
    forward(operation)) satisfies ApolloLink.RequestHandler);
  const defer = mockDefer20220824();
  const client = new ApolloClient({
    cache: new InMemoryCache({}),
    link: new ApolloLink(outgoingRequestSpy).concat(defer.httpLink),
    incrementalHandler: new Defer20220824Handler(),
  });

  const query1 = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );
  const query2 = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );
  expect(outgoingRequestSpy).toHaveBeenCalledTimes(1);

  const initialData = {
    people: {
      __typename: "Person",
      id: 1,
      name: "Luke",
      friends: [
        {
          __typename: "Person",
          id: 5,
        } as { __typename: "Person"; id: number; name?: string },
        {
          __typename: "Person",
          id: 8,
        } as { __typename: "Person"; id: number; name?: string },
      ],
    },
  };
  const initialResult: ObservableQuery.Result<typeof initialData> = {
    data: initialData,
    dataState: "streaming",
    loading: true,
    networkStatus: NetworkStatus.streaming,
    partial: true,
  };

  defer.enqueueInitialChunk({
    data: initialData,
    hasNext: true,
  });

  await expect(query1).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });
  await expect(query2).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(query1).toEmitTypedValue(initialResult);
  await expect(query2).toEmitTypedValue(initialResult);

  const query3 = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );
  await expect(query3).toEmitTypedValue(initialResult);
  expect(outgoingRequestSpy).toHaveBeenCalledTimes(1);

  const firstChunk = {
    incremental: [
      {
        data: {
          name: "Leia",
        },
        path: ["people", "friends", 0],
      },
    ],
    hasNext: true,
  };
  const resultAfterFirstChunk = structuredClone(
    initialResult
  ) as ObservableQuery.Result<any>;
  resultAfterFirstChunk.data.people.friends[0].name = "Leia";

  defer.enqueueSubsequentChunk(firstChunk);

  await expect(query1).toEmitTypedValue(resultAfterFirstChunk);
  await expect(query2).toEmitTypedValue(resultAfterFirstChunk);
  await expect(query3).toEmitTypedValue(resultAfterFirstChunk);

  const query4 = new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );
  await expect(query4).toEmitTypedValue(resultAfterFirstChunk);
  expect(outgoingRequestSpy).toHaveBeenCalledTimes(1);

  const secondChunk = {
    incremental: [
      {
        data: {
          name: "Han Solo",
        },
        path: ["people", "friends", 1],
      },
    ],
    hasNext: false,
  };
  const resultAfterSecondChunk = {
    ...structuredClone(resultAfterFirstChunk),
    loading: false,
    networkStatus: NetworkStatus.ready,
    dataState: "complete",
    partial: false,
  } as ObservableQuery.Result<any>;
  resultAfterSecondChunk.data.people.friends[1].name = "Han Solo";

  defer.enqueueSubsequentChunk(secondChunk);

  await expect(query1).toEmitTypedValue(resultAfterSecondChunk);
  await expect(query2).toEmitTypedValue(resultAfterSecondChunk);
  await expect(query3).toEmitTypedValue(resultAfterSecondChunk);
  await expect(query4).toEmitTypedValue(resultAfterSecondChunk);

  // TODO: Re-enable once below condition can be met
  /* const query5 = */ new ObservableStream(
    client.watchQuery({ query, fetchPolicy: "network-only" })
  );
  // TODO: Re-enable once notifyOnNetworkStatusChange controls whether we
  // get the loading state. This test fails with the switch to RxJS for now
  // since the initial value is emitted synchronously unlike zen-observable
  // where the emitted result wasn't emitted until after this assertion.
  // expect(query5).not.toEmitAnything();
  expect(outgoingRequestSpy).toHaveBeenCalledTimes(2);
});
