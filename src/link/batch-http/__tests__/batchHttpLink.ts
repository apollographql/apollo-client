import fetchMock from "fetch-mock";
import type { ASTNode } from "graphql";
import { print, stripIgnoredCharacters } from "graphql";
import { gql } from "graphql-tag";
import type { Subscription } from "rxjs";
import { map, Observable, Subject } from "rxjs";

import {
  ApolloClient,
  InMemoryCache,
  ServerError,
  ServerParseError,
  version,
} from "@apollo/client";
import { ApolloLink } from "@apollo/client/link";
import {
  BaseBatchHttpLink,
  BatchHttpLink,
} from "@apollo/client/link/batch-http";
import { ClientAwarenessLink } from "@apollo/client/link/client-awareness";
import {
  executeWithDefaultContext as execute,
  ObservableStream,
  wait,
} from "@apollo/client/testing/internal";

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
    fetchMock.post("begin:/rofl", makePromise([roflData, roflData]));
    fetchMock.post("begin:/lawl", makePromise([lawlData, lawlData]));
  });

  it("does not need any constructor arguments", () => {
    expect(() => new BatchHttpLink()).not.toThrow();
  });

  it("handles batched requests", async () => {
    fetchMock.post("/batch", makePromise([data, data2]));

    const clientAwareness = {
      name: "Some Client Name",
      version: "1.0.1",
    };

    const link = new BatchHttpLink({
      uri: "/batch",
      batchInterval: 0,
      batchMax: 2,
    });

    const stream1 = new ObservableStream(
      execute(link, {
        query: sampleQuery,
        context: { credentials: "two", clientAwareness },
      })
    );
    const stream2 = new ObservableStream(
      execute(link, {
        query: sampleQuery,
        context: { credentials: "two", clientAwareness },
      })
    );

    await expect(stream1).toEmitTypedValue(data);
    await expect(stream1).toComplete();

    await expect(stream2).toEmitTypedValue(data2);
    await expect(stream2).toComplete();

    expect(fetchMock.calls("/batch").length).toBe(1);

    const options: any = fetchMock.lastOptions("/batch");
    expect(options.credentials).toEqual("two");

    const { headers } = options;
    expect(headers["apollographql-client-name"]).toEqual(clientAwareness.name);
    expect(headers["apollographql-client-version"]).toEqual(
      clientAwareness.version
    );
  });

  it("errors on an incorrect number of results for a batch", async () => {
    fetchMock.post("/batch", makePromise([data, data2]));

    const link = new BatchHttpLink({
      uri: "/batch",
      batchInterval: 0,
      batchMax: 3,
    });

    const stream1 = new ObservableStream(execute(link, { query: sampleQuery }));
    const stream2 = new ObservableStream(execute(link, { query: sampleQuery }));
    const stream3 = new ObservableStream(execute(link, { query: sampleQuery }));

    await expect(stream1).toEmitError(
      new Error("server returned results with length 2, expected length of 3")
    );
    await expect(stream2).toEmitError(
      new Error("server returned results with length 2, expected length of 3")
    );
    await expect(stream3).toEmitError(
      new Error("server returned results with length 2, expected length of 3")
    );
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
        execute(link, { query, variables: { endpoint: "/rofl" } }).subscribe({
          next: next(roflData),
          error: (error) => {
            throw error;
          },
          complete,
        });

        execute(link, { query, variables: { endpoint: "/lawl" } }).subscribe({
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

  it("does not need any constructor arguments", () => {
    expect(() => new BatchHttpLink()).not.toThrow();
  });

  it("calls next and then complete", async () => {
    const link = new BatchHttpLink({ uri: "/data" });
    const observable = execute(link, { query: sampleQuery });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();
  });

  it("calls error when fetch fails", async () => {
    const link = new BatchHttpLink({ uri: "/error" });
    const observable = execute(link, { query: sampleQuery });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitError(mockError.throws);
  });

  it("calls error when fetch fails", async () => {
    const link = new BatchHttpLink({ uri: "/error" });
    const observable = execute(link, { query: sampleMutation });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitError(mockError.throws);
  });

  it("strips unused variables, respecting nested fragments", async () => {
    const link = new BatchHttpLink({ uri: "/data" });

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

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();

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
        extensions: {
          clientLibrary: {
            name: "@apollo/client",
            version,
          },
        },
      },
    ]);
    expect(method).toBe("POST");
    expect(uri).toBe("/data");
  });

  it("unsubscribes without calling subscriber", async () => {
    const link = new BatchHttpLink({ uri: "/data" });
    const observable = execute(link, { query: sampleQuery });
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

    await expect(stream).toEmitTypedValue(data);
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
    const link = new BatchHttpLink({ uri: "/data" });

    await verifyRequest(link, true, false);
    await verifyRequest(link, true, false);
  });

  it("passes all arguments to multiple fetch body excluding extensions", async () => {
    const link = new BatchHttpLink({ uri: "/data", includeExtensions: false });

    await verifyRequest(link, false, false);
    await verifyRequest(link, false, false);
  });

  it("calls multiple subscribers", async () => {
    const link = new BatchHttpLink({ uri: "/data" });
    const context = { info: "stub" };
    const variables = { params: "stub" };

    const observable = execute(link, {
      query: sampleMutation,
      context,
      variables,
    });

    const observer1 = new Subject();
    const stream1 = new ObservableStream(observer1);

    const observer2 = new Subject();
    const stream2 = new ObservableStream(observer2);

    observable.subscribe(observer1);
    observable.subscribe(observer2);

    await expect(stream1).toEmitTypedValue(data);
    await expect(stream2).toEmitTypedValue(data);

    await expect(stream1).toComplete();
    await expect(stream2).toComplete();

    expect(fetchMock.calls().length).toBe(1);
  });

  it("calls remaining subscribers after unsubscribe", async () => {
    const link = new BatchHttpLink({ uri: "/data" });
    const context = { info: "stub" };
    const variables = { params: "stub" };

    const observable = execute(link, {
      query: sampleMutation,
      context,
      variables,
    });

    const observer = new Subject();
    const stream = new ObservableStream(observer);

    observable.subscribe(observer);

    await wait(10);

    const subscription = observable.subscribe(subscriber);
    subscription.unsubscribe();

    await wait(50);

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();
  });

  it("allows for dynamic endpoint setting", async () => {
    const variables = { params: "stub" };
    const link = new BatchHttpLink({ uri: "/data" });

    const stream = new ObservableStream(
      execute(link, {
        query: sampleQuery,
        variables,
        context: { uri: "/data2" },
      })
    );

    await expect(stream).toEmitTypedValue(data2);
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
    const link = middleware.concat(new BatchHttpLink({ uri: "/data" }));
    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();

    const headers: Record<string, string> = fetchMock.lastCall()![1]!
      .headers as Record<string, string>;
    expect(headers.authorization).toBe("1234");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers.accept).toBe(
      "application/graphql-response+json,application/json;q=0.9"
    );
  });

  it("adds headers to the request from the setup", async () => {
    const variables = { params: "stub" };
    const link = new BatchHttpLink({
      uri: "/data",
      headers: { authorization: "1234" },
    });

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();

    const headers: Record<string, string> = fetchMock.lastCall()![1]!
      .headers as Record<string, string>;
    expect(headers.authorization).toBe("1234");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers.accept).toBe(
      "application/graphql-response+json,application/json;q=0.9"
    );
  });

  it("uses the latest window.fetch function if options.fetch not configured", async () => {
    const httpLink = new BatchHttpLink({ uri: "data" });

    const fetch = window.fetch;
    expect(typeof fetch).toBe("function");

    const fetchSpy = jest.spyOn(window, "fetch");
    fetchSpy.mockImplementation(() =>
      Promise.resolve(
        Response.json(
          { data: { hello: "from spy" } },
          { headers: { "content-type": "application/json" } }
        )
      )
    );

    const spyFn = window.fetch;
    expect(spyFn).not.toBe(fetch);

    using stream = new ObservableStream(
      execute(httpLink, { query: sampleQuery })
    );

    await expect(stream).toEmitTypedValue({
      data: { hello: "from spy" },
    });
    await expect(stream).toComplete();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();

    using stream2 = new ObservableStream(
      execute(httpLink, { query: sampleQuery })
    );

    await expect(stream2).toEmitTypedValue({ data: { hello: "world" } });
    await expect(stream2).toComplete();
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
      new BatchHttpLink({
        uri: "/data",
        headers: { authorization: "no user" },
      })
    );

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();

    const headers: Record<string, string> = fetchMock.lastCall()![1]!
      .headers as Record<string, string>;
    expect(headers.authorization).toBe("1234");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers.accept).toBe(
      "application/graphql-response+json,application/json;q=0.9"
    );
  });

  it("adds headers to the request from the context on an operation", async () => {
    const variables = { params: "stub" };
    const link = new BatchHttpLink({ uri: "/data" });

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

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();

    const headers: Record<string, string> = fetchMock.lastCall()![1]!
      .headers as Record<string, string>;
    expect(headers.authorization).toBe("1234");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers.accept).toBe(
      "application/graphql-response+json,application/json;q=0.9"
    );
  });

  it("adds headers w/ preserved case to the request from the setup", async () => {
    const variables = { params: "stub" };
    const link = new BatchHttpLink({
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

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();

    const headers: any = fetchMock.lastCall()![1]!.headers;
    expect(headers.AUTHORIZATION).toBe("1234");
    expect(headers["CONTENT-TYPE"]).toBe("application/json");
    expect(headers.accept).toBe(
      "application/graphql-response+json,application/json;q=0.9"
    );
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
      new BatchHttpLink({
        uri: "/data",
        headers: { authorization: "no user" },
        preserveHeaderCase: false,
      })
    );

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();

    const headers: any = fetchMock.lastCall()![1]!.headers;
    expect(headers.AUTHORIZATION).toBe("1234");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers.accept).toBe(
      "application/graphql-response+json,application/json;q=0.9"
    );
  });

  it("adds headers w/ preserved case to the request from the context on an operation", async () => {
    const variables = { params: "stub" };
    const link = new BatchHttpLink({ uri: "/data" });

    const context = {
      headers: { AUTHORIZATION: "1234" },
      http: { preserveHeaderCase: true },
    };
    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables, context })
    );

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();

    const headers: any = fetchMock.lastCall()![1]!.headers;
    expect(headers.AUTHORIZATION).toBe("1234");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers.accept).toBe(
      "application/graphql-response+json,application/json;q=0.9"
    );
  });

  it("adds creds to the request from the context", async () => {
    const variables = { params: "stub" };
    const middleware = new ApolloLink((operation, forward) => {
      operation.setContext({
        credentials: "same-team-yo",
      });
      return forward(operation);
    });
    const link = middleware.concat(new BatchHttpLink({ uri: "/data" }));

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();

    const creds = fetchMock.lastCall()![1]!.credentials;
    expect(creds).toBe("same-team-yo");
  });

  it("adds creds to the request from the setup", async () => {
    const variables = { params: "stub" };
    const link = new BatchHttpLink({
      uri: "/data",
      credentials: "include",
    });

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();

    const creds = fetchMock.lastCall()![1]!.credentials;
    expect(creds).toBe("include");
  });

  it("prioritizes creds from the context over the setup", async () => {
    const variables = { params: "stub" };
    const middleware = new ApolloLink((operation, forward) => {
      operation.setContext({
        credentials: "omit",
      });
      return forward(operation);
    });
    const link = middleware.concat(
      new BatchHttpLink({ uri: "/data", credentials: "include" })
    );

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();

    const creds = fetchMock.lastCall()![1]!.credentials;
    expect(creds).toBe("omit");
  });

  it("adds uri to the request from the context", async () => {
    const variables = { params: "stub" };
    const middleware = new ApolloLink((operation, forward) => {
      operation.setContext({
        uri: "/data",
      });
      return forward(operation);
    });
    const link = middleware.concat(new BatchHttpLink());

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();

    const uri = fetchMock.lastUrl();
    expect(uri).toBe("/data");
  });

  it("adds uri to the request from the setup", async () => {
    const variables = { params: "stub" };
    const link = new BatchHttpLink({ uri: "/data" });

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();

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
      new BatchHttpLink({ uri: "/data", credentials: "include" })
    );

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();

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

    const link = new BatchHttpLink({ fetch: customFetch });

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();

    expect(fetchMock.lastUrl()).toBe("/dataFunc");
  });

  it("adds fetchOptions to the request from the setup", async () => {
    const variables = { params: "stub" };
    const link = new BatchHttpLink({
      uri: "/data",
      fetchOptions: { mode: "no-cors" },
    });

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();

    const { mode, headers } = fetchMock.lastCall()![1]! as any;
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
    const link = middleware.concat(new BatchHttpLink({ uri: "/data" }));

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();

    const { someOption } = fetchMock.lastCall()![1]! as any;
    expect(someOption).toBe("foo");
  });

  it("uses the print option function when defined", async () => {
    const customPrinter = jest.fn(
      (ast: ASTNode, originalPrint: typeof print) => {
        return stripIgnoredCharacters(originalPrint(ast));
      }
    );

    const httpLink = new BatchHttpLink({ uri: "data", print: customPrinter });

    const stream = new ObservableStream(
      execute(httpLink, { query: sampleQuery })
    );

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();

    expect(customPrinter).toHaveBeenCalledTimes(1);
  });

  it("prioritizes context over setup", async () => {
    const variables = { params: "stub" };
    const middleware = new ApolloLink((operation, forward) => {
      operation.setContext({
        fetchOptions: {
          mode: "cors",
        },
      });
      return forward(operation);
    });
    const link = middleware.concat(
      new BatchHttpLink({ uri: "/data", fetchOptions: { mode: "no-cors" } })
    );

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();

    const { mode } = fetchMock.lastCall()![1]! as any;
    expect(mode).toBe("cors");
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
    const link = middleware.concat(new BatchHttpLink({ uri: "/data" }));

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery, variables })
    );

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();

    let body = convertBatchedBody(fetchMock.lastCall()![1]!.body);

    expect(body.query).not.toBeDefined();
    expect(body.extensions).toEqual({
      persistedQuery: { hash: "1234" },
      clientLibrary: {
        name: "@apollo/client",
        version,
      },
    });
  });

  it("sets the raw response on context", async () => {
    const middleware = new ApolloLink((operation, forward) => {
      return new Observable((ob) => {
        const op = forward(operation);
        const sub = op.subscribe({
          next: ob.next.bind(ob),
          error: ob.error.bind(ob),
          complete: () => {
            expect(operation.getContext().response.headers).toBeDefined();
            ob.complete();
          },
        });

        return () => {
          sub.unsubscribe();
        };
      });
    });

    const link = middleware.concat(new BatchHttpLink({ uri: "/data", fetch }));

    const stream = new ObservableStream(execute(link, { query: sampleQuery }));

    await expect(stream).toEmitTypedValue(data);
    await expect(stream).toComplete();
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

    it("aborts the request when unsubscribing before the request has completed", async () => {
      const fetch = jest.fn(async () => {
        return Response.json(
          { data: { stub: { id: "foo" } } },
          { status: 200 }
        );
      });
      const abortControllers = trackGlobalAbortControllers();

      const link = new BatchHttpLink({
        uri: "data",
        fetch,
        batchMax: 1,
      });

      const stream = new ObservableStream(
        execute(link, { query: sampleQuery })
      );
      stream.unsubscribe();

      await expect(stream).not.toEmitAnything();

      expect(abortControllers.length).toBe(1);
      expect(abortControllers[0].signal.aborted).toBe(true);
    });

    it("a passed-in signal will be forwarded to the `fetch` call and not be overwritten by an internally-created one", () => {
      const fetch = jest.fn(async () => {
        return Response.json(
          { data: { stub: { id: "foo" } } },
          { status: 200 }
        );
      });
      const externalAbortController = new AbortController();

      const link = new BatchHttpLink({
        uri: "data",
        fetch,
        fetchOptions: { signal: externalAbortController.signal },
        batchMax: 1,
      });

      const stream = new ObservableStream(
        execute(link, { query: sampleQuery })
      );
      stream.unsubscribe();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        "data",
        expect.objectContaining({ signal: externalAbortController.signal })
      );
    });

    it("aborting the internal signal emits abort error", async () => {
      try {
        fetchMock.restore();
        fetchMock.postOnce(
          "data",
          async () => '{ "data": { "stub": { "id": "foo" } } }'
        );
        const abortControllers = trackGlobalAbortControllers();

        const link = new BatchHttpLink({ uri: "/data", batchMax: 1 });
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery })
        );
        abortControllers[0].abort();

        await expect(stream).toEmitError(
          new DOMException("The operation was aborted.", "AbortError")
        );
      } finally {
        fetchMock.restore();
      }
    });

    it("resolving fetch does not cause the AbortController to be aborted", async () => {
      const abortControllers = trackGlobalAbortControllers();

      const link = new BatchHttpLink({
        uri: "data",
        fetch: async () => {
          return Response.json({ data: { hello: "world" } }, { status: 200 });
        },
        batchMax: 1,
      });

      const stream = new ObservableStream(
        execute(link, { query: sampleQuery })
      );

      await expect(stream).toEmitTypedValue({ data: { hello: "world" } });
      await expect(stream).toComplete();

      expect(abortControllers.length).toBe(1);
      expect(abortControllers[0].signal.aborted).toBe(false);
    });

    it("an unsuccessful fetch does not cause the AbortController to be aborted", async () => {
      const abortControllers = trackGlobalAbortControllers();

      const link = new BatchHttpLink({
        uri: "data",
        fetch: async () => {
          throw new Error("Could not connect to network");
        },
        batchMax: 1,
      });

      const stream = new ObservableStream(
        execute(link, { query: sampleQuery })
      );

      await expect(stream).toEmitError();

      expect(abortControllers.length).toBe(1);
      expect(abortControllers[0].signal.aborted).toBe(false);
    });
  });
});

describe("GraphQL over HTTP", () => {
  test("emits result when content-type is not set with well formed GraphQL response", async () => {
    const query = gql`
      query {
        foo
      }
    `;

    const response = Response.json({ data: { foo: true } }, { status: 200 });
    response.headers.delete("content-type");

    const link = new BatchHttpLink({
      uri: "/graphql",
      fetch: async () => response,
    });
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitTypedValue({ data: { foo: true } });
    await expect(stream).toComplete();
  });

  test("emits ServerError when content-type is not set with malformed GraphQL response", async () => {
    const query = gql`
      query Foo {
        foo
      }
    `;

    const response = Response.json({ foo: true }, { status: 200 });
    response.headers.delete("content-type");

    const link = new BatchHttpLink({
      uri: "/graphql",
      fetch: async () => response,
    });
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitError(
      new ServerError("Server response was malformed for query 'Foo'.", {
        response,
        bodyText: JSON.stringify({ foo: true }),
      })
    );
  });

  test("emits ServerParseError when content-type is not set with unparsable JSON body", async () => {
    const query = gql`
      query {
        foo
      }
    `;

    const response = new Response("This is a response", { status: 200 });
    response.headers.delete("content-type");

    const link = new BatchHttpLink({
      uri: "/graphql",
      fetch: async () => response,
    });
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitError(
      new ServerParseError(
        new Error(
          `Unexpected token 'T', "This is a response" is not valid JSON`
        ),
        {
          response,
          bodyText: "This is a response",
        }
      )
    );
  });

  test("emits ServerError when content-type is not set with well formed GraphQL response and non-200 status code", async () => {
    const query = gql`
      query {
        foo
      }
    `;

    const response = Response.json(
      { data: null, errors: [{ message: "Something went wrong" }] },
      { status: 400 }
    );
    response.headers.delete("content-type");

    const link = new BatchHttpLink({
      uri: "/graphql",
      fetch: async () => response,
    });
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitError(
      new ServerError("Response not successful: Received status code 400", {
        response,
        bodyText: JSON.stringify({
          data: null,
          errors: [{ message: "Something went wrong" }],
        }),
      })
    );
  });

  test("emits ServerError when responding with application/json and non-200 status code with malformed GraphQL response", async () => {
    const query = gql`
      query {
        foo
      }
    `;

    const response = Response.json(
      { error: "Could not process request" },
      {
        status: 400,
        headers: { "content-type": "application/json" },
      }
    );

    const link = new BatchHttpLink({
      uri: "/graphql",
      fetch: async () => response,
    });
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitError(
      new ServerError("Response not successful: Received status code 400", {
        response,
        bodyText: JSON.stringify({
          error: "Could not process request",
        }),
      })
    );
  });

  test("emits ServerError when responding with application/json and non-200 status code with well-formed GraphQL response", async () => {
    const query = gql`
      query {
        foo
      }
    `;

    const response = Response.json(
      { data: null, errors: [{ message: "Could not process request" }] },
      { status: 400, headers: { "content-type": "application/json" } }
    );

    const link = new BatchHttpLink({
      uri: "/graphql",
      fetch: async () => response,
    });
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitError(
      new ServerError("Response not successful: Received status code 400", {
        response,
        bodyText: JSON.stringify({
          data: null,
          errors: [{ message: "Could not process request" }],
        }),
      })
    );
  });

  test("emits result when responding with a non-json mime type and 200 response with well formed GraphQL response", async () => {
    const query = gql`
      query {
        foo
      }
    `;

    const response = Response.json(
      { data: null, errors: [{ message: "Could not process request" }] },
      {
        status: 200,
        headers: { "content-type": "text/plain" },
      }
    );

    const link = new BatchHttpLink({
      uri: "/graphql",
      fetch: async () => response,
    });
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitTypedValue({
      data: null,
      errors: [{ message: "Could not process request" }],
    });
    await expect(stream).toComplete();
  });

  test("handles 200 response with application/graphql-response+json", async () => {
    const query = gql`
      query {
        foo
      }
    `;

    const response = Response.json(
      { data: { foo: "bar" } },
      {
        status: 200,
        headers: { "content-type": "application/graphql-response+json" },
      }
    );

    const link = new BatchHttpLink({
      uri: "/graphql",
      fetch: async () => response,
    });

    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitTypedValue({ data: { foo: "bar" } });
    await expect(stream).toComplete();
  });

  test("parses non-200 response with application/graphql-response+json", async () => {
    const query = gql`
      query {
        foo
      }
    `;

    const response = Response.json(
      { data: null, errors: [{ message: "Could not process request" }] },
      {
        status: 400,
        headers: { "content-type": "application/graphql-response+json" },
      }
    );

    const link = new BatchHttpLink({
      uri: "/graphql",
      fetch: async () => response,
    });

    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitTypedValue({
      data: null,
      errors: [{ message: "Could not process request" }],
    });
    await expect(stream).toComplete();
  });

  test("parses 200 response with application/graphql-response+json and errors", async () => {
    const query = gql`
      query {
        foo
      }
    `;

    const response = Response.json(
      { data: null, errors: [{ message: "Could not process request" }] },
      {
        status: 200,
        headers: { "content-type": "application/graphql-response+json" },
      }
    );

    const link = new BatchHttpLink({
      uri: "/graphql",
      fetch: async () => response,
    });

    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitTypedValue({
      data: null,
      errors: [{ message: "Could not process request" }],
    });
    await expect(stream).toComplete();
  });
});

describe("client awareness", () => {
  const query = gql`
    query {
      hello
    }
  `;
  const response = {
    data: { hello: "world" },
  };
  const uri = "https://example.com/graphql";

  afterEach(() => fetchMock.reset());

  test("is part of `BatchHttpLink`", async () => {
    fetchMock.postOnce(uri, [response, response]);
    const client = new ApolloClient({
      link: new BatchHttpLink({
        uri,
      }),
      cache: new InMemoryCache(),
      clientAwareness: {
        name: "test-client",
        version: "1.0.0",
      },
    });

    void client.query({ query });
    void client.query({ query, context: { queryDeduplication: false } });
    await wait(10);

    const headers = fetchMock.lastCall()![1]?.headers;
    expect(headers).toStrictEqual({
      accept: "application/graphql-response+json,application/json;q=0.9",
      "content-type": "application/json",
      "apollographql-client-name": "test-client",
      "apollographql-client-version": "1.0.0",
    });
  });

  test("is not part of `BaseBatchHttpLink`", async () => {
    fetchMock.postOnce(uri, response);
    const client = new ApolloClient({
      link: new BaseBatchHttpLink({
        uri,
      }),
      cache: new InMemoryCache(),
      clientAwareness: {
        name: "test-client",
        version: "1.0.0",
      },
    });

    void client.query({ query });
    await wait(10);

    const headers = fetchMock.lastCall()![1]?.headers;
    expect(headers).toStrictEqual({
      accept: "application/graphql-response+json,application/json;q=0.9",
      "content-type": "application/json",
    });
  });

  test("`BatchHttpLink` options have priority over `ApolloClient` options", async () => {
    fetchMock.postOnce(uri, response);
    const client = new ApolloClient({
      link: new BatchHttpLink({
        uri,

        clientAwareness: {
          name: "overridden-client",
          version: "2.0.0",
        },
      }),
      cache: new InMemoryCache(),

      clientAwareness: {
        name: "test-client",
        version: "1.0.0",
      },
    });

    void client.query({ query });
    await wait(10);

    const headers = fetchMock.lastCall()![1]?.headers;
    expect(headers).toStrictEqual({
      accept: "application/graphql-response+json,application/json;q=0.9",
      "content-type": "application/json",
      "apollographql-client-name": "overridden-client",
      "apollographql-client-version": "2.0.0",
    });
  });

  test("will batch requests with equal options", async () => {
    fetchMock.postOnce(uri, [response, response]);
    const client = new ApolloClient({
      link: new BatchHttpLink({
        uri,
      }),
      cache: new InMemoryCache(),

      clientAwareness: {
        name: "test-client",
        version: "1.0.0",
      },
    });

    void client.query({ query, context: { queryDeduplication: false } });
    void client.query({ query, context: { queryDeduplication: false } });
    await wait(10);

    const headers = fetchMock.lastCall()![1]?.headers;
    expect(headers).toStrictEqual({
      accept: "application/graphql-response+json,application/json;q=0.9",
      "content-type": "application/json",
      "apollographql-client-name": "test-client",
      "apollographql-client-version": "1.0.0",
    });
  });

  test("will not batch requests with different options", async () => {
    fetchMock.post(uri, [response], { repeat: 2 });
    const client = new ApolloClient({
      link: new BatchHttpLink({
        uri,
      }),
      cache: new InMemoryCache(),

      clientAwareness: {
        name: "test-client",
        version: "1.0.0",
      },
    });

    void client.query({ query, context: { queryDeduplication: false } });
    void client.query({
      query,
      context: {
        queryDeduplication: false,
        clientAwareness: {
          name: "overridden-client",
          version: "2.0.0",
        },
      },
    });
    await wait(10);

    expect(fetchMock.calls()[0][1]?.headers).toStrictEqual({
      accept: "application/graphql-response+json,application/json;q=0.9",
      "content-type": "application/json",
      "apollographql-client-name": "test-client",
      "apollographql-client-version": "1.0.0",
    });
    expect(fetchMock.calls()[1][1]?.headers).toStrictEqual({
      accept: "application/graphql-response+json,application/json;q=0.9",
      "content-type": "application/json",
      "apollographql-client-name": "overridden-client",
      "apollographql-client-version": "2.0.0",
    });
  });
});

describe("enhanced client awareness", () => {
  const query = gql`
    query {
      hello
    }
  `;
  const response = {
    data: { hello: "world" },
  };
  const uri = "https://example.com/graphql";

  afterEach(() => fetchMock.reset());

  test("is part of `BatchHttpLink`", async () => {
    fetchMock.postOnce(uri, [response, response]);
    const client = new ApolloClient({
      link: new BatchHttpLink({
        uri,
      }),
      cache: new InMemoryCache(),
    });

    void client.query({ query });
    void client.query({ query, context: { queryDeduplication: false } });
    await wait(10);

    const body = JSON.parse(fetchMock.lastCall()![1]?.body as string);
    expect(body[0].extensions).toStrictEqual({
      clientLibrary: {
        name: "@apollo/client",
        version,
      },
    });
    expect(body[1].extensions).toStrictEqual({
      clientLibrary: {
        name: "@apollo/client",
        version,
      },
    });
  });

  test("is not part of `BaseBatchHttpLink`", async () => {
    fetchMock.postOnce(uri, [response, response]);
    const client = new ApolloClient({
      link: new BaseBatchHttpLink({
        uri,
      }),
      cache: new InMemoryCache(),
    });

    void client.query({ query });
    void client.query({ query, context: { queryDeduplication: false } });
    await wait(10);

    const body = JSON.parse(fetchMock.lastCall()![1]?.body as string);
    expect(body[0].extensions).not.toBeDefined();
    expect(body[1].extensions).not.toBeDefined();
  });

  test("can be disabled by disabling `includeExtensions`", async () => {
    fetchMock.postOnce(uri, [response, response]);
    const client = new ApolloClient({
      link: new BatchHttpLink({
        uri,
        includeExtensions: false,
      }),
      cache: new InMemoryCache(),
    });

    void client.query({ query });
    void client.query({ query, context: { queryDeduplication: false } });
    await wait(10);

    const body = JSON.parse(fetchMock.lastCall()![1]?.body as string);
    expect(body[0].extensions).not.toBeDefined();
    expect(body[1].extensions).not.toBeDefined();
  });

  test("can send mixed requests with ECA enabled and disabled", async () => {
    fetchMock.postOnce(uri, [response, response]);
    const client = new ApolloClient({
      link: ApolloLink.split(
        (operation) => operation.variables.a === 1,
        new ClientAwarenessLink({
          enhancedClientAwareness: { transport: "extensions" },
        }),
        new ClientAwarenessLink({
          enhancedClientAwareness: { transport: false },
        })
      ).concat(new BaseBatchHttpLink({ uri })),
      cache: new InMemoryCache(),
    });

    void client.query({ query, variables: { a: 1 } });
    void client.query({
      query,
      variables: { a: 2 },
    });
    await wait(10);

    const body = JSON.parse(fetchMock.lastCall()![1]?.body as string);
    expect(body[0].extensions).toStrictEqual({
      clientLibrary: {
        name: "@apollo/client",
        version,
      },
    });
    expect(body[1].extensions).not.toBeDefined();
  });
});
