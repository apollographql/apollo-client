import fetchMock from "fetch-mock";
import gql from "graphql-tag";
import { ASTNode, print, stripIgnoredCharacters } from "graphql";

import { ApolloLink } from "../../core/ApolloLink";
import { execute } from "../../core/execute";
import {
  Observable,
  ObservableSubscription,
  Observer,
} from "../../../utilities/observables/Observable";
import { BatchHttpLink } from "../batchHttpLink";
import { itAsync } from "../../../testing";
import { FetchResult } from "../../core";

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

describe("BatchHttpLink", () => {
  beforeAll(() => {
    jest.resetModules();
  });

  const headers = { cookie: "monster" };
  const data = { data: { hello: "world" } };
  const data2 = { data: { hello: "everyone" } };
  const roflData = { data: { haha: "hehe" } };
  const lawlData = { data: { tehe: "haaa" } };
  const makePromise = (res: any) =>
    new Promise((resolve, reject) =>
      setTimeout(() =>
        resolve({
          headers,
          body: res,
        })
      )
    );

  beforeEach(() => {
    fetchMock.restore();
    fetchMock.post("begin:/batch", makePromise([data, data2]));
    fetchMock.post("begin:/rofl", makePromise([roflData, roflData]));
    fetchMock.post("begin:/lawl", makePromise([lawlData, lawlData]));
  });

  it("does not need any constructor arguments", () => {
    expect(() => new BatchHttpLink()).not.toThrow();
  });

  itAsync("handles batched requests", (resolve, reject) => {
    const clientAwareness = {
      name: "Some Client Name",
      version: "1.0.1",
    };

    const link = new BatchHttpLink({
      uri: "/batch",
      batchInterval: 0,
      batchMax: 2,
    });

    let nextCalls = 0;
    let completions = 0;
    const next = (expectedData: any) => (data: any) => {
      try {
        expect(data).toEqual(expectedData);
        nextCalls++;
      } catch (error) {
        reject(error);
      }
    };

    const complete = () => {
      try {
        const calls = fetchMock.calls("begin:/batch");
        expect(calls.length).toBe(1);
        expect(nextCalls).toBe(2);

        const options: any = fetchMock.lastOptions("begin:/batch");
        expect(options.credentials).toEqual("two");

        const { headers } = options;
        expect(headers["apollographql-client-name"]).toBeDefined();
        expect(headers["apollographql-client-name"]).toEqual(
          clientAwareness.name
        );
        expect(headers["apollographql-client-version"]).toBeDefined();
        expect(headers["apollographql-client-version"]).toEqual(
          clientAwareness.version
        );

        completions++;

        if (completions === 2) {
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    };

    const error = (error: any) => {
      reject(error);
    };

    execute(link, {
      query: sampleQuery,
      context: {
        credentials: "two",
        clientAwareness,
      },
    }).subscribe(next(data), error, complete);

    execute(link, {
      query: sampleQuery,
      context: { credentials: "two" },
    }).subscribe(next(data2), error, complete);
  });

  itAsync(
    "errors on an incorrect number of results for a batch",
    (resolve, reject) => {
      const link = new BatchHttpLink({
        uri: "/batch",
        batchInterval: 0,
        batchMax: 3,
      });

      let errors = 0;
      const next = (data: any) => {
        reject("next should not have been called");
      };

      const complete = () => {
        reject("complete should not have been called");
      };

      const error = (error: any) => {
        errors++;

        if (errors === 3) {
          resolve();
        }
      };

      execute(link, { query: sampleQuery }).subscribe(next, error, complete);
      execute(link, { query: sampleQuery }).subscribe(next, error, complete);
      execute(link, { query: sampleQuery }).subscribe(next, error, complete);
    }
  );

  describe("batchKey", () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;

    itAsync(
      "should batch queries with different options separately",
      (resolve, reject) => {
        let key = true;
        const batchKey = () => {
          key = !key;
          return "" + !key;
        };

        const link = ApolloLink.from([
          new BatchHttpLink({
            uri: (operation) => {
              return operation.variables.endpoint;
            },
            batchInterval: 1,
            //if batchKey does not work, then the batch size would be 3
            batchMax: 2,
            batchKey,
          }),
        ]);

        let count = 0;
        const next = (expected: any) => (received: any) => {
          try {
            expect(received).toEqual(expected);
          } catch (e) {
            reject(e);
          }
        };
        const complete = () => {
          count++;
          if (count === 4) {
            try {
              const lawlCalls = fetchMock.calls("begin:/lawl");
              expect(lawlCalls.length).toBe(1);
              const roflCalls = fetchMock.calls("begin:/rofl");
              expect(roflCalls.length).toBe(1);
              resolve();
            } catch (e) {
              reject(e);
            }
          }
        };

        [1, 2].forEach((x) => {
          execute(link, {
            query,
            variables: { endpoint: "/rofl" },
          }).subscribe({
            next: next(roflData),
            error: reject,
            complete,
          });

          execute(link, {
            query,
            variables: { endpoint: "/lawl" },
          }).subscribe({
            next: next(lawlData),
            error: reject,
            complete,
          });
        });
      }
    );
  });
});

const convertBatchedBody = (body: any) => {
  const parsed = JSON.parse(body);
  expect(Array.isArray(parsed));
  expect(parsed.length).toBe(1);
  return parsed.pop();
};

const createHttpLink = (httpArgs?: any) => {
  const args = {
    ...httpArgs,
    batchInterval: 0,
    batchMax: 1,
  };
  return new BatchHttpLink(args);
};

const subscriptions = new Set<ObservableSubscription>();

describe("SharedHttpTest", () => {
  const data = { data: { hello: "world" } };
  const data2 = { data: { hello: "everyone" } };
  const mockError = { throws: new TypeError("mock me") };

  const makePromise = (res: any) =>
    new Promise((resolve, reject) => setTimeout(() => resolve(res)));

  let subscriber: any;

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
    const link = createHttpLink({ uri: "/data" });
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
    const link = createHttpLink({ uri: "/error" });
    const observable = execute(link, {
      query: sampleQuery,
    });
    observable.subscribe(
      (result) => reject("next should not have been called"),
      makeCallback(resolve, reject, (error: any) => {
        expect(error).toEqual(mockError.throws);
      }),
      () => reject("complete should not have been called")
    );
  });

  itAsync("calls error when fetch fails", (resolve, reject) => {
    const link = createHttpLink({ uri: "/error" });
    const observable = execute(link, {
      query: sampleMutation,
    });
    observable.subscribe(
      (result) => reject("next should not have been called"),
      makeCallback(resolve, reject, (error: any) => {
        expect(error).toEqual(mockError.throws);
      }),
      () => reject("complete should not have been called")
    );
  });

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
          expect(JSON.parse(body as string)).toEqual([
            {
              operationName: "PEOPLE",
              query: print(query),
              variables: {
                declaredAndUsed: "keep",
                undeclared: "keep",
                usedByInlineFragment: "keep",
                usedByNamedFragment: "keep",
              },
            },
          ]);
          expect(method).toBe("POST");
          expect(uri).toBe("/data");
        }),
        error: (error) => reject(error),
      });
    }
  );

  itAsync("unsubscribes without calling subscriber", (resolve, reject) => {
    const link = createHttpLink({ uri: "/data" });
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
    after: () => void,
    includeExtensions: boolean,
    includeUnusedVariables: boolean,
    reject: (e: Error) => void
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
          expect(body.variables).toEqual(
            includeUnusedVariables ? variables : {}
          );
          expect(body.context).not.toBeDefined();
          if (includeExtensions) {
            expect(body.extensions).toBeDefined();
          } else {
            expect(body.extensions).not.toBeDefined();
          }
          expect(next).toHaveBeenCalledTimes(1);

          after();
        } catch (e) {
          reject(e as Error);
        }
      },
    });
  };

  itAsync(
    "passes all arguments to multiple fetch body including extensions",
    (resolve, reject) => {
      const link = createHttpLink({ uri: "/data", includeExtensions: true });
      verifyRequest(
        link,
        () => verifyRequest(link, resolve, true, false, reject),
        true,
        false,
        reject
      );
    }
  );

  itAsync(
    "passes all arguments to multiple fetch body excluding extensions",
    (resolve, reject) => {
      const link = createHttpLink({ uri: "/data" });
      verifyRequest(
        link,
        () => verifyRequest(link, resolve, false, false, reject),
        false,
        false,
        reject
      );
    }
  );

  itAsync("calls multiple subscribers", (resolve, reject) => {
    const link = createHttpLink({ uri: "/data" });
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
      // only one call because batchHttpLink can handle more than one subscriber
      // without starting a new request
      expect(fetchMock.calls().length).toBe(1);
      resolve();
    }, 50);
  });

  itAsync(
    "calls remaining subscribers after unsubscribe",
    (resolve, reject) => {
      const link = createHttpLink({ uri: "/data" });
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
    const link = createHttpLink({ uri: "/data" });

    execute(link, {
      query: sampleQuery,
      variables,
      context: { uri: "/data2" },
    }).subscribe((result) => {
      expect(result).toEqual(data2);
      resolve();
    });
  });

  itAsync("adds headers to the request from the context", (resolve, reject) => {
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
    const link = middleware.concat(createHttpLink({ uri: "/data" }));

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const headers: Record<string, string> = fetchMock.lastCall()![1]!
          .headers as Record<string, string>;
        expect(headers.authorization).toBe("1234");
        expect(headers["content-type"]).toBe("application/json");
        expect(headers.accept).toBe("*/*");
      })
    );
  });

  itAsync("adds headers to the request from the setup", (resolve, reject) => {
    const variables = { params: "stub" };
    const link = createHttpLink({
      uri: "/data",
      headers: { authorization: "1234" },
    });

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const headers: Record<string, string> = fetchMock.lastCall()![1]!
          .headers as Record<string, string>;
        expect(headers.authorization).toBe("1234");
        expect(headers["content-type"]).toBe("application/json");
        expect(headers.accept).toBe("*/*");
      })
    );
  });

  it("uses the latest window.fetch function if options.fetch not configured", (done) => {
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
        error: done.fail,

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
              error: done.fail,
              next(result) {
                expect(result).toEqual({
                  data: { hello: "world" },
                });
                done();
              },
            })
          );
        },
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
        createHttpLink({ uri: "/data", headers: { authorization: "no user" } })
      );

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(resolve, reject, (result: any) => {
          const headers: Record<string, string> = fetchMock.lastCall()![1]!
            .headers as Record<string, string>;
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
      const link = createHttpLink({ uri: "/data" });

      const context = {
        headers: { authorization: "1234" },
      };
      execute(link, {
        query: sampleQuery,
        variables,
        context,
      }).subscribe(
        makeCallback(resolve, reject, (result: any) => {
          const headers: Record<string, string> = fetchMock.lastCall()![1]!
            .headers as Record<string, string>;
          expect(headers.authorization).toBe("1234");
          expect(headers["content-type"]).toBe("application/json");
          expect(headers.accept).toBe("*/*");
        })
      );
    }
  );

  itAsync(
    "adds headers w/ preserved case to the request from the setup",
    (resolve, reject) => {
      const variables = { params: "stub" };
      const link = createHttpLink({
        uri: "/data",
        headers: {
          authorization: "1234",
          AUTHORIZATION: "1234",
          "CONTENT-TYPE": "application/json",
        },
        preserveHeaderCase: true,
      });

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(resolve, reject, (result: any) => {
          const headers: any = fetchMock.lastCall()![1]!.headers;
          expect(headers.AUTHORIZATION).toBe("1234");
          expect(headers["CONTENT-TYPE"]).toBe("application/json");
          expect(headers.accept).toBe("*/*");
        })
      );
    }
  );

  itAsync(
    "prioritizes context headers w/ preserved case over setup headers",
    (resolve, reject) => {
      const variables = { params: "stub" };
      const middleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          headers: { AUTHORIZATION: "1234" },
          http: { preserveHeaderCase: true },
        });
        return forward(operation);
      });
      const link = middleware.concat(
        createHttpLink({
          uri: "/data",
          headers: { authorization: "no user" },
          preserveHeaderCase: false,
        })
      );

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(resolve, reject, (result: any) => {
          const headers: any = fetchMock.lastCall()![1]!.headers;
          expect(headers.AUTHORIZATION).toBe("1234");
          expect(headers["content-type"]).toBe("application/json");
          expect(headers.accept).toBe("*/*");
        })
      );
    }
  );

  itAsync(
    "adds headers w/ preserved case to the request from the context on an operation",
    (resolve, reject) => {
      const variables = { params: "stub" };
      const link = createHttpLink({ uri: "/data" });

      const context = {
        headers: { AUTHORIZATION: "1234" },
        http: { preserveHeaderCase: true },
      };
      execute(link, {
        query: sampleQuery,
        variables,
        context,
      }).subscribe(
        makeCallback(resolve, reject, (result: any) => {
          const headers: any = fetchMock.lastCall()![1]!.headers;
          expect(headers.AUTHORIZATION).toBe("1234");
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
    const link = middleware.concat(createHttpLink({ uri: "/data" }));

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const creds = fetchMock.lastCall()![1]!.credentials;
        expect(creds).toBe("same-team-yo");
      })
    );
  });

  itAsync("adds creds to the request from the setup", (resolve, reject) => {
    const variables = { params: "stub" };
    const link = createHttpLink({ uri: "/data", credentials: "same-team-yo" });

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
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
        createHttpLink({ uri: "/data", credentials: "error" })
      );

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(resolve, reject, (result: any) => {
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
        uri: "/data",
      });
      return forward(operation);
    });
    const link = middleware.concat(createHttpLink());

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const uri = fetchMock.lastUrl();
        expect(uri).toBe("/data");
      })
    );
  });

  itAsync("adds uri to the request from the setup", (resolve, reject) => {
    const variables = { params: "stub" };
    const link = createHttpLink({ uri: "/data" });

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const uri = fetchMock.lastUrl();
        expect(uri).toBe("/data");
      })
    );
  });

  itAsync("prioritizes context uri over setup uri", (resolve, reject) => {
    const variables = { params: "stub" };
    const middleware = new ApolloLink((operation, forward) => {
      operation.setContext({
        uri: "/apollo",
      });
      return forward(operation);
    });
    const link = middleware.concat(
      createHttpLink({ uri: "/data", credentials: "error" })
    );

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const uri = fetchMock.lastUrl();

        expect(uri).toBe("/apollo");
      })
    );
  });

  itAsync("allows uri to be a function", (resolve, reject) => {
    const variables = { params: "stub" };
    const customFetch = (_uri: any, options: any) => {
      const { operationName } = convertBatchedBody(options.body);
      try {
        expect(operationName).toBe("SampleQuery");
      } catch (e) {
        reject(e);
      }
      return fetch("/dataFunc", options);
    };

    const link = createHttpLink({ fetch: customFetch });

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        expect(fetchMock.lastUrl()).toBe("/dataFunc");
      })
    );
  });

  itAsync(
    "adds fetchOptions to the request from the setup",
    (resolve, reject) => {
      const variables = { params: "stub" };
      const link = createHttpLink({
        uri: "/data",
        fetchOptions: { someOption: "foo", mode: "no-cors" },
      });

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(resolve, reject, (result: any) => {
          const { someOption, mode, headers } =
            fetchMock.lastCall()![1]! as any;
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
      const link = middleware.concat(createHttpLink({ uri: "/data" }));

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(resolve, reject, (result: any) => {
          const { someOption } = fetchMock.lastCall()![1]! as any;
          expect(someOption).toBe("foo");
          resolve();
        })
      );
    }
  );

  itAsync("uses the print option function when defined", (resolve, reject) => {
    const customPrinter = jest.fn(
      (ast: ASTNode, originalPrint: typeof print) => {
        return stripIgnoredCharacters(originalPrint(ast));
      }
    );

    const httpLink = createHttpLink({ uri: "data", print: customPrinter });

    execute(httpLink, {
      query: sampleQuery,
    }).subscribe(
      makeCallback(resolve, reject, () => {
        expect(customPrinter).toHaveBeenCalledTimes(1);
      })
    );
  });

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
      createHttpLink({ uri: "/data", fetchOptions: { someOption: "bar" } })
    );

    execute(link, { query: sampleQuery, variables }).subscribe(
      makeCallback(resolve, reject, (result: any) => {
        const { someOption } = fetchMock.lastCall()![1]! as any;
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
      const link = middleware.concat(createHttpLink({ uri: "/data" }));

      execute(link, { query: sampleQuery, variables }).subscribe(
        makeCallback(resolve, reject, (result: any) => {
          let body = convertBatchedBody(fetchMock.lastCall()![1]!.body);

          expect(body.query).not.toBeDefined();
          expect(body.extensions).toEqual({ persistedQuery: { hash: "1234" } });
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

    const link = middleware.concat(createHttpLink({ uri: "/data", fetch }));

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

    expect(JSON.parse(body!.toString())).toEqual([
      {
        query: print(serverQuery),
        variables: {},
      },
    ]);
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
        "BatchHttpLink: Trying to send a client-only query to the server. To send to the server, ensure a non-client field is added to the query or enable the `transformOptions.removeClientFields` option."
      )
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

    it("aborting the internal signal will not cause an error", async () => {
      try {
        fetchMock.restore();
        fetchMock.postOnce(
          "data",
          async () => '{ "data": { "stub": { "id": "foo" } } }'
        );
        const abortControllers = trackGlobalAbortControllers();

        const link = createHttpLink({ uri: "/data" });
        execute(link, { query: sampleQuery }).subscribe(failingObserver);
        abortControllers[0].abort();
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
});
