import fetchMock from "fetch-mock";
import { ASTNode, print, stripIgnoredCharacters } from "graphql";
import { gql } from "graphql-tag";
import { map, Observable, Observer, Subscription } from "rxjs";

import { BatchHttpLink } from "@apollo/client/link/batch-http";
import { ApolloLink, execute, FetchResult } from "@apollo/client/link/core";
import { ObservableStream } from "@apollo/client/testing/internal";

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

  it("handles batched requests", (done) => {
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
      expect(data).toEqual(expectedData);
      nextCalls++;
    };

    const complete = () => {
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
        done();
      }
    };

    const error = (error: any) => {
      throw error;
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

  it("errors on an incorrect number of results for a batch", (done) => {
    const link = new BatchHttpLink({
      uri: "/batch",
      batchInterval: 0,
      batchMax: 3,
    });

    let errors = 0;
    const next = (data: any) => {
      throw new Error("next should not have been called");
    };

    const complete = () => {
      throw new Error("complete should not have been called");
    };

    const error = (error: any) => {
      errors++;

      if (errors === 3) {
        done();
      }
    };

    execute(link, { query: sampleQuery }).subscribe(next, error, complete);
    execute(link, { query: sampleQuery }).subscribe(next, error, complete);
    execute(link, { query: sampleQuery }).subscribe(next, error, complete);
  });

  describe("batchKey", () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;

    it("should batch queries with different options separately", (done) => {
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
        expect(received).toEqual(expected);
      };
      const complete = () => {
        count++;
        if (count === 4) {
          const lawlCalls = fetchMock.calls("begin:/lawl");
          expect(lawlCalls.length).toBe(1);
          const roflCalls = fetchMock.calls("begin:/rofl");
          expect(roflCalls.length).toBe(1);
          done();
        }
      };

      [1, 2].forEach((x) => {
        execute(link, {
          query,
          variables: { endpoint: "/rofl" },
        }).subscribe({
          next: next(roflData),
          error: (error) => {
            throw error;
          },
          complete,
        });

        execute(link, {
          query,
          variables: { endpoint: "/lawl" },
        }).subscribe({
          next: next(lawlData),
          error: (error) => {
            throw error;
          },
          complete,
        });
      });
    });
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

const subscriptions = new Set<Subscription>();

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

  it("calls next and then complete", async () => {
    const link = createHttpLink({ uri: "/data" });
    const observable = execute(link, {
      query: sampleQuery,
    });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitNext();
    await expect(stream).toComplete();
  });

  it("calls error when fetch fails", async () => {
    const link = createHttpLink({ uri: "/error" });
    const observable = execute(link, {
      query: sampleQuery,
    });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitError(mockError.throws);
  });

  it("calls error when fetch fails", async () => {
    const link = createHttpLink({ uri: "/error" });
    const observable = execute(link, {
      query: sampleMutation,
    });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitError(mockError.throws);
  });

  it("strips unused variables, respecting nested fragments", async () => {
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

    const stream = new ObservableStream(execute(link, { query, variables }));

    await expect(stream).toEmitNext();

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
  });

  it("unsubscribes without calling subscriber", async () => {
    const link = createHttpLink({ uri: "/data" });
    const observable = execute(link, {
      query: sampleQuery,
    });
    const stream = new ObservableStream(observable);
    stream.unsubscribe();

    await expect(stream).not.toEmitAnything();
  });

  const verifyRequest = async (
    link: ApolloLink,
    includeExtensions: boolean,
    includeUnusedVariables: boolean
  ) => {
    const context = { info: "stub" };
    const variables = { params: "stub" };

    const observable = execute(link, {
      query: sampleMutation,
      context,
      variables,
    });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitNext();
    await expect(stream).toComplete();

    let body = convertBatchedBody(fetchMock.lastCall()![1]!.body);
    expect(body.query).toBe(print(sampleMutation));
    expect(body.variables).toEqual(includeUnusedVariables ? variables : {});
    expect(body.context).not.toBeDefined();
    if (includeExtensions) {
      expect(body.extensions).toBeDefined();
    } else {
      expect(body.extensions).not.toBeDefined();
    }
  };

  it("passes all arguments to multiple fetch body including extensions", async () => {
    const link = createHttpLink({ uri: "/data", includeExtensions: true });

    await verifyRequest(link, true, false);
    await verifyRequest(link, true, false);
  });

  it("passes all arguments to multiple fetch body excluding extensions", async () => {
    const link = createHttpLink({ uri: "/data" });

    await verifyRequest(link, false, false);
    await verifyRequest(link, false, false);
  });

  it("calls multiple subscribers", (done) => {
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
      done();
    }, 50);
  });

  it("calls remaining subscribers after unsubscribe", (done) => {
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

    setTimeout(() => {
      expect(subscriber.next).toHaveBeenCalledTimes(1);
      expect(subscriber.complete).toHaveBeenCalledTimes(1);
      expect(subscriber.error).not.toHaveBeenCalled();
      done();
    }, 50);
  });

  it("allows for dynamic endpoint setting", async () => {
    const variables = { params: "stub" };
    const link = createHttpLink({ uri: "/data" });

    const stream = new ObservableStream(
      execute(link, {
        query: sampleQuery,
        variables,
        context: { uri: "/data2" },
      })
    );

    await expect(stream).toEmitValue(data2);
  });

  it("adds headers to the request from the context", async () => {
    const variables = { params: "stub" };
    const middleware = new ApolloLink((operation, forward) => {
      operation.setContext({
        headers: { authorization: "1234" },
      });
      return forward(operation).pipe(
        map((result) => {
          const { headers } = operation.getContext();
          expect(headers).toBeDefined();
          return result;
        })
      );
    });
    const link = middleware.concat(createHttpLink({ uri: "/data" }));
    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitNext();

    const headers: Record<string, string> = fetchMock.lastCall()![1]!
      .headers as Record<string, string>;
    expect(headers.authorization).toBe("1234");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers.accept).toBe("application/graphql-response+json");
  });

  it("adds headers to the request from the setup", async () => {
    const variables = { params: "stub" };
    const link = createHttpLink({
      uri: "/data",
      headers: { authorization: "1234" },
    });

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitNext();

    const headers: Record<string, string> = fetchMock.lastCall()![1]!
      .headers as Record<string, string>;
    expect(headers.authorization).toBe("1234");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers.accept).toBe("application/graphql-response+json");
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

  it("prioritizes context headers over setup headers", async () => {
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

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitNext();

    const headers: Record<string, string> = fetchMock.lastCall()![1]!
      .headers as Record<string, string>;
    expect(headers.authorization).toBe("1234");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers.accept).toBe("application/graphql-response+json");
  });

  it("adds headers to the request from the context on an operation", async () => {
    const variables = { params: "stub" };
    const link = createHttpLink({ uri: "/data" });

    const context = {
      headers: { authorization: "1234" },
    };
    const stream = new ObservableStream(
      execute(link, {
        query: sampleQuery,
        variables,
        context,
      })
    );

    await expect(stream).toEmitNext();

    const headers: Record<string, string> = fetchMock.lastCall()![1]!
      .headers as Record<string, string>;
    expect(headers.authorization).toBe("1234");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers.accept).toBe("application/graphql-response+json");
  });

  it("adds headers w/ preserved case to the request from the setup", async () => {
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

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitNext();

    const headers: any = fetchMock.lastCall()![1]!.headers;
    expect(headers.AUTHORIZATION).toBe("1234");
    expect(headers["CONTENT-TYPE"]).toBe("application/json");
    expect(headers.accept).toBe("application/graphql-response+json");
  });

  it("prioritizes context headers w/ preserved case over setup headers", async () => {
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

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitNext();

    const headers: any = fetchMock.lastCall()![1]!.headers;
    expect(headers.AUTHORIZATION).toBe("1234");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers.accept).toBe("application/graphql-response+json");
  });

  it("adds headers w/ preserved case to the request from the context on an operation", async () => {
    const variables = { params: "stub" };
    const link = createHttpLink({ uri: "/data" });

    const context = {
      headers: { AUTHORIZATION: "1234" },
      http: { preserveHeaderCase: true },
    };
    const stream = new ObservableStream(
      execute(link, {
        query: sampleQuery,
        variables,
        context,
      })
    );

    await expect(stream).toEmitNext();

    const headers: any = fetchMock.lastCall()![1]!.headers;
    expect(headers.AUTHORIZATION).toBe("1234");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers.accept).toBe("application/graphql-response+json");
  });

  it("adds creds to the request from the context", async () => {
    const variables = { params: "stub" };
    const middleware = new ApolloLink((operation, forward) => {
      operation.setContext({
        credentials: "same-team-yo",
      });
      return forward(operation);
    });
    const link = middleware.concat(createHttpLink({ uri: "/data" }));

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitNext();

    const creds = fetchMock.lastCall()![1]!.credentials;
    expect(creds).toBe("same-team-yo");
  });

  it("adds creds to the request from the setup", async () => {
    const variables = { params: "stub" };
    const link = createHttpLink({ uri: "/data", credentials: "same-team-yo" });

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitNext();

    const creds = fetchMock.lastCall()![1]!.credentials;
    expect(creds).toBe("same-team-yo");
  });

  it("prioritizes creds from the context over the setup", async () => {
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

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitNext();

    const creds = fetchMock.lastCall()![1]!.credentials;
    expect(creds).toBe("same-team-yo");
  });

  it("adds uri to the request from the context", async () => {
    const variables = { params: "stub" };
    const middleware = new ApolloLink((operation, forward) => {
      operation.setContext({
        uri: "/data",
      });
      return forward(operation);
    });
    const link = middleware.concat(createHttpLink());

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitNext();

    const uri = fetchMock.lastUrl();
    expect(uri).toBe("/data");
  });

  it("adds uri to the request from the setup", async () => {
    const variables = { params: "stub" };
    const link = createHttpLink({ uri: "/data" });

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitNext();

    const uri = fetchMock.lastUrl();
    expect(uri).toBe("/data");
  });

  it("prioritizes context uri over setup uri", async () => {
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

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitNext();

    const uri = fetchMock.lastUrl();
    expect(uri).toBe("/apollo");
  });

  it("allows uri to be a function", async () => {
    const variables = { params: "stub" };
    const customFetch = (_uri: any, options: any) => {
      const { operationName } = convertBatchedBody(options.body);
      expect(operationName).toBe("SampleQuery");
      return fetch("/dataFunc", options);
    };

    const link = createHttpLink({ fetch: customFetch });

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitNext();

    expect(fetchMock.lastUrl()).toBe("/dataFunc");
  });

  it("adds fetchOptions to the request from the setup", async () => {
    const variables = { params: "stub" };
    const link = createHttpLink({
      uri: "/data",
      fetchOptions: { someOption: "foo", mode: "no-cors" },
    });

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitNext();

    const { someOption, mode, headers } = fetchMock.lastCall()![1]! as any;
    expect(someOption).toBe("foo");
    expect(mode).toBe("no-cors");
    expect(headers["content-type"]).toBe("application/json");
  });

  it("adds fetchOptions to the request from the context", async () => {
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

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitNext();

    const { someOption } = fetchMock.lastCall()![1]! as any;
    expect(someOption).toBe("foo");
  });

  it("uses the print option function when defined", async () => {
    const customPrinter = jest.fn(
      (ast: ASTNode, originalPrint: typeof print) => {
        return stripIgnoredCharacters(originalPrint(ast));
      }
    );

    const httpLink = createHttpLink({ uri: "data", print: customPrinter });

    const stream = new ObservableStream(
      execute(httpLink, { query: sampleQuery })
    );

    await expect(stream).toEmitNext();

    expect(customPrinter).toHaveBeenCalledTimes(1);
  });

  it("prioritizes context over setup", async () => {
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

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitNext();

    const { someOption } = fetchMock.lastCall()![1]! as any;
    expect(someOption).toBe("foo");
  });

  it("allows for not sending the query with the request", async () => {
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

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitNext();

    let body = convertBatchedBody(fetchMock.lastCall()![1]!.body);

    expect(body.query).not.toBeDefined();
    expect(body.extensions).toEqual({ persistedQuery: { hash: "1234" } });
  });

  it("sets the raw response on context", async () => {
    const middleware = new ApolloLink((operation, forward) => {
      return new Observable((ob) => {
        const op = forward(operation);
        const sub = op.subscribe({
          next: ob.next.bind(ob),
          error: ob.error.bind(ob),
          complete: () => {
            expect(operation.getContext().response.headers.toBeDefined);
            ob.complete();
          },
        });

        return () => {
          sub.unsubscribe();
        };
      });
    });

    const link = middleware.concat(createHttpLink({ uri: "/data", fetch }));

    const stream = new ObservableStream(execute(link, { query: sampleQuery }));

    await expect(stream).toEmitNext();
    await expect(stream).toComplete();
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
