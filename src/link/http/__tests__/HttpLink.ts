import { TextDecoder } from "util";

import fetchMock from "fetch-mock";
import type { ASTNode } from "graphql";
import { print, stripIgnoredCharacters } from "graphql";
import { gql } from "graphql-tag";
import type { Observer, Subscription } from "rxjs";
import { map, Observable } from "rxjs";
import { ReadableStream } from "web-streams-polyfill";

import type { FetchResult } from "@apollo/client";
import { ServerError } from "@apollo/client";
import {
  CombinedProtocolErrors,
  PROTOCOL_ERRORS_SYMBOL,
  ServerParseError,
} from "@apollo/client/errors";
import { ApolloLink } from "@apollo/client/link";
import { createHttpLink, HttpLink } from "@apollo/client/link/http";
import {
  executeWithDefaultContext as execute,
  ObservableStream,
  spyOnConsole,
  wait,
} from "@apollo/client/testing/internal";

import type { ClientParseError } from "../serializeFetchParameter.js";

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
      fetchMock.post("begin:/data2", Promise.resolve(data2), {
        headers: { "content-type": "application/json" },
      });
      fetchMock.post("begin:/data", Promise.resolve(data), {
        headers: { "content-type": "application/json" },
      });
      fetchMock.post("begin:/error", mockError);
      fetchMock.post("begin:/apollo", Promise.resolve(data), {
        headers: { "content-type": "application/json" },
      });

      fetchMock.get("begin:/data", Promise.resolve(data), {
        headers: { "content-type": "application/json" },
      });
      fetchMock.get("begin:/data2", Promise.resolve(data2), {
        headers: { "content-type": "application/json" },
      });

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

      const link = createHttpLink({
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
        "/data?query=query%20SampleQuery%20%7B%0A%20%20stub%20%7B%0A%20%20%20%20id%0A%20%20%7D%0A%7D&operationName=SampleQuery&variables=%7B%22params%22%3A%22stub%22%7D&extensions=%7B%22myExtension%22%3A%22foo%22%7D"
      );
    });

    it("supports using a GET request with search", async () => {
      const variables = { params: "stub" };

      const link = createHttpLink({
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
        "/data?foo=bar&query=query%20SampleQuery%20%7B%0A%20%20stub%20%7B%0A%20%20%20%20id%0A%20%20%7D%0A%7D&operationName=SampleQuery&variables=%7B%7D"
      );
    });

    it("supports using a GET request on the context", async () => {
      const variables = { params: "stub" };
      const link = createHttpLink({
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
        "/data?query=query%20SampleQuery%20%7B%0A%20%20stub%20%7B%0A%20%20%20%20id%0A%20%20%7D%0A%7D&operationName=SampleQuery&variables=%7B%7D"
      );
    });

    it("uses GET with useGETForQueries", async () => {
      const variables = { params: "stub" };
      const link = createHttpLink({
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
        "/data?query=query%20SampleQuery%20%7B%0A%20%20stub%20%7B%0A%20%20%20%20id%0A%20%20%7D%0A%7D&operationName=SampleQuery&variables=%7B%7D"
      );
    });

    it("uses POST for mutations with useGETForQueries", async () => {
      const variables = { params: "stub" };
      const link = createHttpLink({
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
      });
      expect(method).toBe("POST");
      expect(uri).toBe("/data");
    });

    it("should add client awareness settings to request headers", async () => {
      const variables = { params: "stub" };
      const link = createHttpLink({
        uri: "/data",
      });

      const clientAwareness = {
        name: "Some Client Name",
        version: "1.0.1",
      };

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
      expect(headers["apollographql-client-name"]).toBeDefined();
      expect(headers["apollographql-client-name"]).toEqual(
        clientAwareness.name
      );
      expect(headers["apollographql-client-version"]).toBeDefined();
      expect(headers["apollographql-client-version"]).toEqual(
        clientAwareness.version
      );
    });

    it("should not add empty client awareness settings to request headers", async () => {
      const variables = { params: "stub" };
      const link = createHttpLink({
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
      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      const error = await stream.takeError();

      expect(error.message).toMatch(/Variables map is not serializable/);
      expect(error.parseError.message).toMatch(
        /Converting circular structure to JSON/
      );
    });

    it("throws for GET if the extensions can't be stringified", async () => {
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
      const observable = execute(link, { query: sampleQuery, extensions });
      const stream = new ObservableStream(observable);

      const error = await stream.takeError();

      expect(error.message).toMatch(/Extensions map is not serializable/);
      expect(error.parseError.message).toMatch(
        /Converting circular structure to JSON/
      );
    });

    it("raises warning if called with concat", () => {
      using _ = spyOnConsole("warn");
      const link = createHttpLink();

      expect(link.concat((operation, forward) => forward(operation))).toEqual(
        link
      );
      expect(console.warn).toHaveBeenCalledWith(
        "You are calling concat on a terminating link, which will have no effect %o",
        link
      );
    });

    it("does not need any constructor arguments", () => {
      expect(() => createHttpLink()).not.toThrow();
    });

    it("calls next and then complete", async () => {
      const link = createHttpLink({ uri: "data" });
      const observable = execute(link, {
        query: sampleQuery,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);
      await expect(stream).toComplete();
    });

    it("calls error when fetch fails", async () => {
      const link = createHttpLink({ uri: "error" });
      const observable = execute(link, {
        query: sampleQuery,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitError(mockError.throws);
    });

    it("calls error when fetch fails", async () => {
      const link = createHttpLink({ uri: "error" });
      const observable = execute(link, {
        query: sampleMutation,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitError(mockError.throws);
    });

    it("unsubscribes without calling subscriber", async () => {
      const link = createHttpLink({ uri: "data" });
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
      const link = createHttpLink({ uri: "data", includeExtensions: true });

      await verifyRequest(link, true);
      await verifyRequest(link, true);
    });

    it("passes all arguments to multiple fetch body excluding extensions", async () => {
      const link = createHttpLink({ uri: "data" });

      await verifyRequest(link, false);
      await verifyRequest(link, false);
    });

    it("calls multiple subscribers", async () => {
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

      await wait(50);

      expect(subscriber.next).toHaveBeenCalledTimes(2);
      expect(subscriber.complete).toHaveBeenCalledTimes(2);
      expect(subscriber.error).not.toHaveBeenCalled();
      expect(fetchMock.calls().length).toBe(2);
    });

    it("calls remaining subscribers after unsubscribe", async () => {
      const link = createHttpLink({ uri: "data" });
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
      const link = createHttpLink({ uri: "data" });

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
      const link = middleware.concat(createHttpLink({ uri: "data" }));

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      const headers = fetchMock.lastCall()![1]!.headers as any;

      expect(headers.authorization).toBe("1234");
      expect(headers["content-type"]).toBe("application/json");
      expect(headers.accept).toBe(
        "application/graphql-response+json, application/json;q=0.9"
      );
    });

    it("adds headers to the request from the setup", async () => {
      const variables = { params: "stub" };
      const link = createHttpLink({
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
        "application/graphql-response+json, application/json;q=0.9"
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
        createHttpLink({ uri: "data", headers: { authorization: "no user" } })
      );

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      const headers = fetchMock.lastCall()![1]!.headers as any;
      expect(headers.authorization).toBe("1234");
      expect(headers["content-type"]).toBe("application/json");
      expect(headers.accept).toBe(
        "application/graphql-response+json, application/json;q=0.9"
      );
    });

    it("adds headers to the request from the context on an operation", async () => {
      const variables = { params: "stub" };
      const link = createHttpLink({ uri: "data" });

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
        "application/graphql-response+json, application/json;q=0.9"
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
      const link = middleware.concat(createHttpLink({ uri: "data" }));

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      const creds = fetchMock.lastCall()![1]!.credentials;
      expect(creds).toBe("same-team-yo");
    });

    it("adds creds to the request from the setup", async () => {
      const variables = { params: "stub" };
      const link = createHttpLink({ uri: "data", credentials: "same-team-yo" });

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

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
        createHttpLink({ uri: "data", credentials: "error" })
      );

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      const creds = fetchMock.lastCall()![1]!.credentials;
      expect(creds).toBe("same-team-yo");
    });

    it("adds uri to the request from the context", async () => {
      const variables = { params: "stub" };
      const middleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          uri: "data",
        });
        return forward(operation);
      });
      const link = middleware.concat(createHttpLink());

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      const uri = fetchMock.lastUrl();
      expect(uri).toBe("/data");
    });

    it("adds uri to the request from the setup", async () => {
      const variables = { params: "stub" };
      const link = createHttpLink({ uri: "data" });

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
        createHttpLink({ uri: "data", credentials: "error" })
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

      const link = createHttpLink({ fetch: customFetch });

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      expect(fetchMock.lastUrl()).toBe("/dataFunc");
    });

    it("adds fetchOptions to the request from the setup", async () => {
      const variables = { params: "stub" };
      const link = createHttpLink({
        uri: "data",
        fetchOptions: { someOption: "foo", mode: "no-cors" },
      });

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      const { someOption, mode, headers } = fetchMock.lastCall()![1] as any;
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
      const link = middleware.concat(createHttpLink({ uri: "data" }));

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      const { someOption } = fetchMock.lastCall()![1] as any;
      expect(someOption).toBe("foo");
    });

    it("uses the latest window.fetch function if options.fetch not configured", async () => {
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
          headers: new Headers({ "content-type": "application/json" }),
        } as Response)
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

      const httpLink = createHttpLink({ uri: "data", print: customPrinter });

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
        "/data?query=query%20SampleQuery%7Bstub%7Bid%7D%7D&operationName=SampleQuery&variables=%7B%7D"
      );
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
        createHttpLink({ uri: "data", fetchOptions: { someOption: "bar" } })
      );

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      const { someOption } = fetchMock.lastCall()![1] as any;
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
      const link = middleware.concat(createHttpLink({ uri: "data" }));

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);

      let body = convertBatchedBody(fetchMock.lastCall()![1]!.body);

      expect(body.query).not.toBeDefined();
      expect(body.extensions).toEqual({
        persistedQuery: { hash: "1234" },
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
              expect(operation.getContext().response.headers.toBeDefined);
              ob.complete();
            },
          });

          return () => {
            sub.unsubscribe();
          };
        });
      });

      const link = middleware.concat(createHttpLink({ uri: "data", fetch }));

      const observable = execute(link, { query: sampleQuery });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);
      await expect(stream).toComplete();
    });
  });

  describe("Dev warnings", () => {
    voidFetchDuringEachTest();

    it("warns if fetch is undeclared", async () => {
      expect(() => createHttpLink({ uri: "data" })).toThrow(
        /has not been found globally/
      );
    });

    it("warns if fetch is undefined", async () => {
      window.fetch = undefined as any;

      expect(() => createHttpLink({ uri: "data" })).toThrow(
        /has not been found globally/
      );
    });

    it("does not warn if fetch is undeclared but a fetch is passed", () => {
      expect(() => {
        createHttpLink({ uri: "data", fetch: (() => {}) as any });
      }).not.toThrow();
    });
  });

  describe("Error handling", () => {
    it("throws an error if response code is > 300", async () => {
      const response = new Response("{}", {
        status: 400,
        headers: { "content-type": "application/json" },
      });

      const link = createHttpLink({ uri: "data", fetch: async () => response });
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
      const response = new Response("Error! Foo bar", {
        status: 302,
        headers: { "content-type": "application/json" },
      });

      const link = createHttpLink({ uri: "data", fetch: async () => response });
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

      const link = createHttpLink({ uri: "data", fetch: async () => response });
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

      const link = createHttpLink({ uri: "data", fetch: async () => response });
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

      const link = createHttpLink({ uri: "data", fetch: async () => response });
      const observable = execute(link, { query: sampleQuery });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitError(
        new ServerError(
          "Server response was missing for query 'SampleQuery'.",
          { response, bodyText: JSON.stringify({ body: "boo" }) }
        )
      );
    });

    it("throws if the body can't be stringified", async () => {
      const link = createHttpLink({
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

      const error: ClientParseError = await stream.takeError();

      expect(error.message).toMatch(/Payload is not serializable/);
      expect(error.parseError.message).toMatch(
        /Converting circular structure to JSON/
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
        const fetch = jest.fn(async (uri, options) => ({
          text,
          headers: new Headers({ "content-type": "application/json" }),
        }));
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

    it("throws a Server error if response is > 300 with unparsable json", async () => {
      const body = "{";
      const response = new Response(body, {
        status: 400,
        headers: { "content-type": "application/json" },
      });
      const link = createHttpLink({ uri: "data", fetch: async () => response });

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
      const link = createHttpLink({ uri: "data", fetch: async () => response });

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

        // the second chunk contains only hasNext: false which is not emitted as
        // a `next` event so the link completes.

        await expect(observableStream).toComplete();
      });

      it("sets correct accept header on request with deferred query", async () => {
        const stream = ReadableStream.from(
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
        const observable = execute(link, { query: sampleDeferredQuery });
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
              "content-type": "application/json",
              accept: "multipart/mixed;deferSpec=20220824,application/json",
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
        const fetch = jest.fn(async () => ({
          status: 200,
          body: stream,
          headers: new Headers({ "Content-Type": "multipart/mixed" }),
        }));
        const link = new HttpLink({
          fetch: fetch as any,
        });
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
                "application/graphql-response+json, application/json;q=0.9",
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

        const fetch = jest.fn(async () => ({
          status: 200,
          body: stream,
          headers: new Headers({ "Content-Type": "multipart/mixed" }),
        }));

        const link = new HttpLink({
          fetch: fetch as any,
        });

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

      it("with errors", async () => {
        const stream = ReadableStream.from(
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
          },
        });

        await expect(observableStream).toComplete();
      });

      it("sets correct accept header on request with subscription", async () => {
        const stream = ReadableStream.from(
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
                "multipart/mixed;boundary=graphql;subscriptionSpec=1.0,application/json",
            },
          })
        );
      });
    });
  });

  describe("GraphQL over HTTP", () => {
    test("emits ServerError when content-type is not set with well formed GraphQL response", async () => {
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

      await expect(stream).toEmitError(
        new ServerError(
          "Could not determine content encoding because the 'content-type' header is missing.",
          {
            response,
            bodyText: JSON.stringify({ data: { foo: true } }),
          }
        )
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

    test("emits ServerError when responding with a non-json mime type and 200 response with well formed GraphQL response", async () => {
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

      await expect(stream).toEmitError(
        new ServerError("Unsupported media type: 'text/plain'", {
          response,
          bodyText: JSON.stringify({
            data: null,
            errors: [{ message: "Could not process request" }],
          }),
        })
      );
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
});
