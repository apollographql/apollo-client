import gql from "graphql-tag";

import { ApolloLink } from "../../core/ApolloLink";
import { execute } from "../../core/execute";
import { ServerError, throwServerError } from "../../utils/throwServerError";
import { Observable } from "../../../utilities/observables/Observable";
import { onError, ErrorLink } from "../";
import { ObservableStream } from "../../../testing/internal";

describe("error handling", () => {
  it("has an easy way to handle GraphQL errors", async () => {
    const query = gql`
      {
        foo {
          bar
        }
      }
    `;

    let called = false;
    const errorLink = onError(({ graphQLErrors, networkError }) => {
      expect(graphQLErrors![0].message).toBe("resolver blew up");
      called = true;
    });

    const mockLink = new ApolloLink((operation) =>
      Observable.of({
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

    expect(result.errors![0].message).toBe("resolver blew up");
    expect(called).toBe(true);
  });

  it("has an easy way to log client side (network) errors", async () => {
    const query = gql`
      query Foo {
        foo {
          bar
        }
      }
    `;

    let called = false;
    const errorLink = onError(({ operation, networkError }) => {
      expect(networkError!.message).toBe("app is crashing");
      expect(operation.operationName).toBe("Foo");
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

  it("captures errors within links", async () => {
    const query = gql`
      query Foo {
        foo {
          bar
        }
      }
    `;

    let called = false;
    const errorLink = onError(({ operation, networkError }) => {
      expect(networkError!.message).toBe("app is crashing");
      expect(operation.operationName).toBe("Foo");
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

  it("captures networkError.statusCode within links", async () => {
    const query = gql`
      query Foo {
        foo {
          bar
        }
      }
    `;

    let called = false;
    const errorLink = onError(({ operation, networkError }) => {
      expect(networkError!.message).toBe("app is crashing");
      expect(networkError!.name).toBe("ServerError");
      expect((networkError as ServerError).statusCode).toBe(500);
      expect((networkError as ServerError).response.ok).toBe(false);
      expect(operation.operationName).toBe("Foo");
      called = true;
    });

    const mockLink = new ApolloLink((operation) => {
      return new Observable((obs) => {
        const response = { status: 500, ok: false } as Response;
        throwServerError(response, "ServerError", "app is crashing");
      });
    });

    const link = errorLink.concat(mockLink);
    const stream = new ObservableStream(execute(link, { query }));

    const error = await stream.takeError();

    expect(error.message).toBe("app is crashing");
    expect(called).toBe(true);
  });

  it("sets graphQLErrors to undefined if networkError.result is an empty string", async () => {
    const query = gql`
      query Foo {
        foo {
          bar
        }
      }
    `;

    let called = false;
    const errorLink = onError(({ graphQLErrors }) => {
      expect(graphQLErrors).toBeUndefined();
      called = true;
    });

    const mockLink = new ApolloLink((operation) => {
      return new Observable((obs) => {
        const response = { status: 500, ok: false } as Response;
        throwServerError(response, "", "app is crashing");
      });
    });

    const link = errorLink.concat(mockLink);
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitError();
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

    const errorLink = onError(({ graphQLErrors, networkError }) => {
      expect(networkError!.message).toBe("app is crashing");
    });

    const mockLink = new ApolloLink((operation) => {
      return Observable.of({ data: { foo: { id: 1 } } });
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
      return Observable.of({
        data: { foo: { id: 1 } },
        errors: [{ message: "ignore" } as any],
      });
    });

    const link = errorLink.concat(mockLink);
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitValue({
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
      Observable.of({
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
      Observable.of({
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
      return Observable.of({ data: { foo: { id: 1 } } });
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

    await expect(stream).toEmitValue(GOOD_RESPONSE);
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

    await expect(stream).toEmitValue(GOOD_RESPONSE);
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
