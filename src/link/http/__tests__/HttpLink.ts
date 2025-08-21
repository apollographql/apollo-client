import { TextDecoder } from "util";

import fetchMock from "fetch-mock";
import type { ASTNode } from "graphql";
import { print, stripIgnoredCharacters } from "graphql";
import { gql } from "graphql-tag";
import type { Observer, Subscription } from "rxjs";
import { map, Observable, Subject, tap } from "rxjs";
import { ReadableStream } from "web-streams-polyfill";

import {
  ApolloClient,
  InMemoryCache,
  ServerError,
  version,
} from "@apollo/client";
import {
  CombinedProtocolErrors,
  PROTOCOL_ERRORS_SYMBOL,
  ServerParseError,
} from "@apollo/client/errors";
import { Defer20220824Handler } from "@apollo/client/incremental";
import { ApolloLink } from "@apollo/client/link";
import { BaseHttpLink, HttpLink } from "@apollo/client/link/http";
import {
  executeWithDefaultContext as execute,
  ObservableStream,
  wait,
} from "@apollo/client/testing/internal";

import { voidFetchDuringEachTest } from "./helpers.js";

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

function convertBatchedBody(body: BodyInit | null | undefined) {
  return JSON.parse(body as string);
}

describe("HttpLink", () => {
  describe("General", () => {
    const data = { data: { hello: "world" } };
    const data2 = { data: { hello: "everyone" } };
    const mockError = { throws: new TypeError("mock me") };
    let subscriber: Observer<any>;
    const subscriptions = new Set<Subscription>();

    beforeEach(() => {
      fetchMock.restore();
      fetchMock.post("begin:/data2", Promise.resolve(data2));
      fetchMock.post("begin:/data", Promise.resolve(data));
      fetchMock.post("begin:/error", mockError);
      fetchMock.post("begin:/apollo", Promise.resolve(data));

      fetchMock.get("begin:/data", Promise.resolve(data));
      fetchMock.get("begin:/data2", Promise.resolve(data2));

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

    it("constructor creates link that can call next and then complete", async () => {
      const link = new HttpLink({ uri: "/data" });
      const observable = execute(link, {
        query: sampleQuery,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);
      await expect(stream).toComplete();
    });

    it("supports using a GET request", async () => {
      const variables = { params: "stub" };
      const extensions = { myExtension: "foo" };

      const link = new HttpLink({
        uri: "/data",
        fetchOptions: { method: "GET" },
        includeExtensions: true,
        includeUnusedVariables: true,
      });

      const observable = execute(link, {
        query: sampleQuery,
        variables,
        extensions,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);
      await expect(stream).toComplete();

      const [uri, options] = fetchMock.lastCall()!;
      const { method, body } = options!;

      expect(body).toBeUndefined();
      expect(method).toBe("GET");

      expect(uri).toBe(
        `/data?query=query%20SampleQuery%20%7B%0A%20%20stub%20%7B%0A%20%20%20%20id%0A%20%20%7D%0A%7D&operationName=SampleQuery&variables=%7B%22params%22%3A%22stub%22%7D&extensions=%7B%22clientLibrary%22%3A%7B%22name%22%3A%22%40apollo%2Fclient%22%2C%22version%22%3A%22${version}%22%7D%2C%22myExtension%22%3A%22foo%22%7D`
      );
    });

    it("supports using a GET request with search", async () => {
      const variables = { params: "stub" };

      const link = new HttpLink({
        uri: "/data?foo=bar",
        fetchOptions: { method: "GET" },
      });
      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);
      await expect(stream).toComplete();

      const [uri, options] = fetchMock.lastCall()!;
      const { method, body } = options!;

      expect(body).toBeUndefined();
      expect(method).toBe("GET");
      expect(uri).toBe(
        `/data?foo=bar&query=query%20SampleQuery%20%7B%0A%20%20stub%20%7B%0A%20%20%20%20id%0A%20%20%7D%0A%7D&operationName=SampleQuery&variables=%7B%7D&extensions=%7B%22clientLibrary%22%3A%7B%22name%22%3A%22%40apollo%2Fclient%22%2C%22version%22%3A%22${version}%22%7D%7D`
      );
    });

    it("supports using a GET request on the context", async () => {
      const variables = { params: "stub" };
      const link = new HttpLink({
        uri: "/data",
      });

      const observable = execute(link, {
        query: sampleQuery,
        variables,
        context: {
          fetchOptions: { method: "GET" },
        },
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);
      await expect(stream).toComplete();

      const [uri, options] = fetchMock.lastCall()!;
      const { method, body } = options!;

      expect(body).toBeUndefined();
      expect(method).toBe("GET");
      expect(uri).toBe(
        `/data?query=query%20SampleQuery%20%7B%0A%20%20stub%20%7B%0A%20%20%20%20id%0A%20%20%7D%0A%7D&operationName=SampleQuery&variables=%7B%7D&extensions=%7B%22clientLibrary%22%3A%7B%22name%22%3A%22%40apollo%2Fclient%22%2C%22version%22%3A%22${version}%22%7D%7D`
      );
    });

    it("uses GET with useGETForQueries", async () => {
      const variables = { params: "stub" };
      const link = new HttpLink({
        uri: "/data",
        useGETForQueries: true,
      });

      const observable = execute(link, {
        query: sampleQuery,
        variables,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);
      await expect(stream).toComplete();

      const [uri, options] = fetchMock.lastCall()!;
      const { method, body } = options!;
      expect(body).toBeUndefined();
      expect(method).toBe("GET");
      expect(uri).toBe(
        `/data?query=query%20SampleQuery%20%7B%0A%20%20stub%20%7B%0A%20%20%20%20id%0A%20%20%7D%0A%7D&operationName=SampleQuery&variables=%7B%7D&extensions=%7B%22clientLibrary%22%3A%7B%22name%22%3A%22%40apollo%2Fclient%22%2C%22version%22%3A%22${version}%22%7D%7D`
      );
    });

    it("uses POST for mutations with useGETForQueries", async () => {
      const variables = { params: "stub" };
      const link = new HttpLink({
        uri: "/data",
        useGETForQueries: true,
      });

      const observable = execute(link, {
        query: sampleMutation,
        variables,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);
      await expect(stream).toComplete();

      const [uri, options] = fetchMock.lastCall()!;
      const { method, body } = options!;

      expect(body).toBeDefined();
      expect(method).toBe("POST");
      expect(uri).toBe("/data");
    });

    it("strips unused variables, respecting nested fragments", async () => {
      const link = new HttpLink({ uri: "/data" });

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

      const observable = execute(link, {
        query,
        variables,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);
      await expect(stream).toComplete();

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
        extensions: {
          clientLibrary: {
            name: "@apollo/client",
            version,
          },
        },
      });
      expect(method).toBe("POST");
      expect(uri).toBe("/data");
    });

    it("should not add empty client awareness settings to request headers", async () => {
      const variables = { params: "stub" };
      const link = new HttpLink({
        uri: "/data",
      });

      const hasOwn = Object.prototype.hasOwnProperty;
      const clientAwareness = {};
      const observable = execute(link, {
        query: sampleQuery,
        variables,
        context: {
          clientAwareness,
        },
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);
      await expect(stream).toComplete();

      const [, options] = fetchMock.lastCall()!;
      const { headers } = options as any;
      expect(hasOwn.call(headers, "apollographql-client-name")).toBe(false);
      expect(hasOwn.call(headers, "apollographql-client-version")).toBe(false);
    });

    it("throws for GET if the variables can't be stringified", async () => {
      const link = new HttpLink({
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
      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      const error = await stream.takeError();

      expect(error.message).toMatch(/Converting circular structure to JSON/);
    });

    it("throws for GET if the extensions can't be stringified", async () => {
      const link = new HttpLink({
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
      const observable = execute(link, { query: sampleQuery, extensions });
      const stream = new ObservableStream(observable);

      const error = await stream.takeError();

      expect(error.message).toMatch(/Converting circular structure to JSON/);
    });

    it("does not need any constructor arguments", () => {
      expect(() => new HttpLink()).not.toThrow();
    });

    it("calls next and then complete", async () => {
      const link = new HttpLink({ uri: "data" });
      const observable = execute(link, {
        query: sampleQuery,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);
      await expect(stream).toComplete();
    });

    it("calls error when fetch fails", async () => {
      const link = new HttpLink({ uri: "error" });
      const observable = execute(link, {
        query: sampleQuery,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitError(mockError.throws);
    });

    it("calls error when fetch fails", async () => {
      const link = new HttpLink({ uri: "error" });
      const observable = execute(link, {
        query: sampleMutation,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitError(mockError.throws);
    });

    it("unsubscribes without calling subscriber", async () => {
      const link = new HttpLink({ uri: "data" });
      const observable = execute(link, {
        query: sampleQuery,
      });
      const subscription = observable.subscribe(
        () => {
          throw new Error("next should not have been called");
        },
        (error) => {
          throw error;
        },
        () => {
          throw "complete should not have been called";
        }
      );
      subscription.unsubscribe();

      expect(subscription.closed).toBe(true);

      // Ensure none of the callbacks throw after our assertion
      await wait(10);
    });

    const verifyRequest = async (
      link: ApolloLink,
      includeExtensions: boolean
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
      expect(body.variables).toEqual({});
      expect(body.context).not.toBeDefined();
      if (includeExtensions) {
        expect(body.extensions).toBeDefined();
      } else {
        expect(body.extensions).not.toBeDefined();
      }
    };

    it("passes all arguments to multiple fetch body including extensions", async () => {
      const link = new HttpLink({ uri: "data", includeExtensions: true });

      await verifyRequest(link, true);
      await verifyRequest(link, true);
    });

    it("passes all arguments to multiple fetch body excluding extensions", async () => {
      const link = new HttpLink({ uri: "data", includeExtensions: false });

      await verifyRequest(link, false);
      await verifyRequest(link, false);
    });

    it("calls multiple subscribers", async () => {
      const link = new HttpLink({ uri: "data" });
      const context = { info: "stub" };
      const variables = { params: "stub" };

      const observable = execute(link, {
        query: sampleMutation,
        context,
        variables,
      });
      observable.subscribe(subscriber);
      observable.subscribe(subscriber);

      await wait(50);

      expect(subscriber.next).toHaveBeenCalledTimes(2);
      expect(subscriber.complete).toHaveBeenCalledTimes(2);
      expect(subscriber.error).not.toHaveBeenCalled();
      expect(fetchMock.calls().length).toBe(2);
    });

    it("calls remaining subscribers after unsubscribe", async () => {
      const link = new HttpLink({ uri: "data" });
      const context = { info: "stub" };
      const variables = { params: "stub" };

      const observable = execute(link, {
        query: sampleMutation,
        context,
        variables,
      });

      observable.subscribe(subscriber);

      await wait(10);

      const subscription = observable.subscribe(subscriber);
      subscription.unsubscribe();

      await wait(50);

      expect(subscriber.next).toHaveBeenCalledTimes(1);
      expect(subscriber.complete).toHaveBeenCalledTimes(1);
      expect(subscriber.error).not.toHaveBeenCalled();
    });

    it("allows for dynamic endpoint setting", async () => {
      const variables = { params: "stub" };
      const link = new HttpLink({ uri: "data" });

      const observable = execute(link, {
        query: sampleQuery,
        variables,
        context: { uri: "data2" },
      });
      const stream = new ObservableStream(observable);

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
      const link = middleware.concat(new HttpLink({ uri: "data" }));

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      const headers = fetchMock.lastCall()![1]!.headers as any;

      expect(headers.authorization).toBe("1234");
      expect(headers["content-type"]).toBe("application/json");
      expect(headers.accept).toBe(
        "application/graphql-response+json,application/json;q=0.9"
      );
    });

    it("adds headers to the request from the setup", async () => {
      const variables = { params: "stub" };
      const link = new HttpLink({
        uri: "data",
        headers: { authorization: "1234" },
      });

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      const headers = fetchMock.lastCall()![1]!.headers as any;
      expect(headers.authorization).toBe("1234");
      expect(headers["content-type"]).toBe("application/json");
      expect(headers.accept).toBe(
        "application/graphql-response+json,application/json;q=0.9"
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
        new HttpLink({ uri: "data", headers: { authorization: "no user" } })
      );

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      const headers = fetchMock.lastCall()![1]!.headers as any;
      expect(headers.authorization).toBe("1234");
      expect(headers["content-type"]).toBe("application/json");
      expect(headers.accept).toBe(
        "application/graphql-response+json,application/json;q=0.9"
      );
    });

    it("adds headers to the request from the context on an operation", async () => {
      const variables = { params: "stub" };
      const link = new HttpLink({ uri: "data" });

      const context = {
        headers: { authorization: "1234" },
      };
      const observable = execute(link, {
        query: sampleQuery,
        variables,
        context,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      const headers = fetchMock.lastCall()![1]!.headers as any;
      expect(headers.authorization).toBe("1234");
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
      const link = middleware.concat(new HttpLink({ uri: "data" }));

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      const creds = fetchMock.lastCall()![1]!.credentials;
      expect(creds).toBe("same-team-yo");
    });

    it("adds creds to the request from the setup", async () => {
      const variables = { params: "stub" };
      const link = new HttpLink({ uri: "data", credentials: "include" });

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

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
        new HttpLink({ uri: "data", credentials: "include" })
      );

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      const creds = fetchMock.lastCall()![1]!.credentials;
      expect(creds).toBe("omit");
    });

    it("adds uri to the request from the context", async () => {
      const variables = { params: "stub" };
      const middleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          uri: "data",
        });
        return forward(operation);
      });
      const link = middleware.concat(new HttpLink());

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      const uri = fetchMock.lastUrl();
      expect(uri).toBe("/data");
    });

    it("adds uri to the request from the setup", async () => {
      const variables = { params: "stub" };
      const link = new HttpLink({ uri: "data" });

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      const uri = fetchMock.lastUrl();
      expect(uri).toBe("/data");
    });

    it("prioritizes context uri over setup uri", async () => {
      const variables = { params: "stub" };
      const middleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          uri: "apollo",
        });
        return forward(operation);
      });
      const link = middleware.concat(
        new HttpLink({ uri: "data", credentials: "include" })
      );

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      const uri = fetchMock.lastUrl();
      expect(uri).toBe("/apollo");
    });

    it("allows uri to be a function", async () => {
      const variables = { params: "stub" };
      const customFetch: typeof fetch = (uri, options) => {
        const { operationName } = convertBatchedBody(options!.body);
        expect(operationName).toBe("SampleQuery");

        return fetch("dataFunc", options);
      };

      const link = new HttpLink({ fetch: customFetch });

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      expect(fetchMock.lastUrl()).toBe("/dataFunc");
    });

    it("adds fetchOptions to the request from the setup", async () => {
      const variables = { params: "stub" };
      const link = new HttpLink({
        uri: "data",
        fetchOptions: { mode: "no-cors" },
      });

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      const { mode, headers } = fetchMock.lastCall()![1] as any;
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
      const link = middleware.concat(new HttpLink({ uri: "data" }));

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      const { someOption } = fetchMock.lastCall()![1] as any;
      expect(someOption).toBe("foo");
    });

    it("uses the latest window.fetch function if options.fetch not configured", async () => {
      const httpLink = new HttpLink({ uri: "data" });

      const fetch = window.fetch;
      expect(typeof fetch).toBe("function");

      const fetchSpy = jest.spyOn(window, "fetch");
      fetchSpy.mockImplementation(() =>
        Promise.resolve(Response.json({ data: { hello: "from spy" } }))
      );

      const spyFn = window.fetch;
      expect(spyFn).not.toBe(fetch);

      const stream = new ObservableStream(
        execute(httpLink, { query: sampleQuery })
      );

      await expect(stream).toEmitTypedValue({ data: { hello: "from spy" } });
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      fetchSpy.mockRestore();
      expect(window.fetch).toBe(fetch);

      const stream2 = new ObservableStream(
        execute(httpLink, { query: sampleQuery })
      );

      await expect(stream2).toEmitTypedValue({ data: { hello: "world" } });
    });

    it("uses the print option function when defined", async () => {
      const customPrinter = jest.fn(
        (ast: ASTNode, originalPrint: typeof print) => {
          return stripIgnoredCharacters(originalPrint(ast));
        }
      );

      const httpLink = new HttpLink({ uri: "data", print: customPrinter });

      const observable = execute(httpLink, {
        query: sampleQuery,
        context: {
          fetchOptions: { method: "GET" },
        },
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      expect(customPrinter).toHaveBeenCalledTimes(1);
      const [uri] = fetchMock.lastCall()!;
      expect(uri).toBe(
        `/data?query=query%20SampleQuery%7Bstub%7Bid%7D%7D&operationName=SampleQuery&variables=%7B%7D&extensions=%7B%22clientLibrary%22%3A%7B%22name%22%3A%22%40apollo%2Fclient%22%2C%22version%22%3A%22${version}%22%7D%7D`
      );
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
        new HttpLink({ uri: "data", fetchOptions: { mode: "no-cors" } })
      );

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      const { mode } = fetchMock.lastCall()![1] as any;
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
      const link = middleware.concat(new HttpLink({ uri: "data" }));

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

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

      const link = middleware.concat(new HttpLink({ uri: "data", fetch }));

      const observable = execute(link, { query: sampleQuery });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);
      await expect(stream).toComplete();
    });
  });

  describe("Dev warnings", () => {
    voidFetchDuringEachTest();

    it("warns if fetch is undeclared", async () => {
      expect(() => new HttpLink({ uri: "data" })).toThrow(
        /has not been found globally/
      );
    });

    it("warns if fetch is undefined", async () => {
      window.fetch = undefined as any;

      expect(() => new HttpLink({ uri: "data" })).toThrow(
        /has not been found globally/
      );
    });

    it("does not warn if fetch is undeclared but a fetch is passed", () => {
      expect(() => {
        new HttpLink({ uri: "data", fetch: (() => {}) as any });
      }).not.toThrow();
    });
  });

  describe("Error handling", () => {
    it("throws an error if response code is > 300", async () => {
      const response = Response.json({}, { status: 400 });

      const link = new HttpLink({ uri: "data", fetch: async () => response });
      const observable = execute(link, { query: sampleQuery });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitError(
        new ServerError("Response not successful: Received status code 400", {
          response,
          bodyText: "{}",
        })
      );
    });

    it("throws an error if response code is > 300 and handles string response body", async () => {
      const response = new Response("Error! Foo bar", { status: 302 });

      const link = new HttpLink({ uri: "data", fetch: async () => response });
      const observable = execute(link, { query: sampleQuery });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitError(
        new ServerError("Response not successful: Received status code 302", {
          response,
          bodyText: "Error! Foo bar",
        })
      );
    });

    it("throws an error if response code is > 300 and returns data", async () => {
      const result = {
        data: { stub: { id: 1 } },
        errors: [{ message: "dangit" }],
      };
      const response = Response.json(result, { status: 400 });

      const link = new HttpLink({ uri: "data", fetch: async () => response });
      const observable = execute(link, { query: sampleQuery });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitError(
        new ServerError("Response not successful: Received status code 400", {
          response,
          bodyText: JSON.stringify(result),
        })
      );
    });

    it("throws an error if only errors are returned", async () => {
      const result = { errors: [{ message: "dangit" }] };
      const response = Response.json(result, { status: 400 });

      const link = new HttpLink({ uri: "data", fetch: async () => response });
      const observable = execute(link, { query: sampleQuery });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitError(
        new ServerError("Response not successful: Received status code 400", {
          response,
          bodyText: JSON.stringify(result),
        })
      );
    });

    it("throws an error if empty response from the server ", async () => {
      const response = Response.json({ body: "boo" }, { status: 200 });

      const link = new HttpLink({ uri: "data", fetch: async () => response });
      const observable = execute(link, { query: sampleQuery });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitError(
        new ServerError(
          "Server response was malformed for query 'SampleQuery'.",
          { response, bodyText: JSON.stringify({ body: "boo" }) }
        )
      );
    });

    it("throws if the body can't be stringified", async () => {
      const link = new HttpLink({
        uri: "data",
        fetch: async () => new Response(""),
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
      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      const error = await stream.takeError();

      expect(error.message).toMatch(/Converting circular structure to JSON/);
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

      const failingObserver: Observer<ApolloLink.Result> = {
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

      it("aborts the request when unsubscribing before the request has completed", () => {
        const fetch = async () =>
          Response.json({ data: { stub: { id: "foo" } } }, { status: 200 });
        const abortControllers = trackGlobalAbortControllers();

        const link = new HttpLink({ uri: "data", fetch });

        const sub = execute(link, { query: sampleQuery }).subscribe(
          failingObserver
        );
        sub.unsubscribe();

        expect(abortControllers.length).toBe(1);
        expect(abortControllers[0].signal.aborted).toBe(true);
      });

      it("a passed-in signal that is aborted will fail the observable with an `AbortError`", async () => {
        try {
          fetchMock.restore();
          fetchMock.postOnce(
            "data",
            async () => '{ "data": { "stub": { "id": "foo" } } }',
            { delay: 100 }
          );

          const externalAbortController = new AbortController();
          const abortControllers = trackGlobalAbortControllers();

          const link = new HttpLink({
            uri: "/data",
          });

          const observable = execute(link, {
            query: sampleQuery,
            context: {
              fetchOptions: { signal: externalAbortController.signal },
            },
          });

          const internalAbortController = abortControllers[0];

          const stream = new ObservableStream(observable);
          const externalReason = new Error("External abort reason");

          externalAbortController.abort(externalReason);

          await expect(stream).toEmitError(
            // this not being `externalReason` is a quirk of `fetch-mock`:
            // https://github.com/wheresrhys/fetch-mock/blob/605ec0afa6a5ff35066b9e01a9bcd688f3c25ce0/packages/fetch-mock/src/Router.ts#L164-L167
            new DOMException("The operation was aborted.", "AbortError")
          );

          expect(externalAbortController).not.toBe(internalAbortController);
          expect(externalAbortController.signal.aborted).toBe(true);
          expect(externalAbortController.signal.reason).toBe(externalReason);
          expect(internalAbortController.signal.aborted).toBe(true);
          expect(internalAbortController.signal.reason).toBe(externalReason);
        } finally {
          fetchMock.restore();
        }
      });

      it("a passed-in signal will not fully overwrite the internally created one", () => {
        try {
          const externalAbortController = new AbortController();
          const abortControllers = trackGlobalAbortControllers();

          fetchMock.restore();
          fetchMock.postOnce(
            "data",
            async () => '{ "data": { "stub": { "id": "foo" } } }'
          );

          const link = new HttpLink({
            uri: "/data",
          });

          const sub = execute(link, {
            query: sampleQuery,
            context: {
              fetchOptions: { signal: externalAbortController.signal },
            },
          }).subscribe(failingObserver);
          const internalAbortController = abortControllers[0];

          sub.unsubscribe();

          expect(externalAbortController.signal.aborted).toBe(false);
          expect(internalAbortController.signal.aborted).toBe(true);
        } finally {
          fetchMock.restore();
        }
      });

      it("resolving fetch does not cause the AbortController to be aborted", async () => {
        const fetch = async () =>
          Response.json({ data: { hello: "world" } }, { status: 200 });
        const abortControllers = trackGlobalAbortControllers();

        // (the request is already finished at that point)
        const link = new HttpLink({ uri: "data", fetch });

        await new Promise<void>((resolve) =>
          execute(link, { query: sampleQuery }).subscribe({
            complete: resolve,
          })
        );

        expect(abortControllers.length).toBe(1);
        expect(abortControllers[0].signal.aborted).toBe(false);
      });

      it("an unsuccessful fetch does not cause the AbortController to be aborted", async () => {
        const fetch = async () => {
          throw new Error("This is an error!");
        };

        const abortControllers = trackGlobalAbortControllers();
        // the request would be closed by the browser in the case of an error anyways
        const link = new HttpLink({ uri: "data", fetch });

        await new Promise<void>((resolve) =>
          execute(link, { query: sampleQuery }).subscribe({
            error: resolve,
          })
        );

        expect(abortControllers.length).toBe(1);
        expect(abortControllers[0].signal.aborted).toBe(false);
      });
    });

    it("throws a Server error if response is > 300 with unparsable json", async () => {
      const body = "{";
      const response = new Response(body, {
        status: 400,
        headers: { "content-type": "application/json" },
      });
      const link = new HttpLink({ uri: "data", fetch: async () => response });

      const observable = execute(link, { query: sampleQuery });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitError(
        new ServerError("Response not successful: Received status code 400", {
          response,
          bodyText: body,
        })
      );
    });

    it("throws a ServerParseError if response is 200 with unparsable json", async () => {
      const body = "{";
      const response = new Response(body, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
      const link = new HttpLink({ uri: "data", fetch: async () => response });

      const observable = execute(link, { query: sampleQuery });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitError(
        new ServerParseError(
          new Error(
            "Expected property name or '}' in JSON at position 1 (line 1 column 2)"
          ),
          { response, bodyText: body }
        )
      );
    });
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

      it("whatwg stream bodies", async () => {
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

        const link = new HttpLink({
          fetch: async () => {
            return new Response(stream, {
              status: 200,
              headers: new Headers({ "content-type": "multipart/mixed" }),
            });
          },
        });

        const observableStream = new ObservableStream(
          execute(link, { query: sampleDeferredQuery })
        );

        await expect(observableStream).toEmitTypedValue({
          data: {
            stub: {
              id: "0",
            },
          },
          hasNext: true,
        });

        await expect(observableStream).toEmitTypedValue({
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

        await expect(observableStream).toComplete();
      });

      // Verify that observable completes if final chunk does not contain
      // incremental array.
      it("whatwg stream bodies, final chunk of { hasNext: false }", async () => {
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

        const link = new HttpLink({
          fetch: async () => {
            return new Response(stream, {
              status: 200,
              headers: new Headers({
                "Content-Type":
                  'multipart/mixed;boundary="graphql";deferSpec=20220824',
              }),
            });
          },
        });

        const observableStream = new ObservableStream(
          execute(link, { query: sampleDeferredQuery })
        );

        await expect(observableStream).toEmitTypedValue({
          data: {
            allProducts: [null, null, null],
          },
          errors: [
            {
              message:
                "Cannot return null for non-nullable field Product.nonNullErrorField.",
            },
            {
              message:
                "Cannot return null for non-nullable field Product.nonNullErrorField.",
            },
            {
              message:
                "Cannot return null for non-nullable field Product.nonNullErrorField.",
            },
          ],
          hasNext: true,
        });

        await expect(observableStream).toEmitTypedValue({
          hasNext: false,
        });

        // the second chunk contains only hasNext: false which is not emitted as
        // a `next` event so the link completes.

        await expect(observableStream).toComplete();
      });

      it("sets correct accept header on request with deferred query", async () => {
        const stream = ReadableStream.from(
          body.split("\r\n").map((line) => line + "\r\n")
        );
        const fetch = jest.fn(async () => {
          return new Response(stream, {
            status: 200,
            headers: { "content-type": "multipart/mixed" },
          });
        });

        const { link, observableStream } = pipeLinkToObservableStream(
          new HttpLink({ fetch })
        );

        const client = new ApolloClient({
          link,
          cache: new InMemoryCache(),
          incrementalHandler: new Defer20220824Handler(),
        });
        void client.query({ query: sampleDeferredQuery });

        await expect(observableStream).toEmitTypedValue({
          data: { stub: { id: "0" } },
          hasNext: true,
        });

        await expect(observableStream).toEmitTypedValue({
          incremental: [
            {
              data: { name: "stubby---" },
              path: ["stub"],
              extensions: { timestamp: 1633038919 },
            },
          ],
          hasNext: false,
        });

        await expect(observableStream).toComplete();

        expect(fetch).toHaveBeenCalledWith(
          "/graphql",
          expect.objectContaining({
            headers: {
              "content-type": "application/json",
              accept:
                "multipart/mixed;deferSpec=20220824,application/graphql-response+json,application/json;q=0.9",
            },
          })
        );
      });

      // ensure that custom directives beginning with '@defer..' do not trigger
      // custom accept header for multipart responses
      it("sets does not set accept header on query with custom directive begging with @defer", async () => {
        const stream = ReadableStream.from(
          body.split("\r\n").map((line) => line + "\r\n")
        );
        const fetch = jest.fn(async () => {
          return new Response(stream, {
            status: 200,
            headers: { "content-type": "multipart/mixed" },
          });
        });
        const link = new HttpLink({ fetch });
        const observable = execute(link, { query: sampleQueryCustomDirective });
        const observableStream = new ObservableStream(observable);

        await expect(observableStream).toEmitTypedValue({
          data: { stub: { id: "0" } },
          hasNext: true,
        });

        await expect(observableStream).toEmitTypedValue({
          incremental: [
            {
              data: { name: "stubby---" },
              path: ["stub"],
              extensions: { timestamp: 1633038919 },
            },
          ],
          hasNext: false,
        });

        await expect(observableStream).toComplete();

        expect(fetch).toHaveBeenCalledWith(
          "/graphql",
          expect.objectContaining({
            headers: {
              accept:
                "application/graphql-response+json,application/json;q=0.9",
              "content-type": "application/json",
            },
          })
        );
      });
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

      it("whatwg stream bodies", async () => {
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

        const fetch = jest.fn(async () => {
          return new Response(stream, {
            status: 200,
            headers: { "content-type": "multipart/mixed" },
          });
        });

        const link = new HttpLink({ fetch });

        const observableStream = new ObservableStream(
          execute(link, { query: sampleSubscription })
        );

        await expect(observableStream).toEmitTypedValue({
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

        await expect(observableStream).toEmitTypedValue({
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

        await expect(observableStream).toComplete();
      });

      test("whatwg stream bodies combined with @defer, lets server handle erroring", async () => {
        const error = {
          errors: [
            {
              message:
                "value retrieval failed: Federation error: @defer is not supported on subscriptions",
              extensions: { code: "INTERNAL_SERVER_ERROR" },
            },
          ],
        };
        const response = Response.json(error, {
          status: 500,
          headers: { "content-type": "application/json" },
        });
        const fetch = jest.fn(async () => {
          return response;
        });

        const link = new HttpLink({ fetch });

        const client = new ApolloClient({
          link,
          cache: new InMemoryCache(),
          incrementalHandler: new Defer20220824Handler(),
        });

        const stream = new ObservableStream(
          client.subscribe({ query: sampleSubscriptionWithDefer })
        );
        expect(fetch).toHaveBeenCalledWith(
          "/graphql",
          expect.objectContaining({
            headers: {
              accept:
                "multipart/mixed;boundary=graphql;subscriptionSpec=1.0,multipart/mixed;deferSpec=20220824,application/graphql-response+json,application/json;q=0.9",
              "content-type": "application/json",
            },
          })
        );

        await expect(stream).toEmitTypedValue({
          data: undefined,
          error: new ServerError(
            "Response not successful: Received status code 500",
            {
              bodyText: JSON.stringify(error),
              response,
            }
          ),
        });
      });

      it("with errors", async () => {
        const stream = ReadableStream.from(
          subscriptionsBodyError.split("\r\n").map((line) => line + "\r\n")
        );

        const fetch = jest.fn(async () => {
          return new Response(stream, {
            status: 200,
            headers: { "content-type": "multipart/mixed" },
          });
        });
        const link = new HttpLink({ fetch });

        const observableStream = new ObservableStream(
          execute(link, { query: sampleSubscription })
        );

        await expect(observableStream).toEmitTypedValue({
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

        await expect(observableStream).toEmitTypedValue({
          extensions: {
            [PROTOCOL_ERRORS_SYMBOL]: new CombinedProtocolErrors([
              {
                extensions: {
                  code: "INTERNAL_SERVER_ERROR",
                },
                message: "Error field",
              },
            ]),
          } as Record<string, unknown>,
        });

        await expect(observableStream).toComplete();
      });

      it("sets correct accept header on request with subscription", async () => {
        const stream = ReadableStream.from(
          subscriptionsBody.split("\r\n").map((line) => line + "\r\n")
        );
        const fetch = jest.fn(async () => {
          return new Response(stream, {
            status: 200,
            headers: { "content-type": "multipart/mixed" },
          });
        });
        const link = new HttpLink({ fetch });
        const observable = execute(link, { query: sampleSubscription });
        const observableStream = new ObservableStream(observable);

        await expect(observableStream).toEmitTypedValue({
          data: {
            aNewDieWasCreated: { die: { color: "red", roll: 1, sides: 4 } },
          },
        });
        await expect(observableStream).toEmitTypedValue({
          data: {
            aNewDieWasCreated: { die: { color: "blue", roll: 2, sides: 5 } },
          },
        });
        await expect(observableStream).toComplete();

        expect(fetch).toHaveBeenCalledWith(
          "/graphql",
          expect.objectContaining({
            headers: {
              "content-type": "application/json",
              accept:
                "multipart/mixed;boundary=graphql;subscriptionSpec=1.0,application/graphql-response+json,application/json;q=0.9",
            },
          })
        );
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

      const link = new HttpLink({
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

      const link = new HttpLink({
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

      const link = new HttpLink({
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

      const link = new HttpLink({
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

      const link = new HttpLink({
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

      const link = new HttpLink({
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

      const link = new HttpLink({
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

      const link = new HttpLink({
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

      const link = new HttpLink({
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

      const link = new HttpLink({
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

    test("is part of `HttpLink`", () => {
      fetchMock.postOnce(uri, response);
      const client = new ApolloClient({
        link: new HttpLink({
          uri,
        }),
        cache: new InMemoryCache(),
        clientAwareness: {
          name: "test-client",
          version: "1.0.0",
        },
      });

      void client.query({ query });
      const headers = fetchMock.lastCall()![1]?.headers;
      expect(headers).toStrictEqual({
        accept: "application/graphql-response+json,application/json;q=0.9",
        "content-type": "application/json",
        "apollographql-client-name": "test-client",
        "apollographql-client-version": "1.0.0",
      });
    });

    test("is not part of `BaseHttpLink`", () => {
      fetchMock.postOnce(uri, response);
      const client = new ApolloClient({
        link: new BaseHttpLink({
          uri,
        }),
        cache: new InMemoryCache(),
        clientAwareness: {
          name: "test-client",
          version: "1.0.0",
        },
      });

      void client.query({ query });
      const headers = fetchMock.lastCall()![1]?.headers;
      expect(headers).toStrictEqual({
        accept: "application/graphql-response+json,application/json;q=0.9",
        "content-type": "application/json",
      });
    });

    test("`HttpLink` options have priority over `ApolloClient` options", () => {
      fetchMock.postOnce(uri, response);
      const client = new ApolloClient({
        link: new HttpLink({
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
      const headers = fetchMock.lastCall()![1]?.headers;
      expect(headers).toStrictEqual({
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

    test("is part of `HttpLink`", () => {
      fetchMock.postOnce(uri, response);
      const client = new ApolloClient({
        link: new HttpLink({
          uri,
        }),
        cache: new InMemoryCache(),
      });

      void client.query({ query });
      const body = JSON.parse(fetchMock.lastCall()![1]?.body as string);
      expect(body.extensions).toStrictEqual({
        clientLibrary: {
          name: "@apollo/client",
          version,
        },
      });
    });

    test("is not part of `BaseHttpLink`", () => {
      fetchMock.postOnce(uri, response);
      const client = new ApolloClient({
        link: new BaseHttpLink({
          uri,
        }),
        cache: new InMemoryCache(),
      });

      void client.query({ query });
      const body = JSON.parse(fetchMock.lastCall()![1]?.body as string);
      expect(body.extensions).not.toBeDefined();
    });

    test("can be disabled from `HttpLink`", () => {
      fetchMock.postOnce(uri, response);
      const client = new ApolloClient({
        link: new HttpLink({
          uri,
          enhancedClientAwareness: { transport: false },
        }),
        cache: new InMemoryCache(),
      });

      void client.query({ query });
      const body = JSON.parse(fetchMock.lastCall()![1]?.body as string);
      expect(body.extensions).not.toBeDefined();
    });

    test("can also be disabled by disabling `includeExtensions`", () => {
      fetchMock.postOnce(uri, response);
      const client = new ApolloClient({
        link: new HttpLink({
          uri,
          includeExtensions: false,
        }),
        cache: new InMemoryCache(),
      });

      void client.query({ query });
      const body = JSON.parse(fetchMock.lastCall()![1]?.body as string);
      expect(body.extensions).not.toBeDefined();
    });
  });
});

function pipeLinkToObservableStream(link: ApolloLink) {
  const sink = new Subject<ApolloLink.Result>();
  const observableStream = new ObservableStream(sink);
  const pipedLink = new ApolloLink((operation, forward) =>
    forward(operation).pipe(
      tap({
        next: (result) => {
          sink.next(structuredClone(result));
        },
        error: sink.error.bind(sink),
        complete: sink.complete.bind(sink),
      })
    )
  ).concat(link);
  return {
    observableStream,
    link: pipedLink,
  };
}
