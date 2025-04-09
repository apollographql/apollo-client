import type { GraphQLFormattedError } from "graphql";
import { gql } from "graphql-tag";
import { Observable, of } from "rxjs";

import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
  PROTOCOL_ERRORS_SYMBOL,
  ServerError,
} from "@apollo/client/errors";
import { ApolloLink, execute } from "@apollo/client/link/core";
import { ErrorLink, onError } from "@apollo/client/link/error";
import {
  mockDeferStream,
  mockMultipartSubscriptionStream,
  ObservableStream,
} from "@apollo/client/testing/internal";

describe("error handling", () => {
  it("calls onError when GraphQL errors are returned", async () => {
    const query = gql`
      {
        foo {
          bar
        }
      }
    `;

    const error: GraphQLFormattedError = { message: "resolver blew up" };

    const callback = jest.fn();
    const errorLink = onError(callback);

    const mockLink = new ApolloLink(() => of({ errors: [error] }));

    const link = errorLink.concat(mockLink);
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitTypedValue({ errors: [error] });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith({
      forward: expect.any(Function),
      operation: expect.objectContaining({ query }),
      response: { errors: [error] },
      error: new CombinedGraphQLErrors({ errors: [error] }),
    });
  });

  it("calls onError with error when thrown from request handler", async () => {
    const query = gql`
      query Foo {
        foo {
          bar
        }
      }
    `;

    const error = new Error("app is crashing");

    const callback = jest.fn();
    const errorLink = onError(callback);

    const mockLink = new ApolloLink(() => {
      throw error;
    });

    const link = errorLink.concat(mockLink);
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitError(error);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith({
      forward: expect.any(Function),
      operation: expect.objectContaining({ query, operationName: "Foo" }),
      error,
    });
  });

  it("calls onError with error emitted from observable", async () => {
    const query = gql`
      query Foo {
        foo {
          bar
        }
      }
    `;

    const error = new Error("app is crashing");

    const callback = jest.fn();
    const errorLink = onError(callback);

    const mockLink = new ApolloLink(() => {
      return new Observable((observer) => {
        observer.error(error);
      });
    });

    const link = errorLink.concat(mockLink);
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitError(error);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith({
      forward: expect.any(Function),
      operation: expect.objectContaining({ query, operationName: "Foo" }),
      error,
    });
  });

  it.failing("handles errors emitted in incremental chunks", async () => {
    const query = gql`
      query Foo {
        foo {
          ... @defer {
            bar
          }
        }
      }
    `;

    const callback = jest.fn();
    const errorLink = onError(callback);

    const { httpLink, enqueueInitialChunk, enqueueErrorChunk } =
      mockDeferStream();
    const link = errorLink.concat(httpLink);
    const stream = new ObservableStream(execute(link, { query }));

    enqueueInitialChunk({
      hasNext: true,
      data: {},
    });

    enqueueErrorChunk([
      {
        message: "could not read data",
        extensions: {
          code: "INCREMENTAL_ERROR",
        },
      },
    ]);

    await expect(stream).toEmitTypedValue({
      data: {},
      hasNext: true,
    });

    await expect(stream).toEmitTypedValue({
      hasNext: true,
      incremental: [
        // @ts-expect-error Our defer type and GraphQL incremental type do not
        // line up. Our type request data and path but enqueueErrorChunk does
        // not emit those values
        {
          errors: [
            {
              message: "could not read data",
              extensions: {
                code: "INCREMENTAL_ERROR",
              },
            },
          ],
        },
      ],
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith({
      forward: expect.any(Function),
      operation: expect.objectContaining({ query, operationName: "Foo" }),
      error: new CombinedGraphQLErrors({
        errors: [
          {
            message: "could not read data",
            extensions: {
              code: "INCREMENTAL_ERROR",
            },
          },
        ],
      }),
      result: {},
    });
  });

  it("calls onError with protocol errors from multipart subscriptions", async () => {
    const subscription = gql`
      subscription MySubscription {
        aNewDieWasCreated {
          die {
            roll
            sides
            color
          }
        }
      }
    `;

    const callback = jest.fn();
    const errorLink = onError(callback);

    const { httpLink, enqueuePayloadResult, enqueueProtocolErrors } =
      mockMultipartSubscriptionStream();

    const link = errorLink.concat(httpLink);
    const stream = new ObservableStream(execute(link, { query: subscription }));

    enqueuePayloadResult({
      data: { aNewDieWasCreated: { die: { color: "red", roll: 1, sides: 4 } } },
    });

    enqueueProtocolErrors([
      { message: "Error field", extensions: { code: "INTERNAL_SERVER_ERROR" } },
    ]);

    await expect(stream).toEmitTypedValue({
      data: { aNewDieWasCreated: { die: { color: "red", roll: 1, sides: 4 } } },
    });

    await expect(stream).toEmitTypedValue({
      extensions: {
        [PROTOCOL_ERRORS_SYMBOL]: new CombinedProtocolErrors([
          {
            extensions: {
              code: "INTERNAL_SERVER_ERROR",
            },
            message: "Error field",
          },
        ]),
      },
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith({
      forward: expect.any(Function),
      operation: expect.objectContaining({
        query: subscription,
        operationName: "MySubscription",
      }),
      response: {
        extensions: {
          [PROTOCOL_ERRORS_SYMBOL]: new CombinedProtocolErrors([
            {
              extensions: {
                code: "INTERNAL_SERVER_ERROR",
              },
              message: "Error field",
            },
          ]),
        },
      },
      error: new CombinedProtocolErrors([
        {
          message: "Error field",
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        },
      ]),
    });
  });

  it("captures errors within links", async () => {
    const query = gql`
      query Foo {
        foo {
          bar
        }
      }
    `;

    const callback = jest.fn();
    const error = new Error("app is crashing");
    const errorLink = onError(callback);

    const mockLink = new ApolloLink(() => {
      return new Observable(() => {
        throw error;
      });
    });

    const link = errorLink.concat(mockLink);
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitError(error);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith({
      forward: expect.any(Function),
      operation: expect.objectContaining({ query, operationName: "Foo" }),
      error,
    });
  });

  it("captures networkError.statusCode within links", async () => {
    const query = gql`
      query Foo {
        foo {
          bar
        }
      }
    `;

    const callback = jest.fn();
    const errorLink = onError(callback);
    const error = new ServerError("app is crashing", {
      response: new Response("", { status: 500 }),
      result: "ServerError",
    });

    const mockLink = new ApolloLink(() => {
      return new Observable(() => {
        throw error;
      });
    });

    const link = errorLink.concat(mockLink);
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitError(error);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith({
      forward: expect.any(Function),
      operation: expect.objectContaining({ query, operationName: "Foo" }),
      error,
    });

    const capturedError = callback.mock.calls[0][0].error as ServerError;
    expect(capturedError.statusCode).toBe(500);
  });

  it("completes if no errors", async () => {
    const query = gql`
      {
        foo {
          bar
        }
      }
    `;

    const errorLink = onError(({ graphQLErrors, networkError }) => {
      expect(networkError!.message).toBe("app is crashing");
    });

    const mockLink = new ApolloLink((operation) => {
      return of({ data: { foo: { id: 1 } } });
    });

    const link = errorLink.concat(mockLink);
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitNext();
    await expect(stream).toComplete();
  });

  it("allows an error to be ignored", async () => {
    const query = gql`
      {
        foo {
          bar
        }
      }
    `;

    const errorLink = onError(({ graphQLErrors, response }) => {
      expect(graphQLErrors![0].message).toBe("ignore");
      // ignore errors
      response!.errors = null as any;
    });

    const mockLink = new ApolloLink((operation) => {
      return of({
        data: { foo: { id: 1 } },
        errors: [{ message: "ignore" } as any],
      });
    });

    const link = errorLink.concat(mockLink);
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitTypedValue({
      // @ts-expect-error TODO: Need to determine a better way to handle this
      errors: null,
      data: { foo: { id: 1 } },
    });
    await expect(stream).toComplete();
  });

  it("can be unsubcribed", async () => {
    const query = gql`
      {
        foo {
          bar
        }
      }
    `;

    const errorLink = onError(({ networkError }) => {
      expect(networkError!.message).toBe("app is crashing");
    });

    const mockLink = new ApolloLink((operation) => {
      return new Observable((obs) => {
        setTimeout(() => {
          obs.next({ data: { foo: { id: 1 } } });
          obs.complete();
        }, 5);
      });
    });

    const link = errorLink.concat(mockLink);
    const stream = new ObservableStream(execute(link, { query }));

    stream.unsubscribe();

    await expect(stream).not.toEmitAnything();
  });

  it("includes the operation and any data along with a graphql error", async () => {
    const query = gql`
      query Foo {
        foo {
          bar
        }
      }
    `;

    let called = false;
    const errorLink = onError(({ graphQLErrors, response, operation }) => {
      expect(graphQLErrors![0].message).toBe("resolver blew up");
      expect(response!.data!.foo).toBe(true);
      expect(operation.operationName).toBe("Foo");
      expect(operation.getContext().bar).toBe(true);
      called = true;
    });

    const mockLink = new ApolloLink((operation) =>
      of({
        data: { foo: true },
        errors: [
          {
            message: "resolver blew up",
          },
        ],
      } as any)
    );

    const link = errorLink.concat(mockLink);
    const stream = new ObservableStream(
      execute(link, { query, context: { bar: true } })
    );

    const result = await stream.takeNext();

    expect(result.errors![0].message).toBe("resolver blew up");
    expect(called).toBe(true);
  });
});

describe("error handling with class", () => {
  it("has an easy way to handle GraphQL errors", async () => {
    const query = gql`
      {
        foo {
          bar
        }
      }
    `;

    let called = false;
    const errorLink = new ErrorLink(({ graphQLErrors, networkError }) => {
      expect(graphQLErrors![0].message).toBe("resolver blew up");
      called = true;
    });

    const mockLink = new ApolloLink((operation) =>
      of({
        errors: [
          {
            message: "resolver blew up",
          },
        ],
      } as any)
    );

    const link = errorLink.concat(mockLink);
    const stream = new ObservableStream(execute(link, { query }));

    const result = await stream.takeNext();

    expect(result!.errors![0].message).toBe("resolver blew up");
    expect(called).toBe(true);
  });

  it("has an easy way to log client side (network) errors", async () => {
    const query = gql`
      {
        foo {
          bar
        }
      }
    `;

    let called = false;
    const errorLink = new ErrorLink(({ networkError }) => {
      expect(networkError!.message).toBe("app is crashing");
      called = true;
    });

    const mockLink = new ApolloLink((operation) => {
      throw new Error("app is crashing");
    });

    const link = errorLink.concat(mockLink);
    const stream = new ObservableStream(execute(link, { query }));

    const error = await stream.takeError();

    expect(error.message).toBe("app is crashing");
    expect(called).toBe(true);
  });

  it("handles protocol errors (multipart subscription)", async () => {
    expect.assertions(4);
    const subscription = gql`
      subscription MySubscription {
        aNewDieWasCreated {
          die {
            roll
            sides
            color
          }
        }
      }
    `;

    const { httpLink, enqueuePayloadResult, enqueueProtocolErrors } =
      mockMultipartSubscriptionStream();

    const errorLink = new ErrorLink(({ operation, protocolErrors }) => {
      expect(operation.operationName).toBe("MySubscription");
      expect(protocolErrors).toEqual(
        new CombinedProtocolErrors([
          {
            message: "Error field",
            extensions: { code: "INTERNAL_SERVER_ERROR" },
          },
        ])
      );
    });

    const link = errorLink.concat(httpLink);
    const stream = new ObservableStream(execute(link, { query: subscription }));

    enqueuePayloadResult({
      data: { aNewDieWasCreated: { die: { color: "red", roll: 1, sides: 4 } } },
    });

    enqueueProtocolErrors([
      { message: "Error field", extensions: { code: "INTERNAL_SERVER_ERROR" } },
    ]);

    await expect(stream).toEmitTypedValue({
      data: { aNewDieWasCreated: { die: { color: "red", roll: 1, sides: 4 } } },
    });

    await expect(stream).toEmitTypedValue({
      extensions: {
        [PROTOCOL_ERRORS_SYMBOL]: new CombinedProtocolErrors([
          {
            extensions: {
              code: "INTERNAL_SERVER_ERROR",
            },
            message: "Error field",
          },
        ]),
      },
    });
  });

  it("captures errors within links", async () => {
    const query = gql`
      {
        foo {
          bar
        }
      }
    `;

    let called = false;
    const errorLink = new ErrorLink(({ networkError }) => {
      expect(networkError!.message).toBe("app is crashing");
      called = true;
    });

    const mockLink = new ApolloLink((operation) => {
      return new Observable((obs) => {
        throw new Error("app is crashing");
      });
    });

    const link = errorLink.concat(mockLink);
    const stream = new ObservableStream(execute(link, { query }));

    const error = await stream.takeError();

    expect(error.message).toBe("app is crashing");
    expect(called).toBe(true);
  });

  it("completes if no errors", async () => {
    const query = gql`
      {
        foo {
          bar
        }
      }
    `;

    const errorLink = new ErrorLink(({ networkError }) => {
      expect(networkError!.message).toBe("app is crashing");
    });

    const mockLink = new ApolloLink((operation) => {
      return of({ data: { foo: { id: 1 } } });
    });

    const link = errorLink.concat(mockLink);

    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitNext();
    await expect(stream).toComplete();
  });

  it("can be unsubcribed", async () => {
    const query = gql`
      {
        foo {
          bar
        }
      }
    `;

    const errorLink = new ErrorLink(({ networkError }) => {
      expect(networkError!.message).toBe("app is crashing");
    });

    const mockLink = new ApolloLink((operation) => {
      return new Observable((obs) => {
        setTimeout(() => {
          obs.next({ data: { foo: { id: 1 } } });
          obs.complete();
        }, 5);
      });
    });

    const link = errorLink.concat(mockLink);
    const stream = new ObservableStream(execute(link, { query }));

    stream.unsubscribe();

    await expect(stream).not.toEmitAnything();
  });
});

describe("support for request retrying", () => {
  const QUERY = gql`
    query Foo {
      foo {
        bar
      }
    }
  `;
  const ERROR_RESPONSE = {
    errors: [
      {
        name: "something bad happened",
        message: "resolver blew up",
      },
    ],
  };
  const GOOD_RESPONSE = {
    data: { foo: true },
  };
  const NETWORK_ERROR = {
    message: "some other error",
  };

  it("returns the retried request when forward(operation) is called", async () => {
    let errorHandlerCalled = false;

    let timesCalled = 0;
    const mockHttpLink = new ApolloLink((operation) => {
      if (timesCalled === 0) {
        timesCalled++;
        // simulate the first request being an error
        return new Observable((observer) => {
          observer.next(ERROR_RESPONSE as any);
          observer.complete();
        });
      } else {
        return new Observable((observer) => {
          observer.next(GOOD_RESPONSE);
          observer.complete();
        });
      }
    });

    const errorLink = new ErrorLink(
      ({ graphQLErrors, response, operation, forward }) => {
        if (graphQLErrors) {
          errorHandlerCalled = true;
          expect(graphQLErrors).toEqual(ERROR_RESPONSE.errors);
          expect(response!.data).not.toBeDefined();
          expect(operation.operationName).toBe("Foo");
          expect(operation.getContext().bar).toBe(true);
          // retry operation if it resulted in an error
          return forward(operation);
        }
      }
    );

    const link = errorLink.concat(mockHttpLink);

    const stream = new ObservableStream(
      execute(link, { query: QUERY, context: { bar: true } })
    );

    await expect(stream).toEmitTypedValue(GOOD_RESPONSE);
    expect(errorHandlerCalled).toBe(true);
    await expect(stream).toComplete();
  });

  it("supports retrying when the initial request had networkError", async () => {
    let errorHandlerCalled = false;

    let timesCalled = 0;
    const mockHttpLink = new ApolloLink((operation) => {
      if (timesCalled === 0) {
        timesCalled++;
        // simulate the first request being an error
        return new Observable((observer) => {
          observer.error(NETWORK_ERROR);
        });
      } else {
        return new Observable((observer) => {
          observer.next(GOOD_RESPONSE);
          observer.complete();
        });
      }
    });

    const errorLink = new ErrorLink(
      ({ networkError, response, operation, forward }) => {
        if (networkError) {
          errorHandlerCalled = true;
          expect(networkError).toEqual(NETWORK_ERROR);
          return forward(operation);
        }
      }
    );

    const link = errorLink.concat(mockHttpLink);

    const stream = new ObservableStream(
      execute(link, { query: QUERY, context: { bar: true } })
    );

    await expect(stream).toEmitTypedValue(GOOD_RESPONSE);
    expect(errorHandlerCalled).toBe(true);
    await expect(stream).toComplete();
  });

  it("supports retrying when the initial request had protocol errors", async () => {
    let errorHandlerCalled = false;

    const { httpLink, enqueuePayloadResult, enqueueProtocolErrors } =
      mockMultipartSubscriptionStream();

    const errorLink = new ErrorLink(
      ({ protocolErrors, operation, forward }) => {
        if (protocolErrors) {
          errorHandlerCalled = true;
          expect(protocolErrors).toEqual(
            new CombinedProtocolErrors([
              {
                message: "cannot read message from websocket",
                extensions: {
                  code: "WEBSOCKET_MESSAGE_ERROR",
                },
              },
            ])
          );
          return forward(operation);
        }
      }
    );

    const link = errorLink.concat(httpLink);
    const stream = new ObservableStream(
      execute(link, {
        query: gql`
          subscription Foo {
            foo {
              bar
            }
          }
        `,
      })
    );

    enqueuePayloadResult({ data: { foo: { bar: true } } });

    await expect(stream).toEmitTypedValue({ data: { foo: { bar: true } } });

    enqueueProtocolErrors([
      {
        message: "cannot read message from websocket",
        extensions: {
          code: "WEBSOCKET_MESSAGE_ERROR",
        },
      },
    ]);

    enqueuePayloadResult({ data: { foo: { bar: true } } }, false);

    // Ensure the error result is not emitted but rather the retried result
    await expect(stream).toEmitTypedValue({ data: { foo: { bar: true } } });
    expect(errorHandlerCalled).toBe(true);
    await expect(stream).toComplete();
  });

  it("returns errors from retried requests", async () => {
    let errorHandlerCalled = false;

    let timesCalled = 0;
    const mockHttpLink = new ApolloLink((operation) => {
      if (timesCalled === 0) {
        timesCalled++;
        // simulate the first request being an error
        return new Observable((observer) => {
          observer.next(ERROR_RESPONSE as any);
          observer.complete();
        });
      } else {
        return new Observable((observer) => {
          observer.error(NETWORK_ERROR);
        });
      }
    });

    const errorLink = new ErrorLink(
      ({ graphQLErrors, networkError, response, operation, forward }) => {
        if (graphQLErrors) {
          errorHandlerCalled = true;
          expect(graphQLErrors).toEqual(ERROR_RESPONSE.errors);
          expect(response!.data).not.toBeDefined();
          expect(operation.operationName).toBe("Foo");
          expect(operation.getContext().bar).toBe(true);
          // retry operation if it resulted in an error
          return forward(operation);
        }
      }
    );

    const link = errorLink.concat(mockHttpLink);

    const stream = new ObservableStream(
      execute(link, { query: QUERY, context: { bar: true } })
    );

    await expect(stream).toEmitError(NETWORK_ERROR);
    expect(errorHandlerCalled).toBe(true);
  });
});
