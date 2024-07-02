import gql from "graphql-tag";

import { ApolloLink } from "../../core/ApolloLink";
import { execute } from "../../core/execute";
import { ServerError, throwServerError } from "../../utils/throwServerError";
import { Observable } from "../../../utilities/observables/Observable";
import { onError, ErrorLink } from "../";
import { itAsync } from "../../../testing";

describe("error handling", () => {
  itAsync("has an easy way to handle GraphQL errors", (resolve, reject) => {
    const query = gql`
      {
        foo {
          bar
        }
      }
    `;

    let called: boolean;
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

    execute(link, { query }).subscribe((result) => {
      expect(result.errors![0].message).toBe("resolver blew up");
      expect(called).toBe(true);
      resolve();
    });
  });
  itAsync(
    "has an easy way to log client side (network) errors",
    (resolve, reject) => {
      const query = gql`
        query Foo {
          foo {
            bar
          }
        }
      `;

      let called: boolean;
      const errorLink = onError(({ operation, networkError }) => {
        expect(networkError!.message).toBe("app is crashing");
        expect(operation.operationName).toBe("Foo");
        called = true;
      });

      const mockLink = new ApolloLink((operation) => {
        throw new Error("app is crashing");
      });

      const link = errorLink.concat(mockLink);

      execute(link, { query }).subscribe({
        error: (e) => {
          expect(e.message).toBe("app is crashing");
          expect(called).toBe(true);
          resolve();
        },
      });
    }
  );
  itAsync("captures errors within links", (resolve, reject) => {
    const query = gql`
      query Foo {
        foo {
          bar
        }
      }
    `;

    let called: boolean;
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

    execute(link, { query }).subscribe({
      error: (e) => {
        expect(e.message).toBe("app is crashing");
        expect(called).toBe(true);
        resolve();
      },
    });
  });
  itAsync(
    "captures networkError.statusCode within links",
    (resolve, reject) => {
      const query = gql`
        query Foo {
          foo {
            bar
          }
        }
      `;

      let called: boolean;
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

      execute(link, { query }).subscribe({
        error: (e) => {
          expect(e.message).toBe("app is crashing");
          expect(called).toBe(true);
          resolve();
        },
      });
    }
  );
  itAsync(
    "sets graphQLErrors to undefined if networkError.result is an empty string",
    (resolve, reject) => {
      const query = gql`
        query Foo {
          foo {
            bar
          }
        }
      `;

      let called: boolean;
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

      execute(link, { query }).subscribe({
        error: (e) => {
          expect(called).toBe(true);
          resolve();
        },
      });
    }
  );
  itAsync("completes if no errors", (resolve, reject) => {
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

    execute(link, { query }).subscribe({
      complete: resolve,
    });
  });
  itAsync("allows an error to be ignored", (resolve, reject) => {
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

    execute(link, { query }).subscribe({
      next: ({ errors, data }) => {
        expect(errors).toBe(null);
        expect(data).toEqual({ foo: { id: 1 } });
      },
      complete: resolve,
    });
  });

  itAsync("can be unsubcribed", (resolve, reject) => {
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

    const sub = execute(link, { query }).subscribe({
      complete: () => {
        reject("completed");
      },
    });

    sub.unsubscribe();

    setTimeout(resolve, 10);
  });

  itAsync(
    "includes the operation and any data along with a graphql error",
    (resolve, reject) => {
      const query = gql`
        query Foo {
          foo {
            bar
          }
        }
      `;

      let called: boolean;
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

      execute(link, { query, context: { bar: true } }).subscribe((result) => {
        expect(result.errors![0].message).toBe("resolver blew up");
        expect(called).toBe(true);
        resolve();
      });
    }
  );
});

describe("error handling with class", () => {
  itAsync("has an easy way to handle GraphQL errors", (resolve, reject) => {
    const query = gql`
      {
        foo {
          bar
        }
      }
    `;

    let called: boolean;
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

    execute(link, { query }).subscribe((result) => {
      expect(result!.errors![0].message).toBe("resolver blew up");
      expect(called).toBe(true);
      resolve();
    });
  });
  itAsync(
    "has an easy way to log client side (network) errors",
    (resolve, reject) => {
      const query = gql`
        {
          foo {
            bar
          }
        }
      `;

      let called: boolean;
      const errorLink = new ErrorLink(({ networkError }) => {
        expect(networkError!.message).toBe("app is crashing");
        called = true;
      });

      const mockLink = new ApolloLink((operation) => {
        throw new Error("app is crashing");
      });

      const link = errorLink.concat(mockLink);

      execute(link, { query }).subscribe({
        error: (e) => {
          expect(e.message).toBe("app is crashing");
          expect(called).toBe(true);
          resolve();
        },
      });
    }
  );
  itAsync("captures errors within links", (resolve, reject) => {
    const query = gql`
      {
        foo {
          bar
        }
      }
    `;

    let called: boolean;
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

    execute(link, { query }).subscribe({
      error: (e) => {
        expect(e.message).toBe("app is crashing");
        expect(called).toBe(true);
        resolve();
      },
    });
  });
  itAsync("completes if no errors", (resolve, reject) => {
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

    execute(link, { query }).subscribe({
      complete: resolve,
    });
  });
  itAsync("can be unsubcribed", (resolve, reject) => {
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

    const sub = execute(link, { query }).subscribe({
      complete: () => {
        reject("completed");
      },
    });

    sub.unsubscribe();

    setTimeout(resolve, 10);
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

  itAsync(
    "returns the retried request when forward(operation) is called",
    (resolve, reject) => {
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
          try {
            if (graphQLErrors) {
              errorHandlerCalled = true;
              expect(graphQLErrors).toEqual(ERROR_RESPONSE.errors);
              expect(response!.data).not.toBeDefined();
              expect(operation.operationName).toBe("Foo");
              expect(operation.getContext().bar).toBe(true);
              // retry operation if it resulted in an error
              return forward(operation);
            }
          } catch (error) {
            reject(error);
          }
        }
      );

      const link = errorLink.concat(mockHttpLink);

      execute(link, { query: QUERY, context: { bar: true } }).subscribe({
        next(result) {
          try {
            expect(errorHandlerCalled).toBe(true);
            expect(result).toEqual(GOOD_RESPONSE);
          } catch (error) {
            return reject(error);
          }
        },
        complete() {
          resolve();
        },
      });
    }
  );

  itAsync(
    "supports retrying when the initial request had networkError",
    (resolve, reject) => {
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
          try {
            if (networkError) {
              errorHandlerCalled = true;
              expect(networkError).toEqual(NETWORK_ERROR);
              return forward(operation);
            }
          } catch (error) {
            reject(error);
          }
        }
      );

      const link = errorLink.concat(mockHttpLink);

      execute(link, { query: QUERY, context: { bar: true } }).subscribe({
        next(result) {
          try {
            expect(errorHandlerCalled).toBe(true);
            expect(result).toEqual(GOOD_RESPONSE);
          } catch (error) {
            return reject(error);
          }
        },
        complete() {
          resolve();
        },
      });
    }
  );

  itAsync("returns errors from retried requests", (resolve, reject) => {
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
        try {
          if (graphQLErrors) {
            errorHandlerCalled = true;
            expect(graphQLErrors).toEqual(ERROR_RESPONSE.errors);
            expect(response!.data).not.toBeDefined();
            expect(operation.operationName).toBe("Foo");
            expect(operation.getContext().bar).toBe(true);
            // retry operation if it resulted in an error
            return forward(operation);
          }
        } catch (error) {
          reject(error);
        }
      }
    );

    const link = errorLink.concat(mockHttpLink);

    let observerNextCalled = false;
    execute(link, { query: QUERY, context: { bar: true } }).subscribe({
      next(result) {
        // should not be called
        observerNextCalled = true;
      },
      error(error) {
        // note that complete will not be after an error
        // therefore we should end the test here with resolve()
        expect(errorHandlerCalled).toBe(true);
        expect(observerNextCalled).toBe(false);
        expect(error).toEqual(NETWORK_ERROR);
        resolve();
      },
    });
  });
});
