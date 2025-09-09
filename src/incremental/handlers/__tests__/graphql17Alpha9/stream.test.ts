import assert from "node:assert";

import type {
  DocumentNode,
  FormattedExecutionResult,
  FormattedInitialIncrementalExecutionResult,
  FormattedSubsequentIncrementalExecutionResult,
} from "graphql-17-alpha9";
import {
  experimentalExecuteIncrementally,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from "graphql-17-alpha9";

import { gql } from "@apollo/client";
import { GraphQL17Alpha9Handler } from "@apollo/client/incremental";

import {
  hasIncrementalChunks,
  // eslint-disable-next-line local-rules/no-relative-imports
} from "../../graphql17Alpha9.js";

// This is the test setup of the `graphql-js` v17.0.0-alpha.9 release:
// https://github.com/graphql/graphql-js/blob/3283f8adf52e77a47f148ff2f30185c8d11ff0f0/src/execution/__tests__/stream-test.ts

const friendType = new GraphQLObjectType({
  fields: {
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    nonNullName: { type: new GraphQLNonNull(GraphQLString) },
  },
  name: "Friend",
});

const friends = [
  { name: "Luke", id: 1 },
  { name: "Han", id: 2 },
  { name: "Leia", id: 3 },
];

const query = new GraphQLObjectType({
  fields: {
    scalarList: {
      type: new GraphQLList(GraphQLString),
    },
    scalarListList: {
      type: new GraphQLList(new GraphQLList(GraphQLString)),
    },
    friendList: {
      type: new GraphQLList(friendType),
    },
    nonNullFriendList: {
      type: new GraphQLList(new GraphQLNonNull(friendType)),
    },
    nestedObject: {
      type: new GraphQLObjectType({
        name: "NestedObject",
        fields: {
          scalarField: {
            type: GraphQLString,
          },
          nonNullScalarField: {
            type: new GraphQLNonNull(GraphQLString),
          },
          nestedFriendList: { type: new GraphQLList(friendType) },
          deeperNestedObject: {
            type: new GraphQLObjectType({
              name: "DeeperNestedObject",
              fields: {
                nonNullScalarField: {
                  type: new GraphQLNonNull(GraphQLString),
                },
                deeperNestedFriendList: { type: new GraphQLList(friendType) },
              },
            }),
          },
        },
      }),
    },
  },
  name: "Query",
});

const schema = new GraphQLSchema({ query });

function resolveOnNextTick(): Promise<void> {
  return Promise.resolve(undefined);
}

type PromiseOrValue<T> = Promise<T> | T;

function promiseWithResolvers<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseOrValue<T>) => void;
  reject: (reason?: any) => void;
} {
  // these are assigned synchronously within the Promise constructor
  let resolve!: (value: T | PromiseOrValue<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function* run(
  document: DocumentNode,
  rootValue: unknown = {},
  enableEarlyExecution = false
): AsyncGenerator<
  | FormattedInitialIncrementalExecutionResult
  | FormattedSubsequentIncrementalExecutionResult
  | FormattedExecutionResult,
  void
> {
  const result = await experimentalExecuteIncrementally({
    schema,
    document,
    rootValue,
    enableEarlyExecution,
  });

  if ("initialResult" in result) {
    yield JSON.parse(JSON.stringify(result.initialResult));

    for await (const patch of result.subsequentResults) {
      yield JSON.parse(JSON.stringify(patch));
    }
  } else {
    yield JSON.parse(JSON.stringify(result));
  }
}

describe("graphql-js test cases", () => {
  // These test cases mirror stream tests of the `graphql-js` v17.0.0-alpha.9 release:
  // https://github.com/graphql/graphql-js/blob/3283f8adf52e77a47f148ff2f30185c8d11ff0f0/src/execution/__tests__/stream-test.ts

  it.skip("Can stream a list field", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          scalarList: ["apple", "banana", "coconut"],
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Can use default value of initialCount", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
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

  it.skip("Does not disable stream with null if argument", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          scalarList: ["apple", "banana", "coconut"],
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Can stream multi-dimensional lists", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
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

  it.skip("Can stream a field that returns a list of promises", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
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
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Can stream in correct order with lists of promises", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [
            {
              items: [{ name: "Luke", id: "1" }],
              id: "0",
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [
            {
              items: [
                { name: "Luke", id: "1" },
                { name: "Han", id: "2" },
              ],
              id: "0",
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [
            {
              items: [
                { name: "Luke", id: "1" },
                { name: "Han", id: "2" },
                { name: "Leia", id: "3" },
              ],
              id: "0",
            },
          ],
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Does not execute early if not specified", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1" }],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1" }, { id: "2" }],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1" }, { id: "2" }, { id: "3" }],
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Executes early if specified", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1" }, { id: "2" }, { id: "3" }],
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Can stream a field that returns a list with nested promises", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
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
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Handles rejections in a field that returns a list of promises before initialCount is reached", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ name: "Luke", id: "1" }, null],
        },
        errors: [
          {
            message: "bad",
            locations: [{ line: 3, column: 9 }],
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
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
            locations: [{ line: 3, column: 9 }],
            path: ["friendList", 1],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Handles rejections in a field that returns a list of promises after initialCount is reached", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ name: "Luke", id: "1" }, null],
        },
        errors: [
          {
            message: "bad",
            locations: [{ line: 3, column: 9 }],
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
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
            locations: [{ line: 3, column: 9 }],
            path: ["friendList", 1],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Can stream a field that returns an async iterable", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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

  it.skip("Can stream a field that returns an async iterable, using a non-zero initialCount", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
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
    // from a client perspective, a regular graphql query
  });

  it.skip("Does not execute early if not specified, when streaming from an async iterable", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1" }],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1" }, { id: "2" }],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1" }, { id: "2" }, { id: "3" }],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1" }, { id: "2" }, { id: "3" }],
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Executes early if specified when streaming from an async iterable", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1" }, { id: "2" }, { id: "3" }],
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Can handle concurrent calls to .next() without waiting", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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

  it.skip("Handles error thrown in async iterable before initialCount is reached", async () => {
    // from a client perspective, a regular graphql query
  });

  it.skip("Handles error thrown in async iterable after initialCount is reached", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ name: "Luke", id: "1" }],
        },
        errors: [
          {
            message: "bad",
            locations: [{ line: 3, column: 9 }],
            path: ["friendList"],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Handles null returned in non-null list items after initialCount is reached", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          nonNullFriendList: [{ name: "Luke", id: "1" }],
        },
        errors: [
          {
            message:
              "Cannot return null for non-nullable field Query.nonNullFriendList.",
            locations: [{ line: 3, column: 9 }],
            path: ["nonNullFriendList", 1],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Handles null returned in non-null async iterable list items after initialCount is reached", async () => {
    // from a client perspective, a repeat of the last test
  });

  it.skip("Handles errors thrown by completeValue after initialCount is reached", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          scalarList: ["Luke", null],
        },
        errors: [
          {
            message: "String cannot represent value: {}",
            locations: [{ line: 3, column: 9 }],
            path: ["scalarList", 1],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Handles async errors thrown by completeValue after initialCount is reached", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ nonNullName: "Luke" }, null],
        },
        errors: [
          {
            message: "Oops",
            locations: [{ line: 4, column: 11 }],
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ nonNullName: "Luke" }, null, { nonNullName: "Han" }],
        },
        errors: [
          {
            message: "Oops",
            locations: [{ line: 4, column: 11 }],
            path: ["friendList", 1, "nonNullName"],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Handles nested async errors thrown by completeValue after initialCount is reached", async () => {
    // from a client perspective, a repeat of the last test
  });

  it.skip("Handles async errors thrown by completeValue after initialCount is reached for a non-nullable list", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          nonNullFriendList: [{ nonNullName: "Luke" }],
        },
        errors: [
          {
            message: "Oops",
            locations: [{ line: 4, column: 11 }],
            path: ["nonNullFriendList", 1, "nonNullName"],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Handles nested async errors thrown by completeValue after initialCount is reached for a non-nullable list", async () => {
    // from a client perspective, a repeat of the last test
  });

  it.skip("Handles async errors thrown by completeValue after initialCount is reached from async iterable", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ nonNullName: "Luke" }, null],
        },
        errors: [
          {
            message: "Oops",
            locations: [{ line: 4, column: 11 }],
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ nonNullName: "Luke" }, null, { name: "Han" }],
        },
        errors: [
          {
            message: "Oops",
            locations: [{ line: 4, column: 11 }],
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ nonNullName: "Luke" }, null, { name: "Han" }],
        },
        errors: [
          {
            message: "Oops",
            locations: [{ line: 4, column: 11 }],
            path: ["friendList", 1, "nonNullName"],
          },
        ],
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

  it.skip("Does not filter payloads when null error is in a different path", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          otherNestedObject: { scalarField: null },
          nestedObject: { nestedFriendList: [{ name: "Luke" }] },
        },
        errors: [
          {
            message: "Oops",
            locations: [{ line: 5, column: 13 }],
            path: ["otherNestedObject", "scalarField"],
          },
        ],
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          otherNestedObject: { scalarField: null },
          nestedObject: { nestedFriendList: [{ name: "Luke" }] },
        },
        errors: [
          {
            message: "Oops",
            locations: [{ line: 5, column: 13 }],
            path: ["otherNestedObject", "scalarField"],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Filters stream payloads that are nulled in a deferred payload", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
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

  it.skip("Filters defer payloads that are nulled in a stream response", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [null],
        },
        errors: [
          {
            message:
              "Cannot return null for non-nullable field Friend.nonNullName.",
            locations: [{ line: 4, column: 9 }],
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [null],
        },
        errors: [
          {
            message:
              "Cannot return null for non-nullable field Friend.nonNullName.",
            locations: [{ line: 4, column: 9 }],
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

  it.skip("Handles promises returned by completeValue after initialCount is reached", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
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

  it.skip("Handles overlapping deferred and non-deferred streams", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          nestedObject: {
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          nestedObject: {
            nestedFriendList: [{ id: "1", name: "Luke" }],
          },
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          nestedObject: {
            nestedFriendList: [
              { id: "1", name: "Luke" },
              { id: "2", name: "Han" },
            ],
          },
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          nestedObject: {
            nestedFriendList: [
              { id: "1", name: "Luke" },
              { id: "2", name: "Han" },
            ],
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Returns payloads in correct order when parent deferred fragment resolves slower than stream", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
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

  it.skip("Can @defer fields that are resolved after async iterable is complete", async () => {
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    resolveIterableCompletion(null);

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1", name: "Luke" }],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    resolveSlowField("Han");

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1", name: "Luke" }, { id: "2" }],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1", name: "Luke" }, { id: "2" }],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(true);
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
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1" }],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    resolveSlowField("Han");

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(true);
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
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          friendList: [{ id: "1", name: "Luke" }, { id: "2" }],
        },
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(true);
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

    resolveIterableCompletion(null);

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(true);
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
