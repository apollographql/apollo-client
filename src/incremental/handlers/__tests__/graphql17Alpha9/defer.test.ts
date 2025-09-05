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

import {
  ApolloClient,
  ApolloLink,
  CombinedGraphQLErrors,
  gql,
  InMemoryCache,
  NetworkStatus,
  Observable,
} from "@apollo/client";
import {
  markAsStreaming,
  mockDefer20220824,
  ObservableStream,
  wait,
} from "@apollo/client/testing/internal";

import {
  GraphQL17Alpha9Handler,
  hasIncrementalChunks,
  // eslint-disable-next-line local-rules/no-relative-imports
} from "../../graphql17Alpha9.js";

// This is the test setup of the `graphql-js` v17.0.0-alpha.9 release:
// https://github.com/graphql/graphql-js/blob/3283f8adf52e77a47f148ff2f30185c8d11ff0f0/src/execution/__tests__/defer-test.ts

const friendType = new GraphQLObjectType({
  fields: {
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    nonNullName: { type: new GraphQLNonNull(GraphQLString) },
  },
  name: "Friend",
});

const friends = [
  { name: "Han", id: 2 },
  { name: "Leia", id: 3 },
  { name: "C-3PO", id: 4 },
];

const deeperObject = new GraphQLObjectType({
  fields: {
    foo: { type: GraphQLString },
    bar: { type: GraphQLString },
    baz: { type: GraphQLString },
    bak: { type: GraphQLString },
  },
  name: "DeeperObject",
});

const nestedObject = new GraphQLObjectType({
  fields: {
    deeperObject: { type: deeperObject },
    name: { type: GraphQLString },
  },
  name: "NestedObject",
});

const anotherNestedObject = new GraphQLObjectType({
  fields: {
    deeperObject: { type: deeperObject },
  },
  name: "AnotherNestedObject",
});

const hero = {
  name: "Luke",
  id: 1,
  friends,
  nestedObject,
  anotherNestedObject,
};

const c = new GraphQLObjectType({
  fields: {
    d: { type: GraphQLString },
    nonNullErrorField: { type: new GraphQLNonNull(GraphQLString) },
  },
  name: "c",
});

const e = new GraphQLObjectType({
  fields: {
    f: { type: GraphQLString },
  },
  name: "e",
});

const b = new GraphQLObjectType({
  fields: {
    c: { type: c },
    e: { type: e },
  },
  name: "b",
});

const a = new GraphQLObjectType({
  fields: {
    b: { type: b },
    someField: { type: GraphQLString },
  },
  name: "a",
});

const g = new GraphQLObjectType({
  fields: {
    h: { type: GraphQLString },
  },
  name: "g",
});

const heroType = new GraphQLObjectType({
  fields: {
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    nonNullName: { type: new GraphQLNonNull(GraphQLString) },
    friends: {
      type: new GraphQLList(friendType),
    },
    nestedObject: { type: nestedObject },
    anotherNestedObject: { type: anotherNestedObject },
  },
  name: "Hero",
});

const query = new GraphQLObjectType({
  fields: {
    hero: {
      type: heroType,
    },
    a: { type: a },
    g: { type: g },
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
  rootValue: Record<string, unknown> = { hero },
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
    yield JSON.parse(
      JSON.stringify(result.initialResult)
    ) as FormattedInitialIncrementalExecutionResult;

    for await (const incremental of result.subsequentResults) {
      yield JSON.parse(
        JSON.stringify(incremental)
      ) as FormattedSubsequentIncrementalExecutionResult;
    }
  } else {
    yield JSON.parse(JSON.stringify(result)) as FormattedExecutionResult;
  }
}

function createSchemaLink(rootValue?: Record<string, unknown>) {
  return new ApolloLink((operation) => {
    return new Observable((observer) => {
      void (async () => {
        for await (const chunk of run(operation.query, rootValue)) {
          observer.next(chunk);
        }
        observer.complete();
      })();
    });
  });
}

describe("graphql-js test cases", () => {
  // These test cases mirror defer tests of the `graphql-js` v17.0.0-alpha.9 release:
  // https://github.com/graphql/graphql-js/blob/3283f8adf52e77a47f148ff2f30185c8d11ff0f0/src/execution/__tests__/defer-test.ts

  it("Can defer fragments containing scalar types", async () => {
    const query = gql`
      query HeroNameQuery {
        hero {
          id
          ...NameFragment @defer
        }
      }
      fragment NameFragment on Hero {
        name
      }
    `;

    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query);

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          hero: {
            id: "1",
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
          hero: {
            id: "1",
            name: "Luke",
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Can disable defer using if argument", async () => {
    const query = gql`
      query HeroNameQuery {
        hero {
          id
          ...NameFragment @defer(if: false)
        }
      }
      fragment NameFragment on Hero {
        name
      }
    `;
    const handler = new GraphQL17Alpha9Handler();
    const incoming = run(query);

    const { value: chunk } = await incoming.next();

    assert(chunk);
    expect(handler.isIncrementalResult(chunk)).toBe(false);
    expect(hasIncrementalChunks(chunk)).toBe(false);
  });

  it.skip("Does not disable defer with null if argument", async () => {
    // test is not interesting from a client perspective
  });

  it.skip("Does not execute deferred fragments early when not specified", async () => {
    // test is not interesting from a client perspective
  });

  it.skip("Does execute deferred fragments early when specified", async () => {
    // test is not interesting from a client perspective
  });

  it("Can defer fragments on the top level Query field", async () => {
    const query = gql`
      query HeroNameQuery {
        ...QueryFragment @defer(label: "DeferQuery")
      }
      fragment QueryFragment on Query {
        hero {
          id
        }
      }
    `;

    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query);

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {},
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
          hero: {
            id: "1",
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Can defer fragments with errors on the top level Query field", async () => {
    const query = gql`
      query HeroNameQuery {
        ...QueryFragment @defer(label: "DeferQuery")
      }
      fragment QueryFragment on Query {
        hero {
          name
        }
      }
    `;
    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      hero: {
        ...hero,
        name: () => {
          throw new Error("bad");
        },
      },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {},
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
          hero: {
            name: null,
          },
        },
        errors: [
          {
            message: "bad",
            path: ["hero", "name"],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Can defer a fragment within an already deferred fragment", async () => {
    const query = gql`
      query HeroNameQuery {
        hero {
          ...TopFragment @defer(label: "DeferTop")
        }
      }
      fragment TopFragment on Hero {
        id
        ...NestedFragment @defer(label: "DeferNested")
      }
      fragment NestedFragment on Hero {
        friends {
          name
        }
      }
    `;

    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query);

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          hero: {},
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
          hero: {
            id: "1",
            friends: [{ name: "Han" }, { name: "Leia" }, { name: "C-3PO" }],
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Can defer a fragment that is also not deferred, deferred fragment is first", async () => {
    // from the client perspective, a regular graphql query
  });

  it.skip("Can defer a fragment that is also not deferred, non-deferred fragment is first", async () => {
    // from the client perspective, a regular graphql query
  });

  it("Can defer an inline fragment", async () => {
    const query = gql`
      query HeroNameQuery {
        hero {
          id
          ... on Hero @defer(label: "InlineDeferred") {
            name
          }
        }
      }
    `;
    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query);

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          hero: {
            id: "1",
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
          hero: {
            id: "1",
            name: "Luke",
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Does not emit empty defer fragments", async () => {
    // from the client perspective, a regular query
  });

  it("Emits children of empty defer fragments", async () => {
    const query = gql`
      query HeroNameQuery {
        hero {
          ... @defer {
            ... @defer {
              name
            }
          }
        }
      }
    `;

    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query);

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          hero: {},
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
          hero: {
            name: "Luke",
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Can separately emit defer fragments with different labels with varying fields", async () => {
    const query = gql`
      query HeroNameQuery {
        hero {
          ... @defer(label: "DeferID") {
            id
          }
          ... @defer(label: "DeferName") {
            name
          }
        }
      }
    `;

    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query);

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          hero: {},
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
          hero: {
            id: "1",
            name: "Luke",
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Separately emits defer fragments with different labels with varying subfields", async () => {
    const query = gql`
      query HeroNameQuery {
        ... @defer(label: "DeferID") {
          hero {
            id
          }
        }
        ... @defer(label: "DeferName") {
          hero {
            name
          }
        }
      }
    `;

    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query);

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {},
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
          hero: {
            id: "1",
            name: "Luke",
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Separately emits defer fragments with different labels with varying subfields that return promises", async () => {
    // from the client perspective, a repeat of the last one
  });

  it("Separately emits defer fragments with varying subfields of same priorities but different level of defers", async () => {
    const query = gql`
      query HeroNameQuery {
        hero {
          ... @defer(label: "DeferID") {
            id
          }
        }
        ... @defer(label: "DeferName") {
          hero {
            name
          }
        }
      }
    `;

    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query);

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          hero: {},
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
          hero: {
            id: "1",
            name: "Luke",
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Separately emits nested defer fragments with varying subfields of same priorities but different level of defers", async () => {
    const query = gql`
      query HeroNameQuery {
        ... @defer(label: "DeferName") {
          hero {
            name
            ... @defer(label: "DeferID") {
              id
            }
          }
        }
      }
    `;
    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query);

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {},
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
          hero: {
            id: "1",
            name: "Luke",
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Initiates deferred grouped field sets only if they have been released as pending", async () => {
    const query = gql`
      query {
        ... @defer {
          a {
            ... @defer {
              b {
                c {
                  d
                }
              }
            }
          }
        }
        ... @defer {
          a {
            someField
            ... @defer {
              b {
                e {
                  f
                }
              }
            }
          }
        }
      }
    `;

    const { promise: slowFieldPromise, resolve: resolveSlowField } =
      promiseWithResolvers();
    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      a: {
        someField: slowFieldPromise,
        b: {
          c: () => {
            return { d: "d" };
          },
          e: () => {
            return { f: "f" };
          },
        },
      },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {},
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
          a: {
            b: {
              c: { d: "d" },
            },
          },
        },
      });
      expect(request.hasNext).toBe(true);
    }

    resolveSlowField("someField");

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          a: {
            b: {
              c: { d: "d" },
              e: { f: "f" },
            },
            someField: "someField",
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Initiates unique deferred grouped field sets after those that are common to sibling defers", async () => {
    const query = gql`
      query {
        ... @defer {
          a {
            ... @defer {
              b {
                c {
                  d
                }
              }
            }
          }
        }
        ... @defer {
          a {
            ... @defer {
              b {
                c {
                  d
                }
                e {
                  f
                }
              }
            }
          }
        }
      }
    `;

    const { promise: cPromise, resolve: resolveC } =
      promiseWithResolvers<void>();
    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      a: {
        b: {
          c: async () => {
            await cPromise;
            return { d: "d" };
          },
          e: () => {
            return { f: "f" };
          },
        },
      },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {},
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
          a: {},
        },
      });
      expect(request.hasNext).toBe(true);
    }

    resolveC();

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          a: {
            b: {
              c: { d: "d" },
              e: { f: "f" },
            },
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Can deduplicate multiple defers on the same object", async () => {
    const query = gql`
      query {
        hero {
          friends {
            ... @defer {
              ...FriendFrag
              ... @defer {
                ...FriendFrag
                ... @defer {
                  ...FriendFrag
                  ... @defer {
                    ...FriendFrag
                  }
                }
              }
            }
          }
        }
      }

      fragment FriendFrag on Friend {
        id
        name
      }
    `;

    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query);

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          hero: {
            friends: [{}, {}, {}],
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
          hero: {
            friends: [
              { id: "2", name: "Han" },
              { id: "3", name: "Leia" },
              { id: "4", name: "C-3PO" },
            ],
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Deduplicates fields present in the initial payload", async () => {
    const query = gql`
      query {
        hero {
          nestedObject {
            deeperObject {
              foo
            }
          }
          anotherNestedObject {
            deeperObject {
              foo
            }
          }
          ... @defer {
            nestedObject {
              deeperObject {
                bar
              }
            }
            anotherNestedObject {
              deeperObject {
                foo
              }
            }
          }
        }
      }
    `;
    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      hero: {
        nestedObject: { deeperObject: { foo: "foo", bar: "bar" } },
        anotherNestedObject: { deeperObject: { foo: "foo" } },
      },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          hero: {
            nestedObject: {
              deeperObject: {
                foo: "foo",
              },
            },
            anotherNestedObject: {
              deeperObject: {
                foo: "foo",
              },
            },
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
          hero: {
            nestedObject: {
              deeperObject: {
                foo: "foo",
                bar: "bar",
              },
            },
            anotherNestedObject: {
              deeperObject: {
                foo: "foo",
              },
            },
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Deduplicates fields present in a parent defer payload", async () => {
    const query = gql`
      query {
        hero {
          ... @defer {
            nestedObject {
              deeperObject {
                foo
                ... @defer {
                  foo
                  bar
                }
              }
            }
          }
        }
      }
    `;
    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      hero: { nestedObject: { deeperObject: { foo: "foo", bar: "bar" } } },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          hero: {},
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
          hero: {
            nestedObject: {
              deeperObject: {
                foo: "foo",
                bar: "bar",
              },
            },
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Deduplicates fields with deferred fragments at multiple levels", async () => {
    const query = gql`
      query {
        hero {
          nestedObject {
            deeperObject {
              foo
            }
          }
          ... @defer {
            nestedObject {
              deeperObject {
                foo
                bar
              }
              ... @defer {
                deeperObject {
                  foo
                  bar
                  baz
                  ... @defer {
                    foo
                    bar
                    baz
                    bak
                  }
                }
              }
            }
          }
        }
      }
    `;

    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      hero: {
        nestedObject: {
          deeperObject: { foo: "foo", bar: "bar", baz: "baz", bak: "bak" },
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
          hero: {
            nestedObject: {
              deeperObject: {
                foo: "foo",
              },
            },
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
          hero: {
            nestedObject: {
              deeperObject: {
                foo: "foo",
                bar: "bar",
                baz: "baz",
                bak: "bak",
              },
            },
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Deduplicates multiple fields from deferred fragments from different branches occurring at the same level", async () => {
    const query = gql`
      query {
        hero {
          nestedObject {
            deeperObject {
              ... @defer {
                foo
              }
            }
          }
          ... @defer {
            nestedObject {
              deeperObject {
                ... @defer {
                  foo
                  bar
                }
              }
            }
          }
        }
      }
    `;

    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      hero: { nestedObject: { deeperObject: { foo: "foo", bar: "bar" } } },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          hero: {
            nestedObject: {
              deeperObject: {},
            },
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
          hero: {
            nestedObject: {
              deeperObject: {
                foo: "foo",
                bar: "bar",
              },
            },
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Deduplicate fields with deferred fragments in different branches at multiple non-overlapping levels", async () => {
    const query = gql`
      query {
        a {
          b {
            c {
              d
            }
            ... @defer {
              e {
                f
              }
            }
          }
        }
        ... @defer {
          a {
            b {
              e {
                f
              }
            }
          }
          g {
            h
          }
        }
      }
    `;

    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      a: {
        b: {
          c: { d: "d" },
          e: { f: "f" },
        },
      },
      g: { h: "h" },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          a: {
            b: {
              c: { d: "d" },
            },
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
          a: {
            b: {
              c: { d: "d" },
              e: { f: "f" },
            },
          },
          g: {
            h: "h",
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Correctly bundles varying subfields into incremental data records unique by defer combination, ignoring fields in a fragment masked by a parent defer", async () => {
    const query = gql`
      query HeroNameQuery {
        ... @defer {
          hero {
            id
          }
        }
        ... @defer {
          hero {
            name
            shouldBeWithNameDespiteAdditionalDefer: name
            ... @defer {
              shouldBeWithNameDespiteAdditionalDefer: name
            }
          }
        }
      }
    `;
    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query);

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {},
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
          hero: {
            id: "1",
            name: "Luke",
            shouldBeWithNameDespiteAdditionalDefer: "Luke",
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Nulls cross defer boundaries, null first", async () => {
    const query = gql`
      query {
        ... @defer {
          a {
            someField
            b {
              c {
                nonNullErrorField
              }
            }
          }
        }
        a {
          ... @defer {
            b {
              c {
                d
              }
            }
          }
        }
      }
    `;
    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      a: { b: { c: { d: "d" } }, someField: "someField" },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          a: {},
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
          a: {
            b: {
              c: { d: "d" },
            },
          },
        },
        errors: [
          {
            message:
              "Cannot return null for non-nullable field c.nonNullErrorField.",
            path: ["a", "b", "c", "nonNullErrorField"],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Nulls cross defer boundaries, value first", async () => {
    const query = gql`
      query {
        ... @defer {
          a {
            b {
              c {
                d
              }
            }
          }
        }
        a {
          ... @defer {
            someField
            b {
              c {
                nonNullErrorField
              }
            }
          }
        }
      }
    `;
    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      a: {
        b: { c: { d: "d" }, nonNullErrorFIeld: null },
        someField: "someField",
      },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          a: {},
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
          a: {
            b: {
              c: { d: "d" },
            },
          },
        },
        errors: [
          {
            message:
              "Cannot return null for non-nullable field c.nonNullErrorField.",
            path: ["a", "b", "c", "nonNullErrorField"],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Handles multiple erroring deferred grouped field sets", async () => {
    const query = gql`
      query {
        ... @defer {
          a {
            b {
              c {
                someError: nonNullErrorField
              }
            }
          }
        }
        ... @defer {
          a {
            b {
              c {
                anotherError: nonNullErrorField
              }
            }
          }
        }
      }
    `;
    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      a: {
        b: { c: { nonNullErrorField: null } },
      },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {},
      });
      expect(request.hasNext).toBe(true);
    }

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {},
        errors: [
          {
            message:
              "Cannot return null for non-nullable field c.nonNullErrorField.",
            path: ["a", "b", "c", "someError"],
          },
          {
            message:
              "Cannot return null for non-nullable field c.nonNullErrorField.",
            path: ["a", "b", "c", "anotherError"],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Handles multiple erroring deferred grouped field sets for the same fragment", async () => {
    const query = gql`
      query {
        ... @defer {
          a {
            b {
              someC: c {
                d: d
              }
              anotherC: c {
                d: d
              }
            }
          }
        }
        ... @defer {
          a {
            b {
              someC: c {
                someError: nonNullErrorField
              }
              anotherC: c {
                anotherError: nonNullErrorField
              }
            }
          }
        }
      }
    `;
    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      a: {
        b: { c: { d: "d", nonNullErrorField: null } },
      },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {},
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
          a: {
            b: {
              someC: { d: "d" },
              anotherC: { d: "d" },
            },
          },
        },
        errors: [
          {
            message:
              "Cannot return null for non-nullable field c.nonNullErrorField.",
            path: ["a", "b", "someC", "someError"],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("filters a payload with a null that cannot be merged", async () => {
    const query = gql`
      query {
        ... @defer {
          a {
            someField
            b {
              c {
                nonNullErrorField
              }
            }
          }
        }
        a {
          ... @defer {
            b {
              c {
                d
              }
            }
          }
        }
      }
    `;
    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(
      query,
      {
        a: {
          b: {
            c: {
              d: "d",
              nonNullErrorField: async () => {
                await resolveOnNextTick();
                return null;
              },
            },
          },
          someField: "someField",
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
          a: {},
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
          a: {
            b: {
              c: { d: "d" },
            },
          },
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
          a: {
            b: {
              c: { d: "d" },
            },
          },
        },
        errors: [
          {
            message:
              "Cannot return null for non-nullable field c.nonNullErrorField.",
            path: ["a", "b", "c", "nonNullErrorField"],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Cancels deferred fields when initial result exhibits null bubbling", async () => {
    // from the client perspective, a regular graphql query
  });

  it("Cancels deferred fields when deferred result exhibits null bubbling", async () => {
    const query = gql`
      query {
        ... @defer {
          hero {
            nonNullName
            name
          }
        }
      }
    `;

    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(
      query,
      {
        hero: {
          ...hero,
          nonNullName: () => null,
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
        data: {},
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
          hero: null,
        },
        errors: [
          {
            message:
              "Cannot return null for non-nullable field Hero.nonNullName.",
            path: ["hero", "nonNullName"],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Deduplicates list fields", async () => {
    // from the client perspective, a regular query
  });

  it.skip("Deduplicates async iterable list fields", async () => {
    // from the client perspective, a regular query
  });

  it.skip("Deduplicates empty async iterable list fields", async () => {
    // from the client perspective, a regular query
  });

  it("Does not deduplicate list fields with non-overlapping fields", async () => {
    const query = gql`
      query {
        hero {
          friends {
            name
          }
          ... @defer {
            friends {
              id
            }
          }
        }
      }
    `;
    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query);

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          hero: {
            friends: [{ name: "Han" }, { name: "Leia" }, { name: "C-3PO" }],
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
          hero: {
            friends: [
              { id: "2", name: "Han" },
              { id: "3", name: "Leia" },
              { id: "4", name: "C-3PO" },
            ],
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Deduplicates list fields that return empty lists", async () => {
    // from the client perspective, a regular query
  });

  it.skip("Deduplicates null object fields", async () => {
    // from the client perspective, a regular query
  });

  it.skip("Deduplicates promise object fields", async () => {
    // from the client perspective, a regular query
  });

  it("Handles errors thrown in deferred fragments", async () => {
    const query = gql`
      query HeroNameQuery {
        hero {
          id
          ...NameFragment @defer
        }
      }
      fragment NameFragment on Hero {
        name
      }
    `;

    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      hero: {
        ...hero,
        name: () => {
          throw new Error("bad");
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
          hero: {
            id: "1",
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
          hero: {
            id: "1",
            name: null,
          },
        },
        errors: [
          {
            message: "bad",
            path: ["hero", "name"],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Handles non-nullable errors thrown in deferred fragments", async () => {
    const query = gql`
      query HeroNameQuery {
        hero {
          id
          ...NameFragment @defer
        }
      }
      fragment NameFragment on Hero {
        nonNullName
      }
    `;
    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      hero: {
        ...hero,
        nonNullName: () => null,
      },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          hero: {
            id: "1",
          },
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
          hero: {
            id: "1",
          },
        },
        errors: [
          {
            message:
              "Cannot return null for non-nullable field Hero.nonNullName.",
            path: ["hero", "nonNullName"],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Handles non-nullable errors thrown outside deferred fragments", async () => {
    // from the client perspective, a regular query
  });

  it("Handles async non-nullable errors thrown in deferred fragments", async () => {
    const query = gql`
      query HeroNameQuery {
        hero {
          id
          ...NameFragment @defer
        }
      }
      fragment NameFragment on Hero {
        nonNullName
      }
    `;
    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      hero: {
        ...hero,
        nonNullName: () => Promise.resolve(null),
      },
    });

    {
      const { value: chunk, done } = await incoming.next();

      assert(!done);
      assert(handler.isIncrementalResult(chunk));
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          hero: {
            id: "1",
          },
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
          hero: {
            id: "1",
          },
        },
        errors: [
          {
            message:
              "Cannot return null for non-nullable field Hero.nonNullName.",
            path: ["hero", "nonNullName"],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it("Returns payloads in correct order", async () => {
    const query = gql`
      query HeroNameQuery {
        hero {
          id
          ...NameFragment @defer
        }
      }
      fragment NameFragment on Hero {
        name
        friends {
          ...NestedFragment @defer
        }
      }
      fragment NestedFragment on Friend {
        name
      }
    `;
    const handler = new GraphQL17Alpha9Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query, {
      hero: {
        ...hero,
        name: async () => {
          await resolveOnNextTick();
          return "slow";
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
          hero: {
            id: "1",
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
          hero: {
            id: "1",
            name: "slow",
            friends: [{ name: "Han" }, { name: "Leia" }, { name: "C-3PO" }],
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });

  it.skip("Returns payloads from synchronous data in correct order", async () => {
    // from the client perspective, a repeat of the last one
  });

  it.skip("Filters deferred payloads when a list item returned by an async iterable is nulled", async () => {
    // from the client perspective, a regular query
  });

  it.skip("original execute function throws error if anything is deferred and everything else is sync", () => {
    // not relevant for the client
  });

  it.skip("original execute function resolves to error if anything is deferred and something else is async", async () => {
    // not relevant for the client
  });
});

test("GraphQL17Alpha9Handler can be used with `ApolloClient`", async () => {
  const client = new ApolloClient({
    link: createSchemaLink(),
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query HeroNameQuery {
      hero {
        id
        ... @defer {
          name
        }
      }
    }
  `;

  const observableStream = new ObservableStream(client.watchQuery({ query }));

  await expect(observableStream).toEmitTypedValue({
    loading: true,
    data: undefined,
    dataState: "empty",
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    loading: true,
    data: markAsStreaming({
      hero: {
        __typename: "Hero",
        id: "1",
      },
    }),
    dataState: "streaming",
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    loading: false,
    data: {
      hero: {
        __typename: "Hero",
        id: "1",
        name: "Luke",
      },
    },
    dataState: "complete",
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
});

// TODO: Add test helpers for new format
test.failing("merges cache updates that happen concurrently", async () => {
  const stream = mockDefer20220824();
  const client = new ApolloClient({
    link: stream.httpLink,
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query HeroNameQuery {
      hero {
        id
        job
        ... @defer {
          name
        }
      }
    }
  `;

  const observableStream = new ObservableStream(client.watchQuery({ query }));

  await expect(observableStream).toEmitTypedValue({
    loading: true,
    data: undefined,
    dataState: "empty",
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  stream.enqueueInitialChunk({
    data: {
      hero: {
        __typename: "Hero",
        id: "1",
        job: "Farmer",
      },
    },
    hasNext: true,
  });

  await expect(observableStream).toEmitTypedValue({
    loading: true,
    data: markAsStreaming({
      hero: {
        __typename: "Hero",
        id: "1",
        job: "Farmer",
      },
    }),
    dataState: "streaming",
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  client.cache.writeFragment({
    id: "Hero:1",
    fragment: gql`
      fragment HeroJob on Hero {
        job
      }
    `,
    data: {
      job: "Jedi",
    },
  });

  stream.enqueueSubsequentChunk({
    incremental: [
      {
        data: {
          name: "Luke",
        },
        path: ["hero"],
      },
    ],
    hasNext: false,
  });

  await expect(observableStream).toEmitTypedValue({
    loading: false,
    data: {
      hero: {
        __typename: "Hero",
        id: "1",
        job: "Jedi", // updated from cache
        name: "Luke",
      },
    },
    dataState: "complete",
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
});

test("returns error on initial result", async () => {
  const client = new ApolloClient({
    link: createSchemaLink({
      hero: {
        ...hero,
        nonNullName: null,
      },
    }),
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query HeroNameQuery {
      hero {
        id
        ... @defer {
          name
        }
        nonNullName
      }
    }
  `;

  const observableStream = new ObservableStream(
    client.watchQuery({ query, errorPolicy: "all" })
  );

  await expect(observableStream).toEmitTypedValue({
    loading: true,
    data: undefined,
    dataState: "empty",
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    loading: false,
    data: {
      hero: null,
    },
    error: new CombinedGraphQLErrors({
      data: {
        hero: null,
      },
      errors: [
        {
          message:
            "Cannot return null for non-nullable field Hero.nonNullName.",
          path: ["hero", "nonNullName"],
        },
      ],
    }),
    dataState: "complete",
    networkStatus: NetworkStatus.error,
    partial: false,
  });

  await expect(observableStream).not.toEmitAnything();
});

test("stream that returns an error but continues to stream", async () => {
  const client = new ApolloClient({
    link: createSchemaLink({
      hero: {
        ...hero,
        nonNullName: null,
        name: async () => {
          await wait(100);
          return "slow";
        },
      },
    }),
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query HeroNameQuery {
      hero {
        id
        ... @defer {
          nonNullName
        }
        ... @defer {
          name
        }
      }
    }
  `;

  const observableStream = new ObservableStream(
    client.watchQuery({ query, errorPolicy: "all" })
  );

  await expect(observableStream).toEmitTypedValue({
    loading: true,
    data: undefined,
    dataState: "empty",
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    loading: true,
    data: markAsStreaming({
      hero: {
        __typename: "Hero",
        id: "1",
      },
    }),
    dataState: "streaming",
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    loading: true,
    data: markAsStreaming({
      hero: {
        __typename: "Hero",
        id: "1",
      },
    }),
    error: new CombinedGraphQLErrors({
      data: {
        hero: {
          __typename: "Hero",
          id: "1",
        },
      },
      errors: [
        {
          message:
            "Cannot return null for non-nullable field Hero.nonNullName.",
          path: ["hero", "nonNullName"],
        },
      ],
    }),
    dataState: "streaming",
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    loading: false,
    data: {
      hero: {
        __typename: "Hero",
        id: "1",
        name: "slow",
      },
    },
    error: new CombinedGraphQLErrors({
      data: {
        hero: {
          __typename: "Hero",
          id: "1",
          name: "slow",
        },
      },
      errors: [
        {
          message:
            "Cannot return null for non-nullable field Hero.nonNullName.",
          path: ["hero", "nonNullName"],
        },
      ],
    }),
    dataState: "complete",
    networkStatus: NetworkStatus.error,
    partial: false,
  });
});

// TODO: Update to use test utils with updated types
test.skip("handles final chunk of { hasNext: false } correctly in usage with Apollo Client", async () => {
  const stream = mockDefer20220824();
  const client = new ApolloClient({
    link: stream.httpLink,
    cache: new InMemoryCache(),
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });

  const query = gql`
    query ProductsQuery {
      allProducts {
        id
        nonNullErrorField
      }
    }
  `;

  const observableStream = new ObservableStream(
    client.watchQuery({ query, errorPolicy: "all" })
  );
  stream.enqueueInitialChunk({
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

  stream.enqueueSubsequentChunk({
    hasNext: false,
  });

  await expect(observableStream).toEmitTypedValue({
    loading: true,
    data: undefined,
    dataState: "empty",
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  await expect(observableStream).toEmitTypedValue({
    loading: true,
    data: markAsStreaming({
      allProducts: [null, null, null],
    }),
    error: new CombinedGraphQLErrors({
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
    }),
    dataState: "streaming",
    networkStatus: NetworkStatus.streaming,
    partial: true,
  });

  await expect(observableStream).toEmitSimilarValue({
    expected: (previous) => ({
      ...previous,
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.error,
      partial: false,
    }),
  });
  await expect(observableStream).not.toEmitAnything();
});
