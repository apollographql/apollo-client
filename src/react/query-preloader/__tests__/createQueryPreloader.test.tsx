import React, { Suspense } from "react";
import { createQueryPreloader } from "../createQueryPreloader";
import {
  ApolloClient,
  ApolloError,
  ApolloLink,
  InMemoryCache,
  NetworkStatus,
  TypedDocumentNode,
  gql,
} from "../../../core";
import {
  MockLink,
  MockSubscriptionLink,
  MockedResponse,
  wait,
} from "../../../testing";
import { expectTypeOf } from "expect-type";
import { QueryReference, unwrapQueryRef } from "../../cache/QueryReference";
import { DeepPartial, Observable } from "../../../utilities";
import {
  SimpleCaseData,
  createProfiler,
  spyOnConsole,
  useSimpleCase,
  useTrackRenders,
  useVariablesCase,
} from "../../../testing/internal";
import { ApolloProvider } from "../../context";
import { render, renderHook } from "@testing-library/react";
import { UseReadQueryResult, useReadQuery } from "../../hooks";
import { GraphQLError } from "graphql";
import { ErrorBoundary } from "react-error-boundary";

function createDefaultClient(mocks: MockedResponse[]) {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });
}

function renderDefaultTestApp<TData>({
  client,
  queryRef,
}: {
  client: ApolloClient<any>;
  queryRef: QueryReference<TData>;
}) {
  const Profiler = createProfiler({
    initialSnapshot: {
      result: null as UseReadQueryResult<TData> | null,
      error: null as Error | null,
    },
  });

  function ReadQueryHook() {
    useTrackRenders({ name: "ReadQueryHook" });
    Profiler.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function SuspenseFallback() {
    useTrackRenders({ name: "SuspenseFallback" });
    return <p>Loading</p>;
  }

  function ErrorFallback({ error }: { error: Error }) {
    useTrackRenders({ name: "ErrorFallback" });
    Profiler.mergeSnapshot({ error });

    return null;
  }

  function App() {
    useTrackRenders({ name: "App" });

    return (
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Suspense fallback={<SuspenseFallback />}>
          <ReadQueryHook />
        </Suspense>
      </ErrorBoundary>
    );
  }

  const utils = render(<App />, {
    wrapper: ({ children }) => (
      <ApolloProvider client={client}>
        <Profiler>{children}</Profiler>
      </ApolloProvider>
    ),
  });

  function rerender() {
    return utils.rerender(<App />);
  }

  return { ...utils, rerender, Profiler };
}

test("loads a query and suspends when passed to useReadQuery", async () => {
  const { query, mocks } = useSimpleCase();
  const client = createDefaultClient(mocks);
  const preloadQuery = createQueryPreloader(client);

  const queryRef = preloadQuery(query);

  const { Profiler } = renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "SuspenseFallback"]);
  }

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

test("loads a query with variables and suspends when passed to useReadQuery", async () => {
  const { query, mocks } = useVariablesCase();
  const client = createDefaultClient(mocks);
  const preloadQuery = createQueryPreloader(client);

  const queryRef = preloadQuery(query, {
    variables: { id: "1" },
  });

  const { Profiler } = renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "SuspenseFallback"]);
  }

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: "Spider-Man" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

test("tears down the query when calling dispose", async () => {
  const { query, mocks } = useSimpleCase();
  const client = createDefaultClient(mocks);
  const preloadQuery = createQueryPreloader(client);

  const queryRef = preloadQuery(query);
  const dispose = queryRef.retain();

  expect(client.getObservableQueries().size).toBe(1);
  expect(client).toHaveSuspenseCacheEntryUsing(query);

  dispose();

  await wait(0);

  expect(client.getObservableQueries().size).toBe(0);
  expect(client).not.toHaveSuspenseCacheEntryUsing(query);
});

test("Auto disposes of the query ref if not retained within the given time", async () => {
  jest.useFakeTimers();
  const { query, mocks } = useSimpleCase();
  const client = createDefaultClient(mocks);
  const preloadQuery = createQueryPreloader(client);

  const queryRef = preloadQuery(query);

  // We don't start the dispose timer until the promise is initially resolved
  // so we need to wait for it
  jest.advanceTimersByTime(20);
  await queryRef.toPromise();
  jest.advanceTimersByTime(30_000);

  const internalQueryRef = unwrapQueryRef(queryRef);

  expect(internalQueryRef.disposed).toBe(true);
  expect(client.getObservableQueries().size).toBe(0);
  expect(client).not.toHaveSuspenseCacheEntryUsing(query);

  jest.useRealTimers();
});

test.todo(
  "useReadQuery auto-retains the queryRef and disposes of it when unmounted"
);
test.todo(
  "queryRef is not disposed when useReadQuery unmounts when manually retained"
);

test("useReadQuery warns when called with a disposed queryRef", async () => {
  using _consoleSpy = spyOnConsole("warn");
  const { query, mocks } = useSimpleCase();
  const client = createDefaultClient(mocks);

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query);
  const dispose = queryRef.retain();

  await queryRef.toPromise();

  dispose();

  await wait(0);

  const { rerender } = renderHook(() => useReadQuery(queryRef));

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    expect.stringContaining(
      "'useReadQuery' was called with a disposed queryRef"
    )
  );

  rerender();

  // Ensure re-rendering again only shows the warning once
  expect(console.warn).toHaveBeenCalledTimes(1);
});

test("useReadQuery warns again when called with a different disposed query ref", async () => {
  using _consoleSpy = spyOnConsole("warn");
  const { query } = useSimpleCase();

  const mocks: MockedResponse[] = [
    {
      request: { query },
      result: { data: { greeting: "Hello" } },
      maxUsageCount: 2,
    },
  ];

  const client = createDefaultClient(mocks);

  const preloadQuery = createQueryPreloader(client);
  const queryRef1 = preloadQuery(query, { queryKey: 1 });
  const queryRef2 = preloadQuery(query, { queryKey: 2 });
  const dispose1 = queryRef1.retain();
  const dispose2 = queryRef2.retain();

  await Promise.all([queryRef1.toPromise(), queryRef2.toPromise()]);

  dispose1();
  dispose2();

  await wait(0);

  const { rerender } = renderHook(({ queryRef }) => useReadQuery(queryRef), {
    initialProps: { queryRef: queryRef1 },
  });

  expect(console.warn).toHaveBeenCalledTimes(1);

  rerender({ queryRef: queryRef2 });

  expect(console.warn).toHaveBeenCalledTimes(2);
});

test("reacts to cache updates", async () => {
  const { query, mocks } = useSimpleCase();
  const client = createDefaultClient(mocks);

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query);

  const { Profiler } = renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "SuspenseFallback"]);
  }

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.writeQuery({
    query,
    data: { greeting: "Hello (updated)" },
  });

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello (updated)" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

test("ignores cached result and suspends when `fetchPolicy` is network-only", async () => {
  const { query, mocks } = useSimpleCase();

  const client = createDefaultClient(mocks);
  client.writeQuery({ query, data: { greeting: "Cached Hello" } });

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, {
    fetchPolicy: "network-only",
  });

  const { Profiler } = renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "SuspenseFallback"]);
  }

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

test("does not cache results when `fetchPolicy` is no-cache", async () => {
  const { query, mocks } = useSimpleCase();

  const client = createDefaultClient(mocks);

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, {
    fetchPolicy: "no-cache",
  });

  const { Profiler } = renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "SuspenseFallback"]);
  }

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(client.extract()).toEqual({});
});

test("returns initial cache data followed by network data when `fetchPolicy` is cache-and-network", async () => {
  const { query, mocks } = useSimpleCase();

  const client = createDefaultClient(mocks);
  client.writeQuery({ query, data: { greeting: "Cached Hello" } });

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, {
    fetchPolicy: "cache-and-network",
  });

  const { Profiler } = renderDefaultTestApp({ client, queryRef });

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "ReadQueryHook"]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Cached Hello" },
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual(["ReadQueryHook"]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

test("returns cached data when all data is present in the cache", async () => {
  const { query, mocks } = useSimpleCase();

  const client = createDefaultClient(mocks);
  client.writeQuery({ query, data: { greeting: "Cached Hello" } });

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query);

  const { Profiler } = renderDefaultTestApp({ client, queryRef });

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "ReadQueryHook"]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Cached Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(Profiler).not.toRerender();
});

test("suspends and ignores partial data in the cache", async () => {
  const query = gql`
    query {
      hello
      foo
    }
  `;

  const mocks = [
    {
      request: { query },
      result: { data: { hello: "from link", foo: "bar" } },
      delay: 20,
    },
  ];

  const client = createDefaultClient(mocks);

  {
    // we expect a "Missing field 'foo' while writing result..." error
    // when writing hello to the cache, so we'll silence it
    using _consoleSpy = spyOnConsole("error");
    client.writeQuery({ query, data: { hello: "from cache" } });
  }

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query);

  const { Profiler } = renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "SuspenseFallback"]);
  }

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual(["ReadQueryHook"]);
    expect(snapshot.result).toEqual({
      data: { hello: "from link", foo: "bar" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(Profiler).not.toRerender();
});

test("throws when error is returned", async () => {
  // Disable error messages shown by React when an error is thrown to an error
  // boundary
  using _consoleSpy = spyOnConsole("error");
  const { query } = useSimpleCase();
  const mocks = [
    { request: { query }, result: { errors: [new GraphQLError("Oops")] } },
  ];
  const client = createDefaultClient(mocks);

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query);

  const { Profiler } = renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "SuspenseFallback"]);
  }

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual(["ErrorFallback"]);
    expect(snapshot.error).toEqual(
      new ApolloError({ graphQLErrors: [new GraphQLError("Oops")] })
    );
  }
});

test("returns error when error policy is 'all'", async () => {
  // Disable error messages shown by React when an error is thrown to an error
  // boundary
  using _consoleSpy = spyOnConsole("error");
  const { query } = useSimpleCase();
  const mocks = [
    { request: { query }, result: { errors: [new GraphQLError("Oops")] } },
  ];
  const client = createDefaultClient(mocks);

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, { errorPolicy: "all" });

  const { Profiler } = renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "SuspenseFallback"]);
  }

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual(["ReadQueryHook"]);
    expect(snapshot.result).toEqual({
      data: undefined,
      error: new ApolloError({ graphQLErrors: [new GraphQLError("Oops")] }),
      networkStatus: NetworkStatus.error,
    });
    expect(snapshot.error).toEqual(null);
  }
});

test("discards error when error policy is 'ignore'", async () => {
  // Disable error messages shown by React when an error is thrown to an error
  // boundary
  using _consoleSpy = spyOnConsole("error");
  const { query } = useSimpleCase();
  const mocks = [
    { request: { query }, result: { errors: [new GraphQLError("Oops")] } },
  ];
  const client = createDefaultClient(mocks);

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, { errorPolicy: "ignore" });

  const { Profiler } = renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "SuspenseFallback"]);
  }

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual(["ReadQueryHook"]);
    expect(snapshot.result).toEqual({
      data: undefined,
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
    expect(snapshot.error).toEqual(null);
  }
});

test("passes context to the link", async () => {
  interface QueryData {
    context: Record<string, any>;
  }

  const query: TypedDocumentNode<QueryData, never> = gql`
    query ContextQuery {
      context
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink((operation) => {
      return new Observable((observer) => {
        const { valueA, valueB } = operation.getContext();
        setTimeout(() => {
          observer.next({ data: { context: { valueA, valueB } } });
          observer.complete();
        }, 10);
      });
    }),
  });

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, {
    context: { valueA: "A", valueB: "B" },
  });

  const { Profiler } = renderDefaultTestApp({ client, queryRef });

  // initial render
  await Profiler.takeRender();

  const { snapshot } = await Profiler.takeRender();

  expect(snapshot.result).toEqual({
    data: { context: { valueA: "A", valueB: "B" } },
    networkStatus: NetworkStatus.ready,
    error: undefined,
  });
});

test("creates unique query refs when provided with a queryKey", async () => {
  const { query } = useSimpleCase();

  const mocks: MockedResponse[] = [
    {
      request: { query },
      result: { data: { greeting: "Hello" } },
      maxUsageCount: Infinity,
    },
  ];

  const client = createDefaultClient(mocks);
  const preloadQuery = createQueryPreloader(client);

  const queryRef1 = preloadQuery(query);
  const queryRef2 = preloadQuery(query);
  const queryRef3 = preloadQuery(query, { queryKey: 1 });

  const unwrappedQueryRef1 = unwrapQueryRef(queryRef1);
  const unwrappedQueryRef2 = unwrapQueryRef(queryRef2);
  const unwrappedQueryRef3 = unwrapQueryRef(queryRef3);

  expect(unwrappedQueryRef2).toBe(unwrappedQueryRef1);
  expect(unwrappedQueryRef3).not.toBe(unwrappedQueryRef1);
});

test("does not suspend and returns partial data when `returnPartialData` is `true`", async () => {
  const { query, mocks } = useVariablesCase();
  const partialQuery = gql`
    query CharacterQuery($id: ID!) {
      character(id: $id) {
        id
      }
    }
  `;

  const client = createDefaultClient(mocks);

  client.writeQuery({
    query: partialQuery,
    data: { character: { id: "1" } },
    variables: { id: "1" },
  });

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, {
    variables: { id: "1" },
    returnPartialData: true,
  });

  const { Profiler } = renderDefaultTestApp({ client, queryRef });

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "ReadQueryHook"]);
    expect(snapshot.result).toEqual({
      data: { character: { id: "1" } },
      networkStatus: NetworkStatus.loading,
      error: undefined,
    });
  }

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual(["ReadQueryHook"]);
    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: "Spider-Man" } },
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }
});

test('enables canonical results when canonizeResults is "true"', async () => {
  interface Result {
    __typename: string;
    value: number;
  }

  interface QueryData {
    results: Result[];
  }

  const cache = new InMemoryCache({
    typePolicies: {
      Result: {
        keyFields: false,
      },
    },
  });

  const query: TypedDocumentNode<QueryData, never> = gql`
    query {
      results {
        value
      }
    }
  `;

  const results: Result[] = [
    { __typename: "Result", value: 0 },
    { __typename: "Result", value: 1 },
    { __typename: "Result", value: 1 },
    { __typename: "Result", value: 2 },
    { __typename: "Result", value: 3 },
    { __typename: "Result", value: 5 },
  ];

  cache.writeQuery({
    query,
    data: { results },
  });

  const client = new ApolloClient({ cache, link: new MockLink([]) });

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, { canonizeResults: true });

  const { Profiler } = renderDefaultTestApp({ client, queryRef });

  const { snapshot } = await Profiler.takeRender();
  const resultSet = new Set(snapshot.result?.data.results);
  const values = Array.from(resultSet).map((item) => item.value);

  expect(snapshot.result).toEqual({
    data: { results },
    networkStatus: NetworkStatus.ready,
    error: undefined,
  });

  expect(resultSet.size).toBe(5);
  expect(values).toEqual([0, 1, 2, 3, 5]);
});

test("can disable canonical results when the cache's canonizeResults setting is true", async () => {
  interface Result {
    __typename: string;
    value: number;
  }

  const cache = new InMemoryCache({
    canonizeResults: true,
    typePolicies: {
      Result: {
        keyFields: false,
      },
    },
  });

  const query: TypedDocumentNode<{ results: Result[] }, never> = gql`
    query {
      results {
        value
      }
    }
  `;

  const results: Result[] = [
    { __typename: "Result", value: 0 },
    { __typename: "Result", value: 1 },
    { __typename: "Result", value: 1 },
    { __typename: "Result", value: 2 },
    { __typename: "Result", value: 3 },
    { __typename: "Result", value: 5 },
  ];

  cache.writeQuery({
    query,
    data: { results },
  });

  const client = new ApolloClient({ cache, link: new MockLink([]) });

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, { canonizeResults: false });

  const { Profiler } = renderDefaultTestApp({ client, queryRef });

  const { snapshot } = await Profiler.takeRender();
  const resultSet = new Set(snapshot.result!.data.results);
  const values = Array.from(resultSet).map((item) => item.value);

  expect(snapshot.result).toEqual({
    data: { results },
    networkStatus: NetworkStatus.ready,
    error: undefined,
  });
  expect(resultSet.size).toBe(6);
  expect(values).toEqual([0, 1, 1, 2, 3, 5]);
});

test("suspends deferred queries until initial chunk loads then rerenders with deferred data", async () => {
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
          }
        }
      }
    }
  `;

  const link = new MockSubscriptionLink();
  const client = new ApolloClient({ cache: new InMemoryCache(), link });

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query);

  const { Profiler } = renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "SuspenseFallback"]);
  }

  link.simulateResult({
    result: {
      data: { greeting: { message: "Hello world", __typename: "Greeting" } },
      hasNext: true,
    },
  });

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual(["ReadQueryHook"]);
    expect(snapshot.result).toEqual({
      data: { greeting: { message: "Hello world", __typename: "Greeting" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  link.simulateResult(
    {
      result: {
        incremental: [
          {
            data: {
              recipient: { name: "Alice", __typename: "Person" },
              __typename: "Greeting",
            },
            path: ["greeting"],
          },
        ],
        hasNext: false,
      },
    },
    true
  );

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual(["ReadQueryHook"]);
    expect(snapshot.result).toEqual({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "Person", name: "Alice" },
        },
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

describe.skip("type tests", () => {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([]),
  });
  const preloadQuery = createQueryPreloader(client);

  test("variables are optional and can be anything with untyped DocumentNode", () => {
    const query = gql``;

    preloadQuery(query);
    preloadQuery(query, { variables: {} });
    preloadQuery(query, { variables: { foo: "bar" } });
    preloadQuery(query, { variables: { foo: "bar", bar: 2 } });
  });

  test("variables are optional and can be anything with unspecified TVariables on a TypedDocumentNode", () => {
    const query: TypedDocumentNode<{ greeting: string }> = gql``;

    preloadQuery(query);
    preloadQuery(query, { variables: {} });
    preloadQuery(query, { variables: { foo: "bar" } });
    preloadQuery(query, { variables: { foo: "bar", bar: 2 } });
  });

  test("variables are optional when TVariables are empty", () => {
    const query: TypedDocumentNode<
      { greeting: string },
      Record<string, never>
    > = gql``;

    preloadQuery(query);
    preloadQuery(query, { variables: {} });
    // @ts-expect-error unknown variables
    preloadQuery(query, { variables: { foo: "bar" } });
  });

  test("does not allow variables when TVariables is `never`", () => {
    const query: TypedDocumentNode<{ greeting: string }, never> = gql``;

    preloadQuery(query);
    // @ts-expect-error no variables option allowed
    preloadQuery(query, { variables: {} });
    // @ts-expect-error no variables option allowed
    preloadQuery(query, { variables: { foo: "bar" } });
  });

  test("optional variables are optional", () => {
    const query: TypedDocumentNode<{ posts: string[] }, { limit?: number }> =
      gql``;

    preloadQuery(query);
    preloadQuery(query, { variables: {} });
    preloadQuery(query, { variables: { limit: 10 } });
    preloadQuery(query, {
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery(query, {
      variables: {
        limit: 10,
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  });

  test("enforces required variables", () => {
    const query: TypedDocumentNode<{ character: string }, { id: string }> =
      gql``;

    // @ts-expect-error missing variables option
    preloadQuery(query);
    // @ts-expect-error empty variables
    preloadQuery(query, { variables: {} });
    preloadQuery(query, { variables: { id: "1" } });
    preloadQuery(query, {
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery(query, {
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  });

  test("requires variables with mixed TVariables", () => {
    const query: TypedDocumentNode<
      { character: string },
      { id: string; language?: string }
    > = gql``;

    // @ts-expect-error missing variables argument
    preloadQuery(query);
    // @ts-expect-error missing variables argument
    preloadQuery(query, { variables: {} });
    preloadQuery(query, { variables: { id: "1" } });
    // @ts-expect-error missing required variable
    preloadQuery(query, { variables: { language: "en" } });
    preloadQuery(query, { variables: { id: "1", language: "en" } });
    preloadQuery(query, {
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery(query, {
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery(query, {
      variables: {
        id: "1",
        language: "en",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  });

  test("returns QueryReference<unknown> when TData cannot be inferred", () => {
    const query = gql``;

    const queryRef = preloadQuery(query);

    expectTypeOf(queryRef).toEqualTypeOf<QueryReference<unknown>>();
  });

  test("returns QueryReference<TData> in default case", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData> = gql``;
      const queryRef = preloadQuery(query);

      expectTypeOf(queryRef).toEqualTypeOf<QueryReference<SimpleCaseData>>();
    }

    {
      const query = gql``;
      const queryRef = preloadQuery<SimpleCaseData>(query);

      expectTypeOf(queryRef).toEqualTypeOf<QueryReference<SimpleCaseData>>();
    }
  });

  test("returns QueryReference<TData | undefined> with errorPolicy: 'ignore'", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData> = gql``;
      const queryRef = preloadQuery(query, { errorPolicy: "ignore" });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<SimpleCaseData | undefined>
      >();
    }

    {
      const query = gql``;
      const queryRef = preloadQuery<SimpleCaseData>(query, {
        errorPolicy: "ignore",
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<SimpleCaseData | undefined>
      >();
    }
  });

  test("returns QueryReference<TData | undefined> with errorPolicy: 'all'", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData> = gql``;
      const queryRef = preloadQuery(query, { errorPolicy: "all" });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<SimpleCaseData | undefined>
      >();
    }

    {
      const query = gql``;
      const queryRef = preloadQuery<SimpleCaseData>(query, {
        errorPolicy: "all",
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<SimpleCaseData | undefined>
      >();
    }
  });

  test("returns QueryReference<TData> with errorPolicy: 'none'", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData> = gql``;
      const queryRef = preloadQuery(query, { errorPolicy: "none" });

      expectTypeOf(queryRef).toEqualTypeOf<QueryReference<SimpleCaseData>>();
    }

    {
      const query = gql``;
      const queryRef = preloadQuery<SimpleCaseData>(query, {
        errorPolicy: "none",
      });

      expectTypeOf(queryRef).toEqualTypeOf<QueryReference<SimpleCaseData>>();
    }
  });

  test("returns QueryReference<DeepPartial<TData>> with returnPartialData: true", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData> = gql``;
      const queryRef = preloadQuery(query, { returnPartialData: true });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<DeepPartial<SimpleCaseData>>
      >();
    }

    {
      const query = gql``;
      const queryRef = preloadQuery<SimpleCaseData>(query, {
        returnPartialData: true,
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<DeepPartial<SimpleCaseData>>
      >();
    }
  });

  test("returns QueryReference<DeepPartial<TData>> with returnPartialData: false", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData> = gql``;
      const queryRef = preloadQuery(query, { returnPartialData: false });

      expectTypeOf(queryRef).toEqualTypeOf<QueryReference<SimpleCaseData>>();
    }

    {
      const query = gql``;
      const queryRef = preloadQuery<SimpleCaseData>(query, {
        returnPartialData: false,
      });

      expectTypeOf(queryRef).toEqualTypeOf<QueryReference<SimpleCaseData>>();
    }
  });

  test("returns QueryReference<TData> when passing an option unrelated to TData", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData> = gql``;
      const queryRef = preloadQuery(query, { canonizeResults: true });

      expectTypeOf(queryRef).toEqualTypeOf<QueryReference<SimpleCaseData>>();
    }

    {
      const query = gql``;
      const queryRef = preloadQuery<SimpleCaseData>(query, {
        canonizeResults: true,
      });

      expectTypeOf(queryRef).toEqualTypeOf<QueryReference<SimpleCaseData>>();
    }
  });

  test("handles combinations of options", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData> = gql``;
      const queryRef = preloadQuery(query, {
        returnPartialData: true,
        errorPolicy: "ignore",
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<DeepPartial<SimpleCaseData> | undefined>
      >();
    }

    {
      const query = gql``;
      const queryRef = preloadQuery<SimpleCaseData>(query, {
        returnPartialData: true,
        errorPolicy: "ignore",
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<DeepPartial<SimpleCaseData> | undefined>
      >();
    }

    {
      const query: TypedDocumentNode<SimpleCaseData> = gql``;
      const queryRef = preloadQuery(query, {
        returnPartialData: true,
        errorPolicy: "none",
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<DeepPartial<SimpleCaseData>>
      >();
    }

    {
      const query = gql``;
      const queryRef = preloadQuery<SimpleCaseData>(query, {
        returnPartialData: true,
        errorPolicy: "none",
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<DeepPartial<SimpleCaseData>>
      >();
    }
  });

  test("returns correct TData type when combined with options unrelated to TData", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData> = gql``;
      const queryRef = preloadQuery(query, {
        canonizeResults: true,
        returnPartialData: true,
        errorPolicy: "none",
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<DeepPartial<SimpleCaseData>>
      >();
    }

    {
      const query = gql``;
      const queryRef = preloadQuery<SimpleCaseData>(query, {
        canonizeResults: true,
        returnPartialData: true,
        errorPolicy: "none",
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<DeepPartial<SimpleCaseData>>
      >();
    }
  });
});
