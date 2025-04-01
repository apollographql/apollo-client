import crypto from "crypto";

import fetchMock from "fetch-mock";
import { print } from "graphql";
import { gql } from "graphql-tag";
import { times } from "lodash";
import { firstValueFrom, Observable } from "rxjs";

import { ApolloLink, execute } from "@apollo/client/link/core";
import { createHttpLink } from "@apollo/client/link/http";
import {
  createPersistedQueryLink as createPersistedQuery,
  VERSION,
} from "@apollo/client/link/persisted-queries";
import { wait } from "@apollo/client/testing";

import { ObservableStream } from "../../../testing/internal/index.js";


// Necessary configuration in order to mock multiple requests
// to a single (/graphql) endpoint
// see: http://www.wheresrhys.co.uk/fetch-mock/#usageconfiguration
fetchMock.config.overwriteRoutes = false;

afterAll(() => {
  fetchMock.config.overwriteRoutes = true;
});

const makeAliasFields = (fieldName: string, numAliases: number) =>
  times(numAliases, (idx) => `${fieldName}${idx}: ${fieldName}`).reduce(
    (aliasBody, currentAlias) => `${aliasBody}\n    ${currentAlias}`
  );

const query = gql`
  query Test($id: ID!) {
    foo(id: $id) {
      bar
      ${makeAliasFields("title", 1000)}
    }
  }
`;

const variables = { id: 1 };
const queryString = print(query);
const data = {
  foo: { bar: true },
};
const response = JSON.stringify({ data });
const errors = [{ message: "PersistedQueryNotFound" }];
const errorsWithCode = [
  {
    message: "SomeOtherMessage",
    extensions: {
      code: "PERSISTED_QUERY_NOT_FOUND",
    },
  },
];
const giveUpErrors = [{ message: "PersistedQueryNotSupported" }];
const giveUpErrorsWithCode = [
  {
    message: "SomeOtherMessage",
    extensions: {
      code: "PERSISTED_QUERY_NOT_SUPPORTED",
    },
  },
];
const multipleErrors = [...errors, { message: "not logged in" }];
const errorResponse = JSON.stringify({ errors });
const errorResponseWithCode = JSON.stringify({ errors: errorsWithCode });
const giveUpResponse = JSON.stringify({ errors: giveUpErrors });
const giveUpResponseWithCode = JSON.stringify({ errors: giveUpErrorsWithCode });
const multiResponse = JSON.stringify({ errors: multipleErrors });

function sha256(data: string) {
  const hash = crypto.createHash("sha256");
  hash.update(data);
  return hash.digest("hex");
}

const hash = sha256(queryString);

describe("happy path", () => {
  beforeEach(async () => {
    fetchMock.restore();
  });

  it("sends a sha256 hash of the query under extensions", async () => {
    fetchMock.post(
      "/graphql",
      () => new Promise((resolve) => resolve({ body: response }))
    );
    const link = createPersistedQuery({ sha256 }).concat(createHttpLink());
    const observable = execute(link, { query, variables });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitValue({ data });

    const [uri, request] = fetchMock.lastCall()!;

    expect(uri).toEqual("/graphql");
    expect(request!.body!).toBe(
      JSON.stringify({
        operationName: "Test",
        variables,
        extensions: {
          persistedQuery: {
            version: VERSION,
            sha256Hash: hash,
          },
        },
      })
    );
  });

  it("sends a version along with the request", async () => {
    fetchMock.post(
      "/graphql",
      () => new Promise((resolve) => resolve({ body: response }))
    );
    const link = createPersistedQuery({ sha256 }).concat(createHttpLink());
    const observable = execute(link, { query, variables });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitValue({ data });

    const [uri, request] = fetchMock.lastCall()!;
    expect(uri).toEqual("/graphql");

    const parsed = JSON.parse(request!.body!.toString());
    expect(parsed.extensions.persistedQuery.version).toBe(VERSION);
  });

  it("memoizes between requests", async () => {
    fetchMock.post(
      "/graphql",
      () => new Promise((resolve) => resolve({ body: response })),
      { repeat: 1 }
    );
    fetchMock.post(
      "/graphql",
      () => new Promise((resolve) => resolve({ body: response })),
      { repeat: 1 }
    );
    const hashSpy = jest.fn(sha256);
    const link = createPersistedQuery({ sha256: hashSpy }).concat(
      createHttpLink()
    );

    {
      const observable = execute(link, { query, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitValue({ data });
      await expect(stream).toComplete();
      expect(hashSpy).toHaveBeenCalledTimes(1);
    }

    {
      const observable = execute(link, { query, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitValue({ data });
      await expect(stream).toComplete();
      expect(hashSpy).toHaveBeenCalledTimes(1);
    }
  });

  it("clears the cache when calling `resetHashCache`", async () => {
    fetchMock.post(
      "/graphql",
      () => new Promise((resolve) => resolve({ body: response })),
      { repeat: 1 }
    );

    const hashRefs: WeakRef<String>[] = [];
    function hash(query: string) {
      const newHash = new String(query);
      hashRefs.push(new WeakRef(newHash));
      return newHash as string;
    }
    const persistedLink = createPersistedQuery({ sha256: hash });
    await new Promise<void>((complete) =>
      execute(persistedLink.concat(createHttpLink()), {
        query,
        variables,
      }).subscribe({ complete })
    );

    await expect(hashRefs[0]).not.toBeGarbageCollected();
    persistedLink.resetHashCache();
    await expect(hashRefs[0]).toBeGarbageCollected();
  });

  it("supports loading the hash from other method", async () => {
    fetchMock.post(
      "/graphql",
      () => new Promise((resolve) => resolve({ body: response }))
    );
    const generateHash = (query: any) => Promise.resolve("foo");
    const link = createPersistedQuery({ generateHash }).concat(
      createHttpLink()
    );

    const observable = execute(link, { query, variables });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitValue({ data });

    const [uri, request] = fetchMock.lastCall()!;
    expect(uri).toEqual("/graphql");

    const parsed = JSON.parse(request!.body!.toString());
    expect(parsed.extensions.persistedQuery.sha256Hash).toBe("foo");
  });

  it("errors if unable to convert to sha256", async () => {
    fetchMock.post(
      "/graphql",
      () => new Promise((resolve) => resolve({ body: response }))
    );
    const link = createPersistedQuery({ sha256 }).concat(createHttpLink());

    const observable = execute(link, { query: "1234", variables } as any);
    const stream = new ObservableStream(observable);

    const error = await stream.takeError();

    expect(error.message).toMatch(/Invalid AST Node/);
  });

  it("unsubscribes correctly", async () => {
    const delay = new ApolloLink(() => {
      return new Observable((ob) => {
        setTimeout(() => {
          ob.next({ data });
          ob.complete();
        }, 100);
      });
    });
    const link = createPersistedQuery({ sha256 }).concat(delay);

    const observable = execute(link, { query, variables });
    const stream = new ObservableStream(observable);

    await wait(10);

    stream.unsubscribe();

    await expect(stream).not.toEmitAnything({ timeout: 150 });
  });

  it("should error if `sha256` and `generateHash` options are both missing", async () => {
    const createPersistedQueryFn = createPersistedQuery as any;

    expect(() => createPersistedQueryFn()).toThrow(
      'Missing/invalid "sha256" or "generateHash" function'
    );
  });

  it.each(["sha256", "generateHash"])(
    "should error if `%s` option is not a function",
    async (option) => {
      const createPersistedQueryFn = createPersistedQuery as any;

      expect(() => createPersistedQueryFn({ [option]: "ooops" })).toThrow(
        'Missing/invalid "sha256" or "generateHash" function'
      );
    }
  );

  it("should work with a synchronous SHA-256 function", async () => {
    const crypto = require("crypto");
    const sha256Hash = crypto.createHmac("sha256", queryString).digest("hex");

    fetchMock.post(
      "/graphql",
      () => new Promise((resolve) => resolve({ body: response }))
    );
    const link = createPersistedQuery({
      sha256(data) {
        return crypto.createHmac("sha256", data).digest("hex");
      },
    }).concat(createHttpLink());

    const observable = execute(link, { query, variables });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitValue({ data });

    const [uri, request] = fetchMock.lastCall()!;

    expect(uri).toEqual("/graphql");
    expect(request!.body!).toBe(
      JSON.stringify({
        operationName: "Test",
        variables,
        extensions: {
          persistedQuery: {
            version: VERSION,
            sha256Hash: sha256Hash,
          },
        },
      })
    );
  });
});

describe("failure path", () => {
  beforeEach(async () => {
    fetchMock.restore();
  });

  it.each([
    ["error message", errorResponse],
    ["error code", errorResponseWithCode],
  ] as const)(
    "correctly identifies the error shape from the server (%s)",
    (_description, failingResponse) =>
      new Promise<void>((resolve, reject) => {
        fetchMock.post(
          "/graphql",
          () => new Promise((resolve) => resolve({ body: failingResponse })),
          { repeat: 1 }
        );
        // `repeat: 1` simulates a `mockResponseOnce` API with fetch-mock:
        // it limits the number of times the route can be used,
        // after which the call to `fetch()` will fall through to be
        // handled by any other routes defined...
        // With `overwriteRoutes = false`, this means
        // subsequent /graphql mocks will be used
        // see: http://www.wheresrhys.co.uk/fetch-mock/#usageconfiguration
        fetchMock.post(
          "/graphql",
          () => new Promise((resolve) => resolve({ body: response })),
          { repeat: 1 }
        );
        const link = createPersistedQuery({ sha256 }).concat(createHttpLink());
        execute(link, { query, variables }).subscribe((result) => {
          expect(result.data).toEqual(data);
          const [[, failure], [, success]] = fetchMock.calls();
          expect(JSON.parse(failure!.body!.toString()).query).not.toBeDefined();
          expect(JSON.parse(success!.body!.toString()).query).toBe(queryString);
          expect(
            JSON.parse(success!.body!.toString()).extensions.persistedQuery
              .sha256Hash
          ).toBe(hash);
          resolve();
        }, reject);
      })
  );

  it("sends GET for the first response only with useGETForHashedQueries", async () => {
    const params = new URLSearchParams({
      operationName: "Test",
      variables: JSON.stringify({
        id: 1,
      }),
      extensions: JSON.stringify({
        persistedQuery: {
          version: 1,
          sha256Hash: hash,
        },
      }),
    }).toString();
    fetchMock.get(
      `/graphql?${params}`,
      () => new Promise((resolve) => resolve({ body: errorResponse }))
    );
    fetchMock.post(
      "/graphql",
      () => new Promise((resolve) => resolve({ body: response }))
    );
    const link = createPersistedQuery({
      sha256,
      useGETForHashedQueries: true,
    }).concat(createHttpLink());
    const observable = execute(link, { query, variables });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitValue({ data });

    const [[, failure]] = fetchMock.calls();

    expect(failure!.method).toBe("GET");
    expect(failure!.body).not.toBeDefined();

    const [, [, success]] = fetchMock.calls();

    expect(success!.method).toBe("POST");
    expect(JSON.parse(success!.body!.toString()).query).toBe(queryString);
    expect(
      JSON.parse(success!.body!.toString()).extensions.persistedQuery.sha256Hash
    ).toBe(hash);
  });

  it("sends POST for both requests without useGETForHashedQueries", async () => {
    fetchMock.post(
      "/graphql",
      () => new Promise((resolve) => resolve({ body: errorResponse })),
      { repeat: 1 }
    );
    fetchMock.post(
      "/graphql",
      () => new Promise((resolve) => resolve({ body: response })),
      { repeat: 1 }
    );
    const link = createPersistedQuery({ sha256 }).concat(createHttpLink());
    const observable = execute(link, { query, variables });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitValue({ data });

    const [[, failure]] = fetchMock.calls();

    expect(failure!.method).toBe("POST");
    expect(JSON.parse(failure!.body!.toString())).toEqual({
      operationName: "Test",
      variables,
      extensions: {
        persistedQuery: {
          version: VERSION,
          sha256Hash: hash,
        },
      },
    });

    const [, [, success]] = fetchMock.calls();

    expect(success!.method).toBe("POST");
    expect(JSON.parse(success!.body!.toString())).toEqual({
      operationName: "Test",
      query: queryString,
      variables,
      extensions: {
        persistedQuery: {
          version: VERSION,
          sha256Hash: hash,
        },
      },
    });
  });

  // https://github.com/apollographql/apollo-client/pull/7456
  it("forces POST request when sending full query", async () => {
    fetchMock.post(
      "/graphql",
      () => new Promise((resolve) => resolve({ body: giveUpResponse })),
      { repeat: 1 }
    );
    fetchMock.post(
      "/graphql",
      () => new Promise((resolve) => resolve({ body: response })),
      { repeat: 1 }
    );
    const link = createPersistedQuery({
      sha256,
      disable({ operation }) {
        operation.setContext({
          fetchOptions: {
            method: "GET",
          },
        });
        return true;
      },
    }).concat(createHttpLink());
    const observable = execute(link, { query, variables });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitValue({ data });

    const [[, failure]] = fetchMock.calls();

    expect(failure!.method).toBe("POST");
    expect(JSON.parse(failure!.body!.toString())).toEqual({
      operationName: "Test",
      variables,
      extensions: {
        persistedQuery: {
          version: VERSION,
          sha256Hash: hash,
        },
      },
    });

    const [, [, success]] = fetchMock.calls();

    expect(success!.method).toBe("POST");
    expect(JSON.parse(success!.body!.toString())).toEqual({
      operationName: "Test",
      query: queryString,
      variables,
    });
  });

  it.each([
    ["error message", giveUpResponse],
    ["error code", giveUpResponseWithCode],
  ] as const)(
    "does not try again after receiving NotSupported error (%s)",
    (_description, failingResponse) =>
      new Promise<void>((resolve, reject) => {
        fetchMock.post(
          "/graphql",
          () => new Promise((resolve) => resolve({ body: failingResponse })),
          { repeat: 1 }
        );
        fetchMock.post(
          "/graphql",
          () => new Promise((resolve) => resolve({ body: response })),
          { repeat: 1 }
        );
        // mock it again so we can verify it doesn't try anymore
        fetchMock.post(
          "/graphql",
          () => new Promise((resolve) => resolve({ body: response })),
          { repeat: 1 }
        );
        const link = createPersistedQuery({ sha256 }).concat(createHttpLink());

        execute(link, { query, variables }).subscribe((result) => {
          expect(result.data).toEqual(data);
          const [[, failure]] = fetchMock.calls();
          expect(JSON.parse(failure!.body!.toString()).query).not.toBeDefined();
          const [, [, success]] = fetchMock.calls();
          expect(JSON.parse(success!.body!.toString()).query).toBe(queryString);
          expect(
            JSON.parse(success!.body!.toString()).extensions
          ).toBeUndefined();
          execute(link, { query, variables }).subscribe((secondResult) => {
            expect(secondResult.data).toEqual(data);
            const [, , [, success]] = fetchMock.calls();
            expect(JSON.parse(success!.body!.toString()).query).toBe(
              queryString
            );
            expect(
              JSON.parse(success!.body!.toString()).extensions
            ).toBeUndefined();
            resolve();
          }, reject);
        }, reject);
      })
  );

  it.each([
    // TODO(fixme): test flake on CI https://github.com/apollographql/apollo-client/issues/11782
    // ["error message", giveUpResponse],
    ["error code", giveUpResponseWithCode],
  ] as const)(
    "clears the cache when receiving NotSupported error (%s)",
    async (_description, failingResponse) => {
      fetchMock.post(
        "/graphql",
        () => new Promise((resolve) => resolve({ body: failingResponse })),
        { repeat: 1 }
      );
      fetchMock.post(
        "/graphql",
        () => new Promise((resolve) => resolve({ body: response })),
        { repeat: 1 }
      );

      const hashRefs: WeakRef<String>[] = [];
      function hash(query: string) {
        const newHash = new String(query);
        hashRefs.push(new WeakRef(newHash));
        return newHash as string;
      }
      const persistedLink = createPersistedQuery({ sha256: hash });
      await new Promise<void>((complete) =>
        execute(persistedLink.concat(createHttpLink()), {
          query,
          variables,
        }).subscribe({ complete })
      );
      // fetch-mock holds a history of all options it has been called with
      // that includes the `signal` option, which (with the native `AbortController`)
      // has a reference to the `Request` instance, which will somehow reference our
      // hash object
      fetchMock.resetHistory();
      await expect(hashRefs[0]).toBeGarbageCollected();
    }
  );

  it("works with multiple errors", async () => {
    fetchMock.post(
      "/graphql",
      () => new Promise((resolve) => resolve({ body: multiResponse })),
      { repeat: 1 }
    );
    fetchMock.post(
      "/graphql",
      () => new Promise((resolve) => resolve({ body: response })),
      { repeat: 1 }
    );
    const link = createPersistedQuery({ sha256 }).concat(createHttpLink());
    const observable = execute(link, { query, variables });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitValue({ data });

    const [[, failure]] = fetchMock.calls();

    expect(JSON.parse(failure!.body!.toString()).query).not.toBeDefined();

    const [, [, success]] = fetchMock.calls();

    expect(JSON.parse(success!.body!.toString()).query).toBe(queryString);
    expect(
      JSON.parse(success!.body!.toString()).extensions.persistedQuery.sha256Hash
    ).toBe(hash);
  });

  describe.each([[400], [500]])("status %s", (status) => {
    it(`handles a ${status} network with a "PERSISTED_QUERY_NOT_FOUND" error and still retries`, async () => {
      let requestCount = 0;
      fetchMock.post(
        "/graphql",
        () => new Promise((resolve) => resolve({ body: response })),
        { repeat: 1 }
      );

      // mock it again so we can verify it doesn't try anymore
      fetchMock.post(
        "/graphql",
        () => new Promise((resolve) => resolve({ body: response })),
        { repeat: 5 }
      );

      const fetcher = (...args: any[]) => {
        if (++requestCount % 2) {
          return Promise.resolve({
            json: () => Promise.resolve(errorResponseWithCode),
            text: () => Promise.resolve(errorResponseWithCode),
            status,
          });
        }
        // @ts-expect-error
        return global.fetch.apply(null, args);
      };
      const link = createPersistedQuery({ sha256 }).concat(
        createHttpLink({ fetch: fetcher } as any)
      );

      {
        const observable = execute(link, { query, variables });
        const stream = new ObservableStream(observable);

        await expect(stream).toEmitValue({ data });

        const [[, success]] = fetchMock.calls();

        expect(JSON.parse(success!.body!.toString()).query).toBe(queryString);
        expect(
          JSON.parse(success!.body!.toString()).extensions.persistedQuery
            .sha256Hash
        ).toBe(hash);
      }

      {
        const observable = execute(link, { query, variables });
        const stream = new ObservableStream(observable);

        await expect(stream).toEmitValue({ data });

        const [, [, success]] = fetchMock.calls();

        expect(JSON.parse(success!.body!.toString()).query).toBe(queryString);
        expect(
          JSON.parse(success!.body!.toString()).extensions.persistedQuery
            .sha256Hash
        ).toBe(hash);
      }
    });

    it(`will fail on an unrelated ${status} network error, but still send a hash the next request`, async () => {
      let failed = false;
      fetchMock.post(
        "/graphql",
        () => new Promise((resolve) => resolve({ body: response })),
        { repeat: 1 }
      );

      // mock it again so we can verify it doesn't try anymore
      fetchMock.post(
        "/graphql",
        () => new Promise((resolve) => resolve({ body: response })),
        { repeat: 1 }
      );

      const fetcher = (...args: any[]) => {
        if (!failed) {
          failed = true;
          return Promise.resolve({
            json: () => Promise.resolve("This will blow up"),
            text: () => Promise.resolve("THIS WILL BLOW UP"),
            status,
          });
        }
        // @ts-expect-error
        return global.fetch.apply(null, args);
      };
      const link = createPersistedQuery({ sha256 }).concat(
        createHttpLink({ fetch: fetcher } as any)
      );

      const failingAttempt = firstValueFrom(
        execute(link, { query, variables })
      );
      await expect(failingAttempt).rejects.toThrow();
      expect(fetchMock.calls().length).toBe(0);

      const successfullAttempt = firstValueFrom(
        execute(link, { query, variables })
      );
      await expect(successfullAttempt).resolves.toEqual({ data });
      const [[, success]] = fetchMock.calls();
      expect(JSON.parse(success!.body!.toString()).query).toBeUndefined();
      expect(
        JSON.parse(success!.body!.toString()).extensions.persistedQuery
          .sha256Hash
      ).toBe(hash);
    });

    it(`handles ${status} response network error and graphql error without disabling persistedQuery support`, async () => {
      let failed = false;
      fetchMock.post(
        "/graphql",
        () => new Promise((resolve) => resolve({ body: response })),
        { repeat: 1 }
      );

      const fetcher = (...args: any[]) => {
        if (!failed) {
          failed = true;
          return Promise.resolve({
            json: () => Promise.resolve(errorResponse),
            text: () => Promise.resolve(errorResponse),
            status,
          });
        }
        // @ts-expect-error
        return global.fetch.apply(null, args);
      };

      const link = createPersistedQuery({ sha256 }).concat(
        createHttpLink({ fetch: fetcher } as any)
      );

      const observable = execute(link, { query, variables });
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitValue({ data });

      const [[, success]] = fetchMock.calls();

      expect(JSON.parse(success!.body!.toString()).query).toBe(queryString);
      expect(
        JSON.parse(success!.body!.toString()).extensions
      ).not.toBeUndefined();
    });
  });
});
