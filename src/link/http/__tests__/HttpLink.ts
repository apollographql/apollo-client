import gql from "graphql-tag";
import fetchMock from "fetch-mock";
import { ASTNode, print, stripIgnoredCharacters } from "graphql";
import { TextDecoder } from "util";
import { ReadableStream } from "web-streams-polyfill";
import { Readable } from "stream";

import {
  Observable,
  Observer,
  ObservableSubscription,
} from "../../../utilities/observables/Observable";
import { ApolloLink } from "../../core/ApolloLink";
import { execute } from "../../core/execute";
import { PROTOCOL_ERRORS_SYMBOL } from "../../../errors";
import { HttpLink } from "../HttpLink";
import { createHttpLink } from "../createHttpLink";
import { ClientParseError } from "../serializeFetchParameter";
import { ServerParseError } from "../parseAndCheckHttpResponse";
import { FetchResult, ServerError } from "../../..";
import { voidFetchDuringEachTest } from "./helpers";
import { itAsync } from "../../../testing";

const sampleQuery = gql`
  query SampleQuery {
    stub {
      id
    }
  }
`;

const sampleMutation = gql`
  mutation SampleMutation {
    stub {
      id
    }
  }
`;

const sampleDeferredQuery = gql`
  query SampleDeferredQuery {
    stub {
      id
      ... on Stub @defer {
        name
      }
    }
  }
`;

const sampleQueryCustomDirective = gql`
  query SampleDeferredQuery {
    stub {
      id
      ... on Stub @deferCustomDirective {
        name
      }
    }
  }
`;

const sampleSubscription = gql`
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

const sampleSubscriptionWithDefer = gql`
  subscription MySubscription {
    aNewDieWasCreated {
      die {
        roll
        sides
        ... on Stub @defer {
          color
        }
      }
    }
  }
`;

function makeCallback<TArgs extends any[]>(
  resolve: () => void,
  reject: (error: Error) => void,
  callback: (...args: TArgs) => any
) {
  return function () {
    try {
      // @ts-expect-error
      callback.apply(this, arguments);
      resolve();
    } catch (error) {
      reject(error as Error);
    }
  } as typeof callback;
}

function convertBatchedBody(body: BodyInit | null | undefined) {
  return JSON.parse(body as string);
}

function makePromise(res: any) {
  return new Promise((resolve) => setTimeout(() => resolve(res)));
}

describe("HttpLink", () => {
  describe("General", () => {
    const data = { data: { hello: "world" } };
    const data2 = { data: { hello: "everyone" } };
    const mockError = { throws: new TypeError("mock me") };
    let subscriber: Observer<any>;
    const subscriptions = new Set<ObservableSubscription>();

    beforeEach(() => {
      fetchMock.restore();
      fetchMock.post("begin:/data2", makePromise(data2));
      fetchMock.post("begin:/data", makePromise(data));
      fetchMock.post("begin:/error", mockError);
      fetchMock.post("begin:/apollo", makePromise(data));

      fetchMock.get("begin:/data", makePromise(data));
      fetchMock.get("begin:/data2", makePromise(data2));

      const next = jest.fn();
      const error = jest.fn();
      const complete = jest.fn();

      subscriber = {
        next,
        error,
        complete,
      };

      subscriptions.clear();
    });

    afterEach(() => {
      fetchMock.restore();
      if (subscriptions.size) {
        // Tests within this describe block can add subscriptions to this Set
        // that they want to be canceled/unsubscribed after the test finishes.
        subscriptions.forEach((sub) => sub.unsubscribe());
      }
    });

    it("does not need any constructor arguments", () => {
      expect(() => new HttpLink()).not.toThrow();
    });

    itAsync(
      "constructor creates link that can call next and then complete",
      (resolve, reject) => {
        const next = jest.fn();
        const link = new HttpLink({ uri: "/data" });
        const observable = execute(link, {
          query: sampleQuery,
        });
        observable.subscribe({
          next,
          error: (error) => expect(false),
          complete: () => {
            expect(next).toHaveBeenCalledTimes(1);
            resolve();
          },
        });
      }
    );

    itAsync("supports using a GET request", (resolve, reject) => {
      const variables = { params: "stub" };
      const extensions = { myExtension: "foo" };

      const link = createHttpLink({
        uri: "/data",
        fetchOptions: { method: "GET" },
        includeExtensions: true,
        includeUnusedVariables: true,
      });

      execute(link, { query: sampleQuery, variables, extensions }).subscribe({
        next: makeCallback(resolve, reject, () => {
          const [uri, options] = fetchMock.lastCall()!;
          const { method, body } = options!;
          expect(body).toBeUndefined();
          expect(method).toBe("GET");
          expect(uri).toBe(
            "/data?query=query%20SampleQuery%20%7B%0A%20%20stub%20%7B%0A%20%20%20%20id%0A%20%20%7D%0A%7D&operationName=SampleQuery&variables=%7B%22params%22%3A%22stub%22%7D&extensions=%7B%22myExtension%22%3A%22foo%22%7D"
          );
        }),
        error: (error) => reject(error),
      });
    });

    itAsync("supports using a GET request with search", (resolve, reject) => {
      const variables = { params: "stub" };

      const link = createHttpLink({
        uri: "/data?foo=bar",
        fetchOptions: { method: "GET" },
      });

      execute(link, { query: sampleQuery, variables }).subscribe({
        next: makeCallback(resolve, reject, () => {
          const [uri, options] = fetchMock.lastCall()!;
          const { method, body } = options!;
          expect(body).toBeUndefined();
          expect(method).toBe("GET");
          expect(uri).toBe(
            "/data?foo=bar&query=query%20SampleQuery%20%7B%0A%20%20stub%20%7B%0A%20%20%20%20id%0A%20%20%7D%0A%7D&operationName=SampleQuery&variables=%7B%7D"
          );
        }),
        error: (error) => reject(error),
      });
    });

    itAsync(
      "supports using a GET request on the context",
      (resolve, reject) => {
        const variables = { params: "stub" };
        const link = createHttpLink({
          uri: "/data",
        });

        execute(link, {
          query: sampleQuery,
          variables,
          context: {
            fetchOptions: { method: "GET" },
          },
        }).subscribe(
          makeCallback(resolve, reject, () => {
            const [uri, options] = fetchMock.lastCall()!;
            const { method, body } = options!;
            expect(body).toBeUndefined();
            expect(method).toBe("GET");
            expect(uri).toBe(
              "/data?query=query%20SampleQuery%20%7B%0A%20%20stub%20%7B%0A%20%20%20%20id%0A%20%20%7D%0A%7D&operationName=SampleQuery&variables=%7B%7D"
            );
          })
        );
      }
    );

    itAsync("uses GET with useGETForQueries", (resolve, reject) => {
      const variables = { params: "stub" };
      const link = createHttpLink({
        uri: "/data",
        useGETForQueries: true,
      });

      execute(link, {
        query: sampleQuery,
        variables,
      }).subscribe(
        makeCallback(resolve, reject, () => {
          const [uri, options] = fetchMock.lastCall()!;
          const { method, body } = options!;
          expect(body).toBeUndefined();
          expect(method).toBe("GET");
          expect(uri).toBe(
            "/data?query=query%20SampleQuery%20%7B%0A%20%20stub%20%7B%0A%20%20%20%20id%0A%20%20%7D%0A%7D&operationName=SampleQuery&variables=%7B%7D"
          );
        })
      );
    });

    itAsync(
      "uses POST for mutations with useGETForQueries",
      (resolve, reject) => {
        const variables = { params: "stub" };
        const link = createHttpLink({
          uri: "/data",
          useGETForQueries: true,
        });

        execute(link, {
          query: sampleMutation,
          variables,
        }).subscribe(
          makeCallback(resolve, reject, () => {
            const [uri, options] = fetchMock.lastCall()!;
            const { method, body } = options!;
            expect(body).toBeDefined();
            expect(method).toBe("POST");
            expect(uri).toBe("/data");
          })
        );
      }
    );

    itAsync(
      "strips unused variables, respecting nested fragments",
      (resolve, reject) => {
        const link = createHttpLink({ uri: "/data" });

        const query = gql`
          query PEOPLE($declaredAndUsed: String, $declaredButUnused: Int) {
            people(surprise: $undeclared, noSurprise: $declaredAndUsed) {
              ... on Doctor {
                specialty(var: $usedByInlineFragment)
              }
              ...LawyerFragment
            }
          }
          fragment LawyerFragment on Lawyer {
            caseCount(var: $usedByNamedFragment)
          }
        `;

        const variables = {
          unused: "strip",
          declaredButUnused: "strip",
          declaredAndUsed: "keep",
          undeclared: "keep",
          usedByInlineFragment: "keep",
          usedByNamedFragment: "keep",
        };

        execute(link, {
          query,
          variables,
        }).subscribe({
          next: makeCallback(resolve, reject, () => {
            const [uri, options] = fetchMock.lastCall()!;
            const { method, body } = options!;
            expect(JSON.parse(body as string)).toEqual({
              operationName: "PEOPLE",
              query: print(query),
              variables: {
                declaredAndUsed: "keep",
                undeclared: "keep",
                usedByInlineFragment: "keep",
                usedByNamedFragment: "keep",
              },
            });
            expect(method).toBe("POST");
            expect(uri).toBe("/data");
          }),
          error: (error) => reject(error),
        });
      }
    );

    itAsync(
      "should add client awareness settings to request headers",
      (resolve, reject) => {
        const variables = { params: "stub" };
        const link = createHttpLink({
          uri: "/data",
        });

        const clientAwareness = {
          name: "Some Client Name",
          version: "1.0.1",
        };

        execute(link, {
          query: sampleQuery,
          variables,
          context: {
            clientAwareness,
          },
        }).subscribe(
          makeCallback(resolve, reject, () => {
            const [, options] = fetchMock.lastCall()!;
            const { headers } = options as any;
            expect(headers["apollographql-client-name"]).toBeDefined();
            expect(headers["apollographql-client-name"]).toEqual(
              clientAwareness.name
            );
            expect(headers["apollographql-client-version"]).toBeDefined();
            expect(headers["apollographql-client-version"]).toEqual(
              clientAwareness.version
            );
          })
        );
      }
    );

    itAsync(
      "should not add empty client awareness settings to request headers",
      (resolve, reject) => {
        const variables = { params: "stub" };
        const link = createHttpLink({
          uri: "/data",
        });

        const hasOwn = Object.prototype.hasOwnProperty;
        const clientAwareness = {};
        execute(link, {
          query: sampleQuery,
          variables,
          context: {
            clientAwareness,
          },
        }).subscribe(
          makeCallback(resolve, reject, () => {
            const [, options] = fetchMock.lastCall()!;
            const { headers } = options as any;
            expect(hasOwn.call(headers, "apollographql-client-name")).toBe(
              false
            );
            expect(hasOwn.call(headers, "apollographql-client-version")).toBe(
              false
            );
          })
        );
      }
    );

    itAsync(
      "throws for GET if the variables can't be stringified",
      (resolve, reject) => {
        const link = createHttpLink({
          uri: "/data",
          useGETForQueries: true,
          includeUnusedVariables: true,
        });

        let b;
        const a: any = { b };
        b = { a };
        a.b = b;
        const variables = {
          a,
          b,
        };
        execute(link, { query: sampleQuery, variables }).subscribe(
          (result) => {
            reject("next should have been thrown from the link");
          },
          makeCallback(resolve, reject, (e: ClientParseError) => {
            expect(e.message).toMatch(/Variables map is not serializable/);
            expect(e.parseError.message).toMatch(
              /Converting circular structure to JSON/
            );
          })
        );
      }
    );

    itAsync(
      "throws for GET if the extensions can't be stringified",
      (resolve, reject) => {
        const link = createHttpLink({
          uri: "/data",
          useGETForQueries: true,
          includeExtensions: true,
        });

        let b;
        const a: any = { b };
        b = { a };
        a.b = b;
        const extensions = {
          a,
          b,
        };
        execute(link, { query: sampleQuery, extensions }).subscribe(
          (result) => {
            reject("next should have been thrown from the link");
          },
          makeCallback(resolve, reject, (e: ClientParseError) => {
            expect(e.message).toMatch(/Extensions map is not serializable/);
            expect(e.parseError.message).toMatch(
              /Converting circular structure to JSON/
            );
          })
        );
      }
    );

    it("raises warning if called with concat", () => {
      const link = createHttpLink();
      const _warn = console.warn;
      console.warn = (...args: any) =>
        expect(args).toEqual([
          "You are calling concat on a terminating link, which will have no effect %o",
          link,
        ]);
      expect(link.concat((operation, forward) => forward(operation))).toEqual(
        link
      );
      console.warn = _warn;
    });

    it("does not need any constructor arguments", () => {
      expect(() => createHttpLink()).not.toThrow();
    });

    itAsync("calls next and then complete", (resolve, reject) => {
      const next = jest.fn();
      const link = createHttpLink({ uri: "data" });
      const observable = execute(link, {
        query: sampleQuery,
      });
      observable.subscribe({
        next,
        error: (error) => reject(error),
        complete: makeCallback(resolve, reject, () => {
          expect(next).toHaveBeenCalledTimes(1);
        }),
      });
    });

    itAsync("calls error when fetch fails", (resolve, reject) => {
      const link = createHttpLink({ uri: "error" });
      const observable = execute(link, {
        query: sampleQuery,
      });
      observable.subscribe(
        (result) => reject("next should not have been called"),
        makeCallback(resolve, reject, (error: TypeError) => {
          expect(error).toEqual(mockError.throws);
        }),
        () => reject("complete should not have been called")
      );
    });

    itAsync("calls error when fetch fails", (resolve, reject) => {
      const link = createHttpLink({ uri: "error" });
      const observable = execute(link, {
        query: sampleMutation,
      });
      observable.subscribe(
        (result) => reject("next should not have been called"),
        makeCallback(resolve, reject, (error: TypeError) => {
          expect(error).toEqual(mockError.throws);
        }),
        () => reject("complete should not have been called")
      );
    });

    itAsync("unsubscribes without calling subscriber", (resolve, reject) => {
      const link = createHttpLink({ uri: "data" });
      const observable = execute(link, {
        query: sampleQuery,
      });
      const subscription = observable.subscribe(
        (result) => reject("next should not have been called"),
        (error) => reject(error),
        () => reject("complete should not have been called")
      );
      subscription.unsubscribe();
      expect(subscription.closed).toBe(true);
      setTimeout(resolve, 50);
    });

    const verifyRequest = (
      link: ApolloLink,
      resolve: () => void,
      includeExtensions: boolean,
      reject: (error: any) => any
    ) => {
      const next = jest.fn();
      const context = { info: "stub" };
      const variables = { params: "stub" };

      const observable = execute(link, {
        query: sampleMutation,
        context,
        variables,
      });
      observable.subscribe({
        next,
        error: (error) => reject(error),
        complete: () => {
          try {
            let body = convertBatchedBody(fetchMock.lastCall()![1]!.body);
            expect(body.query).toBe(print(sampleMutation));
            expect(body.variables).toEqual({});
            expect(body.context).not.toBeDefined();
            if (includeExtensions) {
              expect(body.extensions).toBeDefined();
            } else {
              expect(body.extensions).not.toBeDefined();
            }
            expect(next).toHaveBeenCalledTimes(1);

            resolve();
          } catch (e) {
            reject(e);
          }
        },
      });
    };

    itAsync(
      "passes all arguments to multiple fetch body including extensions",
      (resolve, reject) => {
        const link = createHttpLink({ uri: "data", includeExtensions: true });
        verifyRequest(
          link,
          () => verifyRequest(link, resolve, true, reject),
          true,
          reject
        );
      }
    );

    itAsync(
      "passes all arguments to multiple fetch body excluding extensions",
      (resolve, reject) => {
        const link = createHttpLink({ uri: "data" });
        verifyRequest(
          link,
          () => verifyRequest(link, resolve, false, reject),
          false,
          reject
        );
      }
    );

    itAsync("calls multiple subscribers", (resolve, reject) => {
      const link = createHttpLink({ uri: "data" });
      const context = { info: "stub" };
      const variables = { params: "stub" };

      const observable = execute(link, {
        query: sampleMutation,
        context,
        variables,
      });
      observable.subscribe(subscriber);
      observable.subscribe(subscriber);

      setTimeout(() => {
        expect(subscriber.next).toHaveBeenCalledTimes(2);
        expect(subscriber.complete).toHaveBeenCalledTimes(2);
        expect(subscriber.error).not.toHaveBeenCalled();
        expect(fetchMock.calls().length).toBe(2);
        resolve();
      }, 50);
    });

    itAsync(
      "calls remaining subscribers after unsubscribe",
      (resolve, reject) => {
        const link = createHttpLink({ uri: "data" });
        const context = { info: "stub" };
        const variables = { params: "stub" };

        const observable = execute(link, {
          query: sampleMutation,
          context,
          variables,
        });

        observable.subscribe(subscriber);

        setTimeout(() => {
          const subscription = observable.subscribe(subscriber);
          subscription.unsubscribe();
        }, 10);

        setTimeout(
          makeCallback(resolve, reject, () => {
            expect(subscriber.next).toHaveBeenCalledTimes(1);
            expect(subscriber.complete).toHaveBeenCalledTimes(1);
            expect(subscriber.error).not.toHaveBeenCalled();
            resolve();
          }),
          50
        );
      }
    );

    itAsync("allows for dynamic endpoint setting", (resolve, reject) => {
      const variables = { params: "stub" };
      const link = createHttpLink({ uri: "data" });

      execute(link, {
        query: sampleQuery,
        variables,
        context: { uri: "data2" },
      }).subscribe((result) => {
        expect(result).toEqual(data2);
        resolve();
      });
    });

    itAsync(
      "adds headers to the request from the context",
      (resolve, reject) => {
        const variables = { params: "stub" };
        const middleware = new ApolloLink((operation, forward) => {
          operation.setContext({
            headers: { authorization: "1234" },
          });
          return forward(operation).map((result) => {
            const { headers } = operation.getContext();
            try {
              expect(headers).toBeDefined();
            } catch (e) {
              reject(e);
            }
            return result;
          });
        });
        const link = middleware.concat(createHttpLink({ uri: "data" }));

        execute(link, { query: sampleQuery, variables }).subscribe(
          makeCallback(resolve, reject, () => {
            const headers = fetchMock.lastCall()![1]!.headers as any;
            expect(headers.authorization).toBe("1234");
            expect(headers["content-type"]).toBe("application/json");
            expect(headers.accept).toBe("*/*");
          })
        );
      }
    );

    itAsync("adds headers to the request from the setup", (resolve, reject) => {
      const variables = { params: "stub" };
      const link = createHttpLink({
        uri: "data",
        headers: { authorization: "1234" },
      });

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(resolve, reject, () => {
          const headers = fetchMock.lastCall()![1]!.headers as any;
          expect(headers.authorization).toBe("1234");
          expect(headers["content-type"]).toBe("application/json");
          expect(headers.accept).toBe("*/*");
        })
      );
    });

    itAsync(
      "prioritizes context headers over setup headers",
      (resolve, reject) => {
        const variables = { params: "stub" };
        const middleware = new ApolloLink((operation, forward) => {
          operation.setContext({
            headers: { authorization: "1234" },
          });
          return forward(operation);
        });
        const link = middleware.concat(
          createHttpLink({ uri: "data", headers: { authorization: "no user" } })
        );

        execute(link, { query: sampleQuery, variables }).subscribe(
          makeCallback(resolve, reject, () => {
            const headers = fetchMock.lastCall()![1]!.headers as any;
            expect(headers.authorization).toBe("1234");
            expect(headers["content-type"]).toBe("application/json");
            expect(headers.accept).toBe("*/*");
          })
        );
      }
    );

    itAsync(
      "adds headers to the request from the context on an operation",
      (resolve, reject) => {
        const variables = { params: "stub" };
        const link = createHttpLink({ uri: "data" });

        const context = {
          headers: { authorization: "1234" },
        };
        execute(link, {
          query: sampleQuery,
          variables,
          context,
        }).subscribe(
          makeCallback(resolve, reject, () => {
            const headers = fetchMock.lastCall()![1]!.headers as any;
            expect(headers.authorization).toBe("1234");
            expect(headers["content-type"]).toBe("application/json");
            expect(headers.accept).toBe("*/*");
          })
        );
      }
    );

    itAsync("adds creds to the request from the context", (resolve, reject) => {
      const variables = { params: "stub" };
      const middleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          credentials: "same-team-yo",
        });
        return forward(operation);
      });
      const link = middleware.concat(createHttpLink({ uri: "data" }));

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(resolve, reject, () => {
          const creds = fetchMock.lastCall()![1]!.credentials;
          expect(creds).toBe("same-team-yo");
        })
      );
    });

    itAsync("adds creds to the request from the setup", (resolve, reject) => {
      const variables = { params: "stub" };
      const link = createHttpLink({ uri: "data", credentials: "same-team-yo" });

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(resolve, reject, () => {
          const creds = fetchMock.lastCall()![1]!.credentials;
          expect(creds).toBe("same-team-yo");
        })
      );
    });

    itAsync(
      "prioritizes creds from the context over the setup",
      (resolve, reject) => {
        const variables = { params: "stub" };
        const middleware = new ApolloLink((operation, forward) => {
          operation.setContext({
            credentials: "same-team-yo",
          });
          return forward(operation);
        });
        const link = middleware.concat(
          createHttpLink({ uri: "data", credentials: "error" })
        );

        execute(link, { query: sampleQuery, variables }).subscribe(
          makeCallback(resolve, reject, () => {
            const creds = fetchMock.lastCall()![1]!.credentials;
            expect(creds).toBe("same-team-yo");
          })
        );
      }
    );

    itAsync("adds uri to the request from the context", (resolve, reject) => {
      const variables = { params: "stub" };
      const middleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          uri: "data",
        });
        return forward(operation);
      });
      const link = middleware.concat(createHttpLink());

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(resolve, reject, () => {
          const uri = fetchMock.lastUrl();
          expect(uri).toBe("/data");
        })
      );
    });

    itAsync("adds uri to the request from the setup", (resolve, reject) => {
      const variables = { params: "stub" };
      const link = createHttpLink({ uri: "data" });

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(resolve, reject, () => {
          const uri = fetchMock.lastUrl();
          expect(uri).toBe("/data");
        })
      );
    });

    itAsync("prioritizes context uri over setup uri", (resolve, reject) => {
      const variables = { params: "stub" };
      const middleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          uri: "apollo",
        });
        return forward(operation);
      });
      const link = middleware.concat(
        createHttpLink({ uri: "data", credentials: "error" })
      );

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(resolve, reject, () => {
          const uri = fetchMock.lastUrl();

          expect(uri).toBe("/apollo");
        })
      );
    });

    itAsync("allows uri to be a function", (resolve, reject) => {
      const variables = { params: "stub" };
      const customFetch: typeof fetch = (uri, options) => {
        const { operationName } = convertBatchedBody(options!.body);
        try {
          expect(operationName).toBe("SampleQuery");
        } catch (e) {
          reject(e);
        }
        return fetch("dataFunc", options);
      };

      const link = createHttpLink({ fetch: customFetch });

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(resolve, reject, () => {
          expect(fetchMock.lastUrl()).toBe("/dataFunc");
        })
      );
    });

    itAsync(
      "adds fetchOptions to the request from the setup",
      (resolve, reject) => {
        const variables = { params: "stub" };
        const link = createHttpLink({
          uri: "data",
          fetchOptions: { someOption: "foo", mode: "no-cors" },
        });

        execute(link, { query: sampleQuery, variables }).subscribe(
          makeCallback(resolve, reject, () => {
            const { someOption, mode, headers } =
              fetchMock.lastCall()![1] as any;
            expect(someOption).toBe("foo");
            expect(mode).toBe("no-cors");
            expect(headers["content-type"]).toBe("application/json");
          })
        );
      }
    );

    itAsync(
      "adds fetchOptions to the request from the context",
      (resolve, reject) => {
        const variables = { params: "stub" };
        const middleware = new ApolloLink((operation, forward) => {
          operation.setContext({
            fetchOptions: {
              someOption: "foo",
            },
          });
          return forward(operation);
        });
        const link = middleware.concat(createHttpLink({ uri: "data" }));

        execute(link, { query: sampleQuery, variables }).subscribe(
          makeCallback(resolve, reject, () => {
            const { someOption } = fetchMock.lastCall()![1] as any;
            expect(someOption).toBe("foo");
            resolve();
          })
        );
      }
    );

    itAsync(
      "uses the latest window.fetch function if options.fetch not configured",
      (resolve, reject) => {
        const httpLink = createHttpLink({ uri: "data" });

        const fetch = window.fetch;
        expect(typeof fetch).toBe("function");

        const fetchSpy = jest.spyOn(window, "fetch");
        fetchSpy.mockImplementation(() =>
          Promise.resolve<Response>({
            text() {
              return Promise.resolve(
                JSON.stringify({
                  data: { hello: "from spy" },
                })
              );
            },
          } as Response)
        );

        const spyFn = window.fetch;
        expect(spyFn).not.toBe(fetch);

        subscriptions.add(
          execute(httpLink, {
            query: sampleQuery,
          }).subscribe({
            error: reject,

            next(result) {
              expect(fetchSpy).toHaveBeenCalledTimes(1);
              expect(result).toEqual({
                data: { hello: "from spy" },
              });

              fetchSpy.mockRestore();
              expect(window.fetch).toBe(fetch);

              subscriptions.add(
                execute(httpLink, {
                  query: sampleQuery,
                }).subscribe({
                  error: reject,
                  next(result) {
                    expect(result).toEqual({
                      data: { hello: "world" },
                    });
                    resolve();
                  },
                })
              );
            },
          })
        );
      }
    );

    itAsync(
      "uses the print option function when defined",
      (resolve, reject) => {
        const customPrinter = jest.fn(
          (ast: ASTNode, originalPrint: typeof print) => {
            return stripIgnoredCharacters(originalPrint(ast));
          }
        );

        const httpLink = createHttpLink({ uri: "data", print: customPrinter });

        execute(httpLink, {
          query: sampleQuery,
          context: {
            fetchOptions: { method: "GET" },
          },
        }).subscribe(
          makeCallback(resolve, reject, () => {
            expect(customPrinter).toHaveBeenCalledTimes(1);
            const [uri] = fetchMock.lastCall()!;
            expect(uri).toBe(
              "/data?query=query%20SampleQuery%7Bstub%7Bid%7D%7D&operationName=SampleQuery&variables=%7B%7D"
            );
          })
        );
      }
    );

    itAsync("prioritizes context over setup", (resolve, reject) => {
      const variables = { params: "stub" };
      const middleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          fetchOptions: {
            someOption: "foo",
          },
        });
        return forward(operation);
      });
      const link = middleware.concat(
        createHttpLink({ uri: "data", fetchOptions: { someOption: "bar" } })
      );

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(resolve, reject, () => {
          const { someOption } = fetchMock.lastCall()![1] as any;
          expect(someOption).toBe("foo");
        })
      );
    });

    itAsync(
      "allows for not sending the query with the request",
      (resolve, reject) => {
        const variables = { params: "stub" };
        const middleware = new ApolloLink((operation, forward) => {
          operation.setContext({
            http: {
              includeQuery: false,
              includeExtensions: true,
            },
          });
          operation.extensions.persistedQuery = { hash: "1234" };
          return forward(operation);
        });
        const link = middleware.concat(createHttpLink({ uri: "data" }));

        execute(link, { query: sampleQuery, variables }).subscribe(
          makeCallback(resolve, reject, () => {
            let body = convertBatchedBody(fetchMock.lastCall()![1]!.body);

            expect(body.query).not.toBeDefined();
            expect(body.extensions).toEqual({
              persistedQuery: { hash: "1234" },
            });
            resolve();
          })
        );
      }
    );

    itAsync("sets the raw response on context", (resolve, reject) => {
      const middleware = new ApolloLink((operation, forward) => {
        return new Observable((ob) => {
          const op = forward(operation);
          const sub = op.subscribe({
            next: ob.next.bind(ob),
            error: ob.error.bind(ob),
            complete: makeCallback(resolve, reject, () => {
              expect(operation.getContext().response.headers.toBeDefined);
              ob.complete();
            }),
          });

          return () => {
            sub.unsubscribe();
          };
        });
      });

      const link = middleware.concat(createHttpLink({ uri: "data", fetch }));

      execute(link, { query: sampleQuery }).subscribe(
        (result) => {
          resolve();
        },
        () => {}
      );
    });

    it("removes @client fields from the query before sending it to the server", async () => {
      fetchMock.mock("https://example.com/graphql", {
        status: 200,
        body: JSON.stringify({
          data: {
            author: { __typename: "Author", name: "Test User" },
          },
        }),
        headers: { "content-type": "application/json" },
      });

      const query = gql`
        query {
          author {
            name
            isInCollection @client
          }
        }
      `;

      const serverQuery = gql`
        query {
          author {
            name
          }
        }
      `;

      const link = createHttpLink({ uri: "https://example.com/graphql" });

      await new Promise((resolve, reject) => {
        execute(link, { query }).subscribe({
          next: resolve,
          error: reject,
        });
      });

      const [, options] = fetchMock.lastCall()!;
      const { body } = options!;

      expect(JSON.parse(body!.toString())).toEqual({
        query: print(serverQuery),
        variables: {},
      });
    });

    it("responds with error when trying to send a client-only query", async () => {
      const errorHandler = jest.fn();
      const query = gql`
        query {
          author @client {
            name
          }
        }
      `;

      const link = createHttpLink({ uri: "https://example.com/graphql" });

      await new Promise<void>((resolve, reject) => {
        execute(link, { query }).subscribe({
          next: reject,
          error: errorHandler.mockImplementation(resolve),
        });
      });

      expect(errorHandler).toHaveBeenCalledWith(
        new Error(
          "HttpLink: Trying to send a client-only query to the server. To send to the server, ensure a non-client field is added to the query or set the `transformOptions.removeClientFields` option to `true`."
        )
      );
    });
  });

  describe("Dev warnings", () => {
    voidFetchDuringEachTest();

    itAsync("warns if fetch is undeclared", (resolve, reject) => {
      try {
        createHttpLink({ uri: "data" });
        reject("warning wasn't called");
      } catch (e) {
        makeCallback(resolve, reject, () =>
          expect((e as Error).message).toMatch(/has not been found globally/)
        )();
      }
    });

    itAsync("warns if fetch is undefined", (resolve, reject) => {
      window.fetch = undefined as any;
      try {
        createHttpLink({ uri: "data" });
        reject("warning wasn't called");
      } catch (e) {
        makeCallback(resolve, reject, () =>
          expect((e as Error).message).toMatch(/has not been found globally/)
        )();
      }
    });

    it("does not warn if fetch is undeclared but a fetch is passed", () => {
      expect(() => {
        createHttpLink({ uri: "data", fetch: (() => {}) as any });
      }).not.toThrow();
    });
  });

  describe("Error handling", () => {
    let responseBody: any;
    const text = jest.fn(() => {
      const responseBodyText = "{}";
      responseBody = JSON.parse(responseBodyText);
      return Promise.resolve(responseBodyText);
    });
    const textWithStringError = jest.fn(() => {
      const responseBodyText = "Error! Foo bar";
      responseBody = responseBodyText;
      return Promise.resolve(responseBodyText);
    });
    const textWithData = jest.fn(() => {
      responseBody = {
        data: { stub: { id: 1 } },
        errors: [{ message: "dangit" }],
      };

      return Promise.resolve(JSON.stringify(responseBody));
    });

    const textWithErrors = jest.fn(() => {
      responseBody = {
        errors: [{ message: "dangit" }],
      };

      return Promise.resolve(JSON.stringify(responseBody));
    });
    const fetch = jest.fn((uri, options) => {
      return Promise.resolve({ text });
    });
    beforeEach(() => {
      fetch.mockReset();
    });
    itAsync("makes it easy to do stuff on a 401", (resolve, reject) => {
      const middleware = new ApolloLink((operation, forward) => {
        return new Observable((ob) => {
          fetch.mockReturnValueOnce(Promise.resolve({ status: 401, text }));
          const op = forward(operation);
          const sub = op.subscribe({
            next: ob.next.bind(ob),
            error: makeCallback(resolve, reject, (e: ServerError) => {
              expect(e.message).toMatch(/Received status code 401/);
              expect(e.statusCode).toEqual(401);
              ob.error(e);
            }),
            complete: ob.complete.bind(ob),
          });

          return () => {
            sub.unsubscribe();
          };
        });
      });

      const link = middleware.concat(
        createHttpLink({ uri: "data", fetch: fetch as any })
      );

      execute(link, { query: sampleQuery }).subscribe(
        (result) => {
          reject("next should have been thrown from the network");
        },
        () => {}
      );
    });

    itAsync("throws an error if response code is > 300", (resolve, reject) => {
      fetch.mockReturnValueOnce(Promise.resolve({ status: 400, text }));
      const link = createHttpLink({ uri: "data", fetch: fetch as any });

      execute(link, { query: sampleQuery }).subscribe(
        (result) => {
          reject("next should have been thrown from the network");
        },
        makeCallback(resolve, reject, (e: ServerError) => {
          expect(e.message).toMatch(/Received status code 400/);
          expect(e.statusCode).toBe(400);
          expect(e.result).toEqual(responseBody);
        })
      );
    });
    itAsync(
      "throws an error if response code is > 300 and handles string response body",
      (resolve, reject) => {
        fetch.mockReturnValueOnce(
          Promise.resolve({ status: 302, text: textWithStringError })
        );
        const link = createHttpLink({ uri: "data", fetch: fetch as any });
        execute(link, { query: sampleQuery }).subscribe(
          (result) => {
            reject("next should have been thrown from the network");
          },
          makeCallback(resolve, reject, (e: ServerError) => {
            expect(e.message).toMatch(/Received status code 302/);
            expect(e.statusCode).toBe(302);
            expect(e.result).toEqual(responseBody);
          })
        );
      }
    );
    itAsync(
      "throws an error if response code is > 300 and returns data",
      (resolve, reject) => {
        fetch.mockReturnValueOnce(
          Promise.resolve({ status: 400, text: textWithData })
        );

        const link = createHttpLink({ uri: "data", fetch: fetch as any });

        let called = false;

        execute(link, { query: sampleQuery }).subscribe(
          (result) => {
            called = true;
            expect(result).toEqual(responseBody);
          },
          (e) => {
            expect(called).toBe(true);
            expect(e.message).toMatch(/Received status code 400/);
            expect(e.statusCode).toBe(400);
            expect(e.result).toEqual(responseBody);
            resolve();
          }
        );
      }
    );
    itAsync(
      "throws an error if only errors are returned",
      (resolve, reject) => {
        fetch.mockReturnValueOnce(
          Promise.resolve({ status: 400, text: textWithErrors })
        );

        const link = createHttpLink({ uri: "data", fetch: fetch as any });
        execute(link, { query: sampleQuery }).subscribe(
          (result) => {
            reject("should not have called result because we have no data");
          },
          (e) => {
            expect(e.message).toMatch(/Received status code 400/);
            expect(e.statusCode).toBe(400);
            expect(e.result).toEqual(responseBody);
            resolve();
          }
        );
      }
    );
    itAsync(
      "throws an error if empty response from the server ",
      (resolve, reject) => {
        fetch.mockReturnValueOnce(Promise.resolve({ text }));
        text.mockReturnValueOnce(Promise.resolve('{ "body": "boo" }'));
        const link = createHttpLink({ uri: "data", fetch: fetch as any });

        execute(link, { query: sampleQuery }).subscribe(
          (result) => {
            reject("next should have been thrown from the network");
          },
          makeCallback(resolve, reject, (e: Error) => {
            expect(e.message).toMatch(
              /Server response was missing for query 'SampleQuery'/
            );
          })
        );
      }
    );
    itAsync("throws if the body can't be stringified", (resolve, reject) => {
      fetch.mockReturnValueOnce(Promise.resolve({ data: {}, text }));
      const link = createHttpLink({
        uri: "data",
        fetch: fetch as any,
        includeUnusedVariables: true,
      });

      let b;
      const a: any = { b };
      b = { a };
      a.b = b;
      const variables = {
        a,
        b,
      };
      execute(link, { query: sampleQuery, variables }).subscribe(
        (result) => {
          reject("next should have been thrown from the link");
        },
        makeCallback(resolve, reject, (e: ClientParseError) => {
          expect(e.message).toMatch(/Payload is not serializable/);
          expect(e.parseError.message).toMatch(
            /Converting circular structure to JSON/
          );
        })
      );
    });

    describe("AbortController", () => {
      const originalAbortController = globalThis.AbortController;
      afterEach(() => {
        globalThis.AbortController = originalAbortController;
      });

      function trackGlobalAbortControllers() {
        const instances: AbortController[] = [];
        class AbortControllerMock {
          constructor() {
            const instance = new originalAbortController();
            instances.push(instance);
            return instance;
          }
        }

        globalThis.AbortController = AbortControllerMock as any;
        return instances;
      }

      const failingObserver: Observer<FetchResult> = {
        next: () => {
          fail("result should not have been called");
        },
        error: (e) => {
          fail(e);
        },
        complete: () => {
          fail("complete should not have been called");
        },
      };

      function mockFetch() {
        const text = jest.fn(
          async () => '{ "data": { "stub": { "id": "foo" } } }'
        );
        const fetch = jest.fn(async (uri, options) => ({ text }));
        return { text, fetch };
      }

      it("aborts the request when unsubscribing before the request has completed", () => {
        const { fetch } = mockFetch();
        const abortControllers = trackGlobalAbortControllers();

        const link = createHttpLink({ uri: "data", fetch: fetch as any });

        const sub = execute(link, { query: sampleQuery }).subscribe(
          failingObserver
        );
        sub.unsubscribe();

        expect(abortControllers.length).toBe(1);
        expect(abortControllers[0].signal.aborted).toBe(true);
      });

      it("a passed-in signal will be forwarded to the `fetch` call and not be overwritten by an internally-created one", () => {
        const { fetch } = mockFetch();
        const externalAbortController = new AbortController();

        const link = createHttpLink({
          uri: "data",
          fetch: fetch as any,
          fetchOptions: { signal: externalAbortController.signal },
        });

        const sub = execute(link, { query: sampleQuery }).subscribe(
          failingObserver
        );
        sub.unsubscribe();

        expect(fetch.mock.calls.length).toBe(1);
        expect(fetch.mock.calls[0][1]).toEqual(
          expect.objectContaining({ signal: externalAbortController.signal })
        );
      });

      it("a passed-in signal that is cancelled will fail the observable with an `AbortError`", async () => {
        try {
          fetchMock.restore();
          fetchMock.postOnce(
            "data",
            async () => '{ "data": { "stub": { "id": "foo" } } }'
          );

          const externalAbortController = new AbortController();

          const link = createHttpLink({
            uri: "/data",
            fetchOptions: { signal: externalAbortController.signal },
          });

          const error = await new Promise<Error>((resolve) => {
            execute(link, { query: sampleQuery }).subscribe({
              ...failingObserver,
              error: resolve,
            });
            externalAbortController.abort();
          });
          expect(error.name).toBe("AbortError");
        } finally {
          fetchMock.restore();
        }
      });

      it("resolving fetch does not cause the AbortController to be aborted", async () => {
        const { text, fetch } = mockFetch();
        const abortControllers = trackGlobalAbortControllers();
        text.mockResolvedValueOnce('{ "data": { "hello": "world" } }');

        // (the request is already finished at that point)
        const link = createHttpLink({ uri: "data", fetch: fetch as any });

        await new Promise<void>((resolve) =>
          execute(link, { query: sampleQuery }).subscribe({
            complete: resolve,
          })
        );

        expect(abortControllers.length).toBe(1);
        expect(abortControllers[0].signal.aborted).toBe(false);
      });

      it("an unsuccessful fetch does not cause the AbortController to be aborted", async () => {
        const { fetch } = mockFetch();
        const abortControllers = trackGlobalAbortControllers();
        fetch.mockRejectedValueOnce("This is an error!");
        // the request would be closed by the browser in the case of an error anyways
        const link = createHttpLink({ uri: "data", fetch: fetch as any });

        await new Promise<void>((resolve) =>
          execute(link, { query: sampleQuery }).subscribe({
            error: resolve,
          })
        );

        expect(abortControllers.length).toBe(1);
        expect(abortControllers[0].signal.aborted).toBe(false);
      });
    });

    const body = "{";
    const unparsableJson = jest.fn(() => Promise.resolve(body));
    itAsync(
      "throws a Server error if response is > 300 with unparsable json",
      (resolve, reject) => {
        fetch.mockReturnValueOnce(
          Promise.resolve({ status: 400, text: unparsableJson })
        );
        const link = createHttpLink({ uri: "data", fetch: fetch as any });

        execute(link, { query: sampleQuery }).subscribe(
          (result) => {
            reject("next should have been thrown from the network");
          },
          makeCallback(resolve, reject, (e: ServerParseError) => {
            expect(e.message).toMatch(
              "Response not successful: Received status code 400"
            );
            expect(e.statusCode).toBe(400);
            expect(e.response).toBeDefined();
            expect(e.bodyText).toBe(undefined);
          })
        );
      }
    );

    itAsync(
      "throws a ServerParse error if response is 200 with unparsable json",
      (resolve, reject) => {
        fetch.mockReturnValueOnce(
          Promise.resolve({ status: 200, text: unparsableJson })
        );
        const link = createHttpLink({ uri: "data", fetch: fetch as any });

        execute(link, { query: sampleQuery }).subscribe(
          (result) => {
            reject("next should have been thrown from the network");
          },
          makeCallback(resolve, reject, (e: ServerParseError) => {
            expect(e.message).toMatch(/JSON/);
            expect(e.statusCode).toBe(200);
            expect(e.response).toBeDefined();
            expect(e.bodyText).toBe(body);
          })
        );
      }
    );
  });

  describe("Multipart responses", () => {
    let originalTextDecoder: any;
    beforeAll(() => {
      originalTextDecoder = TextDecoder;
      (globalThis as any).TextDecoder = TextDecoder;
    });

    afterAll(() => {
      globalThis.TextDecoder = originalTextDecoder;
    });

    describe("@defer", () => {
      const body = [
        "---",
        "Content-Type: application/json; charset=utf-8",
        "Content-Length: 43",
        "",
        '{"data":{"stub":{"id":"0"}},"hasNext":true}',
        "---",
        "Content-Type: application/json; charset=utf-8",
        "Content-Length: 58",
        "",
        // Intentionally using the boundary value `---` within the “name” to
        // validate that boundary delimiters are not parsed within the response
        // data itself, only read at the beginning of each chunk.
        '{"hasNext":false, "incremental": [{"data":{"name":"stubby---"},"path":["stub"],"extensions":{"timestamp":1633038919}}]}',
        "-----",
      ].join("\r\n");

      const finalChunkOnlyHasNextFalse = [
        "--graphql",
        "content-type: application/json",
        "",
        '{"data":{"allProducts":[null,null,null]},"errors":[{"message":"Cannot return null for non-nullable field Product.nonNullErrorField."},{"message":"Cannot return null for non-nullable field Product.nonNullErrorField."},{"message":"Cannot return null for non-nullable field Product.nonNullErrorField."}],"hasNext":true}',
        "--graphql",
        "content-type: application/json",
        "",
        '{"hasNext":false}',
        "--graphql--",
      ].join("\r\n");

      it("whatwg stream bodies", (done) => {
        const stream = new ReadableStream({
          async start(controller) {
            const lines = body.split("\r\n");
            try {
              for (const line of lines) {
                await new Promise((resolve) => setTimeout(resolve, 10));
                controller.enqueue(line + "\r\n");
              }
            } finally {
              controller.close();
            }
          },
        });

        const fetch = jest.fn(async () => ({
          status: 200,
          body: stream,
          headers: new Headers({ "content-type": "multipart/mixed" }),
        }));

        const link = new HttpLink({
          fetch: fetch as any,
        });

        let i = 0;
        execute(link, { query: sampleDeferredQuery }).subscribe(
          (result) => {
            try {
              if (i === 0) {
                expect(result).toEqual({
                  data: {
                    stub: {
                      id: "0",
                    },
                  },
                  hasNext: true,
                });
              } else if (i === 1) {
                expect(result).toEqual({
                  incremental: [
                    {
                      data: {
                        name: "stubby---",
                      },
                      extensions: {
                        timestamp: 1633038919,
                      },
                      path: ["stub"],
                    },
                  ],
                  hasNext: false,
                });
              }
            } catch (err) {
              done(err);
            } finally {
              i++;
            }
          },
          (err) => {
            done(err);
          },
          () => {
            if (i !== 2) {
              done(new Error("Unexpected end to observable"));
            }

            done();
          }
        );
      });

      // Verify that observable completes if final chunk does not contain
      // incremental array.
      it("whatwg stream bodies, final chunk of { hasNext: false }", (done) => {
        const stream = new ReadableStream({
          async start(controller) {
            const lines = finalChunkOnlyHasNextFalse.split("\r\n");
            try {
              for (const line of lines) {
                await new Promise((resolve) => setTimeout(resolve, 10));
                controller.enqueue(line + "\r\n");
              }
            } finally {
              controller.close();
            }
          },
        });

        const fetch = jest.fn(async () => ({
          status: 200,
          body: stream,
          headers: new Headers({
            "Content-Type":
              'multipart/mixed;boundary="graphql";deferSpec=20220824',
          }),
        }));

        const link = new HttpLink({
          fetch: fetch as any,
        });

        let i = 0;
        execute(link, { query: sampleDeferredQuery }).subscribe(
          (result) => {
            try {
              if (i === 0) {
                expect(result).toMatchObject({
                  data: {
                    allProducts: [null, null, null],
                  },
                  // errors is also present, but for the purpose of this test
                  // we're not interested in its (lengthy) content.
                  // errors: [{...}],
                  hasNext: true,
                });
              }
              // Since the second chunk contains only hasNext: false,
              // there is no next result to receive.
            } catch (err) {
              done(err);
            } finally {
              i++;
            }
          },
          (err) => {
            done(err);
          },
          () => {
            if (i !== 1) {
              done(new Error("Unexpected end to observable"));
            }

            done();
          }
        );
      });

      it("node stream bodies", (done) => {
        const stream = Readable.from(
          body.split("\r\n").map((line) => line + "\r\n")
        );

        const fetch = jest.fn(async () => ({
          status: 200,
          body: stream,
          headers: new Headers({
            "Content-Type": 'multipart/mixed;boundary="-";deferSpec=20220824',
          }),
        }));
        const link = new HttpLink({
          fetch: fetch as any,
        });

        let i = 0;
        execute(link, { query: sampleDeferredQuery }).subscribe(
          (result) => {
            try {
              if (i === 0) {
                expect(result).toEqual({
                  data: {
                    stub: {
                      id: "0",
                    },
                  },
                  hasNext: true,
                });
              } else if (i === 1) {
                expect(result).toEqual({
                  incremental: [
                    {
                      data: {
                        name: "stubby---",
                      },
                      extensions: {
                        timestamp: 1633038919,
                      },
                      path: ["stub"],
                    },
                  ],
                  hasNext: false,
                });
              }
            } catch (err) {
              done(err);
            } finally {
              i++;
            }
          },
          (err) => {
            done(err);
          },
          () => {
            if (i !== 2) {
              done(new Error("Unexpected end to observable"));
            }

            done();
          }
        );
      });

      itAsync(
        "sets correct accept header on request with deferred query",
        (resolve, reject) => {
          const stream = Readable.from(
            body.split("\r\n").map((line) => line + "\r\n")
          );
          const fetch = jest.fn(async () => ({
            status: 200,
            body: stream,
            headers: new Headers({ "Content-Type": "multipart/mixed" }),
          }));
          const link = new HttpLink({
            fetch: fetch as any,
          });
          execute(link, {
            query: sampleDeferredQuery,
          }).subscribe(
            makeCallback(resolve, reject, () => {
              expect(fetch).toHaveBeenCalledWith(
                "/graphql",
                expect.objectContaining({
                  headers: {
                    "content-type": "application/json",
                    accept:
                      "multipart/mixed;deferSpec=20220824,application/json",
                  },
                })
              );
            })
          );
        }
      );

      // ensure that custom directives beginning with '@defer..' do not trigger
      // custom accept header for multipart responses
      itAsync(
        "sets does not set accept header on query with custom directive begging with @defer",
        (resolve, reject) => {
          const stream = Readable.from(
            body.split("\r\n").map((line) => line + "\r\n")
          );
          const fetch = jest.fn(async () => ({
            status: 200,
            body: stream,
            headers: new Headers({ "Content-Type": "multipart/mixed" }),
          }));
          const link = new HttpLink({
            fetch: fetch as any,
          });
          execute(link, {
            query: sampleQueryCustomDirective,
          }).subscribe(
            makeCallback(resolve, reject, () => {
              expect(fetch).toHaveBeenCalledWith(
                "/graphql",
                expect.objectContaining({
                  headers: {
                    accept: "*/*",
                    "content-type": "application/json",
                  },
                })
              );
            })
          );
        }
      );
    });

    describe("subscriptions", () => {
      const subscriptionsBody = [
        "---",
        "Content-Type: application/json",
        "",
        "{}",
        "---",
        "Content-Type: application/json",
        "",
        '{"payload":{"data":{"aNewDieWasCreated":{"die":{"color":"red","roll":1,"sides":4}}}}}',
        "---",
        "Content-Type: application/json",
        "",
        "{}",
        "---",
        "Content-Type: application/json",
        "",
        '{"payload":{"data":{"aNewDieWasCreated":{"die":{"color":"blue","roll":2,"sides":5}}}}}',
        "---",
        "Content-Type: application/json",
        "",
        '{"payload": null}',
        "-----",
      ].join("\r\n");

      const subscriptionsBodyError = [
        "---",
        "Content-Type: application/json",
        "",
        "{}",
        "---",
        "Content-Type: application/json",
        "",
        '{"payload":{"data":{"aNewDieWasCreated":{"die":{"color":"red","roll":1,"sides":4}}}}}',
        "---",
        "Content-Type: application/json",
        "",
        '{"payload": null, "errors": [{"message":"Error field","extensions":{"code":"INTERNAL_SERVER_ERROR"}}]}',
        "-----",
      ].join("\r\n");

      it("whatwg stream bodies", (done) => {
        const stream = new ReadableStream({
          async start(controller) {
            const lines = subscriptionsBody.split("\r\n");
            try {
              for (const line of lines) {
                await new Promise((resolve) => setTimeout(resolve, 10));
                controller.enqueue(line + "\r\n");
              }
            } finally {
              controller.close();
            }
          },
        });

        const fetch = jest.fn(async () => ({
          status: 200,
          body: stream,
          headers: new Headers({ "Content-Type": "multipart/mixed" }),
        }));

        const link = new HttpLink({
          fetch: fetch as any,
        });

        let i = 0;
        execute(link, { query: sampleSubscription }).subscribe(
          (result) => {
            try {
              if (i === 0) {
                expect(result).toEqual({
                  data: {
                    aNewDieWasCreated: {
                      die: {
                        color: "red",
                        roll: 1,
                        sides: 4,
                      },
                    },
                  },
                });
              } else if (i === 1) {
                expect(result).toEqual({
                  data: {
                    aNewDieWasCreated: {
                      die: {
                        color: "blue",
                        roll: 2,
                        sides: 5,
                      },
                    },
                  },
                });
              }
            } catch (err) {
              done(err);
            } finally {
              i++;
            }
          },
          (err) => {
            done(err);
          },
          () => {
            if (i !== 2) {
              done(new Error("Unexpected end to observable"));
            }
            done();
          }
        );
      });

      test("whatwg stream bodies, warns if combined with @defer", () => {
        const stream = new ReadableStream({
          async start(controller) {
            const lines = subscriptionsBody.split("\r\n");
            try {
              for (const line of lines) {
                await new Promise((resolve) => setTimeout(resolve, 10));
                controller.enqueue(line + "\r\n");
              }
            } finally {
              controller.close();
            }
          },
        });

        const fetch = jest.fn(async () => ({
          status: 200,
          body: stream,
          headers: new Headers({ "Content-Type": "multipart/mixed" }),
        }));

        const link = new HttpLink({
          fetch: fetch as any,
        });

        const warningSpy = jest
          .spyOn(console, "warn")
          .mockImplementation(() => {});
        execute(link, { query: sampleSubscriptionWithDefer });
        expect(warningSpy).toHaveBeenCalledTimes(1);
        expect(warningSpy).toHaveBeenCalledWith(
          "Multipart-subscriptions do not support @defer"
        );
        warningSpy.mockRestore();
      });

      it("node stream bodies", (done) => {
        const stream = Readable.from(
          subscriptionsBody.split("\r\n").map((line) => line + "\r\n")
        );

        const fetch = jest.fn(async () => ({
          status: 200,
          body: stream,
          headers: new Headers({ "Content-Type": "multipart/mixed" }),
        }));
        const link = new HttpLink({
          fetch: fetch as any,
        });

        let i = 0;
        execute(link, { query: sampleSubscription }).subscribe(
          (result) => {
            try {
              if (i === 0) {
                expect(result).toEqual({
                  data: {
                    aNewDieWasCreated: {
                      die: {
                        color: "red",
                        roll: 1,
                        sides: 4,
                      },
                    },
                  },
                });
              } else if (i === 1) {
                expect(result).toEqual({
                  data: {
                    aNewDieWasCreated: {
                      die: {
                        color: "blue",
                        roll: 2,
                        sides: 5,
                      },
                    },
                  },
                });
              }
            } catch (err) {
              done(err);
            } finally {
              i++;
            }
          },
          (err) => {
            done(err);
          },
          () => {
            if (i !== 2) {
              done(new Error("Unexpected end to observable"));
            }
            done();
          }
        );
      });

      it("node stream bodies, with errors", (done) => {
        const stream = Readable.from(
          subscriptionsBodyError.split("\r\n").map((line) => line + "\r\n")
        );

        const fetch = jest.fn(async () => ({
          status: 200,
          body: stream,
          headers: new Headers({ "Content-Type": "multipart/mixed" }),
        }));
        const link = new HttpLink({
          fetch: fetch as any,
        });

        let i = 0;
        execute(link, { query: sampleSubscription }).subscribe(
          (result) => {
            try {
              if (i === 0) {
                expect(result).toEqual({
                  data: {
                    aNewDieWasCreated: {
                      die: {
                        color: "red",
                        roll: 1,
                        sides: 4,
                      },
                    },
                  },
                });
              } else if (i === 1) {
                expect(result).toEqual({
                  extensions: {
                    [PROTOCOL_ERRORS_SYMBOL]: [
                      {
                        extensions: {
                          code: "INTERNAL_SERVER_ERROR",
                        },
                        message: "Error field",
                      },
                    ],
                  },
                });
              }
            } catch (err) {
              done(err);
            } finally {
              i++;
            }
          },
          (err) => {
            done(err);
          },
          () => {
            if (i !== 2) {
              done(new Error("Unexpected end to observable"));
            }
            done();
          }
        );
      });

      itAsync(
        "sets correct accept header on request with subscription",
        (resolve, reject) => {
          const stream = Readable.from(
            subscriptionsBody.split("\r\n").map((line) => line + "\r\n")
          );
          const fetch = jest.fn(async () => ({
            status: 200,
            body: stream,
            headers: new Headers({ "Content-Type": "multipart/mixed" }),
          }));
          const link = new HttpLink({
            fetch: fetch as any,
          });
          execute(link, {
            query: sampleSubscription,
          }).subscribe(
            makeCallback(resolve, reject, () => {
              expect(fetch).toHaveBeenCalledWith(
                "/graphql",
                expect.objectContaining({
                  headers: {
                    "content-type": "application/json",
                    accept:
                      "multipart/mixed;boundary=graphql;subscriptionSpec=1.0,application/json",
                  },
                })
              );
            })
          );
        }
      );
    });
  });
});
