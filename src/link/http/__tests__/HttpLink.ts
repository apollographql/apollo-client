import { TextDecoder } from "util";

import fetchMock from "fetch-mock";
import { ASTNode, print, stripIgnoredCharacters } from "graphql";
import { gql } from "graphql-tag";
import { map, Observable, Observer, Subscription } from "rxjs";
import { ReadableStream } from "web-streams-polyfill";

import { FetchResult, ServerError } from "@apollo/client";
import {
  CombinedProtocolErrors,
  PROTOCOL_ERRORS_SYMBOL,
  ServerParseError,
} from "@apollo/client/errors";
import { ApolloLink, execute } from "@apollo/client/link/core";
import { createHttpLink, HttpLink } from "@apollo/client/link/http";
import { wait } from "@apollo/client/testing";
import { ObservableStream } from "@apollo/client/testing/internal";

import { ClientParseError } from "../serializeFetchParameter.js";

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

function makePromise(res: any) {
  return new Promise((resolve) => setTimeout(() => resolve(res)));
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

    it("constructor creates link that can call next and then complete", async () => {
      const link = new HttpLink({ uri: "/data" });
      const observable = execute(link, {
        query: sampleQuery,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitNext();
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

      await expect(stream).toEmitNext();
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

      await expect(stream).toEmitNext();
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

      await expect(stream).toEmitNext();
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

      await expect(stream).toEmitNext();
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

      await expect(stream).toEmitNext();
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

      await expect(stream).toEmitNext();
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

      await expect(stream).toEmitNext();
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

      await expect(stream).toEmitNext();
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
      const link = createHttpLink({ uri: "data" });
      const observable = execute(link, {
        query: sampleQuery,
      });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitNext();
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

      await expect(stream).toEmitNext();
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
      const link = middleware.concat(createHttpLink({ uri: "data" }));

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitNext();

      const headers = fetchMock.lastCall()![1]!.headers as any;

      expect(headers.authorization).toBe("1234");
      expect(headers["content-type"]).toBe("application/json");
      expect(headers.accept).toBe("application/graphql-response+json");
    });

    it("adds headers to the request from the setup", async () => {
      const variables = { params: "stub" };
      const link = createHttpLink({
        uri: "data",
        headers: { authorization: "1234" },
      });

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitNext();

      const headers = fetchMock.lastCall()![1]!.headers as any;
      expect(headers.authorization).toBe("1234");
      expect(headers["content-type"]).toBe("application/json");
      expect(headers.accept).toBe("application/graphql-response+json");
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

      await expect(stream).toEmitNext();

      const headers = fetchMock.lastCall()![1]!.headers as any;
      expect(headers.authorization).toBe("1234");
      expect(headers["content-type"]).toBe("application/json");
      expect(headers.accept).toBe("application/graphql-response+json");
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

      await expect(stream).toEmitNext();

      const headers = fetchMock.lastCall()![1]!.headers as any;
      expect(headers.authorization).toBe("1234");
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
      const link = middleware.concat(createHttpLink({ uri: "data" }));

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitNext();

      const creds = fetchMock.lastCall()![1]!.credentials;
      expect(creds).toBe("same-team-yo");
    });

    it("adds creds to the request from the setup", async () => {
      const variables = { params: "stub" };
      const link = createHttpLink({ uri: "data", credentials: "same-team-yo" });

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

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
        createHttpLink({ uri: "data", credentials: "error" })
      );

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitNext();

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

      await expect(stream).toEmitNext();

      const uri = fetchMock.lastUrl();
      expect(uri).toBe("/data");
    });

    it("adds uri to the request from the setup", async () => {
      const variables = { params: "stub" };
      const link = createHttpLink({ uri: "data" });

      const observable = execute(link, { query: sampleQuery, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitNext();

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

      await expect(stream).toEmitNext();

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

      await expect(stream).toEmitNext();

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

      await expect(stream).toEmitNext();

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

      await expect(stream).toEmitNext();

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
        } as Response)
      );

      const spyFn = window.fetch;
      expect(spyFn).not.toBe(fetch);

      const stream = new ObservableStream(
        execute(httpLink, { query: sampleQuery })
      );

      await expect(stream).toEmitValue({ data: { hello: "from spy" } });
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      fetchSpy.mockRestore();
      expect(window.fetch).toBe(fetch);

      const stream2 = new ObservableStream(
        execute(httpLink, { query: sampleQuery })
      );

      await expect(stream2).toEmitValue({ data: { hello: "world" } });
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

      await expect(stream).toEmitNext();

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

      await expect(stream).toEmitNext();

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

      await expect(stream).toEmitNext();

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

    it("warns if fetch is undeclared", async () => {
      try {
        createHttpLink({ uri: "data" });
        throw new Error("warning wasn't called");
      } catch (e) {
        expect((e as Error).message).toMatch(/has not been found globally/);
      }
    });

    it("warns if fetch is undefined", async () => {
      window.fetch = undefined as any;
      try {
        createHttpLink({ uri: "data" });
        throw new Error("warning wasn't called");
      } catch (e) {
        expect((e as Error).message).toMatch(/has not been found globally/);
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
    it("makes it easy to do stuff on a 401", async () => {
      const middleware = new ApolloLink((operation, forward) => {
        return new Observable((ob) => {
          fetch.mockReturnValueOnce(Promise.resolve({ status: 401, text }));
          const op = forward(operation);
          const sub = op.subscribe({
            next: ob.next.bind(ob),
            error: (e: ServerError) => {
              expect(e.message).toMatch(/Received status code 401/);
              expect(e.statusCode).toEqual(401);
              ob.error(e);
            },
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

      const observable = execute(link, { query: sampleQuery });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitError();
    });

    it("throws an error if response code is > 300", async () => {
      fetch.mockReturnValueOnce(Promise.resolve({ status: 400, text }));
      const link = createHttpLink({ uri: "data", fetch: fetch as any });

      const observable = execute(link, { query: sampleQuery });
      const stream = new ObservableStream(observable);

      const error: ServerError = await stream.takeError();

      expect(error.message).toMatch(/Received status code 400/);
      expect(error.statusCode).toBe(400);
      expect(error.result).toEqual(responseBody);
    });

    it("throws an error if response code is > 300 and handles string response body", async () => {
      fetch.mockReturnValueOnce(
        Promise.resolve({ status: 302, text: textWithStringError })
      );
      const link = createHttpLink({ uri: "data", fetch: fetch as any });
      const observable = execute(link, { query: sampleQuery });
      const stream = new ObservableStream(observable);

      const error: ServerError = await stream.takeError();

      expect(error.message).toMatch(/Received status code 302/);
      expect(error.statusCode).toBe(302);
      expect(error.result).toEqual(responseBody);
    });

    it("throws an error if response code is > 300 and returns data", async () => {
      fetch.mockReturnValueOnce(
        Promise.resolve({ status: 400, text: textWithData })
      );

      const link = createHttpLink({ uri: "data", fetch: fetch as any });

      const observable = execute(link, { query: sampleQuery });
      const stream = new ObservableStream(observable);

      const result = await stream.takeNext();

      expect(result).toEqual(responseBody);

      const error = await stream.takeError();

      expect(error.message).toMatch(/Received status code 400/);
      expect(error.statusCode).toBe(400);
      expect(error.result).toEqual(responseBody);
    });

    it("throws an error if only errors are returned", async () => {
      fetch.mockReturnValueOnce(
        Promise.resolve({ status: 400, text: textWithErrors })
      );

      const link = createHttpLink({ uri: "data", fetch: fetch as any });
      const observable = execute(link, { query: sampleQuery });
      const stream = new ObservableStream(observable);

      const error = await stream.takeError();

      expect(error.message).toMatch(/Received status code 400/);
      expect(error.statusCode).toBe(400);
      expect(error.result).toEqual(responseBody);
    });

    it("throws an error if empty response from the server ", async () => {
      fetch.mockReturnValueOnce(Promise.resolve({ text }));
      text.mockReturnValueOnce(Promise.resolve('{ "body": "boo" }'));
      const link = createHttpLink({ uri: "data", fetch: fetch as any });

      const observable = execute(link, { query: sampleQuery });
      const stream = new ObservableStream(observable);

      const error = await stream.takeError();

      expect(error.message).toMatch(
        /Server response was missing for query 'SampleQuery'/
      );
    });

    it("throws if the body can't be stringified", async () => {
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
    it("throws a Server error if response is > 300 with unparsable json", async () => {
      fetch.mockReturnValueOnce(
        Promise.resolve({ status: 400, text: unparsableJson })
      );
      const link = createHttpLink({ uri: "data", fetch: fetch as any });

      const observable = execute(link, { query: sampleQuery });
      const stream = new ObservableStream(observable);

      const error: ServerParseError = await stream.takeError();

      expect(error.message).toMatch(
        "Response not successful: Received status code 400"
      );
      expect(error.statusCode).toBe(400);
      expect(error.response).toBeDefined();
      expect(error.bodyText).toBe(undefined);
    });

    it("throws a ServerParseError if response is 200 with unparsable json", async () => {
      fetch.mockReturnValueOnce(
        Promise.resolve({ status: 200, text: unparsableJson })
      );
      const link = createHttpLink({ uri: "data", fetch: fetch as any });

      const observable = execute(link, { query: sampleQuery });
      const stream = new ObservableStream(observable);

      const error: ServerParseError = await stream.takeError();

      expect(error.message).toMatch(/JSON/);
      expect(error.statusCode).toBe(200);
      expect(error.response).toBeDefined();
      expect(error.bodyText).toBe(body);
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

        await expect(observableStream).toEmitNext();

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

        await expect(observableStream).toEmitNext();

        expect(fetch).toHaveBeenCalledWith(
          "/graphql",
          expect.objectContaining({
            headers: {
              accept: "application/graphql-response+json",
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
      it("with errors", (done) => {
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

        await expect(observableStream).toEmitNext();

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
});
