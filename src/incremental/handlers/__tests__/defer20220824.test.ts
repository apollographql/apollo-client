import assert from "node:assert";

import type {
  DocumentNode,
  FormattedExecutionResult,
  FormattedInitialIncrementalExecutionResult,
  FormattedSubsequentIncrementalExecutionResult,
} from "graphql-17-alpha2";
import {
  experimentalExecuteIncrementally,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from "graphql-17-alpha2";

import {
  ApolloClient,
  ApolloLink,
  CombinedGraphQLErrors,
  gql,
  InMemoryCache,
  NetworkStatus,
  Observable,
} from "@apollo/client";
import { Defer20220824Handler } from "@apollo/client/incremental";
import {
  markAsStreaming,
  mockDeferStream,
  ObservableStream,
} from "@apollo/client/testing/internal";

import {
  hasIncrementalChunks,
  // eslint-disable-next-line local-rules/no-relative-imports
} from "../defer20220824.js";

// This is the test setup of the `graphql-js` v17.0.0-alpha.2 release:
// https://github.com/graphql/graphql-js/blob/364cd71d1a26eb6f62661efd7fa399e91332d30d/src/execution/__tests__/defer-test.ts

const friendType = new GraphQLObjectType({
  fields: {
    id: { type: GraphQLID },
    name: { type: GraphQLString },
  },
  name: "Friend",
});

const friends = [
  { name: "Han", id: 2 },
  { name: "Leia", id: 3 },
  { name: "C-3PO", id: 4 },
];

const heroType = new GraphQLObjectType({
  fields: {
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    slowField: {
      type: GraphQLString,
      resolve: async () => {
        await resolveOnNextTick();
        return "slow";
      },
    },
    errorField: {
      type: GraphQLString,
      resolve: () => {
        throw new Error("bad");
      },
    },
    nonNullErrorField: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: () => null,
    },
    promiseNonNullErrorField: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: () => Promise.resolve(null),
    },
    friends: {
      type: new GraphQLList(friendType),
      resolve: () => friends,
    },
  },
  name: "Hero",
});

const hero = { name: "Luke", id: 1 };

const query = new GraphQLObjectType({
  fields: {
    hero: {
      type: heroType,
      resolve: () => hero,
    },
  },
  name: "Query",
});

const schema = new GraphQLSchema({ query });

function resolveOnNextTick(): Promise<void> {
  return Promise.resolve(undefined);
}

async function* run(
  document: DocumentNode
): AsyncGenerator<
  | FormattedInitialIncrementalExecutionResult
  | FormattedSubsequentIncrementalExecutionResult,
  FormattedExecutionResult | void
> {
  const result = await experimentalExecuteIncrementally({
    schema,
    document,
    rootValue: {},
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
    return result;
  }
}

const schemaLink = new ApolloLink((operation) => {
  return new Observable((observer) => {
    void (async () => {
      for await (const chunk of run(operation.query)) {
        observer.next(chunk);
      }
      observer.complete();
    })();
  });
});

describe("graphql-js test cases", () => {
  // These test cases mirror defer tests of the `graphql-js` v17.0.0-alpha.2 release:
  // https://github.com/graphql/graphql-js/blob/364cd71d1a26eb6f62661efd7fa399e91332d30d/src/execution/__tests__/defer-test.ts

  it("Can defer fragments containing scalar types", async () => {
    const query = gql`
      query HeroNameQuery {
        hero {
          id
          ...NameFragment @defer
        }
      }
      fragment NameFragment on Hero {
        id
        name
      }
    `;
    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query);
    {
      const { value: chunk, done } = (await incoming.next())!;
      assert(!done);
      expect(handler.isIncrementalResult(chunk)).toBe(true);
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
      const { value: chunk, done } = (await incoming.next())!;
      assert(!done);
      expect(handler.isIncrementalResult(chunk)).toBe(true);
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
    const handler = new Defer20220824Handler();
    const incoming = run(query);

    const { value: chunk } = (await incoming.next())!;
    assert(chunk);
    expect(handler.isIncrementalResult(chunk)).toBe(false);
    expect(hasIncrementalChunks(chunk)).toBe(false);
  });
  it.skip("Does not disable defer with null if argument", async () => {
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

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });
    const incoming = run(query);
    {
      const { value: chunk, done } = (await incoming.next())!;
      assert(!done);
      expect(handler.isIncrementalResult(chunk)).toBe(true);
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {},
      });
      expect(request.hasNext).toBe(true);
    }
    {
      const { value: chunk, done } = (await incoming.next())!;
      assert(!done);
      expect(handler.isIncrementalResult(chunk)).toBe(true);
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
          errorField
        }
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query);
    {
      const { value: chunk, done } = (await incoming.next())!;
      assert(!done);
      expect(handler.isIncrementalResult(chunk)).toBe(true);
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {},
      });
      expect(request.hasNext).toBe(true);
    }
    {
      const { value: chunk, done } = (await incoming.next())!;
      assert(!done);
      expect(handler.isIncrementalResult(chunk)).toBe(true);
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          hero: {
            errorField: null,
          },
        },
        errors: [
          {
            message: "bad",
            path: ["hero", "errorField"],
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
          id
          ...TopFragment @defer(label: "DeferTop")
        }
      }
      fragment TopFragment on Hero {
        name
        ...NestedFragment @defer(label: "DeferNested")
      }
      fragment NestedFragment on Hero {
        friends {
          name
        }
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query);
    {
      const { value: chunk, done } = (await incoming.next())!;
      assert(!done);
      expect(handler.isIncrementalResult(chunk)).toBe(true);
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
      const { value: chunk, done } = (await incoming.next())!;
      assert(!done);

      expect(handler.isIncrementalResult(chunk)).toBe(true);
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          hero: {
            id: "1",
            friends: [{ name: "Han" }, { name: "Leia" }, { name: "C-3PO" }],
            name: "Luke",
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });
  it("Can defer a fragment that is also not deferred, deferred fragment is first", async () => {
    const query = gql`
      query HeroNameQuery {
        hero {
          id
          ...TopFragment @defer(label: "DeferTop")
          ...TopFragment
        }
      }
      fragment TopFragment on Hero {
        name
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query);
    {
      const { value: chunk, done } = (await incoming.next())!;
      assert(!done);

      expect(handler.isIncrementalResult(chunk)).toBe(true);
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          hero: { id: "1", name: "Luke" },
        },
      });
      expect(request.hasNext).toBe(true);
    }
    {
      const { value: chunk, done } = (await incoming.next())!;
      assert(!done);

      expect(handler.isIncrementalResult(chunk)).toBe(true);
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
  it.skip("Can defer a fragment that is also not deferred, non-deferred fragment is first", async () => {
    // from client perspective, a repeat of the last one
  });

  it.skip("Can defer an inline fragment", async () => {
    // from client perspective, a repeat of a previous test
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
        errorField
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query);
    {
      const { value: chunk, done } = (await incoming.next())!;
      assert(!done);
      expect(handler.isIncrementalResult(chunk)).toBe(true);
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: { hero: { id: "1" } },
      });
      expect(request.hasNext).toBe(true);
    }
    {
      const { value: chunk, done } = (await incoming.next())!;
      assert(!done);
      expect(handler.isIncrementalResult(chunk)).toBe(true);
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          hero: {
            id: "1",
            errorField: null,
          },
        },
        errors: [
          {
            message: "bad",
            path: ["hero", "errorField"],
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
        nonNullErrorField
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query);
    {
      const { value: chunk, done } = (await incoming.next())!;
      assert(!done);
      expect(handler.isIncrementalResult(chunk)).toBe(true);
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: { hero: { id: "1" } },
      });
      expect(request.hasNext).toBe(true);
    }
    {
      const { value: chunk, done } = (await incoming.next())!;
      assert(!done);
      expect(handler.isIncrementalResult(chunk)).toBe(true);
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          hero: {
            id: "1",
            // in a perfect world, this would bubble up `null` to `hero` or the top level,
            // but we don't have the necessary schema information here to do that
          },
        },
        errors: [
          {
            message:
              "Cannot return null for non-nullable field Hero.nonNullErrorField.",
            path: ["hero", "nonNullErrorField"],
          },
        ],
      });
      expect(request.hasNext).toBe(false);
    }
  });
  it("Handles non-nullable errors thrown outside deferred fragments", async () => {
    const query = gql`
      query HeroNameQuery {
        hero {
          nonNullErrorField
          ...NameFragment @defer
        }
      }
      fragment NameFragment on Hero {
        id
      }
    `;

    const handler = new Defer20220824Handler();
    const incoming = run(query);

    const { value: chunk } = (await incoming.next())!;
    assert(chunk);
    expect(handler.isIncrementalResult(chunk)).toBe(false);
    expect(hasIncrementalChunks(chunk)).toBe(false);
  });
  it.skip("Handles async non-nullable errors thrown in deferred fragments", async () => {
    // from client perspective, a repeat of a previous one
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
        slowField
        friends {
          ...NestedFragment @defer
        }
      }
      fragment NestedFragment on Friend {
        name
      }
    `;

    const handler = new Defer20220824Handler();
    const request = handler.startRequest({ query });

    const incoming = run(query);
    {
      const { value: chunk, done } = (await incoming.next())!;
      assert(!done);
      expect(handler.isIncrementalResult(chunk)).toBe(true);
      expect(hasIncrementalChunks(chunk)).toBe(false);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: { hero: { id: "1" } },
      });
      expect(request.hasNext).toBe(true);
    }
    {
      const { value: chunk, done } = (await incoming.next())!;
      assert(!done);
      expect(handler.isIncrementalResult(chunk)).toBe(true);
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          hero: {
            id: "1",
            friends: [{}, {}, {}],
            slowField: "slow",
          },
        },
      });
      expect(request.hasNext).toBe(true);
    }
    {
      const { value: chunk, done } = (await incoming.next())!;
      assert(!done);
      expect(handler.isIncrementalResult(chunk)).toBe(true);
      expect(hasIncrementalChunks(chunk)).toBe(true);
      expect(request.handle(undefined, chunk)).toStrictEqualTyped({
        data: {
          hero: {
            id: "1",
            friends: [
              {
                name: "Han",
              },
              {
                name: "Leia",
              },
              {
                name: "C-3PO",
              },
            ],
            slowField: "slow",
          },
        },
      });
      expect(request.hasNext).toBe(false);
    }
  });
  it.skip("Returns payloads from synchronous data in correct order", async () => {
    // from client perspective, a repeat of the previous one
  });

  it.skip("original execute function throws error if anything is deferred and everything else is sync", () => {
    // not relevant for the client
  });

  it.skip("original execute function resolves to error if anything is deferred and something else is async", async () => {
    // not relevant for the client
  });
});

test("Defer20220824Handler can be used with `ApolloClient`", async () => {
  const client = new ApolloClient({
    link: schemaLink,
    cache: new InMemoryCache(),
    incrementalHandler: new Defer20220824Handler(),
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

test("merges cache updates that happen concurrently", async () => {
  const stream = mockDeferStream();
  const client = new ApolloClient({
    link: stream.httpLink,
    cache: new InMemoryCache(),
    incrementalHandler: new Defer20220824Handler(),
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
    link: schemaLink,
    cache: new InMemoryCache(),
    incrementalHandler: new Defer20220824Handler(),
  });

  const query = gql`
    query HeroNameQuery {
      hero {
        id
        ... @defer {
          name
        }
        errorField
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
        errorField: null,
      },
    }),
    error: new CombinedGraphQLErrors({
      data: {
        hero: {
          __typename: "Hero",
          id: "1",
          errorField: null,
        },
      },
      errors: [
        {
          message: "bad",
          path: ["hero", "errorField"],
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
        errorField: null,
        name: "Luke",
      },
    },
    error: new CombinedGraphQLErrors({
      data: {
        hero: {
          __typename: "Hero",
          id: "1",
          errorField: null,
          name: "Luke",
        },
      },
      errors: [
        {
          message: "bad",
          path: ["hero", "errorField"],
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
    link: schemaLink,
    cache: new InMemoryCache(),
    incrementalHandler: new Defer20220824Handler(),
  });

  const query = gql`
    query HeroNameQuery {
      hero {
        id
        ... @defer {
          errorField
        }
        ... @defer {
          slowField
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
        errorField: null,
      },
    }),
    error: new CombinedGraphQLErrors({
      data: {
        hero: {
          __typename: "Hero",
          id: "1",
          errorField: null,
        },
      },
      errors: [
        {
          message: "bad",
          path: ["hero", "errorField"],
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
        errorField: null,
        slowField: "slow",
      },
    },
    error: new CombinedGraphQLErrors({
      data: {
        hero: {
          __typename: "Hero",
          id: "1",
          errorField: null,
          slowField: "slow",
        },
      },
      errors: [
        {
          message: "bad",
          path: ["hero", "errorField"],
        },
      ],
    }),
    dataState: "complete",
    networkStatus: NetworkStatus.error,
    partial: false,
  });
});

test("handles final chunk of { hasNext: false } correctly in usage with Apollo Client", async () => {
  const stream = mockDeferStream();
  const client = new ApolloClient({
    link: stream.httpLink,
    cache: new InMemoryCache(),
    incrementalHandler: new Defer20220824Handler(),
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
