import gql from "graphql-tag";

import { ApolloClient, FetchResult } from "../core";
import { InMemoryCache } from "../cache";
import { ApolloError, PROTOCOL_ERRORS_SYMBOL } from "../errors";
import { QueryManager } from "../core/QueryManager";
import { mockObservableLink } from "../testing";
import { GraphQLError } from "graphql";
import { ObservableStream, spyOnConsole } from "../testing/internal";
import { getDefaultOptionsForQueryManagerTests } from "../testing/core/mocking/mockQueryManager";

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
      cache: new InMemoryCache({ addTypename: false }),
    });

    const stream = new ObservableStream(client.subscribe(defaultOptions));
    link.simulateResult(results[0]);

    await expect(stream).toEmitValue(results[0].result);

    stream.unsubscribe();
  });

  it("should subscribe with default values", async () => {
    const link = mockObservableLink();
    // This test calls directly through Apollo Client
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({ addTypename: false }),
    });

    const stream = new ObservableStream(client.subscribe(options));

    link.simulateResult(results[0]);

    await expect(stream).toEmitValue(results[0].result);

    stream.unsubscribe();
  });

  it("should multiplex subscriptions", async () => {
    const link = mockObservableLink();
    const queryManager = new QueryManager(
      getDefaultOptionsForQueryManagerTests({
        link,
        cache: new InMemoryCache({ addTypename: false }),
      })
    );

    const obs = queryManager.startGraphQLSubscription(options);
    const stream1 = new ObservableStream(obs);
    const stream2 = new ObservableStream(obs);

    link.simulateResult(results[0]);

    await expect(stream1).toEmitValue(results[0].result);
    await expect(stream2).toEmitValue(results[0].result);
  });

  it("should receive multiple results for a subscription", async () => {
    const link = mockObservableLink();
    const queryManager = new QueryManager(
      getDefaultOptionsForQueryManagerTests({
        link,
        cache: new InMemoryCache({ addTypename: false }),
      })
    );

    const stream = new ObservableStream(
      queryManager.startGraphQLSubscription(options)
    );

    for (let i = 0; i < 4; i++) {
      link.simulateResult(results[i]);
    }

    await expect(stream).toEmitValue(results[0].result);
    await expect(stream).toEmitValue(results[1].result);
    await expect(stream).toEmitValue(results[2].result);
    await expect(stream).toEmitValue(results[3].result);
    await expect(stream).not.toEmitAnything();
  });

  it("should not cache subscription data if a `no-cache` fetch policy is used", async () => {
    const link = mockObservableLink();
    const cache = new InMemoryCache({ addTypename: false });
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

  it("should throw an error if the result has errors on it", () => {
    const link = mockObservableLink();
    const queryManager = new QueryManager(
      getDefaultOptionsForQueryManagerTests({
        link,
        cache: new InMemoryCache({ addTypename: false }),
      })
    );

    const obs = queryManager.startGraphQLSubscription(options);

    const promise = new Promise<void>((resolve, reject) => {
      obs.subscribe({
        next(result) {
          reject("Should have hit the error block");
        },
        error(error) {
          expect(error).toMatchSnapshot();
          resolve();
        },
      });
    });

    const errorResult = {
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
    };

    link.simulateResult(errorResult);
    return Promise.resolve(promise);
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
    const queryManager = new QueryManager(
      getDefaultOptionsForQueryManagerTests({
        link,
        cache: new InMemoryCache(),
      })
    );

    const obs = queryManager.startGraphQLSubscription({
      query,
      variables: { name: "Iron Man" },
      errorPolicy: "all",
    });

    const promise = new Promise<FetchResult[]>((resolve, reject) => {
      const results: FetchResult[] = [];

      obs.subscribe({
        next: (result) => results.push(result),
        complete: () => resolve(results),
        error: reject,
      });
    });

    const errorResult = {
      result: {
        data: null,
        errors: [new GraphQLError("This is an error")],
      },
    };

    link.simulateResult(errorResult, true);

    await expect(promise).resolves.toEqual([
      {
        data: null,
        errors: [new GraphQLError("This is an error")],
      },
    ]);
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
    const queryManager = new QueryManager(
      getDefaultOptionsForQueryManagerTests({
        link,
        cache: new InMemoryCache(),
      })
    );

    const obs = queryManager.startGraphQLSubscription({
      query,
      variables: { name: "Iron Man" },
      errorPolicy: "all",
    });

    const promise = new Promise<FetchResult[]>((resolve, reject) => {
      const results: FetchResult[] = [];

      obs.subscribe({
        next: (result) => results.push(result),
        complete: () => resolve(results),
        error: reject,
      });
    });

    const errorResult = {
      result: {
        data: null,
        extensions: {
          [PROTOCOL_ERRORS_SYMBOL]: [
            {
              message: "cannot read message from websocket",
              extensions: [
                {
                  code: "WEBSOCKET_MESSAGE_ERROR",
                },
              ],
            } as any,
          ],
        },
      },
    };

    // Silence expected warning about missing field for cache write
    using _consoleSpy = spyOnConsole("warn");

    link.simulateResult(errorResult, true);

    await expect(promise).rejects.toEqual(
      new ApolloError({
        protocolErrors: [
          {
            message: "cannot read message from websocket",
            extensions: [
              {
                code: "WEBSOCKET_MESSAGE_ERROR",
              },
            ],
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
    const queryManager = new QueryManager(
      getDefaultOptionsForQueryManagerTests({
        link,
        cache: new InMemoryCache(),
      })
    );

    const obs = queryManager.startGraphQLSubscription({
      query,
      variables: { name: "Iron Man" },
      errorPolicy: "ignore",
    });

    const promise = new Promise<FetchResult[]>((resolve, reject) => {
      const results: FetchResult[] = [];

      obs.subscribe({
        next: (result) => results.push(result),
        complete: () => resolve(results),
        error: reject,
      });
    });

    const errorResult = {
      result: {
        data: null,
        errors: [new GraphQLError("This is an error")],
      },
    };

    link.simulateResult(errorResult, true);

    await expect(promise).resolves.toEqual([{ data: null }]);
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
    const queryManager = new QueryManager(
      getDefaultOptionsForQueryManagerTests({
        link,
        cache: new InMemoryCache(),
      })
    );

    const obs = queryManager.startGraphQLSubscription({
      query,
      variables: { name: "Iron Man" },
      errorPolicy: "ignore",
    });

    const promise = new Promise<FetchResult[]>((resolve, reject) => {
      const results: FetchResult[] = [];

      obs.subscribe({
        next: (result) => results.push(result),
        complete: () => resolve(results),
        error: reject,
      });
    });

    const errorResult = {
      result: {
        data: null,
        extensions: {
          [PROTOCOL_ERRORS_SYMBOL]: [
            {
              message: "cannot read message from websocket",
              extensions: [
                {
                  code: "WEBSOCKET_MESSAGE_ERROR",
                },
              ],
            } as any,
          ],
        },
      },
    };

    // Silence expected warning about missing field for cache write
    using _consoleSpy = spyOnConsole("warn");

    link.simulateResult(errorResult, true);

    await expect(promise).rejects.toEqual(
      new ApolloError({
        protocolErrors: [
          {
            message: "cannot read message from websocket",
            extensions: [
              {
                code: "WEBSOCKET_MESSAGE_ERROR",
              },
            ],
          },
        ],
      })
    );
  });

  it("should call complete handler when the subscription completes", () => {
    const link = mockObservableLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({ addTypename: false }),
    });

    return new Promise<void>((resolve) => {
      client.subscribe(defaultOptions).subscribe({
        complete() {
          resolve();
        },
      });
      setTimeout(() => link.simulateComplete(), 100);
    });
  });

  it("should pass a context object through the link execution chain", async () => {
    const link = mockObservableLink();
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    const stream = new ObservableStream(client.subscribe(options));

    link.simulateResult(results[0]);

    await expect(stream).toEmitNext();
    expect(link.operation?.getContext().someVar).toEqual(
      options.context.someVar
    );
  });

  it("should throw an error if the result has protocolErrors on it", async () => {
    const link = mockObservableLink();
    const queryManager = new QueryManager(
      getDefaultOptionsForQueryManagerTests({
        link,
        cache: new InMemoryCache({ addTypename: false }),
      })
    );

    const obs = queryManager.startGraphQLSubscription(options);

    const promise = new Promise<void>((resolve, reject) => {
      obs.subscribe({
        next(result) {
          reject("Should have hit the error block");
        },
        error(error) {
          expect(error).toMatchSnapshot();
          resolve();
        },
      });
    });

    const errorResult = {
      result: {
        data: null,
        extensions: {
          [PROTOCOL_ERRORS_SYMBOL]: [
            {
              message: "cannot read message from websocket",
              extensions: [
                {
                  code: "WEBSOCKET_MESSAGE_ERROR",
                },
              ],
            } as any,
          ],
        },
      },
    };

    // Silence expected warning about missing field for cache write
    using _consoleSpy = spyOnConsole("warn");

    link.simulateResult(errorResult);

    await promise;
  });
});
