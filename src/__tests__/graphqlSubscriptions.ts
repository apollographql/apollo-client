import { GraphQLError } from "graphql";
import { gql } from "graphql-tag";

import { ObservableStream, spyOnConsole } from "../testing/internal/index.js";

import { InMemoryCache } from "@apollo/client/cache";
import { ApolloClient } from "@apollo/client/core";
import { ApolloError, PROTOCOL_ERRORS_SYMBOL } from "@apollo/client/errors";
import { mockObservableLink } from "@apollo/client/testing";

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
    const link = mockObservableLink();
    // This test calls directly through Apollo Client
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const stream = new ObservableStream(client.subscribe(defaultOptions));
    link.simulateResult(results[0]);

    await expect(stream).toEmitFetchResult(results[0].result);

    stream.unsubscribe();
  });

  it("should subscribe with default values", async () => {
    const link = mockObservableLink();
    // This test calls directly through Apollo Client
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const stream = new ObservableStream(client.subscribe(options));

    link.simulateResult(results[0]);

    await expect(stream).toEmitFetchResult(results[0].result);

    stream.unsubscribe();
  });

  it("should multiplex subscriptions", async () => {
    const link = mockObservableLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe(options);
    const stream1 = new ObservableStream(obs);
    const stream2 = new ObservableStream(obs);

    link.simulateResult(results[0]);

    await expect(stream1).toEmitFetchResult(results[0].result);
    await expect(stream2).toEmitFetchResult(results[0].result);
  });

  it("should receive multiple results for a subscription", async () => {
    const link = mockObservableLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const stream = new ObservableStream(client.subscribe(options));

    for (let i = 0; i < 4; i++) {
      link.simulateResult(results[i]);
    }

    await expect(stream).toEmitFetchResult(results[0].result);
    await expect(stream).toEmitFetchResult(results[1].result);
    await expect(stream).toEmitFetchResult(results[2].result);
    await expect(stream).toEmitFetchResult(results[3].result);
    await expect(stream).not.toEmitAnything();
  });

  it("should not cache subscription data if a `no-cache` fetch policy is used", async () => {
    const link = mockObservableLink();
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

  it("should throw an error if the result has errors on it", async () => {
    const link = mockObservableLink();
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
          } as any,
        ],
      },
    });

    await expect(stream).toEmitError(
      new ApolloError({
        graphQLErrors: [
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
      })
    );
  });

  it('returns errors in next result when `errorPolicy` is "all"', async () => {
    const query = gql`
      subscription UserInfo($name: String) {
        user(name: $name) {
          name
        }
      }
    `;
    const link = mockObservableLink();
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
          errors: [new GraphQLError("This is an error")],
        },
      },
      true
    );

    await expect(stream).toEmitFetchResult({
      data: null,
      errors: [new GraphQLError("This is an error")],
    });

    await expect(stream).toComplete();
  });

  it('throws protocol errors when `errorPolicy` is "all"', async () => {
    const query = gql`
      subscription UserInfo($name: String) {
        user(name: $name) {
          name
        }
      }
    `;
    const link = mockObservableLink();
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

    // Silence expected warning about missing field for cache write
    using _consoleSpy = spyOnConsole("warn");

    link.simulateResult(
      {
        result: {
          data: null,
          extensions: {
            [PROTOCOL_ERRORS_SYMBOL]: [
              {
                message: "cannot read message from websocket",
                extensions: {
                  code: "WEBSOCKET_MESSAGE_ERROR",
                },
              },
            ],
          },
        },
      },
      true
    );

    await expect(stream).toEmitError(
      new ApolloError({
        protocolErrors: [
          {
            message: "cannot read message from websocket",
            extensions: {
              code: "WEBSOCKET_MESSAGE_ERROR",
            },
          },
        ],
      })
    );
  });

  it('strips errors in next result when `errorPolicy` is "ignore"', async () => {
    const query = gql`
      subscription UserInfo($name: String) {
        user(name: $name) {
          name
        }
      }
    `;
    const link = mockObservableLink();
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

    link.simulateResult(
      {
        result: {
          data: null,
          errors: [new GraphQLError("This is an error")],
        },
      },
      true
    );

    await expect(stream).toEmitFetchResult({ data: null });
    await expect(stream).toComplete();
  });

  it('throws protocol errors when `errorPolicy` is "ignore"', async () => {
    const query = gql`
      subscription UserInfo($name: String) {
        user(name: $name) {
          name
        }
      }
    `;
    const link = mockObservableLink();
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

    // Silence expected warning about missing field for cache write
    using _consoleSpy = spyOnConsole("warn");

    link.simulateResult(
      {
        result: {
          data: null,
          extensions: {
            [PROTOCOL_ERRORS_SYMBOL]: [
              {
                message: "cannot read message from websocket",
                extensions: {
                  code: "WEBSOCKET_MESSAGE_ERROR",
                },
              },
            ],
          },
        },
      },
      true
    );

    await expect(stream).toEmitError(
      new ApolloError({
        protocolErrors: [
          {
            message: "cannot read message from websocket",
            extensions: {
              code: "WEBSOCKET_MESSAGE_ERROR",
            },
          },
        ],
      })
    );
  });

  it("should call complete handler when the subscription completes", async () => {
    const link = mockObservableLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const stream = new ObservableStream(client.subscribe(defaultOptions));

    setTimeout(() => link.simulateComplete(), 50);

    await expect(stream).toComplete();
  });

  it("should pass a context object through the link execution chain", async () => {
    const link = mockObservableLink();
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    const stream = new ObservableStream(client.subscribe(options));

    link.simulateResult(results[0]);

    await expect(stream).toEmitFetchResult(results[0].result);

    expect(link.operation?.getContext().someVar).toEqual(
      options.context.someVar
    );
  });

  it("should throw an error if the result has protocolErrors on it", async () => {
    const link = mockObservableLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obs = client.subscribe(options);
    const stream = new ObservableStream(obs);

    // Silence expected warning about missing field for cache write
    using _consoleSpy = spyOnConsole("warn");

    link.simulateResult({
      result: {
        data: null,
        extensions: {
          [PROTOCOL_ERRORS_SYMBOL]: [
            {
              message: "cannot read message from websocket",
              extensions: {
                code: "WEBSOCKET_MESSAGE_ERROR",
              },
            },
          ],
        },
      },
    });

    await expect(stream).toEmitError(
      new ApolloError({
        protocolErrors: [
          {
            message: "cannot read message from websocket",
            extensions: {
              code: "WEBSOCKET_MESSAGE_ERROR",
            },
          },
        ],
      })
    );
  });
});
