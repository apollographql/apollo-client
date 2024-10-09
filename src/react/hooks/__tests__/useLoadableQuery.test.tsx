import React, { Suspense, useState } from "react";
import {
  act,
  render,
  screen,
  renderHook,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";
import { expectTypeOf } from "expect-type";
import { GraphQLError } from "graphql";
import {
  gql,
  ApolloError,
  ApolloClient,
  ErrorPolicy,
  NetworkStatus,
  TypedDocumentNode,
  ApolloLink,
  Observable,
  OperationVariables,
  RefetchWritePolicy,
  SubscribeToMoreOptions,
  split,
} from "../../../core";
import {
  MockedProvider,
  MockedProviderProps,
  MockedResponse,
  MockLink,
  MockSubscriptionLink,
  wait,
} from "../../../testing";
import {
  concatPagination,
  offsetLimitPagination,
  DeepPartial,
  getMainDefinition,
} from "../../../utilities";
import { useLoadableQuery } from "../useLoadableQuery";
import type { UseReadQueryResult } from "../useReadQuery";
import { useReadQuery } from "../useReadQuery";
import { ApolloProvider } from "../../context";
import { InMemoryCache } from "../../../cache";
import { LoadableQueryHookFetchPolicy } from "../../types/types";
import { QueryRef } from "../../../react";
import {
  FetchMoreFunction,
  RefetchFunction,
  SubscribeToMoreFunction,
} from "../useSuspenseQuery";
import invariant, { InvariantError } from "ts-invariant";
import {
  SimpleCaseData,
  setupPaginatedCase,
  setupSimpleCase,
  spyOnConsole,
} from "../../../testing/internal";

import {
  RenderStream,
  createRenderStream,
  useTrackRenders,
} from "@testing-library/react-render-stream";
const IS_REACT_19 = React.version.startsWith("19");

afterEach(() => {
  jest.useRealTimers();
});

interface SimpleQueryData {
  greeting: string;
}

function useSimpleQueryCase() {
  const query: TypedDocumentNode<SimpleQueryData, never> = gql`
    query GreetingQuery {
      greeting
    }
  `;

  const mocks: MockedResponse<SimpleQueryData>[] = [
    {
      request: { query },
      result: { data: { greeting: "Hello" } },
      delay: 10,
    },
  ];

  return { query, mocks };
}

interface VariablesCaseData {
  character: {
    id: string;
    name: string;
  };
}

interface VariablesCaseVariables {
  id: string;
}

function useVariablesQueryCase() {
  const query: TypedDocumentNode<VariablesCaseData, VariablesCaseVariables> =
    gql`
      query CharacterQuery($id: ID!) {
        character(id: $id) {
          id
          name
        }
      }
    `;
  const CHARACTERS = ["Spider-Man", "Black Widow", "Iron Man", "Hulk"];

  const mocks: MockedResponse<VariablesCaseData>[] = [...CHARACTERS].map(
    (name, index) => ({
      request: { query, variables: { id: String(index + 1) } },
      result: { data: { character: { id: String(index + 1), name } } },
      delay: 20,
    })
  );

  return { mocks, query };
}

interface PaginatedQueryData {
  letters: {
    letter: string;
    position: number;
  }[];
}

interface PaginatedQueryVariables {
  limit?: number;
  offset?: number;
}

function usePaginatedQueryCase() {
  const query: TypedDocumentNode<PaginatedQueryData, PaginatedQueryVariables> =
    gql`
      query letters($limit: Int, $offset: Int) {
        letters(limit: $limit) {
          letter
          position
        }
      }
    `;

  const data = "ABCDEFG"
    .split("")
    .map((letter, index) => ({ letter, position: index + 1 }));

  const link = new ApolloLink((operation) => {
    const { offset = 0, limit = 2 } = operation.variables;
    const letters = data.slice(offset, offset + limit);

    return new Observable((observer) => {
      setTimeout(() => {
        observer.next({ data: { letters } });
        observer.complete();
      }, 10);
    });
  });

  const client = new ApolloClient({ cache: new InMemoryCache(), link });

  return { query, link, client };
}

function createDefaultProfiler<TData>() {
  return createRenderStream({
    initialSnapshot: {
      error: null as Error | null,
      result: null as UseReadQueryResult<TData> | null,
    },
    skipNonTrackingRenders: true,
  });
}

function createDefaultProfiledComponents<
  Snapshot extends {
    result: UseReadQueryResult<any> | null;
    error?: Error | null;
  },
  TData = Snapshot["result"] extends UseReadQueryResult<infer TData> | null ?
    TData
  : unknown,
>(profiler: RenderStream<Snapshot>) {
  function SuspenseFallback() {
    useTrackRenders();
    return <p>Loading</p>;
  }

  function ReadQueryHook({ queryRef }: { queryRef: QueryRef<TData> }) {
    useTrackRenders();
    profiler.mergeSnapshot({
      result: useReadQuery(queryRef),
    } as Partial<Snapshot>);

    return null;
  }

  function ErrorFallback({ error }: { error: Error }) {
    useTrackRenders();
    profiler.mergeSnapshot({ error } as Partial<Snapshot>);

    return <div>Oops</div>;
  }

  function ErrorBoundary({ children }: { children: React.ReactNode }) {
    return (
      <ReactErrorBoundary FallbackComponent={ErrorFallback}>
        {children}
      </ReactErrorBoundary>
    );
  }

  return {
    SuspenseFallback,
    ReadQueryHook,
    ErrorFallback,
    ErrorBoundary,
  };
}

function renderWithMocks(
  ui: React.ReactElement,
  props: MockedProviderProps,
  { render: doRender } = { render }
) {
  const user = userEvent.setup();

  const utils = doRender(ui, {
    wrapper: ({ children }) => (
      <MockedProvider {...props}>{children}</MockedProvider>
    ),
  });

  return { ...utils, user };
}

function renderWithClient(
  ui: React.ReactElement,
  options: { client: ApolloClient<any> },
  { render: doRender } = { render }
) {
  const { client } = options;
  const user = userEvent.setup();

  const utils = doRender(ui, {
    wrapper: ({ children }) => (
      <ApolloProvider client={client}>{children}</ApolloProvider>
    ),
  });

  return { ...utils, user };
}

it("loads a query and suspends when the load query function is called", async () => {
  const { query, mocks } = useSimpleQueryCase();

  const renderStream = createDefaultProfiler<SimpleQueryData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef] = useLoadableQuery(query);

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithMocks(
    <App />,
    {
      mocks,
    },
    renderStream
  );

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App]);
  }

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
  }
});

it("loads a query with variables and suspends by passing variables to the loadQuery function", async () => {
  const { query, mocks } = useVariablesQueryCase();

  const renderStream = createDefaultProfiler<VariablesCaseData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef] = useLoadableQuery(query);

    return (
      <>
        <button onClick={() => loadQuery({ id: "1" })}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithMocks(
    <App />,
    {
      mocks,
    },
    renderStream
  );

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App]);
  }

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: "Spider-Man" } },
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(renderStream).not.toRerender();
});

it("tears down the query on unmount", async () => {
  const { query, mocks } = useSimpleQueryCase();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  const renderStream = createDefaultProfiler<SimpleQueryData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef] = useLoadableQuery(query);

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user, unmount } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));
  await renderStream.takeRender();

  const { snapshot } = await renderStream.takeRender();

  expect(snapshot.result).toEqual({
    data: { greeting: "Hello" },
    error: undefined,
    networkStatus: NetworkStatus.ready,
  });

  unmount();

  // We need to wait a tick since the cleanup is run in a setTimeout to
  // prevent strict mode bugs.
  await wait(0);

  expect(client.getObservableQueries().size).toBe(0);
  expect(client).not.toHaveSuspenseCacheEntryUsing(query);
});

it("auto disposes of the queryRef if not used within timeout", async () => {
  jest.useFakeTimers();
  const { query } = setupSimpleCase();
  const link = new MockSubscriptionLink();
  const client = new ApolloClient({ link, cache: new InMemoryCache() });

  const { result } = renderHook(() => useLoadableQuery(query, { client }));
  const [loadQuery] = result.current;

  act(() => loadQuery());
  const [, queryRef] = result.current;

  expect(queryRef!).not.toBeDisposed();
  expect(client.getObservableQueries().size).toBe(1);
  expect(client).toHaveSuspenseCacheEntryUsing(query);

  await act(async () => {
    link.simulateResult({ result: { data: { greeting: "Hello" } } }, true);
    // Ensure simulateResult will deliver the result since its wrapped with
    // setTimeout
    await jest.advanceTimersByTimeAsync(10);
  });

  jest.advanceTimersByTime(30_000);

  expect(queryRef!).toBeDisposed();
  expect(client.getObservableQueries().size).toBe(0);
  expect(client).not.toHaveSuspenseCacheEntryUsing(query);
});

it("auto disposes of the queryRef if not used within configured timeout", async () => {
  jest.useFakeTimers();
  const { query } = setupSimpleCase();
  const link = new MockSubscriptionLink();
  const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
    defaultOptions: {
      react: {
        suspense: {
          autoDisposeTimeoutMs: 5000,
        },
      },
    },
  });

  const { result } = renderHook(() => useLoadableQuery(query, { client }));
  const [loadQuery] = result.current;

  act(() => loadQuery());
  const [, queryRef] = result.current;

  expect(queryRef!).not.toBeDisposed();
  expect(client.getObservableQueries().size).toBe(1);
  expect(client).toHaveSuspenseCacheEntryUsing(query);

  await act(async () => {
    link.simulateResult({ result: { data: { greeting: "Hello" } } }, true);
    // Ensure simulateResult will deliver the result since its wrapped with
    // setTimeout
    await jest.advanceTimersByTimeAsync(10);
  });

  jest.advanceTimersByTime(5000);

  expect(queryRef!).toBeDisposed();
  expect(client.getObservableQueries().size).toBe(0);
  expect(client).not.toHaveSuspenseCacheEntryUsing(query);
});

it("will resubscribe after disposed when mounting useReadQuery", async () => {
  const { query, mocks } = setupSimpleCase();
  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache: new InMemoryCache(),
    defaultOptions: {
      react: {
        suspense: {
          // Set this to something really low to avoid fake timers
          autoDisposeTimeoutMs: 20,
        },
      },
    },
  });

  const renderStream = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [show, setShow] = React.useState(false);
    const [loadQuery, queryRef] = useLoadableQuery(query);

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <button onClick={() => setShow((show) => !show)}>Toggle</button>
        <Suspense fallback={<SuspenseFallback />}>
          {show && queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();
  await act(() => user.click(screen.getByText("Load query")));

  expect(client.getObservableQueries().size).toBe(1);
  expect(client).toHaveSuspenseCacheEntryUsing(query);

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App]);
  }

  // Wait long enough for auto dispose to kick in
  await wait(50);

  expect(client.getObservableQueries().size).toBe(0);
  expect(client).not.toHaveSuspenseCacheEntryUsing(query);

  await act(() => user.click(screen.getByText("Toggle")));

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.writeQuery({
    query,
    data: { greeting: "Hello again" },
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Hello again" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it("auto resubscribes when mounting useReadQuery after naturally disposed by useReadQuery", async () => {
  const { query, mocks } = setupSimpleCase();
  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache: new InMemoryCache(),
  });

  const renderStream = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [show, setShow] = React.useState(true);
    const [loadQuery, queryRef] = useLoadableQuery(query);

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <button onClick={() => setShow((show) => !show)}>Toggle</button>
        <Suspense fallback={<SuspenseFallback />}>
          {show && queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );
  const toggleButton = screen.getByText("Toggle");

  // initial render
  await renderStream.takeRender();
  await act(() => user.click(screen.getByText("Load query")));

  expect(client.getObservableQueries().size).toBe(1);
  expect(client).toHaveSuspenseCacheEntryUsing(query);

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(toggleButton));
  await renderStream.takeRender();
  await wait(0);

  expect(client.getObservableQueries().size).toBe(0);
  expect(client).not.toHaveSuspenseCacheEntryUsing(query);

  await act(() => user.click(toggleButton));

  expect(client.getObservableQueries().size).toBe(1);
  // Here we don't expect a suspense cache entry because we previously disposed
  // of it and did not call `loadQuery` again, which would normally add it to
  // the suspense cache
  expect(client).not.toHaveSuspenseCacheEntryUsing(query);

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.writeQuery({
    query,
    data: { greeting: "Hello again" },
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Hello again" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it("changes variables on a query and resuspends when passing new variables to the loadQuery function", async () => {
  const { query, mocks } = useVariablesQueryCase();

  const renderStream = createDefaultProfiler<VariablesCaseData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  const App = () => {
    useTrackRenders();
    const [loadQuery, queryRef] = useLoadableQuery(query);

    return (
      <>
        <button onClick={() => loadQuery({ id: "1" })}>
          Load 1st character
        </button>
        <button onClick={() => loadQuery({ id: "2" })}>
          Load 2nd character
        </button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  };

  const { user } = renderWithMocks(
    <App />,
    {
      mocks,
    },
    renderStream
  );

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App]);
  }

  await act(() => user.click(screen.getByText("Load 1st character")));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: "Spider-Man" } },
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await act(() => user.click(screen.getByText("Load 2nd character")));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { character: { id: "2", name: "Black Widow" } },
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(renderStream).not.toRerender();
});

it("resets the `queryRef` to null and disposes of it when calling the `reset` function", async () => {
  const { query, mocks } = useSimpleQueryCase();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  const renderStream = createDefaultProfiler<SimpleQueryData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef, { reset }] = useLoadableQuery(query);

    // Resetting the result allows us to detect when ReadQueryHook is unmounted
    // since it won't render and overwrite the `null`
    renderStream.mergeSnapshot({ result: null });

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <button onClick={() => reset()}>Reset query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Reset query")));

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App]);
    expect(snapshot.result).toBeNull();
  }

  // Since dispose is called in a setTimeout, we need to wait a tick before
  // checking to see if the query ref was properly disposed
  await wait(0);

  expect(client.getObservableQueries().size).toBe(0);
});

it("allows the client to be overridden", async () => {
  const { query } = useSimpleQueryCase();

  const globalClient = new ApolloClient({
    link: new MockLink([
      {
        request: { query },
        result: { data: { greeting: "global hello" } },
        delay: 10,
      },
    ]),
    cache: new InMemoryCache(),
  });

  const localClient = new ApolloClient({
    link: new MockLink([
      {
        request: { query },
        result: { data: { greeting: "local hello" } },
        delay: 10,
      },
    ]),
    cache: new InMemoryCache(),
  });

  const renderStream = createDefaultProfiler<SimpleQueryData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef] = useLoadableQuery(query, {
      client: localClient,
    });

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client: globalClient,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));
  await renderStream.takeRender();

  const { snapshot } = await renderStream.takeRender();

  expect(snapshot.result).toEqual({
    data: { greeting: "local hello" },
    networkStatus: NetworkStatus.ready,
    error: undefined,
  });
});

it("passes context to the link", async () => {
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

  const renderStream = createDefaultProfiler<QueryData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef] = useLoadableQuery(query, {
      context: { valueA: "A", valueB: "B" },
    });

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));
  await renderStream.takeRender();

  const { snapshot } = await renderStream.takeRender();

  expect(snapshot.result).toEqual({
    data: { context: { valueA: "A", valueB: "B" } },
    networkStatus: NetworkStatus.ready,
    error: undefined,
  });
});

it('enables canonical results when canonizeResults is "true"', async () => {
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

  const client = new ApolloClient({
    cache,
    link: new MockLink([]),
  });

  const renderStream = createDefaultProfiler<QueryData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef] = useLoadableQuery(query, {
      canonizeResults: true,
    });

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));

  const { snapshot } = await renderStream.takeRender();
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

it("can disable canonical results when the cache's canonizeResults setting is true", async () => {
  interface Result {
    __typename: string;
    value: number;
  }

  interface QueryData {
    results: Result[];
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

  const renderStream = createDefaultProfiler<QueryData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef] = useLoadableQuery(query, {
      canonizeResults: false,
    });

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithMocks(
    <App />,
    {
      cache,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));

  const { snapshot } = await renderStream.takeRender();
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

it("returns initial cache data followed by network data when the fetch policy is `cache-and-network`", async () => {
  type QueryData = { hello: string };
  const query: TypedDocumentNode<QueryData, never> = gql`
    query {
      hello
    }
  `;
  const cache = new InMemoryCache();
  const link = new MockLink([
    {
      request: { query },
      result: { data: { hello: "from link" } },
      delay: 20,
    },
  ]);

  const client = new ApolloClient({ link, cache });

  cache.writeQuery({ query, data: { hello: "from cache" } });

  const renderStream = createDefaultProfiler<QueryData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef] = useLoadableQuery(query, {
      fetchPolicy: "cache-and-network",
    });

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { hello: "from cache" },
      networkStatus: NetworkStatus.loading,
      error: undefined,
    });
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { hello: "from link" },
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }
});

it("all data is present in the cache, no network request is made", async () => {
  const query = gql`
    query {
      hello
    }
  `;
  const cache = new InMemoryCache();
  const link = new MockLink([
    {
      request: { query },
      result: { data: { hello: "from link" } },
      delay: 20,
    },
  ]);

  const client = new ApolloClient({
    link,
    cache,
  });

  cache.writeQuery({ query, data: { hello: "from cache" } });

  const renderStream = createDefaultProfiler();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef] = useLoadableQuery(query);

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));

  const { snapshot, renderedComponents } = await renderStream.takeRender();

  expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
  expect(snapshot.result).toEqual({
    data: { hello: "from cache" },
    networkStatus: NetworkStatus.ready,
    error: undefined,
  });

  await expect(renderStream).not.toRerender();
});

it("partial data is present in the cache so it is ignored and network request is made", async () => {
  const query = gql`
    {
      hello
      foo
    }
  `;
  const cache = new InMemoryCache();
  const link = new MockLink([
    {
      request: { query },
      result: { data: { hello: "from link", foo: "bar" } },
      delay: 20,
    },
  ]);

  const client = new ApolloClient({
    link,
    cache,
  });

  {
    // we expect a "Missing field 'foo' while writing result..." error
    // when writing hello to the cache, so we'll silence the console.error
    using _consoleSpy = spyOnConsole("error");
    cache.writeQuery({ query, data: { hello: "from cache" } });
  }

  const renderStream = createDefaultProfiler();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef] = useLoadableQuery(query);

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { foo: "bar", hello: "from link" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it("existing data in the cache is ignored when `fetchPolicy` is 'network-only'", async () => {
  const query = gql`
    query {
      hello
    }
  `;
  const cache = new InMemoryCache();
  const link = new MockLink([
    {
      request: { query },
      result: { data: { hello: "from link" } },
      delay: 20,
    },
  ]);

  const client = new ApolloClient({
    link,
    cache,
  });

  cache.writeQuery({ query, data: { hello: "from cache" } });

  const renderStream = createDefaultProfiler();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef] = useLoadableQuery(query, {
      fetchPolicy: "network-only",
    });

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { hello: "from link" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it("fetches data from the network but does not update the cache when `fetchPolicy` is 'no-cache'", async () => {
  const query = gql`
    query {
      hello
    }
  `;
  const cache = new InMemoryCache();
  const link = new MockLink([
    {
      request: { query },
      result: { data: { hello: "from link" } },
      delay: 20,
    },
  ]);

  const client = new ApolloClient({ link, cache });

  cache.writeQuery({ query, data: { hello: "from cache" } });

  const renderStream = createDefaultProfiler();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef] = useLoadableQuery(query, {
      fetchPolicy: "no-cache",
    });

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { hello: "from link" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(client.extract()).toEqual({
    ROOT_QUERY: { __typename: "Query", hello: "from cache" },
  });
});

it("works with startTransition to change variables", async () => {
  type Variables = {
    id: string;
  };

  interface Data {
    todo: {
      id: string;
      name: string;
      completed: boolean;
    };
  }

  const query: TypedDocumentNode<Data, Variables> = gql`
    query TodoItemQuery($id: ID!) {
      todo(id: $id) {
        id
        name
        completed
      }
    }
  `;

  const mocks = [
    {
      request: { query, variables: { id: "1" } },
      result: {
        data: { todo: { id: "1", name: "Clean room", completed: false } },
      },
      delay: 10,
    },
    {
      request: { query, variables: { id: "2" } },
      result: {
        data: {
          todo: { id: "2", name: "Take out trash", completed: true },
        },
      },
      delay: 10,
    },
  ];

  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache: new InMemoryCache(),
  });

  function SuspenseFallback() {
    return <p>Loading</p>;
  }

  function App() {
    const [loadQuery, queryRef] = useLoadableQuery(query);

    return (
      <div>
        <button onClick={() => loadQuery({ id: "1" })}>Load first todo</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && (
            <Todo queryRef={queryRef} onChange={(id) => loadQuery({ id })} />
          )}
        </Suspense>
      </div>
    );
  }

  function Todo({
    queryRef,
    onChange,
  }: {
    queryRef: QueryRef<Data>;
    onChange: (id: string) => void;
  }) {
    const { data } = useReadQuery(queryRef);
    const [isPending, startTransition] = React.useTransition();
    const { todo } = data;

    return (
      <>
        <button
          onClick={() => {
            startTransition(() => {
              onChange("2");
            });
          }}
        >
          Refresh
        </button>
        <div data-testid="todo" aria-busy={isPending}>
          {todo.name}
          {todo.completed && " (completed)"}
        </div>
      </>
    );
  }

  const { user } = renderWithClient(<App />, { client });

  await act(() => user.click(screen.getByText("Load first todo")));

  expect(screen.getByText("Loading")).toBeInTheDocument();
  expect(await screen.findByTestId("todo")).toBeInTheDocument();

  const todo = screen.getByTestId("todo");
  const button = screen.getByText("Refresh");

  expect(todo).toHaveTextContent("Clean room");

  await act(() => user.click(button));

  // startTransition will avoid rendering the suspense fallback for already
  // revealed content if the state update inside the transition causes the
  // component to suspend.
  //
  // Here we should not see the suspense fallback while the component suspends
  // until the todo is finished loading. Seeing the suspense fallback is an
  // indication that we are suspending the component too late in the process.
  expect(screen.queryByText("Loading")).not.toBeInTheDocument();

  // We can ensure this works with isPending from useTransition in the process
  expect(todo).toHaveAttribute("aria-busy", "true");

  // Ensure we are showing the stale UI until the new todo has loaded
  expect(todo).toHaveTextContent("Clean room");

  // Eventually we should see the updated todo content once its done
  // suspending.
  await waitFor(() => {
    expect(todo).toHaveTextContent("Take out trash (completed)");
  });
});

it('does not suspend deferred queries with data in the cache and using a "cache-and-network" fetch policy', async () => {
  interface Data {
    greeting: {
      __typename: string;
      message: string;
      recipient: { name: string; __typename: string };
    };
  }

  const query: TypedDocumentNode<Data, never> = gql`
    query {
      greeting {
        message
        ... @defer {
          recipient {
            name
          }
        }
      }
    }
  `;

  const link = new MockSubscriptionLink();
  const cache = new InMemoryCache();
  cache.writeQuery({
    query,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello cached",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
  });
  const client = new ApolloClient({ cache, link });

  const renderStream = createDefaultProfiler<Data>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef] = useLoadableQuery(query, {
      fetchPolicy: "cache-and-network",
    });
    return (
      <div>
        <button onClick={() => loadQuery()}>Load todo</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </div>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load todo")));

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);

    expect(snapshot.result).toEqual({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello cached",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
      },
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  link.simulateResult({
    result: {
      data: {
        greeting: { __typename: "Greeting", message: "Hello world" },
      },
      hasNext: true,
    },
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
      },
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
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
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

  await expect(renderStream).not.toRerender();
});

it("reacts to cache updates", async () => {
  const { query, mocks } = useSimpleQueryCase();
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as UseReadQueryResult<SimpleQueryData> | null,
    },
  });

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef] = useLoadableQuery(query);

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));
  await renderStream.takeRender();

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.writeQuery({
    query,
    data: { greeting: "Updated Hello" },
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Updated Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender();
});

it("applies `errorPolicy` on next fetch when it changes between renders", async () => {
  const { query } = useSimpleQueryCase();

  const mocks: MockedResponse<SimpleQueryData>[] = [
    {
      request: { query },
      result: { data: { greeting: "Hello" } },
      delay: 10,
    },
    {
      request: { query },
      result: {
        errors: [new GraphQLError("oops")],
      },
      delay: 10,
    },
  ];

  const renderStream = createDefaultProfiler<SimpleQueryData>();
  const { SuspenseFallback, ReadQueryHook, ErrorBoundary, ErrorFallback } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [errorPolicy, setErrorPolicy] = useState<ErrorPolicy>("none");
    const [loadQuery, queryRef, { refetch }] = useLoadableQuery(query, {
      errorPolicy,
    });

    return (
      <>
        <button onClick={() => setErrorPolicy("all")}>
          Change error policy
        </button>
        <button onClick={() => refetch()}>Refetch greeting</button>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          <ErrorBoundary>
            {queryRef && <ReadQueryHook queryRef={queryRef} />}
          </ErrorBoundary>
        </Suspense>
      </>
    );
  }

  const { user } = renderWithMocks(
    <App />,
    {
      mocks,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Change error policy")));
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Refetch greeting")));
  await renderStream.takeRender();

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    // Ensure we aren't rendering the error boundary and instead rendering the
    // error message in the hook component.
    expect(renderedComponents).not.toContain(ErrorFallback);
    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: new ApolloError({ graphQLErrors: [new GraphQLError("oops")] }),
      networkStatus: NetworkStatus.error,
    });
  }
});

it("applies `context` on next fetch when it changes between renders", async () => {
  interface Data {
    phase: string;
  }

  const query: TypedDocumentNode<Data, never> = gql`
    query {
      phase
    }
  `;

  const link = new ApolloLink((operation) => {
    return new Observable((subscriber) => {
      setTimeout(() => {
        subscriber.next({
          data: {
            phase: operation.getContext().phase,
          },
        });
        subscriber.complete();
      }, 10);
    });
  });

  const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
  });

  const renderStream = createDefaultProfiler<Data>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [phase, setPhase] = React.useState("initial");
    const [loadQuery, queryRef, { refetch }] = useLoadableQuery(query, {
      context: { phase },
    });

    return (
      <>
        <button onClick={() => setPhase("rerender")}>Update context</button>
        <button onClick={() => refetch()}>Refetch</button>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result!.data).toEqual({
      phase: "initial",
    });
  }

  await act(() => user.click(screen.getByText("Update context")));
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Refetch")));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result!.data).toEqual({
      phase: "rerender",
    });
  }
});

// NOTE: We only test the `false` -> `true` path here. If the option changes
// from `true` -> `false`, the data has already been canonized, so it has no
// effect on the output.
it("returns canonical results immediately when `canonizeResults` changes from `false` to `true` between renders", async () => {
  interface Result {
    __typename: string;
    value: number;
  }

  interface Data {
    results: Result[];
  }

  const cache = new InMemoryCache({
    typePolicies: {
      Result: {
        keyFields: false,
      },
    },
  });

  const query: TypedDocumentNode<Data> = gql`
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

  const client = new ApolloClient({
    link: new MockLink([]),
    cache,
  });

  const renderStream = createDefaultProfiler<Data>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [canonizeResults, setCanonizeResults] = React.useState(false);
    const [loadQuery, queryRef] = useLoadableQuery(query, {
      canonizeResults,
    });

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <button onClick={() => setCanonizeResults(true)}>
          Canonize results
        </button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { snapshot } = await renderStream.takeRender();
    const { data } = snapshot.result!;
    const resultSet = new Set(data.results);
    const values = Array.from(resultSet).map((item) => item.value);

    expect(data.results.length).toBe(6);
    expect(resultSet.size).toBe(6);
    expect(values).toEqual([0, 1, 1, 2, 3, 5]);
  }

  await act(() => user.click(screen.getByText("Canonize results")));

  {
    const { snapshot } = await renderStream.takeRender();
    const { data } = snapshot.result!;
    const resultSet = new Set(data.results);
    const values = Array.from(resultSet).map((item) => item.value);

    expect(data.results.length).toBe(6);
    expect(resultSet.size).toBe(5);
    expect(values).toEqual([0, 1, 2, 3, 5]);
  }
});

it("applies changed `refetchWritePolicy` to next fetch when changing between renders", async () => {
  interface Data {
    primes: number[];
  }

  const query: TypedDocumentNode<Data, { min: number; max: number }> = gql`
    query GetPrimes($min: number, $max: number) {
      primes(min: $min, max: $max)
    }
  `;

  const mocks = [
    {
      request: { query, variables: { min: 0, max: 12 } },
      result: { data: { primes: [2, 3, 5, 7, 11] } },
      delay: 10,
    },
    {
      request: { query, variables: { min: 12, max: 30 } },
      result: { data: { primes: [13, 17, 19, 23, 29] } },
      delay: 10,
    },
    {
      request: { query, variables: { min: 30, max: 50 } },
      result: { data: { primes: [31, 37, 41, 43, 47] } },
      delay: 10,
    },
  ];

  const mergeParams: [number[] | undefined, number[]][] = [];

  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          primes: {
            keyArgs: false,
            merge(existing: number[] | undefined, incoming: number[]) {
              mergeParams.push([existing, incoming]);
              return existing ? existing.concat(incoming) : incoming;
            },
          },
        },
      },
    },
  });

  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache,
  });

  const renderStream = createDefaultProfiler<Data>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [refetchWritePolicy, setRefetchWritePolicy] =
      React.useState<RefetchWritePolicy>("merge");

    const [loadQuery, queryRef, { refetch }] = useLoadableQuery(query, {
      refetchWritePolicy,
    });

    return (
      <>
        <button onClick={() => loadQuery({ min: 0, max: 12 })}>
          Load query
        </button>
        <button onClick={() => setRefetchWritePolicy("overwrite")}>
          Change refetch write policy
        </button>
        <button onClick={() => refetch({ min: 12, max: 30 })}>
          Refetch next
        </button>
        <button onClick={() => refetch({ min: 30, max: 50 })}>
          Refetch last
        </button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();
    const { primes } = snapshot.result!.data;

    expect(primes).toEqual([2, 3, 5, 7, 11]);
    expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);
  }

  await act(() => user.click(screen.getByText("Refetch next")));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();
    const { primes } = snapshot.result!.data;

    expect(primes).toEqual([2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);
    expect(mergeParams).toEqual([
      [undefined, [2, 3, 5, 7, 11]],
      [
        [2, 3, 5, 7, 11],
        [13, 17, 19, 23, 29],
      ],
    ]);
  }

  await act(() => user.click(screen.getByText("Change refetch write policy")));
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Refetch last")));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();
    const { primes } = snapshot.result!.data;

    expect(primes).toEqual([31, 37, 41, 43, 47]);
    expect(mergeParams).toEqual([
      [undefined, [2, 3, 5, 7, 11]],
      [
        [2, 3, 5, 7, 11],
        [13, 17, 19, 23, 29],
      ],
      [undefined, [31, 37, 41, 43, 47]],
    ]);
  }
});

it("applies `returnPartialData` on next fetch when it changes between renders", async () => {
  interface Data {
    character: {
      __typename: "Character";
      id: string;
      name: string;
    };
  }

  interface PartialData {
    character: {
      __typename: "Character";
      id: string;
    };
  }

  const fullQuery: TypedDocumentNode<Data> = gql`
    query {
      character {
        __typename
        id
        name
      }
    }
  `;

  const partialQuery: TypedDocumentNode<PartialData> = gql`
    query {
      character {
        __typename
        id
      }
    }
  `;

  const mocks = [
    {
      request: { query: fullQuery },
      result: {
        data: {
          character: {
            __typename: "Character",
            id: "1",
            name: "Doctor Strange",
          },
        },
      },
      delay: 10,
    },
    {
      request: { query: fullQuery },
      result: {
        data: {
          character: {
            __typename: "Character",
            id: "1",
            name: "Doctor Strange (refetched)",
          },
        },
      },
      delay: 100,
    },
  ];

  const cache = new InMemoryCache();

  cache.writeQuery({
    query: partialQuery,
    data: { character: { __typename: "Character", id: "1" } },
  });

  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache,
  });

  const renderStream = createDefaultProfiler<Data>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [returnPartialData, setReturnPartialData] = React.useState(false);

    const [loadQuery, queryRef] = useLoadableQuery(fullQuery, {
      returnPartialData,
    });

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <button onClick={() => setReturnPartialData(true)}>
          Update partial data
        </button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: {
        character: { __typename: "Character", id: "1", name: "Doctor Strange" },
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Update partial data")));
  await renderStream.takeRender();

  cache.modify({
    id: cache.identify({ __typename: "Character", id: "1" }),
    fields: {
      name: (_, { DELETE }) => DELETE,
    },
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: {
        character: { __typename: "Character", id: "1" },
      },
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: {
        character: {
          __typename: "Character",
          id: "1",
          name: "Doctor Strange (refetched)",
        },
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it("applies updated `fetchPolicy` on next fetch when it changes between renders", async () => {
  interface Data {
    character: {
      __typename: "Character";
      id: string;
      name: string;
    };
  }

  const query: TypedDocumentNode<Data> = gql`
    query {
      character {
        __typename
        id
        name
      }
    }
  `;

  const mocks = [
    {
      request: { query },
      result: {
        data: {
          character: {
            __typename: "Character",
            id: "1",
            name: "Doctor Strange",
          },
        },
      },
      delay: 10,
    },
  ];

  const cache = new InMemoryCache();

  cache.writeQuery({
    query,
    data: {
      character: {
        __typename: "Character",
        id: "1",
        name: "Doctor Strangecache",
      },
    },
  });

  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache,
  });

  const renderStream = createDefaultProfiler<Data>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [fetchPolicy, setFetchPolicy] =
      React.useState<LoadableQueryHookFetchPolicy>("cache-first");

    const [loadQuery, queryRef, { refetch }] = useLoadableQuery(query, {
      fetchPolicy,
    });

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <button onClick={() => setFetchPolicy("no-cache")}>
          Change fetch policy
        </button>
        <button onClick={() => refetch()}>Refetch</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: {
        character: {
          __typename: "Character",
          id: "1",
          name: "Doctor Strangecache",
        },
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Change fetch policy")));
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Refetch")));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: {
        character: {
          __typename: "Character",
          id: "1",
          name: "Doctor Strange",
        },
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  // Because we switched to a `no-cache` fetch policy, we should not see the
  // newly fetched data in the cache after the fetch occured.
  expect(cache.readQuery({ query })).toEqual({
    character: {
      __typename: "Character",
      id: "1",
      name: "Doctor Strangecache",
    },
  });
});

it("re-suspends when calling `refetch`", async () => {
  const { query } = useVariablesQueryCase();

  const mocks: MockedResponse<VariablesCaseData>[] = [
    {
      request: { query, variables: { id: "1" } },
      result: {
        data: { character: { id: "1", name: "Spider-Man" } },
      },
      delay: 20,
    },
    // refetch
    {
      request: { query, variables: { id: "1" } },
      result: {
        data: { character: { id: "1", name: "Spider-Man (updated)" } },
      },
      delay: 20,
    },
  ];

  const renderStream = createDefaultProfiler<VariablesCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef, { refetch }] = useLoadableQuery(query);

    return (
      <>
        <button onClick={() => loadQuery({ id: "1" })}>Load query</button>
        <button onClick={() => refetch()}>Refetch</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithMocks(
    <App />,
    {
      mocks,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: "Spider-Man" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Refetch")));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: "Spider-Man (updated)" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender();
});

it("re-suspends when calling `refetch` with new variables", async () => {
  const { query } = useVariablesQueryCase();

  const mocks: MockedResponse<VariablesCaseData>[] = [
    {
      request: { query, variables: { id: "1" } },
      result: {
        data: { character: { id: "1", name: "Captain Marvel" } },
      },
      delay: 10,
    },
    {
      request: { query, variables: { id: "2" } },
      result: {
        data: { character: { id: "2", name: "Captain America" } },
      },
      delay: 10,
    },
  ];

  const renderStream = createDefaultProfiler<VariablesCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef, { refetch }] = useLoadableQuery(query);

    return (
      <>
        <button onClick={() => loadQuery({ id: "1" })}>Load query</button>
        <button onClick={() => refetch({ id: "2" })}>Refetch with ID 2</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithMocks(
    <App />,
    {
      mocks,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: "Captain Marvel" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Refetch with ID 2")));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { character: { id: "2", name: "Captain America" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender();
});

it("re-suspends multiple times when calling `refetch` multiple times", async () => {
  const { query } = useVariablesQueryCase();

  const mocks: MockedResponse<VariablesCaseData>[] = [
    {
      request: { query, variables: { id: "1" } },
      result: {
        data: { character: { id: "1", name: "Spider-Man" } },
      },
      maxUsageCount: 3,
      delay: 10,
    },
  ];

  const renderStream = createDefaultProfiler<VariablesCaseData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef, { refetch }] = useLoadableQuery(query);

    return (
      <>
        <button onClick={() => loadQuery({ id: "1" })}>Load query</button>
        <button onClick={() => refetch()}>Refetch</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithMocks(
    <App />,
    {
      mocks,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: "Spider-Man" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  const button = screen.getByText("Refetch");

  await act(() => user.click(button));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: "Spider-Man" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(button));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: "Spider-Man" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender();
});

it("throws errors when errors are returned after calling `refetch`", async () => {
  using _consoleSpy = spyOnConsole("error");

  const { query } = useVariablesQueryCase();

  const mocks: MockedResponse<VariablesCaseData>[] = [
    {
      request: { query, variables: { id: "1" } },
      result: {
        data: { character: { id: "1", name: "Captain Marvel" } },
      },
      delay: 20,
    },
    {
      request: { query, variables: { id: "1" } },
      result: {
        errors: [new GraphQLError("Something went wrong")],
      },
      delay: 20,
    },
  ];

  const renderStream = createDefaultProfiler<VariablesCaseData>();

  const { SuspenseFallback, ReadQueryHook, ErrorBoundary, ErrorFallback } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef, { refetch }] = useLoadableQuery(query);

    return (
      <>
        <button onClick={() => loadQuery({ id: "1" })}>Load query</button>
        <button onClick={() => refetch()}>Refetch</button>
        <Suspense fallback={<SuspenseFallback />}>
          <ErrorBoundary>
            {queryRef && <ReadQueryHook queryRef={queryRef} />}
          </ErrorBoundary>
        </Suspense>
      </>
    );
  }

  const { user } = renderWithMocks(
    <App />,
    {
      mocks,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: "Captain Marvel" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Refetch")));
  await renderStream.takeRender();

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ErrorFallback]);
    expect(snapshot.error).toEqual(
      new ApolloError({
        graphQLErrors: [new GraphQLError("Something went wrong")],
      })
    );
  }
});

it('ignores errors returned after calling `refetch` when errorPolicy is set to "ignore"', async () => {
  const { query } = useVariablesQueryCase();

  const mocks = [
    {
      request: { query, variables: { id: "1" } },
      result: {
        data: { character: { id: "1", name: "Captain Marvel" } },
      },
      delay: 10,
    },
    {
      request: { query, variables: { id: "1" } },
      result: {
        errors: [new GraphQLError("Something went wrong")],
      },
      delay: 10,
    },
  ];

  const renderStream = createDefaultProfiler<VariablesCaseData | undefined>();

  const { SuspenseFallback, ReadQueryHook, ErrorBoundary, ErrorFallback } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef, { refetch }] = useLoadableQuery(query, {
      errorPolicy: "ignore",
    });

    return (
      <>
        <button onClick={() => loadQuery({ id: "1" })}>Load query</button>
        <button onClick={() => refetch()}>Refetch</button>
        <Suspense fallback={<SuspenseFallback />}>
          <ErrorBoundary>
            {queryRef && <ReadQueryHook queryRef={queryRef} />}
          </ErrorBoundary>
        </Suspense>
      </>
    );
  }

  const { user } = renderWithMocks(
    <App />,
    {
      mocks,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqual({
      data: { character: { id: "1", name: "Captain Marvel" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Refetch")));
  await renderStream.takeRender();

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(snapshot.error).toBeNull();
    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: "Captain Marvel" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });

    expect(renderedComponents).not.toContain(ErrorFallback);
  }

  await expect(renderStream).not.toRerender();
});

it('returns errors after calling `refetch` when errorPolicy is set to "all"', async () => {
  const { query } = useVariablesQueryCase();

  const mocks: MockedResponse<VariablesCaseData>[] = [
    {
      request: { query, variables: { id: "1" } },
      result: {
        data: { character: { id: "1", name: "Captain Marvel" } },
      },
      delay: 20,
    },
    {
      request: { query, variables: { id: "1" } },
      result: {
        errors: [new GraphQLError("Something went wrong")],
      },
      delay: 20,
    },
  ];

  const renderStream = createDefaultProfiler<VariablesCaseData | undefined>();

  const { SuspenseFallback, ReadQueryHook, ErrorBoundary, ErrorFallback } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef, { refetch }] = useLoadableQuery(query, {
      errorPolicy: "all",
    });

    return (
      <>
        <button onClick={() => loadQuery({ id: "1" })}>Load query</button>
        <button onClick={() => refetch()}>Refetch</button>
        <Suspense fallback={<SuspenseFallback />}>
          <ErrorBoundary>
            {queryRef && <ReadQueryHook queryRef={queryRef} />}
          </ErrorBoundary>
        </Suspense>
      </>
    );
  }

  const { user } = renderWithMocks(
    <App />,
    {
      mocks,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: "Captain Marvel" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Refetch")));
  await renderStream.takeRender();

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).not.toContain(ErrorFallback);
    expect(snapshot.error).toBeNull();
    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: "Captain Marvel" } },
      error: new ApolloError({
        graphQLErrors: [new GraphQLError("Something went wrong")],
      }),
      networkStatus: NetworkStatus.error,
    });
  }

  await expect(renderStream).not.toRerender();
});

it('handles partial data results after calling `refetch` when errorPolicy is set to "all"', async () => {
  const { query } = useVariablesQueryCase();

  const mocks = [
    {
      request: { query, variables: { id: "1" } },
      result: {
        data: { character: { id: "1", name: "Captain Marvel" } },
      },
      delay: 20,
    },
    {
      request: { query, variables: { id: "1" } },
      result: {
        data: { character: { id: "1", name: null } },
        errors: [new GraphQLError("Something went wrong")],
      },
      delay: 20,
    },
  ];

  const renderStream = createDefaultProfiler<VariablesCaseData | undefined>();

  const { SuspenseFallback, ReadQueryHook, ErrorBoundary, ErrorFallback } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef, { refetch }] = useLoadableQuery(query, {
      errorPolicy: "all",
    });

    return (
      <>
        <button onClick={() => loadQuery({ id: "1" })}>Load query</button>
        <button onClick={() => refetch()}>Refetch</button>
        <Suspense fallback={<SuspenseFallback />}>
          <ErrorBoundary>
            {queryRef && <ReadQueryHook queryRef={queryRef} />}
          </ErrorBoundary>
        </Suspense>
      </>
    );
  }

  const { user } = renderWithMocks(
    <App />,
    {
      mocks,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: "Captain Marvel" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Refetch")));
  await renderStream.takeRender();

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).not.toContain(ErrorFallback);
    expect(snapshot.error).toBeNull();
    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: null } },
      error: new ApolloError({
        graphQLErrors: [new GraphQLError("Something went wrong")],
      }),
      networkStatus: NetworkStatus.error,
    });
  }

  await expect(renderStream).not.toRerender();
});

it("`refetch` works with startTransition to allow React to show stale UI until finished suspending", async () => {
  type Variables = {
    id: string;
  };

  interface Data {
    todo: {
      id: string;
      name: string;
      completed: boolean;
    };
  }

  const query: TypedDocumentNode<Data, Variables> = gql`
    query TodoItemQuery($id: ID!) {
      todo(id: $id) {
        id
        name
        completed
      }
    }
  `;

  const mocks: MockedResponse<Data>[] = [
    {
      request: { query, variables: { id: "1" } },
      result: {
        data: { todo: { id: "1", name: "Clean room", completed: false } },
      },
      delay: 10,
    },
    {
      request: { query, variables: { id: "1" } },
      result: {
        data: { todo: { id: "1", name: "Clean room", completed: true } },
      },
      delay: 10,
    },
  ];

  function SuspenseFallback() {
    return <p>Loading</p>;
  }

  function App() {
    const [id, setId] = React.useState("1");
    const [loadQuery, queryRef, { refetch }] = useLoadableQuery(query);

    return (
      <>
        <button onClick={() => loadQuery({ id })}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && (
            <Todo refetch={refetch} queryRef={queryRef} onChange={setId} />
          )}
        </Suspense>
      </>
    );
  }

  function Todo({
    queryRef,
    refetch,
  }: {
    refetch: RefetchFunction<Data, OperationVariables>;
    queryRef: QueryRef<Data>;
    onChange: (id: string) => void;
  }) {
    const { data } = useReadQuery(queryRef);
    const [isPending, startTransition] = React.useTransition();
    const { todo } = data;

    return (
      <>
        <button
          onClick={() => {
            startTransition(() => {
              refetch();
            });
          }}
        >
          Refresh
        </button>
        <div data-testid="todo" aria-busy={isPending}>
          {todo.name}
          {todo.completed && " (completed)"}
        </div>
      </>
    );
  }

  const { user } = renderWithMocks(<App />, { mocks });

  await act(() => user.click(screen.getByText("Load query")));

  expect(screen.getByText("Loading")).toBeInTheDocument();
  expect(await screen.findByTestId("todo")).toBeInTheDocument();

  const todo = screen.getByTestId("todo");
  const button = screen.getByText("Refresh");

  expect(todo).toHaveTextContent("Clean room");

  await act(() => user.click(button));

  // startTransition will avoid rendering the suspense fallback for already
  // revealed content if the state update inside the transition causes the
  // component to suspend.
  //
  // Here we should not see the suspense fallback while the component suspends
  // until the todo is finished loading. Seeing the suspense fallback is an
  // indication that we are suspending the component too late in the process.
  expect(screen.queryByText("Loading")).not.toBeInTheDocument();

  // We can ensure this works with isPending from useTransition in the process
  expect(todo).toHaveAttribute("aria-busy", "true");

  // Ensure we are showing the stale UI until the new todo has loaded
  expect(todo).toHaveTextContent("Clean room");

  // Eventually we should see the updated todo content once its done
  // suspending.
  await waitFor(() => {
    expect(todo).toHaveTextContent("Clean room (completed)");
  });
});

it("re-suspends when calling `fetchMore` with different variables", async () => {
  const { query, link } = setupPaginatedCase();

  const client = new ApolloClient({
    link,
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            letters: {
              keyArgs: false,
            },
          },
        },
      },
    }),
  });

  const renderStream = createDefaultProfiler<PaginatedQueryData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef, { fetchMore }] = useLoadableQuery(query);

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <button
          onClick={() => fetchMore({ variables: { offset: 2, limit: 2 } })}
        >
          Fetch more
        </button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: {
        letters: [
          { __typename: "Letter", letter: "A", position: 1 },
          { __typename: "Letter", letter: "B", position: 2 },
        ],
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Fetch more")));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: {
        letters: [
          { __typename: "Letter", letter: "C", position: 3 },
          { __typename: "Letter", letter: "D", position: 4 },
        ],
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender();
});

it("properly uses `updateQuery` when calling `fetchMore`", async () => {
  const { query, client } = usePaginatedQueryCase();
  const renderStream = createDefaultProfiler<PaginatedQueryData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef, { fetchMore }] = useLoadableQuery(query);

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <button
          onClick={() =>
            fetchMore({
              variables: { offset: 2, limit: 2 },
              updateQuery: (prev, { fetchMoreResult }) => ({
                letters: prev.letters.concat(fetchMoreResult.letters),
              }),
            })
          }
        >
          Fetch more
        </button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: {
        letters: [
          { letter: "A", position: 1 },
          { letter: "B", position: 2 },
        ],
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Fetch more")));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: {
        letters: [
          { letter: "A", position: 1 },
          { letter: "B", position: 2 },
          { letter: "C", position: 3 },
          { letter: "D", position: 4 },
        ],
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  // TODO investigate: this test highlights a React render
  // that actually doesn't rerender any user-provided components
  // so we need to use `skipNonTrackingRenders`
  await expect(renderStream).not.toRerender();
});

it("properly uses cache field policies when calling `fetchMore` without `updateQuery`", async () => {
  const { query, link } = usePaginatedQueryCase();
  const renderStream = createDefaultProfiler<PaginatedQueryData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  const client = new ApolloClient({
    link,
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            letters: concatPagination(),
          },
        },
      },
    }),
  });

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef, { fetchMore }] = useLoadableQuery(query);

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <button
          onClick={() => fetchMore({ variables: { offset: 2, limit: 2 } })}
        >
          Fetch more
        </button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: {
        letters: [
          { letter: "A", position: 1 },
          { letter: "B", position: 2 },
        ],
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Fetch more")));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: {
        letters: [
          { letter: "A", position: 1 },
          { letter: "B", position: 2 },
          { letter: "C", position: 3 },
          { letter: "D", position: 4 },
        ],
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  // TODO investigate: this test highlights a React render
  // that actually doesn't rerender any user-provided components
  // so we need to use `skipNonTrackingRenders`
  await expect(renderStream).not.toRerender();
});

it("`fetchMore` works with startTransition to allow React to show stale UI until finished suspending", async () => {
  type Variables = {
    offset: number;
  };

  interface Todo {
    __typename: "Todo";
    id: string;
    name: string;
    completed: boolean;
  }
  interface Data {
    todos: Todo[];
  }

  const query: TypedDocumentNode<Data, Variables> = gql`
    query TodosQuery($offset: Int!) {
      todos(offset: $offset) {
        id
        name
        completed
      }
    }
  `;

  const mocks: MockedResponse<Data>[] = [
    {
      request: { query, variables: { offset: 0 } },
      result: {
        data: {
          todos: [
            {
              __typename: "Todo",
              id: "1",
              name: "Clean room",
              completed: false,
            },
          ],
        },
      },
      delay: 10,
    },
    {
      request: { query, variables: { offset: 1 } },
      result: {
        data: {
          todos: [
            {
              __typename: "Todo",
              id: "2",
              name: "Take out trash",
              completed: true,
            },
          ],
        },
      },
      delay: 10,
    },
  ];

  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            todos: offsetLimitPagination(),
          },
        },
      },
    }),
  });

  function SuspenseFallback() {
    return <p>Loading</p>;
  }

  function App() {
    const [loadQuery, queryRef, { fetchMore }] = useLoadableQuery(query);

    return (
      <>
        <button onClick={() => loadQuery({ offset: 0 })}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <Todo fetchMore={fetchMore} queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  function Todo({
    queryRef,
    fetchMore,
  }: {
    fetchMore: FetchMoreFunction<Data, OperationVariables>;
    queryRef: QueryRef<Data>;
  }) {
    const { data } = useReadQuery(queryRef);
    const [isPending, startTransition] = React.useTransition();
    const { todos } = data;

    return (
      <>
        <button
          onClick={() => {
            startTransition(() => {
              fetchMore({ variables: { offset: 1 } });
            });
          }}
        >
          Load more
        </button>
        <div data-testid="todos" aria-busy={isPending}>
          {todos.map((todo) => (
            <div data-testid={`todo:${todo.id}`} key={todo.id}>
              {todo.name}
              {todo.completed && " (completed)"}
            </div>
          ))}
        </div>
      </>
    );
  }

  const { user } = renderWithClient(<App />, { client });

  await act(() => user.click(screen.getByText("Load query")));

  expect(screen.getByText("Loading")).toBeInTheDocument();

  expect(await screen.findByTestId("todos")).toBeInTheDocument();

  const todos = screen.getByTestId("todos");
  const todo1 = screen.getByTestId("todo:1");
  const button = screen.getByText("Load more");

  expect(todo1).toBeInTheDocument();

  await act(() => user.click(button));

  // startTransition will avoid rendering the suspense fallback for already
  // revealed content if the state update inside the transition causes the
  // component to suspend.
  //
  // Here we should not see the suspense fallback while the component suspends
  // until the todo is finished loading. Seeing the suspense fallback is an
  // indication that we are suspending the component too late in the process.
  expect(screen.queryByText("Loading")).not.toBeInTheDocument();

  // We can ensure this works with isPending from useTransition in the process
  expect(todos).toHaveAttribute("aria-busy", "true");

  // Ensure we are showing the stale UI until the new todo has loaded
  expect(todo1).toHaveTextContent("Clean room");

  // Eventually we should see the updated todos content once its done
  // suspending.
  await waitFor(() => {
    expect(screen.getByTestId("todo:2")).toHaveTextContent(
      "Take out trash (completed)"
    );
    expect(todo1).toHaveTextContent("Clean room");
  });
});

it('honors refetchWritePolicy set to "merge"', async () => {
  const query: TypedDocumentNode<
    { primes: number[] },
    { min: number; max: number }
  > = gql`
    query GetPrimes($min: number, $max: number) {
      primes(min: $min, max: $max)
    }
  `;

  interface QueryData {
    primes: number[];
  }

  const mocks = [
    {
      request: { query, variables: { min: 0, max: 12 } },
      result: { data: { primes: [2, 3, 5, 7, 11] } },
      delay: 10,
    },
    {
      request: { query, variables: { min: 12, max: 30 } },
      result: { data: { primes: [13, 17, 19, 23, 29] } },
      delay: 10,
    },
  ];

  const mergeParams: [number[] | undefined, number[]][] = [];
  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          primes: {
            keyArgs: false,
            merge(existing: number[] | undefined, incoming: number[]) {
              mergeParams.push([existing, incoming]);
              return existing ? existing.concat(incoming) : incoming;
            },
          },
        },
      },
    },
  });

  const renderStream = createDefaultProfiler<QueryData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache,
  });

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef, { refetch }] = useLoadableQuery(query, {
      refetchWritePolicy: "merge",
    });

    return (
      <>
        <button onClick={() => loadQuery({ min: 0, max: 12 })}>
          Load query
        </button>
        <button onClick={() => refetch({ min: 12, max: 30 })}>Refetch</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { primes: [2, 3, 5, 7, 11] },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
    expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);
  }

  await act(() => user.click(screen.getByText("Refetch")));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { primes: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29] },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
    expect(mergeParams).toEqual([
      [undefined, [2, 3, 5, 7, 11]],
      [
        [2, 3, 5, 7, 11],
        [13, 17, 19, 23, 29],
      ],
    ]);
  }

  await expect(renderStream).not.toRerender();
});

it('defaults refetchWritePolicy to "overwrite"', async () => {
  const query: TypedDocumentNode<
    { primes: number[] },
    { min: number; max: number }
  > = gql`
    query GetPrimes($min: number, $max: number) {
      primes(min: $min, max: $max)
    }
  `;

  interface QueryData {
    primes: number[];
  }

  const mocks = [
    {
      request: { query, variables: { min: 0, max: 12 } },
      result: { data: { primes: [2, 3, 5, 7, 11] } },
      delay: 10,
    },
    {
      request: { query, variables: { min: 12, max: 30 } },
      result: { data: { primes: [13, 17, 19, 23, 29] } },
      delay: 10,
    },
  ];

  const mergeParams: [number[] | undefined, number[]][] = [];
  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          primes: {
            keyArgs: false,
            merge(existing: number[] | undefined, incoming: number[]) {
              mergeParams.push([existing, incoming]);
              return existing ? existing.concat(incoming) : incoming;
            },
          },
        },
      },
    },
  });

  const renderStream = createDefaultProfiler<QueryData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache,
  });

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef, { refetch }] = useLoadableQuery(query);

    return (
      <>
        <button onClick={() => loadQuery({ min: 0, max: 12 })}>
          Load query
        </button>
        <button onClick={() => refetch({ min: 12, max: 30 })}>Refetch</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial load
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { primes: [2, 3, 5, 7, 11] },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
    expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);
  }

  await act(() => user.click(screen.getByText("Refetch")));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { primes: [13, 17, 19, 23, 29] },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
    expect(mergeParams).toEqual([
      [undefined, [2, 3, 5, 7, 11]],
      [undefined, [13, 17, 19, 23, 29]],
    ]);
  }
});

it('does not suspend when partial data is in the cache and using a "cache-first" fetch policy with returnPartialData', async () => {
  interface Data {
    character: {
      id: string;
      name: string;
    };
  }

  const fullQuery: TypedDocumentNode<Data> = gql`
    query {
      character {
        id
        name
      }
    }
  `;

  const partialQuery = gql`
    query {
      character {
        id
      }
    }
  `;
  const mocks = [
    {
      request: { query: fullQuery },
      result: { data: { character: { id: "1", name: "Doctor Strange" } } },
      delay: 20,
    },
  ];

  const renderStream = createDefaultProfiler<DeepPartial<Data>>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  const cache = new InMemoryCache();

  cache.writeQuery({
    query: partialQuery,
    data: { character: { id: "1" } },
  });

  const client = new ApolloClient({ link: new MockLink(mocks), cache });

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef] = useLoadableQuery(fullQuery, {
      fetchPolicy: "cache-first",
      returnPartialData: true,
    });

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial load
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { character: { id: "1" } },
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: "Doctor Strange" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
  }

  await expect(renderStream).not.toRerender();
});

it('suspends and does not use partial data from other variables in the cache when changing variables and using a "cache-first" fetch policy with returnPartialData: true', async () => {
  const { query, mocks } = useVariablesQueryCase();

  const partialQuery = gql`
    query ($id: ID!) {
      character(id: $id) {
        id
      }
    }
  `;

  const cache = new InMemoryCache();

  cache.writeQuery({
    query: partialQuery,
    data: { character: { id: "1" } },
    variables: { id: "1" },
  });

  const renderStream = createDefaultProfiler<DeepPartial<VariablesCaseData>>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef] = useLoadableQuery(query, {
      fetchPolicy: "cache-first",
      returnPartialData: true,
    });

    return (
      <>
        <button onClick={() => loadQuery({ id: "1" })}>Load query</button>
        <button onClick={() => loadQuery({ id: "2" })}>Change variables</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithMocks(
    <App />,
    {
      mocks,
      cache,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { character: { id: "1" } },
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: "Spider-Man" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
  }

  await act(() => user.click(screen.getByText("Change variables")));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { character: { id: "2", name: "Black Widow" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
  }

  await expect(renderStream).not.toRerender();
});

it('suspends when partial data is in the cache and using a "network-only" fetch policy with returnPartialData', async () => {
  interface Data {
    character: {
      id: string;
      name: string;
    };
  }

  const fullQuery: TypedDocumentNode<Data> = gql`
    query {
      character {
        id
        name
      }
    }
  `;

  const partialQuery = gql`
    query {
      character {
        id
      }
    }
  `;
  const mocks = [
    {
      request: { query: fullQuery },
      result: { data: { character: { id: "1", name: "Doctor Strange" } } },
      delay: 10,
    },
  ];

  const renderStream = createDefaultProfiler<DeepPartial<Data>>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  const cache = new InMemoryCache();

  cache.writeQuery({
    query: partialQuery,
    data: { character: { id: "1" } },
  });

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef] = useLoadableQuery(fullQuery, {
      fetchPolicy: "network-only",
      returnPartialData: true,
    });

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithMocks(
    <App />,
    {
      mocks,
      cache,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: "Doctor Strange" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender();
});

it('suspends when partial data is in the cache and using a "no-cache" fetch policy with returnPartialData', async () => {
  using _consoleSpy = spyOnConsole("warn");

  interface Data {
    character: {
      id: string;
      name: string;
    };
  }

  const fullQuery: TypedDocumentNode<Data> = gql`
    query {
      character {
        id
        name
      }
    }
  `;

  const partialQuery = gql`
    query {
      character {
        id
      }
    }
  `;
  const mocks = [
    {
      request: { query: fullQuery },
      result: { data: { character: { id: "1", name: "Doctor Strange" } } },
      delay: 10,
    },
  ];

  const cache = new InMemoryCache();

  cache.writeQuery({
    query: partialQuery,
    data: { character: { id: "1" } },
  });

  const renderStream = createDefaultProfiler<DeepPartial<Data>>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef] = useLoadableQuery(fullQuery, {
      fetchPolicy: "no-cache",
      returnPartialData: true,
    });

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithMocks(
    <App />,
    {
      mocks,
      cache,
    },
    renderStream
  );

  // initial load
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: "Doctor Strange" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it('warns when using returnPartialData with a "no-cache" fetch policy', async () => {
  using _consoleSpy = spyOnConsole("warn");

  const query: TypedDocumentNode<SimpleQueryData> = gql`
    query UserQuery {
      greeting
    }
  `;

  renderHook(
    () =>
      useLoadableQuery(query, {
        fetchPolicy: "no-cache",
        returnPartialData: true,
      }),
    {
      wrapper: ({ children }) => (
        <MockedProvider mocks={[]}>{children}</MockedProvider>
      ),
    }
  );

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    "Using `returnPartialData` with a `no-cache` fetch policy has no effect. To read partial data from the cache, consider using an alternate fetch policy."
  );
});

it('does not suspend when partial data is in the cache and using a "cache-and-network" fetch policy with returnPartialData', async () => {
  interface Data {
    character: {
      id: string;
      name: string;
    };
  }

  const fullQuery: TypedDocumentNode<Data> = gql`
    query {
      character {
        id
        name
      }
    }
  `;

  const partialQuery = gql`
    query {
      character {
        id
      }
    }
  `;
  const mocks = [
    {
      request: { query: fullQuery },
      result: { data: { character: { id: "1", name: "Doctor Strange" } } },
      delay: 20,
    },
  ];

  const cache = new InMemoryCache();

  cache.writeQuery({
    query: partialQuery,
    data: { character: { id: "1" } },
  });

  const renderStream = createDefaultProfiler<DeepPartial<Data>>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef] = useLoadableQuery(fullQuery, {
      fetchPolicy: "cache-and-network",
      returnPartialData: true,
    });

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithMocks(
    <App />,
    {
      mocks,
      cache,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { character: { id: "1" } },
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: "Doctor Strange" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it('suspends and does not use partial data when changing variables and using a "cache-and-network" fetch policy with returnPartialData', async () => {
  const { query, mocks } = useVariablesQueryCase();

  const partialQuery = gql`
    query ($id: ID!) {
      character(id: $id) {
        id
      }
    }
  `;

  const cache = new InMemoryCache();

  cache.writeQuery({
    query: partialQuery,
    data: { character: { id: "1" } },
    variables: { id: "1" },
  });

  const renderStream = createDefaultProfiler<DeepPartial<VariablesCaseData>>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef] = useLoadableQuery(query, {
      fetchPolicy: "cache-and-network",
      returnPartialData: true,
    });

    return (
      <>
        <button onClick={() => loadQuery({ id: "1" })}>Load query</button>
        <button onClick={() => loadQuery({ id: "2" })}>Change variables</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithMocks(
    <App />,
    {
      mocks,
      cache,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { character: { id: "1" } },
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: "Spider-Man" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Change variables")));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { character: { id: "2", name: "Black Widow" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it('does not suspend deferred queries with partial data in the cache and using a "cache-first" fetch policy with `returnPartialData`', async () => {
  interface QueryData {
    greeting: {
      __typename: string;
      message?: string;
      recipient?: {
        __typename: string;
        name: string;
      };
    };
  }

  const query: TypedDocumentNode<QueryData, never> = gql`
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
  const cache = new InMemoryCache();

  {
    // We are intentionally writing partial data to the cache. Supress console
    // warnings to avoid unnecessary noise in the test.
    using _consoleSpy = spyOnConsole("error");

    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
      },
    });
  }

  const client = new ApolloClient({ link, cache });

  const renderStream = createDefaultProfiler<DeepPartial<QueryData>>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadTodo, queryRef] = useLoadableQuery(query, {
      fetchPolicy: "cache-first",
      returnPartialData: true,
    });

    return (
      <div>
        <button onClick={() => loadTodo()}>Load todo</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </div>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );

  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load todo")));

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: {
        greeting: {
          __typename: "Greeting",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
      },
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  link.simulateResult({
    result: {
      data: {
        greeting: { message: "Hello world", __typename: "Greeting" },
      },
      hasNext: true,
    },
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
      },
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
              __typename: "Greeting",
              recipient: { name: "Alice", __typename: "Person" },
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
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
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

  await expect(renderStream).not.toRerender();
});

it("throws when calling loadQuery on first render", async () => {
  // We don't provide this functionality with React 19 anymore since it requires internals access
  if (IS_REACT_19) return;
  using _consoleSpy = spyOnConsole("error");
  const { query, mocks } = useSimpleQueryCase();

  function App() {
    const [loadQuery] = useLoadableQuery(query);

    loadQuery();

    return null;
  }

  expect(() => renderWithMocks(<App />, { mocks })).toThrow(
    new InvariantError(
      "useLoadableQuery: 'loadQuery' should not be called during render. To start a query during render, use the 'useBackgroundQuery' hook."
    )
  );
});

it("throws when calling loadQuery on subsequent render", async () => {
  // We don't provide this functionality with React 19 anymore since it requires internals access
  if (React.version.startsWith("19")) return;
  using _consoleSpy = spyOnConsole("error");
  const { query, mocks } = useSimpleQueryCase();

  let error!: Error;

  function App() {
    const [count, setCount] = useState(0);
    const [loadQuery] = useLoadableQuery(query);

    if (count === 1) {
      loadQuery();
    }

    return <button onClick={() => setCount(1)}>Load query in render</button>;
  }

  const { user } = renderWithMocks(
    <ReactErrorBoundary onError={(e) => (error = e)} fallback={<div>Oops</div>}>
      <App />
    </ReactErrorBoundary>,
    { mocks }
  );

  await act(() => user.click(screen.getByText("Load query in render")));

  expect(error).toEqual(
    new InvariantError(
      "useLoadableQuery: 'loadQuery' should not be called during render. To start a query during render, use the 'useBackgroundQuery' hook."
    )
  );
});

it("allows loadQuery to be called in useEffect on first render", async () => {
  const { query, mocks } = useSimpleQueryCase();

  function App() {
    const [loadQuery] = useLoadableQuery(query);

    React.useEffect(() => {
      loadQuery();
    }, []);

    return null;
  }

  expect(() => renderWithMocks(<App />, { mocks })).not.toThrow();
});

it("can subscribe to subscriptions and react to cache updates via `subscribeToMore`", async () => {
  interface SubscriptionData {
    greetingUpdated: string;
  }

  type UpdateQueryFn = NonNullable<
    SubscribeToMoreOptions<
      SimpleCaseData,
      Record<string, never>,
      SubscriptionData
    >["updateQuery"]
  >;

  const subscription: TypedDocumentNode<
    SubscriptionData,
    Record<string, never>
  > = gql`
    subscription {
      greetingUpdated
    }
  `;

  const { mocks, query } = setupSimpleCase();

  const wsLink = new MockSubscriptionLink();
  const mockLink = new MockLink(mocks);

  const link = split(
    ({ query }) => {
      const definition = getMainDefinition(query);

      return (
        definition.kind === "OperationDefinition" &&
        definition.operation === "subscription"
      );
    },
    wsLink,
    mockLink
  );

  const client = new ApolloClient({ link, cache: new InMemoryCache() });

  const renderStream = createRenderStream({
    initialSnapshot: {
      subscribeToMore: null as SubscribeToMoreFunction<
        SimpleCaseData,
        Record<string, never>
      > | null,
      result: null as UseReadQueryResult<SimpleCaseData> | null,
    },
  });

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef, { subscribeToMore }] = useLoadableQuery(query);

    renderStream.mergeSnapshot({ subscribeToMore });

    return (
      <div>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </div>
    );
  }

  const { user } = renderWithClient(
    <App />,
    {
      client,
    },
    renderStream
  );
  // initial render
  await renderStream.takeRender();

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { renderedComponents, snapshot } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  const updateQuery = jest.fn<
    ReturnType<UpdateQueryFn>,
    Parameters<UpdateQueryFn>
  >((_, { subscriptionData: { data } }) => {
    return { greeting: data.greetingUpdated };
  });

  const { snapshot } = renderStream.getCurrentRender();

  snapshot.subscribeToMore!({ document: subscription, updateQuery });

  wsLink.simulateResult({
    result: {
      data: {
        greetingUpdated: "Subscription hello",
      },
    },
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Subscription hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(updateQuery).toHaveBeenCalledTimes(1);
  expect(updateQuery).toHaveBeenCalledWith(
    { greeting: "Hello" },
    {
      subscriptionData: {
        data: { greetingUpdated: "Subscription hello" },
      },
      variables: {},
    }
  );
});

it("throws when calling `subscribeToMore` before loading the query", async () => {
  interface SubscriptionData {
    greetingUpdated: string;
  }

  const subscription: TypedDocumentNode<
    SubscriptionData,
    Record<string, never>
  > = gql`
    subscription {
      greetingUpdated
    }
  `;

  const { mocks, query } = setupSimpleCase();

  const wsLink = new MockSubscriptionLink();
  const mockLink = new MockLink(mocks);

  const link = split(
    ({ query }) => {
      const definition = getMainDefinition(query);

      return (
        definition.kind === "OperationDefinition" &&
        definition.operation === "subscription"
      );
    },
    wsLink,
    mockLink
  );

  const client = new ApolloClient({ link, cache: new InMemoryCache() });

  const renderStream = createRenderStream({
    initialSnapshot: {
      subscribeToMore: null as SubscribeToMoreFunction<
        SimpleCaseData,
        Record<string, never>
      > | null,
      result: null as UseReadQueryResult<SimpleCaseData> | null,
    },
  });

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents(renderStream);

  function App() {
    useTrackRenders();
    const [loadQuery, queryRef, { subscribeToMore }] = useLoadableQuery(query);

    renderStream.mergeSnapshot({ subscribeToMore });

    return (
      <div>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </div>
    );
  }

  renderWithClient(<App />, { client }, renderStream);
  // initial render
  await renderStream.takeRender();

  const { snapshot } = renderStream.getCurrentRender();

  expect(() => {
    snapshot.subscribeToMore!({ document: subscription });
  }).toThrow(
    new InvariantError("The query has not been loaded. Please load the query.")
  );
});

describe.skip("type tests", () => {
  it("returns unknown when TData cannot be inferred", () => {
    const query = gql``;

    const [, queryRef] = useLoadableQuery(query);

    invariant(queryRef);

    const { data } = useReadQuery(queryRef);

    expectTypeOf(data).toEqualTypeOf<unknown>();
  });

  it("variables are optional and can be anything with an untyped DocumentNode", () => {
    const query = gql``;

    const [loadQuery] = useLoadableQuery(query);

    loadQuery();
    loadQuery({});
    loadQuery({ foo: "bar" });
    loadQuery({ bar: "baz" });
  });

  it("variables are optional and can be anything with unspecified TVariables on a TypedDocumentNode", () => {
    const query: TypedDocumentNode<{ greeting: string }> = gql``;

    const [loadQuery] = useLoadableQuery(query);

    loadQuery();
    loadQuery({});
    loadQuery({ foo: "bar" });
    loadQuery({ bar: "baz" });
  });

  it("variables are optional when TVariables are empty", () => {
    const query: TypedDocumentNode<
      { greeting: string },
      Record<string, never>
    > = gql``;

    const [loadQuery] = useLoadableQuery(query);

    loadQuery();
    loadQuery({});
    // @ts-expect-error unknown variable
    loadQuery({ foo: "bar" });
  });

  it("does not allow variables when TVariables is `never`", () => {
    const query: TypedDocumentNode<{ greeting: string }, never> = gql``;

    const [loadQuery] = useLoadableQuery(query);

    loadQuery();
    // @ts-expect-error no variables argument allowed
    loadQuery({});
    // @ts-expect-error no variables argument allowed
    loadQuery({ foo: "bar" });
  });

  it("optional variables are optional to loadQuery", () => {
    const query: TypedDocumentNode<{ posts: string[] }, { limit?: number }> =
      gql``;

    const [loadQuery] = useLoadableQuery(query);

    loadQuery();
    loadQuery({});
    loadQuery({ limit: 10 });
    loadQuery({
      // @ts-expect-error unknown variable
      foo: "bar",
    });
    loadQuery({
      limit: 10,
      // @ts-expect-error unknown variable
      foo: "bar",
    });
  });

  it("enforces required variables when TVariables includes required variables", () => {
    const query: TypedDocumentNode<{ character: string }, { id: string }> =
      gql``;

    const [loadQuery] = useLoadableQuery(query);

    // @ts-expect-error missing variables argument
    loadQuery();
    // @ts-expect-error empty variables
    loadQuery({});
    loadQuery({ id: "1" });
    loadQuery({
      // @ts-expect-error unknown variable
      foo: "bar",
    });
    loadQuery({
      id: "1",
      // @ts-expect-error unknown variable
      foo: "bar",
    });
  });

  it("requires variables with mixed TVariables", () => {
    const query: TypedDocumentNode<
      { character: string },
      { id: string; language?: string }
    > = gql``;

    const [loadQuery] = useLoadableQuery(query);

    // @ts-expect-error missing variables argument
    loadQuery();
    // @ts-expect-error empty variables
    loadQuery({});
    loadQuery({ id: "1" });
    // @ts-expect-error missing required variable
    loadQuery({ language: "en" });
    loadQuery({ id: "1", language: "en" });
    loadQuery({
      // @ts-expect-error unknown variable
      foo: "bar",
    });
    loadQuery({
      id: "1",
      // @ts-expect-error unknown variable
      foo: "bar",
    });
    loadQuery({
      id: "1",
      language: "en",
      // @ts-expect-error unknown variable
      foo: "bar",
    });
  });

  it("returns TData in default case", () => {
    const { query } = useVariablesQueryCase();

    {
      const [, queryRef] = useLoadableQuery(query);

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    {
      const [, queryRef] = useLoadableQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query);

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }
  });

  it('returns TData | undefined with errorPolicy: "ignore"', () => {
    const { query } = useVariablesQueryCase();

    {
      const [, queryRef] = useLoadableQuery(query, {
        errorPolicy: "ignore",
      });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<VariablesCaseData | undefined>();
    }

    {
      const [, queryRef] = useLoadableQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, { errorPolicy: "ignore" });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<VariablesCaseData | undefined>();
    }
  });

  it('returns TData | undefined with errorPolicy: "all"', () => {
    const { query } = useVariablesQueryCase();

    {
      const [, queryRef] = useLoadableQuery(query, {
        errorPolicy: "all",
      });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<VariablesCaseData | undefined>();
    }

    {
      const [, queryRef] = useLoadableQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, { errorPolicy: "all" });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<VariablesCaseData | undefined>();
    }
  });

  it('returns TData with errorPolicy: "none"', () => {
    const { query } = useVariablesQueryCase();

    {
      const [, queryRef] = useLoadableQuery(query, {
        errorPolicy: "none",
      });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    {
      const [, queryRef] = useLoadableQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, { errorPolicy: "none" });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }
  });

  it("returns DeepPartial<TData> with returnPartialData: true", () => {
    const { query } = useVariablesQueryCase();

    {
      const [, queryRef] = useLoadableQuery(query, {
        returnPartialData: true,
      });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }

    {
      const [, queryRef] = useLoadableQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, { returnPartialData: true });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }
  });

  it("returns TData with returnPartialData: false", () => {
    const { query } = useVariablesQueryCase();

    {
      const [, queryRef] = useLoadableQuery(query, {
        returnPartialData: false,
      });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    {
      const [, queryRef] = useLoadableQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, { returnPartialData: false });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }
  });

  it("returns TData when passing an option that does not affect TData", () => {
    const { query } = useVariablesQueryCase();

    {
      const [, queryRef] = useLoadableQuery(query, {
        fetchPolicy: "no-cache",
      });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    {
      const [, queryRef] = useLoadableQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, { fetchPolicy: "no-cache" });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }
  });

  it("handles combinations of options", () => {
    const { query } = useVariablesQueryCase();

    {
      const [, queryRef] = useLoadableQuery(query, {
        returnPartialData: true,
        errorPolicy: "ignore",
      });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<
        DeepPartial<VariablesCaseData> | undefined
      >();
    }

    {
      const [, queryRef] = useLoadableQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, { returnPartialData: true, errorPolicy: "ignore" });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<
        DeepPartial<VariablesCaseData> | undefined
      >();
    }

    {
      const [, queryRef] = useLoadableQuery(query, {
        returnPartialData: true,
        errorPolicy: "none",
      });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }

    {
      const [, queryRef] = useLoadableQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, { returnPartialData: true, errorPolicy: "none" });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }
  });

  it("returns correct TData type when combined options that do not affect TData", () => {
    const { query } = useVariablesQueryCase();

    {
      const [, queryRef] = useLoadableQuery(query, {
        fetchPolicy: "no-cache",
        returnPartialData: true,
        errorPolicy: "none",
      });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }

    {
      const [, queryRef] = useLoadableQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, {
        fetchPolicy: "no-cache",
        returnPartialData: true,
        errorPolicy: "none",
      });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }
  });
});
