import assert from "node:assert";

import { Trie } from "@wry/trie";
import { from } from "rxjs";

import type { DocumentNode } from "@apollo/client";
import {
  ApolloClient,
  ApolloLink,
  gql,
  InMemoryCache,
  NetworkStatus,
} from "@apollo/client";
import { GraphQL17Alpha9Handler } from "@apollo/client/incremental";
import {
  executeSchemaGraphQL17Alpha9,
  friendListSchemaGraphQL17Alpha9,
  markAsStreaming,
  ObservableStream,
  promiseWithResolvers,
} from "@apollo/client/testing/internal";
import { streamDetailsSymbol } from "@apollo/client/utilities/internal";

// This is the test setup of the `graphql-js` v17.0.0-alpha.9 release:
// https://github.com/graphql/graphql-js/blob/3283f8adf52e77a47f148ff2f30185c8d11ff0f0/src/execution/__tests__/stream-test.ts

const friends = [
  { name: "Luke", id: 1 },
  { name: "Han", id: 2 },
  { name: "Leia", id: 3 },
];

function resolveOnNextTick(): Promise<void> {
  return Promise.resolve(undefined);
}

function run(
  document: DocumentNode,
  rootValue: unknown = {},
  enableEarlyExecution = false
) {
  return executeSchemaGraphQL17Alpha9(
    friendListSchemaGraphQL17Alpha9,
    document,
    rootValue,
    enableEarlyExecution
  );
}

function createSchemaLink(rootValue?: Record<string, unknown>) {
  return new ApolloLink((operation) => {
    return from(run(operation.query, rootValue));
  });
}

const extensionsWithStreamDetails = {
  [streamDetailsSymbol]: { current: expect.any(Trie) },
};

describe("graphql-js test cases", () => {
  // These test cases mirror stream tests of the `graphql-js` v17.0.0-alpha.9 release:
  // https://github.com/graphql/graphql-js/blob/3283f8adf52e77a47f148ff2f30185c8d11ff0f0/src/execution/__tests__/stream-test.ts

  it("Can stream a list field", async () => {
    const query = gql`
      query {
        scalarList @stream(initialCount: 1)
      }
    `;

    const handler = new GraphQL17Alpha9Handler();
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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
    const handler = new GraphQL17Alpha9Handler();
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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

    const handler = new GraphQL17Alpha9Handler();
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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
    const handler = new GraphQL17Alpha9Handler();
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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

    const handler = new GraphQL17Alpha9Handler();
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
        extensions: extensionsWithStreamDetails,
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
            {
              name: "Luke",
              id: "1",
            },
            {
              name: "Han",
              id: "2",
            },
            {
              name: "Leia",
              id: "3",
            },
          ],
        },
        extensions: extensionsWithStreamDetails,
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

    const handler = new GraphQL17Alpha9Handler();
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Does not execute early if not specified", async () => {
    const query = gql`
      query {
        friendList @stream(initialCount: 0) {
          id
        }
      }
    `;
    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      friendList: () =>
        friends.map((f, i) => ({
          id: async () => {
            const slowness = 3 - i;
            for (let j = 0; j < slowness; j++) {
              await resolveOnNextTick();
            }
            return f.id;
          },
        })),
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [],
        },
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1" }],
        },
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1" }, { id: "2" }],
        },
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1" }, { id: "2" }, { id: "3" }],
        },
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Executes early if specified", async () => {
    const query = gql`
      query {
        friendList @stream(initialCount: 0) {
          id
        }
      }
    `;
    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(
      query,
      {
        friendList: () =>
          friends.map((f, i) => ({
            id: async () => {
              const slowness = 3 - i;
              for (let j = 0; j < slowness; j++) {
                await resolveOnNextTick();
              }
              return f.id;
            },
          })),
      },
      true
    );

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [],
        },
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1" }, { id: "2" }, { id: "3" }],
        },
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Can stream a field that returns a list with nested promises", async () => {
    const query = gql`
      query {
        friendList @stream(initialCount: 2) {
          name
          id
        }
      }
    `;
    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      friendList: () =>
        friends.map((f) => ({
          name: Promise.resolve(f.name),
          id: Promise.resolve(f.id),
        })),
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
        extensions: extensionsWithStreamDetails,
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
            {
              name: "Luke",
              id: "1",
            },
            {
              name: "Han",
              id: "2",
            },
            {
              name: "Leia",
              id: "3",
            },
          ],
        },
        extensions: extensionsWithStreamDetails,
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

    const handler = new GraphQL17Alpha9Handler();
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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

    const handler = new GraphQL17Alpha9Handler();
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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

    const handler = new GraphQL17Alpha9Handler();
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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

    const handler = new GraphQL17Alpha9Handler();
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Negative values of initialCount throw field errors on a field that returns an async iterable", async () => {
    // from a client perspective, a regular graphql query
  });

  it("Does not execute early if not specified, when streaming from an async iterable", async () => {
    const query = gql`
      query {
        friendList @stream(initialCount: 0) {
          id
        }
      }
    `;

    const slowFriend = async (n: number) => ({
      id: async () => {
        const slowness = (3 - n) * 10;
        for (let j = 0; j < slowness; j++) {
          await resolveOnNextTick();
        }
        return friends[n].id;
      },
    });

    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      async *friendList() {
        yield await Promise.resolve(slowFriend(0));
        yield await Promise.resolve(slowFriend(1));
        yield await Promise.resolve(slowFriend(2));
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
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1" }],
        },
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1" }, { id: "2" }],
        },
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1" }, { id: "2" }, { id: "3" }],
        },
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1" }, { id: "2" }, { id: "3" }],
        },
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Executes early if specified when streaming from an async iterable", async () => {
    const query = gql`
      query {
        friendList @stream(initialCount: 0) {
          id
        }
      }
    `;
    const order: Array<number> = [];
    const slowFriend = (n: number) => ({
      id: async () => {
        const slowness = (3 - n) * 10;
        for (let j = 0; j < slowness; j++) {
          await resolveOnNextTick();
        }
        order.push(n);
        return friends[n].id;
      },
    });

    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(
      query,
      {
        async *friendList() {
          yield await Promise.resolve(slowFriend(0));
          yield await Promise.resolve(slowFriend(1));
          yield await Promise.resolve(slowFriend(2));
        },
      },
      true
    );

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [],
        },
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1" }, { id: "2" }, { id: "3" }],
        },
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Can handle concurrent calls to .next() without waiting", async () => {
    const query = gql(`
      query {
        friendList @stream(initialCount: 2) {
          name
          id
        }
      }
    `);

    const handler = new GraphQL17Alpha9Handler();
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(false);
    }
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

    const handler = new GraphQL17Alpha9Handler();
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
        extensions: extensionsWithStreamDetails,
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
        errors: [
          {
            message: "bad",
            path: ["friendList"],
          },
        ],
        extensions: extensionsWithStreamDetails,
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

    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      nonNullFriendList: () => [friends[0], null, friends[1]],
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          nonNullFriendList: [{ name: "Luke" }],
        },
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Handles null returned in non-null async iterable list items after initialCount is reached", async () => {
    // from a client perspective, a repeat of the last test
  });

  it("Handles errors thrown by completeValue after initialCount is reached", async () => {
    const query = gql`
      query {
        scalarList @stream(initialCount: 1)
      }
    `;

    const handler = new GraphQL17Alpha9Handler();
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Handles async errors thrown by completeValue after initialCount is reached", async () => {
    const query = gql`
      query {
        friendList @stream(initialCount: 1) {
          nonNullName
        }
      }
    `;

    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      friendList: () => [
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
          friendList: [{ nonNullName: "Luke" }],
        },
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Handles nested async errors thrown by completeValue after initialCount is reached", async () => {
    // from a client perspective, a repeat of the last test
  });

  it("Handles async errors thrown by completeValue after initialCount is reached for a non-nullable list", async () => {
    const query = gql`
      query {
        nonNullFriendList @stream(initialCount: 1) {
          nonNullName
        }
      }
    `;

    const handler = new GraphQL17Alpha9Handler();
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Handles nested async errors thrown by completeValue after initialCount is reached for a non-nullable list", async () => {
    // from a client perspective, a repeat of the last test
  });

  it("Handles async errors thrown by completeValue after initialCount is reached from async iterable", async () => {
    const query = gql`
      query {
        friendList @stream(initialCount: 1) {
          nonNullName
        }
      }
    `;

    const handler = new GraphQL17Alpha9Handler();
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Handles async errors thrown by completeValue after initialCount is reached from async generator for a non-nullable list", async () => {
    // from a client perspective, a repeat of a previous test
  });

  it.skip("Handles async errors thrown by completeValue after initialCount is reached from async iterable for a non-nullable list when the async iterable does not provide a return method) ", async () => {
    // from a client perspective, a repeat of a previous test
  });

  it.skip("Handles async errors thrown by completeValue after initialCount is reached from async iterable for a non-nullable list when the async iterable provides concurrent next/return methods and has a slow return ", async () => {
    // from a client perspective, a repeat of a previous test
  });

  it.skip("Filters payloads that are nulled", async () => {
    // from a client perspective, a regular graphql query
  });

  it.skip("Filters payloads that are nulled by a later synchronous error", async () => {
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

    const handler = new GraphQL17Alpha9Handler();
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
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          otherNestedObject: { scalarField: null },
          nestedObject: { nestedFriendList: [{ name: "Luke" }] },
        },
        errors: [
          {
            message: "Oops",
            path: ["otherNestedObject", "scalarField"],
          },
        ],
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          otherNestedObject: { scalarField: null },
          nestedObject: { nestedFriendList: [{ name: "Luke" }] },
        },
        errors: [
          {
            message: "Oops",
            path: ["otherNestedObject", "scalarField"],
          },
        ],
        extensions: extensionsWithStreamDetails,
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

    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      nestedObject: {
        deeperNestedObject: {
          nonNullScalarField: () => Promise.resolve(null),
          async *deeperNestedFriendList() {
            yield await Promise.resolve(friends[0]); /* c8 ignore start */
          } /* c8 ignore stop */,
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

    const handler = new GraphQL17Alpha9Handler();
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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

    const handler = new GraphQL17Alpha9Handler();
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Handles overlapping deferred and non-deferred streams", async () => {
    const query = gql`
      query {
        nestedObject {
          nestedFriendList @stream(initialCount: 0) {
            id
          }
        }
        nestedObject {
          ... @defer {
            nestedFriendList @stream(initialCount: 0) {
              id
              name
            }
          }
        }
      }
    `;

    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      nestedObject: {
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
          nestedObject: {
            nestedFriendList: [],
          },
        },
        extensions: extensionsWithStreamDetails,
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
            nestedFriendList: [{ id: "1", name: "Luke" }],
          },
        },
        extensions: extensionsWithStreamDetails,
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
            nestedFriendList: [
              { id: "1", name: "Luke" },
              { id: "2", name: "Han" },
            ],
          },
        },
        extensions: extensionsWithStreamDetails,
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
            nestedFriendList: [
              { id: "1", name: "Luke" },
              { id: "2", name: "Han" },
            ],
          },
        },
        extensions: extensionsWithStreamDetails,
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

    const handler = new GraphQL17Alpha9Handler();
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(false);
    }
  });

  // this test does not exist in the original test suite but added to ensure
  // deferred non-empty lists are properly merged
  it("Returns payloads in correct order when parent deferred fragment resolves slower than stream with > 0 initialCount", async () => {
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
        nestedFriendList @stream(initialCount: 1) {
          name
        }
      }
    `;

    const handler = new GraphQL17Alpha9Handler();
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
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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
        friendList @stream(label: "stream-label") {
          ...NameFragment @defer(label: "DeferName") @defer(label: "DeferName")
          id
        }
      }
      fragment NameFragment on Friend {
        name
      }
    `;

    const handler = new GraphQL17Alpha9Handler();
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
          friendList: [],
        },
        extensions: extensionsWithStreamDetails,
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
          friendList: [{ id: "1", name: "Luke" }],
        },
        extensions: extensionsWithStreamDetails,
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
          friendList: [{ id: "1", name: "Luke" }, { id: "2" }],
        },
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1", name: "Luke" }, { id: "2" }],
        },
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Can @defer fields that are resolved before async iterable is complete", async () => {
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

    const handler = new GraphQL17Alpha9Handler();
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
        extensions: extensionsWithStreamDetails,
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
          friendList: [{ id: "1", name: "Luke" }],
        },
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1", name: "Luke" }, { id: "2" }],
        },
        extensions: extensionsWithStreamDetails,
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
        extensions: extensionsWithStreamDetails,
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
          friendList: [
            { id: "1", name: "Luke" },
            { id: "2", name: "Han" },
          ],
        },
        extensions: extensionsWithStreamDetails,
      });
      expect(request.hasNext).toBe(false);
    }
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
// src/core/__tests__/client.watchQuery/streamGraphQL17Alpha9.test.ts
test("GraphQL17Alpha9Handler can be used with `ApolloClient`", async () => {
  const client = new ApolloClient({
    link: createSchemaLink({ friendList: friends }),
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
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

  const handler = new GraphQL17Alpha9Handler();
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
        ],
      },
      extensions: extensionsWithStreamDetails,
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
      extensions: extensionsWithStreamDetails,
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

  const handler = new GraphQL17Alpha9Handler();
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
          friendList: [{ id: "1" }, { id: "2" }, { id: "3" }],
        },
        chunk
      )
    ).toStrictEqualTyped({
      data: {
        friendList: [
          { name: "Luke", id: "1" },
          { name: "Han", id: "2" },
        ],
      },
      extensions: extensionsWithStreamDetails,
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
      extensions: extensionsWithStreamDetails,
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

  const handler = new GraphQL17Alpha9Handler();
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
          friendList: [{ id: "1", name: "Luke Cached" }],
        },
        chunk
      )
    ).toStrictEqualTyped({
      data: {
        friendList: [
          { name: "Luke", id: "1" },
          { name: "Han", id: "2" },
        ],
      },
      extensions: extensionsWithStreamDetails,
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
      extensions: extensionsWithStreamDetails,
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

  const handler = new GraphQL17Alpha9Handler();
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
        ],
      },
      extensions: extensionsWithStreamDetails,
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
      extensions: extensionsWithStreamDetails,
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

  const handler = new GraphQL17Alpha9Handler();
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
      extensions: extensionsWithStreamDetails,
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
            nestedFriendList: [{ name: "Luke" }],
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
      extensions: extensionsWithStreamDetails,
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
      extensions: extensionsWithStreamDetails,
    });
    expect(request.hasNext).toBe(false);
  }
});
