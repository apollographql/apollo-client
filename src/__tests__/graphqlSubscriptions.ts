import { gql } from "graphql-tag";

import { InMemoryCache } from "@apollo/client/cache";
import { ApolloClient } from "@apollo/client/core";
import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
} from "@apollo/client/errors";
import { MockSubscriptionLink } from "@apollo/client/testing";
import {
  mockMultipartSubscriptionStream,
  ObservableStream,
  spyOnConsole,
} from "@apollo/client/testing/internal";

describe("GraphQL Subscriptions", () => {
  const results = [
    "Dahivat Pandya",
    "Vyacheslav Kim",
    "Changping Chen",
    "Amanda Liu",
  ].map((name) => ({ result: { data: { user: { name } } }, delay: 10 }));

  let options: any;
  let defaultOptions: any;
  beforeEach(() => {
    options = {
      query: gql`
        subscription UserInfo($name: String) {
          user(name: $name) {
            name
          }
        }
      `,
      variables: {
        name: "Changping Chen",
      },
      context: {
        someVar: "Some value",
      },
    };

    defaultOptions = {
      query: gql`
        subscription UserInfo($name: String = "Changping Chen") {
          user(name: $name) {
            name
          }
        }
      `,
    };
  });

  it("should start a subscription on network interface and unsubscribe", async () => {
    const link = new MockSubscriptionLink();
    // This test calls directly through Apollo Client
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const stream = new ObservableStream(client.subscribe(defaultOptions));
    link.simulateResult(results[0]);

    await expect(stream).toEmitStrictTyped(results[0].result);

    stream.unsubscribe();
  });

  it("should subscribe with default values", async () => {
    const link = new MockSubscriptionLink();
    // This test calls directly through Apollo Client
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const stream = new ObservableStream(client.subscribe(options));

    link.simulateResult(results[0]);

    await expect(stream).toEmitStrictTyped(results[0].result);

    stream.unsubscribe();
  });

  it("should multiplex subscriptions", async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe(options);
    const stream1 = new ObservableStream(obs);
    const stream2 = new ObservableStream(obs);

    link.simulateResult(results[0]);

    await expect(stream1).toEmitStrictTyped(results[0].result);
    await expect(stream2).toEmitStrictTyped(results[0].result);
  });

  it("should receive multiple results for a subscription", async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const stream = new ObservableStream(client.subscribe(options));

    for (let i = 0; i < 4; i++) {
      link.simulateResult(results[i]);
    }

    await expect(stream).toEmitStrictTyped(results[0].result);
    await expect(stream).toEmitStrictTyped(results[1].result);
    await expect(stream).toEmitStrictTyped(results[2].result);
    await expect(stream).toEmitStrictTyped(results[3].result);
    await expect(stream).not.toEmitAnything();
  });

  it("should not cache subscription data if a `no-cache` fetch policy is used", async () => {
    const link = new MockSubscriptionLink();
    const cache = new InMemoryCache();
    const client = new ApolloClient({
      link,
      cache,
    });

    expect(cache.extract()).toEqual({});

    options.fetchPolicy = "no-cache";
    const stream = new ObservableStream(client.subscribe(options));

    link.simulateResult(results[0]);

    await expect(stream).toEmitNext();
    expect(cache.extract()).toEqual({});
  });

  it("emits an error if the result has GraphQL errors", async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe(options);
    const stream = new ObservableStream(obs);

    link.simulateResult({
      result: {
        data: null,
        errors: [
          {
            message: "This is an error",
            locations: [
              {
                column: 3,
                line: 2,
              },
            ],
            path: ["result"],
          },
        ],
      },
    });

    await expect(stream).toEmitStrictTyped({
      data: undefined,
      error: new CombinedGraphQLErrors({
        data: null,
        errors: [
          {
            message: "This is an error",
            locations: [
              {
                column: 3,
                line: 2,
              },
            ],
            path: ["result"],
          },
        ],
      }),
    });
  });

  it("can continue receiving results after GraphQL errors when the connection remains open", async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe(options);
    const stream = new ObservableStream(obs);

    link.simulateResult({
      result: {
        data: null,
        errors: [
          {
            message: "This is an error",
            locations: [
              {
                column: 3,
                line: 2,
              },
            ],
            path: ["result"],
          },
        ],
      },
    });

    await expect(stream).toEmitStrictTyped({
      data: undefined,
      error: new CombinedGraphQLErrors({
        data: null,
        errors: [
          {
            message: "This is an error",
            locations: [
              {
                column: 3,
                line: 2,
              },
            ],
            path: ["result"],
          },
        ],
      }),
    });

    link.simulateResult(results[0]);

    await expect(stream).toEmitStrictTyped({ data: results[0].result.data });
  });

  it("emits a result with error if the result has network errors", async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe(options);
    const stream = new ObservableStream(obs);

    link.simulateResult({ error: new Error("Oops") });

    await expect(stream).toEmitStrictTyped({
      data: undefined,
      error: new Error("Oops"),
    });

    await expect(stream).toComplete();
  });

  it('returns errors in next result when `errorPolicy` is "all"', async () => {
    const query = gql`
      subscription UserInfo($name: String) {
        user(name: $name) {
          name
        }
      }
    `;
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe({
      query,
      variables: { name: "Iron Man" },
      errorPolicy: "all",
    });
    const stream = new ObservableStream(obs);

    link.simulateResult(
      {
        result: {
          data: null,
          errors: [{ message: "This is an error" }],
        },
      },
      true
    );

    await expect(stream).toEmitStrictTyped({
      data: undefined,
      error: new CombinedGraphQLErrors({
        data: null,
        errors: [{ message: "This is an error" }],
      }),
    });

    await expect(stream).toComplete();
  });

  it("emits a result with error and completes when the result has network errors with `errorPolicy: 'all'`", async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe({ ...options, errorPolicy: "all" });
    const stream = new ObservableStream(obs);

    link.simulateResult({ error: new Error("Oops") });

    await expect(stream).toEmitStrictTyped({
      data: undefined,
      error: new Error("Oops"),
    });
    await expect(stream).toComplete();
  });

  it('emits protocol errors when `errorPolicy` is "all"', async () => {
    const { httpLink, enqueueProtocolErrors } =
      mockMultipartSubscriptionStream();

    const query = gql`
      subscription UserInfo($name: String) {
        user(name: $name) {
          name
        }
      }
    `;
    const client = new ApolloClient({
      link: httpLink,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe({
      query,
      variables: { name: "Iron Man" },
      errorPolicy: "all",
    });
    const stream = new ObservableStream(obs);

    // Silence expected warning about missing field for cache write
    using _consoleSpy = spyOnConsole("warn");

    enqueueProtocolErrors([
      {
        message: "cannot read message from websocket",
        extensions: {
          code: "WEBSOCKET_MESSAGE_ERROR",
        },
      },
    ]);

    await expect(stream).toEmitStrictTyped({
      data: undefined,
      error: new CombinedProtocolErrors([
        {
          message: "cannot read message from websocket",
          extensions: {
            code: "WEBSOCKET_MESSAGE_ERROR",
          },
        },
      ]),
    });

    await expect(stream).toComplete();
  });

  it('does not emit anything for GraphQL errors with no data in next result when `errorPolicy` is "ignore"', async () => {
    const query = gql`
      subscription UserInfo($name: String) {
        user(name: $name) {
          name
        }
      }
    `;
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe({
      query,
      variables: { name: "Iron Man" },
      errorPolicy: "ignore",
    });
    const stream = new ObservableStream(obs);

    link.simulateResult({
      result: {
        data: null,
        errors: [{ message: "This is an error" }],
      },
    });

    await expect(stream).not.toEmitAnything();

    link.simulateComplete();
    await expect(stream).toComplete();
  });

  it('does not emit anything for network errors with no data in next result when `errorPolicy` is "ignore"', async () => {
    const query = gql`
      subscription UserInfo($name: String) {
        user(name: $name) {
          name
        }
      }
    `;
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe({
      query,
      variables: { name: "Iron Man" },
      errorPolicy: "ignore",
    });
    const stream = new ObservableStream(obs);

    link.simulateResult({ error: new Error("Oops") });

    await expect(stream).toComplete();
  });

  it('does not emit anything and completes observable for protocolErrors when `errorPolicy` is "ignore"', async () => {
    const { httpLink, enqueueProtocolErrors } =
      mockMultipartSubscriptionStream();
    const query = gql`
      subscription UserInfo($name: String) {
        user(name: $name) {
          name
        }
      }
    `;
    const client = new ApolloClient({
      link: httpLink,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe({
      query,
      variables: { name: "Iron Man" },
      errorPolicy: "ignore",
    });
    const stream = new ObservableStream(obs);

    // Silence expected warning about missing field for cache write
    using _consoleSpy = spyOnConsole("warn");

    enqueueProtocolErrors([
      {
        message: "cannot read message from websocket",
        extensions: {
          code: "WEBSOCKET_MESSAGE_ERROR",
        },
      },
    ]);

    await expect(stream).toComplete();
  });

  it("should call complete handler when the subscription completes", async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const stream = new ObservableStream(client.subscribe(defaultOptions));

    setTimeout(() => link.simulateComplete(), 50);

    await expect(stream).toComplete();
  });

  it("should pass a context object through the link execution chain", async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    const stream = new ObservableStream(client.subscribe(options));

    link.simulateResult(results[0]);

    await expect(stream).toEmitStrictTyped(results[0].result);

    expect(link.operation?.getContext().someVar).toEqual(
      options.context.someVar
    );
  });

  it("emits an error if the result has protocolErrors on it", async () => {
    const { httpLink, enqueueProtocolErrors } =
      mockMultipartSubscriptionStream();

    const client = new ApolloClient({
      link: httpLink,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe(options);
    const stream = new ObservableStream(obs);

    // Silence expected warning about missing field for cache write
    using _consoleSpy = spyOnConsole("warn");

    enqueueProtocolErrors([
      {
        message: "cannot read message from websocket",
        extensions: {
          code: "WEBSOCKET_MESSAGE_ERROR",
        },
      },
    ]);

    await expect(stream).toEmitStrictTyped({
      data: undefined,
      error: new CombinedProtocolErrors([
        {
          message: "cannot read message from websocket",
          extensions: {
            code: "WEBSOCKET_MESSAGE_ERROR",
          },
        },
      ]),
    });
  });
});
