import assert from "node:assert";

import { from } from "rxjs";

import type { DocumentNode } from "@apollo/client";
import {
  ApolloClient,
  ApolloLink,
  gql,
  InMemoryCache,
  NetworkStatus,
} from "@apollo/client";
import { Defer20220824Handler } from "@apollo/client/incremental";
import {
  executeSchemaGraphQL17Alpha2,
  friendListSchemaGraphQL17Alpha2,
  markAsStreaming,
  ObservableStream,
  promiseWithResolvers,
} from "@apollo/client/testing/internal";

// This is the test setup of the `graphql-js` v17.0.0-alpha.2 release:
// https://github.com/graphql/graphql-js/blob/042002c3d332d36c67861f5b37d39b74d54d97d4/src/execution/__tests__/stream-test.ts

const friends = [
  { name: "Luke", id: 1 },
  { name: "Han", id: 2 },
  { name: "Leia", id: 3 },
];

function run(document: DocumentNode, rootValue: unknown = {}) {
  return executeSchemaGraphQL17Alpha2(
    friendListSchemaGraphQL17Alpha2,
    document,
    rootValue
  );
}

function createSchemaLink(rootValue?: Record<string, unknown>) {
  return new ApolloLink((operation) => {
    return from(run(operation.query, rootValue));
  });
}

describe("Execute: stream directive", () => {
  it("Can stream a list field", async () => {
    const query = gql`
      query {
        scalarList @stream(initialCount: 1)
      }
    `;
    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      scalarList: () => ["apple", "banana", "coconut"],
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          scalarList: ["apple"],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          scalarList: ["apple", "banana", "coconut"],
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Can use default value of initialCount", async () => {
    const query = gql`
      query {
        scalarList @stream
      }
    `;
    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      scalarList: () => ["apple", "banana", "coconut"],
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          scalarList: [],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          scalarList: ["apple", "banana"],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          scalarList: ["apple", "banana", "coconut"],
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Negative values of initialCount throw field errors", async () => {
    // from a client perspective, a regular graphql query
  });

  it.skip("Returns label from stream directive", async () => {
    // from a client perspective, a repeat of a previous test
  });

  it.skip("Can disable @stream using if argument", async () => {
    // from a client perspective, a regular graphql query
  });

  it("Does not disable stream with null if argument", async () => {
    const query = gql`
      query ($shouldStream: Boolean) {
        scalarList @stream(initialCount: 2, if: $shouldStream)
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      scalarList: () => ["apple", "banana", "coconut"],
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          scalarList: ["apple", "banana"],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          scalarList: ["apple", "banana", "coconut"],
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Can stream multi-dimensional lists", async () => {
    const query = gql`
      query {
        scalarListList @stream(initialCount: 1)
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      scalarListList: () => [
        ["apple", "apple", "apple"],
        ["banana", "banana", "banana"],
        ["coconut", "coconut", "coconut"],
      ],
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          scalarListList: [["apple", "apple", "apple"]],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          scalarListList: [
            ["apple", "apple", "apple"],
            ["banana", "banana", "banana"],
            ["coconut", "coconut", "coconut"],
          ],
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Can stream a field that returns a list of promises", async () => {
    const query = gql`
      query {
        friendList @stream(initialCount: 2) {
          name
          id
        }
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      friendList: () => friends.map((f) => Promise.resolve(f)),
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [
            {
              name: "Luke",
              id: "1",
            },
            {
              name: "Han",
              id: "2",
            },
          ],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [
            { name: "Luke", id: "1" },
            { name: "Han", id: "2" },
            { name: "Leia", id: "3" },
          ],
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Can stream in correct order with lists of promises", async () => {
    const query = gql`
      query {
        friendList @stream(initialCount: 0) {
          name
          id
        }
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      friendList: () => friends.map((f) => Promise.resolve(f)),
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ name: "Luke", id: "1" }],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [
            { name: "Luke", id: "1" },
            { name: "Han", id: "2" },
          ],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [
            { name: "Luke", id: "1" },
            { name: "Han", id: "2" },
            { name: "Leia", id: "3" },
          ],
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Handles rejections in a field that returns a list of promises before initialCount is reached", async () => {
    const query = gql`
      query {
        friendList @stream(initialCount: 2) {
          name
          id
        }
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      friendList: () =>
        friends.map((f, i) => {
          if (i === 1) {
            return Promise.reject(new Error("bad"));
          }
          return Promise.resolve(f);
        }),
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ name: "Luke", id: "1" }, null],
        },
        errors: [
          {
            message: "bad",
            path: ["friendList", 1],
          },
        ],
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [
            { name: "Luke", id: "1" },
            null,
            { name: "Leia", id: "3" },
          ],
        },
        errors: [
          {
            message: "bad",
            path: ["friendList", 1],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Handles rejections in a field that returns a list of promises after initialCount is reached", async () => {
    const query = gql`
      query {
        friendList @stream(initialCount: 1) {
          name
          id
        }
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      friendList: () =>
        friends.map((f, i) => {
          if (i === 1) {
            return Promise.reject(new Error("bad"));
          }
          return Promise.resolve(f);
        }),
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ name: "Luke", id: "1" }],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [
            { name: "Luke", id: "1" },
            null,
            { name: "Leia", id: "3" },
          ],
        },
        errors: [
          {
            message: "bad",
            path: ["friendList", 1],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Can stream a field that returns an async iterable", async () => {
    const query = gql`
      query {
        friendList @stream {
          name
          id
        }
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      async *friendList() {
        yield await Promise.resolve(friends[0]);
        yield await Promise.resolve(friends[1]);
        yield await Promise.resolve(friends[2]);
      },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ name: "Luke", id: "1" }],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [
            { name: "Luke", id: "1" },
            { name: "Han", id: "2" },
          ],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [
            { name: "Luke", id: "1" },
            { name: "Han", id: "2" },
            { name: "Leia", id: "3" },
          ],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [
            { name: "Luke", id: "1" },
            { name: "Han", id: "2" },
            { name: "Leia", id: "3" },
          ],
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Can stream a field that returns an async iterable, using a non-zero initialCount", async () => {
    const query = gql`
      query {
        friendList @stream(initialCount: 2) {
          name
          id
        }
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      async *friendList() {
        yield await Promise.resolve(friends[0]);
        yield await Promise.resolve(friends[1]);
        yield await Promise.resolve(friends[2]);
      },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [
            { name: "Luke", id: "1" },
            { name: "Han", id: "2" },
          ],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [
            { name: "Luke", id: "1" },
            { name: "Han", id: "2" },
            { name: "Leia", id: "3" },
          ],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [
            { name: "Luke", id: "1" },
            { name: "Han", id: "2" },
            { name: "Leia", id: "3" },
          ],
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Negative values of initialCount throw field errors on a field that returns an async iterable", async () => {
    // from a client persective, a regular graphql query
  });

  it.skip("Can handle concurrent calls to .next() without waiting", async () => {
    // from a client persective, a repeat of a previous test
  });

  it.skip("Handles error thrown in async iterable before initialCount is reached", async () => {
    // from a client perspective, a regular graphql query
  });

  it("Handles error thrown in async iterable after initialCount is reached", async () => {
    const query = gql`
      query {
        friendList @stream(initialCount: 1) {
          name
          id
        }
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      async *friendList() {
        yield await Promise.resolve(friends[0]);
        throw new Error("bad");
      },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ name: "Luke", id: "1" }],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ name: "Luke", id: "1" }, null],
        },
        errors: [
          {
            message: "bad",
            path: ["friendList", 1],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Handles null returned in non-null list items after initialCount is reached", async () => {
    const query = gql`
      query {
        nonNullFriendList @stream(initialCount: 1) {
          name
        }
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      nonNullFriendList: () => [friends[0], null],
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          nonNullFriendList: [{ name: "Luke" }],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          nonNullFriendList: [{ name: "Luke" }],
        },
        errors: [
          {
            message:
              "Cannot return null for non-nullable field Query.nonNullFriendList.",
            path: ["nonNullFriendList", 1],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Handles null returned in non-null async iterable list items after initialCount is reached", async () => {
    // from a client perspective, a repeat of the previous test
  });

  it("Handles errors thrown by completeValue after initialCount is reached", async () => {
    const query = gql`
      query {
        scalarList @stream(initialCount: 1)
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      scalarList: () => [friends[0].name, {}],
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          scalarList: ["Luke"],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          scalarList: ["Luke", null],
        },
        errors: [
          {
            message: "String cannot represent value: {}",
            path: ["scalarList", 1],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Handles async errors thrown by completeValue after initialCount is reached", async () => {
    const query = gql`
      query {
        nonNullFriendList @stream(initialCount: 1) {
          nonNullName
        }
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      nonNullFriendList: () => [
        Promise.resolve({ nonNullName: friends[0].name }),
        Promise.resolve({
          nonNullName: () => Promise.reject(new Error("Oops")),
        }),
        Promise.resolve({ nonNullName: friends[1].name }),
      ],
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          nonNullFriendList: [{ nonNullName: "Luke" }],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          nonNullFriendList: [{ nonNullName: "Luke" }],
        },
        errors: [
          {
            message: "Oops",
            path: ["nonNullFriendList", 1, "nonNullName"],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Handles async errors thrown by completeValue after initialCount is reached from async iterable", async () => {
    const query = gql`
      query {
        friendList @stream(initialCount: 1) {
          nonNullName
        }
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      async *friendList() {
        yield await Promise.resolve({ nonNullName: friends[0].name });
        yield await Promise.resolve({
          nonNullName: () => Promise.reject(new Error("Oops")),
        });
        yield await Promise.resolve({ nonNullName: friends[1].name });
      },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ nonNullName: "Luke" }],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ nonNullName: "Luke" }, null],
        },
        errors: [
          {
            message: "Oops",
            path: ["friendList", 1, "nonNullName"],
          },
        ],
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ nonNullName: "Luke" }, null, { nonNullName: "Han" }],
        },
        errors: [
          {
            message: "Oops",
            path: ["friendList", 1, "nonNullName"],
          },
        ],
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ nonNullName: "Luke" }, null, { nonNullName: "Han" }],
        },
        errors: [
          {
            message: "Oops",
            path: ["friendList", 1, "nonNullName"],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Filters payloads that are nulled", async () => {
    // from a client perspective, a regular graphql query
  });

  it("Does not filter payloads when null error is in a different path", async () => {
    const query = gql`
      query {
        otherNestedObject: nestedObject {
          ... @defer {
            scalarField
          }
        }
        nestedObject {
          nestedFriendList @stream(initialCount: 0) {
            name
          }
        }
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      nestedObject: {
        scalarField: () => Promise.reject(new Error("Oops")),
        async *nestedFriendList() {
          yield await Promise.resolve(friends[0]);
        },
      },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          otherNestedObject: {},
          nestedObject: { nestedFriendList: [] },
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          otherNestedObject: {
            scalarField: null,
          },
          nestedObject: { nestedFriendList: [{ name: "Luke" }] },
        },
        errors: [
          {
            message: "Oops",
            path: ["otherNestedObject", "scalarField"],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Filters stream payloads that are nulled in a deferred payload", async () => {
    const query = gql`
      query {
        nestedObject {
          ... @defer {
            deeperNestedObject {
              nonNullScalarField
              deeperNestedFriendList @stream(initialCount: 0) {
                name
              }
            }
          }
        }
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      nestedObject: {
        deeperNestedObject: {
          nonNullScalarField: () => Promise.resolve(null),
          async *deeperNestedFriendList() {
            yield await Promise.resolve(friends[0]);
          },
        },
      },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          nestedObject: {},
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          nestedObject: {
            deeperNestedObject: null,
          },
        },
        errors: [
          {
            message:
              "Cannot return null for non-nullable field DeeperNestedObject.nonNullScalarField.",
            path: ["nestedObject", "deeperNestedObject", "nonNullScalarField"],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Filters defer payloads that are nulled in a stream response", async () => {
    const query = gql`
      query {
        friendList @stream(initialCount: 0) {
          nonNullName
          ... @defer {
            name
          }
        }
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      async *friendList() {
        yield await Promise.resolve({
          name: friends[0].name,
          nonNullName: () => Promise.resolve(null),
        });
      },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [null],
        },
        errors: [
          {
            message:
              "Cannot return null for non-nullable field Friend.nonNullName.",
            path: ["friendList", 0, "nonNullName"],
          },
        ],
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [null],
        },
        errors: [
          {
            message:
              "Cannot return null for non-nullable field Friend.nonNullName.",
            path: ["friendList", 0, "nonNullName"],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Returns iterator and ignores errors when stream payloads are filtered", async () => {
    // from a client perspective, a repeat of a previous test
  });

  it("Handles promises returned by completeValue after initialCount is reached", async () => {
    const query = gql`
      query {
        friendList @stream(initialCount: 1) {
          id
          name
        }
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      async *friendList() {
        yield await Promise.resolve(friends[0]);
        yield await Promise.resolve(friends[1]);
        yield await Promise.resolve({
          id: friends[2].id,
          name: () => Promise.resolve(friends[2].name),
        });
      },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1", name: "Luke" }],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [
            { id: "1", name: "Luke" },
            { id: "2", name: "Han" },
          ],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [
            { id: "1", name: "Luke" },
            { id: "2", name: "Han" },
            { id: "3", name: "Leia" },
          ],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [
            { id: "1", name: "Luke" },
            { id: "2", name: "Han" },
            { id: "3", name: "Leia" },
          ],
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Returns payloads in correct order when parent deferred fragment resolves slower than stream", async () => {
    const { promise: slowFieldPromise, resolve: resolveSlowField } =
      promiseWithResolvers();
    const query = gql`
      query {
        nestedObject {
          ...DeferFragment @defer
        }
      }
      fragment DeferFragment on NestedObject {
        scalarField
        nestedFriendList @stream(initialCount: 0) {
          name
        }
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      nestedObject: {
        scalarField: () => slowFieldPromise,
        async *nestedFriendList() {
          yield await Promise.resolve(friends[0]);
          yield await Promise.resolve(friends[1]);
        },
      },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          nestedObject: {},
        },
      });
      expect(request.hasNext).toBe(true);
    }

    resolveSlowField("slow");

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          nestedObject: {
            scalarField: "slow",
            nestedFriendList: [],
          },
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          nestedObject: {
            scalarField: "slow",
            nestedFriendList: [{ name: "Luke" }],
          },
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          nestedObject: {
            scalarField: "slow",
            nestedFriendList: [{ name: "Luke" }, { name: "Han" }],
          },
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          nestedObject: {
            scalarField: "slow",
            nestedFriendList: [{ name: "Luke" }, { name: "Han" }],
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Can @defer fields that are resolved after async iterable is complete", async () => {
    const { promise: slowFieldPromise, resolve: resolveSlowField } =
      promiseWithResolvers();
    const {
      promise: iterableCompletionPromise,
      resolve: resolveIterableCompletion,
    } = promiseWithResolvers();

    const query = gql`
      query {
        friendList @stream(initialCount: 1, label: "stream-label") {
          ...NameFragment @defer(label: "DeferName") @defer(label: "DeferName")
          id
        }
      }
      fragment NameFragment on Friend {
        name
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      async *friendList() {
        yield await Promise.resolve(friends[0]);
        yield await Promise.resolve({
          id: friends[1].id,
          name: () => slowFieldPromise,
        });
        await iterableCompletionPromise;
      },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1" }],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    resolveIterableCompletion(null);

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1", name: "Luke" }, { id: "2" }],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    resolveSlowField("Han");

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [
            { id: "1", name: "Luke" },
            { id: "2", name: "Han" },
          ],
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Can @defer fields that are resolved before async iterable is complete", async () => {
    // from a client perspective, a repeat of the previous test
  });

  it.skip("Returns underlying async iterables when returned generator is returned", async () => {
    // not interesting from a client perspective
  });

  it.skip("Can return async iterable when underlying iterable does not have a return method", async () => {
    // not interesting from a client perspective
  });

  it.skip("Returns underlying async iterables when returned generator is thrown", async () => {
    // not interesting from a client perspective
  });
});

// quick smoke test. More exhaustive `@stream` tests can be found in
// src/core/__tests__/client.watchQuery/streamDefer20220824.test.ts
test("Defer20220824Handler can be used with `ApolloClient`", async () => {
  const client = new ApolloClient({
    link: createSchemaLink({ friendList: friends }),
    cache: new InMemoryCache(),
    incrementalHandler: new Defer20220824Handler(),
  });

  const query = gql`
    query FriendListQuery {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  const observableStream = new ObservableStream(client.watchQuery({ query }));

  await expect(observableStream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    loading: true,
    data: markAsStreaming({
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    }),
    dataState: "streaming",
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    data: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Leia" },
      ],
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
});

test("properly merges streamed data into cache data", async () => {
  const query = gql`
    query {
      friendList @stream(initialCount: 2) {
        name
        id
      }
    }
  `;

  const handler = new Defer20220824Handler();
  const request = handler.startRequest({ query });

  const incoming = run(query, {
    friendList: () => friends.map((f) => Promise.resolve(f)),
  });

  {
    const { value: chunk, done } = await incoming.next();

    assert(!done);
    assert(handler.isIncrementalResult(chunk));
    expect(
      request.handle(
        {
          friendList: [
            { name: "Luke Cached", id: "1" },
            { name: "Han Cached", id: "2" },
            { name: "Leia Cached", id: "3" },
          ],
        },
        chunk
      )
    ).toStrictEqualTyped({
      data: {
        friendList: [
          { name: "Luke", id: "1" },
          { name: "Han", id: "2" },
          { name: "Leia Cached", id: "3" },
        ],
      },
    });
    expect(request.hasNext).toBe(true);
  }

  {
    const { value: chunk, done } = await incoming.next();

    assert(!done);
    assert(handler.isIncrementalResult(chunk));
    expect(
      request.handle(
        {
          friendList: [
            { name: "Luke", id: "1" },
            { name: "Han", id: "2" },
            { name: "Leia Cached", id: "3" },
          ],
        },
        chunk
      )
    ).toStrictEqualTyped({
      data: {
        friendList: [
          { name: "Luke", id: "1" },
          { name: "Han", id: "2" },
          { name: "Leia", id: "3" },
        ],
      },
    });
    expect(request.hasNext).toBe(false);
  }
});

test("properly merges streamed data into partial cache data", async () => {
  const query = gql`
    query {
      friendList @stream(initialCount: 2) {
        name
        id
      }
    }
  `;

  const handler = new Defer20220824Handler();
  const request = handler.startRequest({ query });

  const incoming = run(query, {
    friendList: () => friends.map((f) => Promise.resolve(f)),
  });

  {
    const { value: chunk, done } = await incoming.next();

    assert(!done);
    assert(handler.isIncrementalResult(chunk));
    expect(
      request.handle(
        { friendList: [{ id: "1" }, { id: "2" }, { id: "3" }] },
        chunk
      )
    ).toStrictEqualTyped({
      data: {
        friendList: [
          { name: "Luke", id: "1" },
          { name: "Han", id: "2" },
          { id: "3" },
        ],
      },
    });
    expect(request.hasNext).toBe(true);
  }

  {
    const { value: chunk, done } = await incoming.next();

    assert(!done);
    assert(handler.isIncrementalResult(chunk));
    expect(
      request.handle(
        {
          friendList: [
            { name: "Luke", id: "1" },
            { name: "Han", id: "2" },
            { id: "3" },
          ],
        },
        chunk
      )
    ).toStrictEqualTyped({
      data: {
        friendList: [
          { name: "Luke", id: "1" },
          { name: "Han", id: "2" },
          { name: "Leia", id: "3" },
        ],
      },
    });
    expect(request.hasNext).toBe(false);
  }
});

test("properly merges streamed data into list with fewer items", async () => {
  const query = gql`
    query {
      friendList @stream(initialCount: 2) {
        name
        id
      }
    }
  `;

  const handler = new Defer20220824Handler();
  const request = handler.startRequest({ query });

  const incoming = run(query, {
    friendList: () => friends.map((f) => Promise.resolve(f)),
  });

  {
    const { value: chunk, done } = await incoming.next();

    assert(!done);
    assert(handler.isIncrementalResult(chunk));
    expect(
      request.handle({ friendList: [{ id: "1", name: "Luke Cached" }] }, chunk)
    ).toStrictEqualTyped({
      data: {
        friendList: [
          { name: "Luke", id: "1" },
          { name: "Han", id: "2" },
        ],
      },
    });
    expect(request.hasNext).toBe(true);
  }

  {
    const { value: chunk, done } = await incoming.next();

    assert(!done);
    assert(handler.isIncrementalResult(chunk));
    expect(
      request.handle(
        {
          friendList: [
            { name: "Luke", id: "1" },
            { name: "Han", id: "2" },
          ],
        },
        chunk
      )
    ).toStrictEqualTyped({
      data: {
        friendList: [
          { name: "Luke", id: "1" },
          { name: "Han", id: "2" },
          { name: "Leia", id: "3" },
        ],
      },
    });
    expect(request.hasNext).toBe(false);
  }
});

test("properly merges streamed data into list with more items", async () => {
  const query = gql`
    query {
      friendList @stream(initialCount: 2) {
        name
        id
      }
    }
  `;

  const handler = new Defer20220824Handler();
  const request = handler.startRequest({ query });

  const incoming = run(query, {
    friendList: () => friends.map((f) => Promise.resolve(f)),
  });

  {
    const { value: chunk, done } = await incoming.next();

    assert(!done);
    assert(handler.isIncrementalResult(chunk));
    expect(
      request.handle(
        {
          friendList: [
            { name: "Luke Cached", id: "1" },
            { name: "Han Cached", id: "2" },
            { name: "Leia Cached", id: "3" },
            { name: "Chewbacca Cached", id: "4" },
          ],
        },
        chunk
      )
    ).toStrictEqualTyped({
      data: {
        friendList: [
          { name: "Luke", id: "1" },
          { name: "Han", id: "2" },
          { name: "Leia Cached", id: "3" },
          { name: "Chewbacca Cached", id: "4" },
        ],
      },
    });
    expect(request.hasNext).toBe(true);
  }

  {
    const { value: chunk, done } = await incoming.next();

    assert(!done);
    assert(handler.isIncrementalResult(chunk));
    expect(
      request.handle(
        {
          friendList: [
            { name: "Luke", id: "1" },
            { name: "Han", id: "2" },
            { name: "Leia Cached", id: "3" },
            { name: "Chewbacca Cached", id: "4" },
          ],
        },
        chunk
      )
    ).toStrictEqualTyped({
      data: {
        friendList: [
          { name: "Luke", id: "1" },
          { name: "Han", id: "2" },
          { name: "Leia", id: "3" },
          { name: "Chewbacca Cached", id: "4" },
        ],
      },
    });
    expect(request.hasNext).toBe(false);
  }
});

test("properly merges cache data when list is included in deferred chunk", async () => {
  const { promise: slowFieldPromise, resolve: resolveSlowField } =
    promiseWithResolvers();

  const query = gql`
    query {
      nestedObject {
        ...DeferFragment @defer
      }
    }
    fragment DeferFragment on NestedObject {
      scalarField
      nestedFriendList @stream(initialCount: 0) {
        name
      }
    }
  `;

  const handler = new Defer20220824Handler();
  const request = handler.startRequest({ query });

  const incoming = run(query, {
    nestedObject: {
      scalarField: () => slowFieldPromise,
      async *nestedFriendList() {
        yield await Promise.resolve(friends[0]);
        yield await Promise.resolve(friends[1]);
      },
    },
  });

  {
    const { value: chunk, done } = await incoming.next();

    assert(!done);
    assert(handler.isIncrementalResult(chunk));
    expect(
      request.handle(
        {
          nestedObject: {
            scalarField: "cached",
            nestedFriendList: [{ name: "Luke Cached" }, { name: "Han Cached" }],
          },
        },
        chunk
      )
    ).toStrictEqualTyped({
      data: {
        nestedObject: {
          scalarField: "cached",
          nestedFriendList: [{ name: "Luke Cached" }, { name: "Han Cached" }],
        },
      },
    });
    expect(request.hasNext).toBe(true);
  }

  resolveSlowField("slow");

  {
    const { value: chunk, done } = await incoming.next();

    assert(!done);
    assert(handler.isIncrementalResult(chunk));
    expect(
      request.handle(
        {
          nestedObject: {
            scalarField: "cached",
            nestedFriendList: [{ name: "Luke Cached" }, { name: "Han Cached" }],
          },
        },
        chunk
      )
    ).toStrictEqualTyped({
      data: {
        nestedObject: {
          scalarField: "slow",
          nestedFriendList: [{ name: "Luke Cached" }, { name: "Han Cached" }],
        },
      },
    });
    expect(request.hasNext).toBe(true);
  }

  {
    const { value: chunk, done } = await incoming.next();

    assert(!done);
    assert(handler.isIncrementalResult(chunk));
    expect(request.handle(undefined, chunk)).toStrictEqualTyped({
      data: {
        nestedObject: {
          scalarField: "slow",
          nestedFriendList: [{ name: "Luke" }, { name: "Han Cached" }],
        },
      },
    });
    expect(request.hasNext).toBe(true);
  }

  {
    const { value: chunk, done } = await incoming.next();

    assert(!done);
    assert(handler.isIncrementalResult(chunk));
    expect(
      request.handle(
        {
          nestedObject: {
            scalarField: "slow",
            nestedFriendList: [{ name: "Luke" }, { name: "Han Cached" }],
          },
        },
        chunk
      )
    ).toStrictEqualTyped({
      data: {
        nestedObject: {
          scalarField: "slow",
          nestedFriendList: [{ name: "Luke" }, { name: "Han" }],
        },
      },
    });
    expect(request.hasNext).toBe(true);
  }

  {
    const { value: chunk, done } = await incoming.next();

    assert(!done);
    assert(handler.isIncrementalResult(chunk));
    expect(
      request.handle(
        {
          nestedObject: {
            scalarField: "slow",
            nestedFriendList: [{ name: "Luke" }, { name: "Han" }],
          },
        },
        chunk
      )
    ).toStrictEqualTyped({
      data: {
        nestedObject: {
          scalarField: "slow",
          nestedFriendList: [{ name: "Luke" }, { name: "Han" }],
        },
      },
    });
    expect(request.hasNext).toBe(false);
  }
});
