import type { GraphQLFormattedError } from "graphql";
import { gql } from "graphql-tag";
import { Observable, of } from "rxjs";

import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
  PROTOCOL_ERRORS_SYMBOL,
  ServerError,
} from "@apollo/client/errors";
import type { FetchResult, Operation } from "@apollo/client/link/core";
import { ApolloLink, execute } from "@apollo/client/link/core";
import { ErrorLink, onError } from "@apollo/client/link/error";
import { wait } from "@apollo/client/testing";
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
      operation: expect.objectContaining({ query, variables: {} }),
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
      operation: expect.objectContaining({
        query,
        operationName: "Foo",
        variables: {},
      }),
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
      operation: expect.objectContaining({
        query,
        operationName: "Foo",
        variables: {},
      }),
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
      operation: expect.objectContaining({
        query,
        operationName: "Foo",
        variables: {},
      }),
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
        variables: {},
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
      operation: expect.objectContaining({
        query,
        operationName: "Foo",
        variables: {},
      }),
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
      operation: expect.objectContaining({
        query,
        operationName: "Foo",
        variables: {},
      }),
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

    const callback = jest.fn();
    const errorLink = onError(callback);

    const mockLink = new ApolloLink(() => {
      return of({ data: { foo: { id: 1 } } });
    });

    const link = errorLink.concat(mockLink);
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitNext();
    await expect(stream).toComplete();

    expect(callback).not.toHaveBeenCalled();
  });

  it("allows an error to be ignored", async () => {
    const query = gql`
      {
        foo {
          bar
        }
      }
    `;

    const errorLink = onError(({ response }) => {
      // ignore errors
      delete response!.errors;
    });

    const mockLink = new ApolloLink(() => {
      return of({
        data: { foo: { id: 1 } },
        errors: [{ message: "ignore" }],
      });
    });

    const link = errorLink.concat(mockLink);
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitTypedValue({
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

    const callback = jest.fn();
    const errorLink = onError(callback);

    const mockLink = new ApolloLink(() => {
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

    await wait(10);

    expect(callback).not.toHaveBeenCalled();
  });

  it("includes the operation and any data along with a graphql error", async () => {
    const query = gql`
      query Foo {
        foo {
          bar
        }
      }
    `;

    const callback = jest.fn();
    const error: GraphQLFormattedError = { message: "resolver blew up" };
    const errorLink = onError(callback);

    const mockLink = new ApolloLink(() =>
      of({
        data: { foo: true },
        errors: [error],
      })
    );

    const link = errorLink.concat(mockLink);
    const stream = new ObservableStream(
      execute(link, { query, context: { bar: true } })
    );

    await expect(stream).toEmitTypedValue({
      data: { foo: true },
      errors: [{ message: "resolver blew up" }],
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith({
      forward: expect.any(Function),
      operation: expect.objectContaining({
        query,
        operationName: "Foo",
        variables: {},
      }),
      response: { data: { foo: true }, errors: [error] },
      error: new CombinedGraphQLErrors({
        data: { foo: true },
        errors: [error],
      }),
    });

    const operation = callback.mock.calls[0][0].operation as Operation;
    expect(operation.getContext().bar).toBe(true);
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

    const callback = jest.fn();
    const error: GraphQLFormattedError = { message: "resolver blew up" };
    const errorLink = new ErrorLink(callback);

    const mockLink = new ApolloLink(() => of({ errors: [error] }));

    const link = errorLink.concat(mockLink);
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitTypedValue({ errors: [error] });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith({
      forward: expect.any(Function),
      operation: expect.objectContaining({ query, variables: {} }),
      response: { errors: [error] },
      error: new CombinedGraphQLErrors({ errors: [error] }),
    });
  });

  it("has an easy way to log client side (network) errors", async () => {
    const query = gql`
      {
        foo {
          bar
        }
      }
    `;

    const callback = jest.fn();
    const error = new Error("app is crashing");
    const errorLink = new ErrorLink(callback);

    const mockLink = new ApolloLink(() => {
      throw error;
    });

    const link = errorLink.concat(mockLink);
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitError(error);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith({
      forward: expect.any(Function),
      operation: expect.objectContaining({ query }),
      error,
    });
  });

  it("handles protocol errors (multipart subscription)", async () => {
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

    const callback = jest.fn();
    const errorLink = new ErrorLink(callback);

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
        variables: {},
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
          extensions: {
            code: "INTERNAL_SERVER_ERROR",
          },
        },
      ]),
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

    const callback = jest.fn();
    const error = new Error("app is crashing");
    const errorLink = new ErrorLink(callback);

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
      operation: expect.objectContaining({ query, variables: {} }),
      error,
    });
  });

  it("completes if no errors", async () => {
    const query = gql`
      {
        foo {
          bar
        }
      }
    `;

    const callback = jest.fn();
    const errorLink = new ErrorLink(callback);

    const mockLink = new ApolloLink(() => {
      return of({ data: { foo: { id: 1 } } });
    });

    const link = errorLink.concat(mockLink);
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitNext();
    await expect(stream).toComplete();

    expect(callback).not.toHaveBeenCalled();
  });

  it("can be unsubcribed", async () => {
    const query = gql`
      {
        foo {
          bar
        }
      }
    `;

    const callback = jest.fn();
    const errorLink = new ErrorLink(callback);

    const mockLink = new ApolloLink(() => {
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

    await wait(10);

    expect(callback).not.toHaveBeenCalled();
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
    errors: [{ message: "resolver blew up" }],
  } satisfies FetchResult;
  const GOOD_RESPONSE = {
    data: { foo: true },
  } satisfies FetchResult;
  const NETWORK_ERROR = new Error("some other error");

  it("returns the retried request when forward(operation) is called", async () => {
    let timesCalled = 0;
    const mockHttpLink = new ApolloLink(() => {
      return new Observable((observer) => {
        if (timesCalled++ === 0) {
          // simulate the first request being an error
          observer.next(ERROR_RESPONSE);
          observer.complete();
        } else {
          observer.next(GOOD_RESPONSE);
          observer.complete();
        }
      });
    });

    const callback = jest
      .fn()
      .mockImplementationOnce(({ operation, forward }) => forward(operation));

    const errorLink = new ErrorLink(callback);
    const link = errorLink.concat(mockHttpLink);

    const stream = new ObservableStream(
      execute(link, { query: QUERY, context: { bar: true } })
    );

    await expect(stream).toEmitTypedValue(GOOD_RESPONSE);
    await expect(stream).toComplete();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("supports retrying when the initial request had networkError", async () => {
    let timesCalled = 0;
    const mockHttpLink = new ApolloLink(() => {
      return new Observable((observer) => {
        if (timesCalled++ === 0) {
          // simulate the first request being an error
          observer.error(NETWORK_ERROR);
        } else {
          observer.next(GOOD_RESPONSE);
          observer.complete();
        }
      });
    });

    const callback = jest
      .fn()
      .mockImplementationOnce(({ forward, operation }) => forward(operation));

    const errorLink = new ErrorLink(callback);
    const link = errorLink.concat(mockHttpLink);

    const stream = new ObservableStream(
      execute(link, { query: QUERY, context: { bar: true } })
    );

    await expect(stream).toEmitTypedValue(GOOD_RESPONSE);
    await expect(stream).toComplete();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("supports retrying when the initial request had protocol errors", async () => {
    const { httpLink, enqueuePayloadResult, enqueueProtocolErrors } =
      mockMultipartSubscriptionStream();

    const callback = jest
      .fn()
      .mockImplementationOnce(({ forward, operation }) => forward(operation));

    const errorLink = new ErrorLink(callback);

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
    await expect(stream).toComplete();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("returns errors from retried requests", async () => {
    let timesCalled = 0;
    const mockHttpLink = new ApolloLink(() => {
      return new Observable((observer) => {
        if (timesCalled++ === 0) {
          // simulate the first request being an error
          observer.next(ERROR_RESPONSE);
          observer.complete();
        } else {
          observer.error(NETWORK_ERROR);
        }
      });
    });

    const callback = jest
      .fn()
      .mockImplementationOnce(({ forward, operation }) => forward(operation));

    const errorLink = new ErrorLink(callback);
    const link = errorLink.concat(mockHttpLink);

    const stream = new ObservableStream(
      execute(link, { query: QUERY, context: { bar: true } })
    );

    await expect(stream).toEmitError(NETWORK_ERROR);

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
