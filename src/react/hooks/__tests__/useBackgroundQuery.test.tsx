import { act, renderHook, screen } from "@testing-library/react";
import type { RenderStream } from "@testing-library/react-render-stream";
import {
  createRenderStream,
  disableActEnvironment,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import { userEvent } from "@testing-library/user-event";
import equal from "@wry/equality";
import { expectTypeOf } from "expect-type";
import { GraphQLError } from "graphql";
import React, { Suspense } from "react";
import type { FallbackProps } from "react-error-boundary";
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";
import { Observable, of } from "rxjs";

import type {
  DataState,
  DataValue,
  ErrorPolicy,
  ObservableQuery,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client";
import {
  ApolloClient,
  ApolloLink,
  CombinedGraphQLErrors,
  gql,
  NetworkStatus,
} from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { Defer20220824Handler } from "@apollo/client/incremental";
import type { QueryRef } from "@apollo/client/react";
import {
  ApolloProvider,
  skipToken,
  useBackgroundQuery,
  useReadQuery,
} from "@apollo/client/react";
import { MockLink, MockSubscriptionLink } from "@apollo/client/testing";
import type {
  PaginatedCaseData,
  SimpleCaseData,
  VariablesCaseData,
  VariablesCaseVariables,
} from "@apollo/client/testing/internal";
import {
  addDelayToMocks,
  createClientWrapper,
  createMockWrapper,
  setupMaskedVariablesCase,
  setupPaginatedCase,
  setupSimpleCase,
  setupVariablesCase,
  spyOnConsole,
  wait,
} from "@apollo/client/testing/internal";
import { MockedProvider } from "@apollo/client/testing/react";
import type { DeepPartial } from "@apollo/client/utilities";
import {
  concatPagination,
  offsetLimitPagination,
} from "@apollo/client/utilities";
import { getMainDefinition } from "@apollo/client/utilities/internal";

import type {
  RefetchWritePolicy,
  SubscribeToMoreFunction,
} from "../../../core/watchQueryOptions.js";
import type {
  MaskedVariablesCaseData,
  UnmaskedVariablesCaseData,
} from "../../../testing/internal/scenarios/index.js";

afterEach(() => {
  jest.useRealTimers();
});

function createDefaultTrackedComponents<
  Snapshot extends {
    result: useReadQuery.Result<any> | null;
  },
  TData = Snapshot["result"] extends useReadQuery.Result<infer TData> | null ?
    TData
  : unknown,
  TStates extends DataState<TData>["dataState"] = Snapshot["result"] extends (
    useReadQuery.Result<any, infer TStates> | null
  ) ?
    TStates
  : "complete" | "streaming",
>(renderStream: RenderStream<Snapshot>) {
  function SuspenseFallback() {
    useTrackRenders();
    return <div>Loading</div>;
  }

  function ReadQueryHook({
    queryRef,
  }: {
    queryRef: QueryRef<TData, any, TStates>;
  }) {
    useTrackRenders();
    renderStream.mergeSnapshot({
      result: useReadQuery(queryRef),
    } as unknown as Partial<Snapshot>);

    return null;
  }

  return { SuspenseFallback, ReadQueryHook };
}

function createTrackedErrorComponents<Snapshot extends { error: Error | null }>(
  renderStream: RenderStream<Snapshot>
) {
  function ErrorFallback({ error }: FallbackProps) {
    useTrackRenders({ name: "ErrorFallback" });
    renderStream.mergeSnapshot({ error } as Partial<Snapshot>);

    return <div>Error</div>;
  }

  function ErrorBoundary({ children }: { children: React.ReactNode }) {
    return (
      <ReactErrorBoundary FallbackComponent={ErrorFallback}>
        {children}
      </ReactErrorBoundary>
    );
  }

  return { ErrorBoundary };
}

function createErrorProfiler<TData = unknown>() {
  return createRenderStream({
    initialSnapshot: {
      error: null as Error | null,
      result: null as useReadQuery.Result<TData> | null,
    },
  });
}

function createDefaultProfiler<TData = unknown>() {
  return createRenderStream({
    initialSnapshot: {
      result: null as useReadQuery.Result<TData> | null,
    },
  });
}

it("fetches a simple query with minimal config", async () => {
  const { query, mocks } = setupSimpleCase();

  const renderStream = createDefaultProfiler<SimpleCaseData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query);

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createMockWrapper({ mocks }) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { renderedComponents, snapshot } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it("tears down the query on unmount", async () => {
  const { query, mocks } = setupSimpleCase();
  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache: new InMemoryCache(),
  });
  const renderStream = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query);

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  const { unmount } = await renderStream.render(<App />, {
    wrapper: createClientWrapper(client),
  });

  // initial suspended render
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  unmount();

  await wait(0);

  expect(client.getObservableQueries().size).toBe(0);
  expect(client).not.toHaveSuspenseCacheEntryUsing(query);
});

it("auto disposes of the queryRef if not used within timeout", async () => {
  jest.useFakeTimers();
  const { query } = setupSimpleCase();
  const link = new MockSubscriptionLink();
  const client = new ApolloClient({ link, cache: new InMemoryCache() });

  const { result } = renderHook(() => useBackgroundQuery(query, { client }));

  const [queryRef] = result.current;

  expect(queryRef).not.toBeDisposed();
  expect(client.getObservableQueries().size).toBe(1);
  expect(client).toHaveSuspenseCacheEntryUsing(query);

  await act(() => {
    link.simulateResult({ result: { data: { greeting: "Hello" } } }, true);
    // Ensure simulateResult will deliver the result since its wrapped with
    // setTimeout
    jest.advanceTimersByTime(10);
  });

  jest.advanceTimersByTime(30_000);

  expect(queryRef).toBeDisposed();
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

  const { result } = renderHook(() => useBackgroundQuery(query, { client }));

  const [queryRef] = result.current;

  expect(queryRef).not.toBeDisposed();
  expect(client.getObservableQueries().size).toBe(1);
  expect(client).toHaveSuspenseCacheEntryUsing(query);

  await act(() => {
    link.simulateResult({ result: { data: { greeting: "Hello" } } }, true);
    // Ensure simulateResult will deliver the result since its wrapped with
    // setTimeout
    jest.advanceTimersByTime(10);
  });

  jest.advanceTimersByTime(5000);

  expect(queryRef).toBeDisposed();
  expect(client.getObservableQueries().size).toBe(0);
  expect(client).not.toHaveSuspenseCacheEntryUsing(query);
});

it("will resubscribe after disposed when mounting useReadQuery", async () => {
  const { query, mocks } = setupSimpleCase();
  const user = userEvent.setup();
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
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [show, setShow] = React.useState(false);
    const [queryRef] = useBackgroundQuery(query);

    return (
      <>
        <button onClick={() => setShow((show) => !show)}>Toggle</button>
        <Suspense fallback={<SuspenseFallback />}>
          {show && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  expect(client.getObservableQueries().size).toBe(1);
  expect(client).toHaveSuspenseCacheEntryUsing(query);

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App]);
  }

  // Wait long enough for auto dispose to kick in
  await wait(80);

  expect(client.getObservableQueries().size).toBe(0);
  expect(client).not.toHaveSuspenseCacheEntryUsing(query);

  await user.click(screen.getByText("Toggle"));

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
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
    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello again" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it("auto resubscribes when mounting useReadQuery after naturally disposed by useReadQuery", async () => {
  const { query, mocks } = setupSimpleCase();
  const user = userEvent.setup();
  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache: new InMemoryCache(),
  });

  const renderStream = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [show, setShow] = React.useState(true);
    const [queryRef] = useBackgroundQuery(query);

    return (
      <>
        <button onClick={() => setShow((show) => !show)}>Toggle</button>
        <Suspense fallback={<SuspenseFallback />}>
          {show && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  const toggleButton = screen.getByText("Toggle");

  expect(client.getObservableQueries().size).toBe(1);
  expect(client).toHaveSuspenseCacheEntryUsing(query);

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await user.click(toggleButton);
  await renderStream.takeRender();
  await wait(0);

  expect(client.getObservableQueries().size).toBe(0);
  // We retain the cache entry in useBackgroundQuery to avoid recreating the
  // queryRef if useBackgroundQuery rerenders before useReadQuery is mounted
  // again.
  expect(client).toHaveSuspenseCacheEntryUsing(query);

  await user.click(toggleButton);

  expect(client.getObservableQueries().size).toBe(1);
  expect(client).toHaveSuspenseCacheEntryUsing(query);

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
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
    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello again" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it("does not recreate queryRef and execute a network request when rerendering useBackgroundQuery after queryRef is disposed", async () => {
  const { query } = setupSimpleCase();
  const user = userEvent.setup();
  let fetchCount = 0;
  const client = new ApolloClient({
    link: new ApolloLink(() => {
      fetchCount++;

      return new Observable((observer) => {
        setTimeout(() => {
          observer.next({ data: { greeting: "Hello" } });
          observer.complete();
        }, 20);
      });
    }),
    cache: new InMemoryCache(),
  });

  const renderStream = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [show, setShow] = React.useState(true);
    // Use a fetchPolicy of no-cache to ensure we can more easily track if
    // another network request was made
    const [queryRef] = useBackgroundQuery(query, { fetchPolicy: "no-cache" });

    return (
      <>
        <button onClick={() => setShow((show) => !show)}>Toggle</button>
        <Suspense fallback={<SuspenseFallback />}>
          {show && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  const { rerender } = await renderStream.render(<App />, {
    wrapper: createClientWrapper(client),
  });

  const toggleButton = screen.getByText("Toggle");

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await user.click(toggleButton);
  await renderStream.takeRender();
  await wait(0);

  await rerender(<App />);
  await renderStream.takeRender();

  expect(fetchCount).toBe(1);

  await user.click(toggleButton);

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(fetchCount).toBe(1);

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

// https://github.com/apollographql/apollo-client/issues/11815
it("does not recreate queryRef or execute a network request when rerendering useBackgroundQuery in strict mode", async () => {
  const { query } = setupSimpleCase();
  const user = userEvent.setup();
  let fetchCount = 0;
  const client = new ApolloClient({
    link: new ApolloLink(() => {
      fetchCount++;

      return new Observable((observer) => {
        setTimeout(() => {
          observer.next({ data: { greeting: "Hello" } });
          observer.complete();
        }, 20);
      });
    }),
    cache: new InMemoryCache(),
  });

  const renderStream = createRenderStream({
    initialSnapshot: {
      queryRef: null as QueryRef<SimpleCaseData> | null,
      result: null as useReadQuery.Result<SimpleCaseData> | null,
    },
  });
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [, setCount] = React.useState(0);
    // Use a fetchPolicy of no-cache to ensure we can more easily track if
    // another network request was made
    const [queryRef] = useBackgroundQuery(query, { fetchPolicy: "no-cache" });

    renderStream.mergeSnapshot({ queryRef });

    return (
      <>
        <button onClick={() => setCount((count) => count + 1)}>
          Increment
        </button>
        <Suspense fallback={<SuspenseFallback />}>
          <ReadQueryHook queryRef={queryRef} />
        </Suspense>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, {
    wrapper: createClientWrapper(client, React.StrictMode),
  });

  const incrementButton = screen.getByText("Increment");

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  // eslint-disable-next-line testing-library/render-result-naming-convention
  const firstRender = await renderStream.takeRender();
  const initialQueryRef = firstRender.snapshot.queryRef;

  await user.click(incrementButton);

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.queryRef).toBe(initialQueryRef);
    expect(fetchCount).toBe(1);
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it("disposes of the queryRef when unmounting before it is used by useReadQuery", async () => {
  const { query, mocks } = setupSimpleCase();
  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache: new InMemoryCache(),
  });

  const renderStream = createDefaultProfiler<SimpleCaseData>();

  function App() {
    useTrackRenders();
    useBackgroundQuery(query);

    return null;
  }

  using _disabledAct = disableActEnvironment();
  const { unmount } = await renderStream.render(<App />, {
    wrapper: createClientWrapper(client),
  });

  expect(client.getObservableQueries().size).toBe(1);
  expect(client).toHaveSuspenseCacheEntryUsing(query);

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App]);
  }

  unmount();
  await wait(0);

  expect(client.getObservableQueries().size).toBe(0);
  expect(client).not.toHaveSuspenseCacheEntryUsing(query);
});

it("disposes of old queryRefs when changing variables before the queryRef is used by useReadQuery", async () => {
  const { query, mocks } = setupVariablesCase();
  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache: new InMemoryCache(),
  });

  const renderStream = createDefaultProfiler<SimpleCaseData>();

  function App({ id }: { id: string }) {
    useTrackRenders();
    useBackgroundQuery(query, { variables: { id } });

    return null;
  }

  using _disabledAct = disableActEnvironment();
  const { rerender } = await renderStream.render(<App id="1" />, {
    wrapper: createClientWrapper(client),
  });

  expect(client.getObservableQueries().size).toBe(1);
  expect(client).toHaveSuspenseCacheEntryUsing(query, {
    variables: { id: "1" },
  });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App]);
  }

  await rerender(<App id="2" />);

  await wait(10);

  expect(client.getObservableQueries().size).toBe(1);
  expect(client).toHaveSuspenseCacheEntryUsing(query, {
    variables: { id: "2" },
  });
  expect(client).not.toHaveSuspenseCacheEntryUsing(query, {
    variables: { id: "1" },
  });
});

it("does not prematurely dispose of the queryRef when using strict mode", async () => {
  const { query, mocks } = setupSimpleCase();
  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache: new InMemoryCache(),
  });

  const renderStream = createDefaultProfiler<SimpleCaseData>();

  function App() {
    useTrackRenders();
    useBackgroundQuery(query);

    return null;
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, {
    wrapper: createClientWrapper(client, React.StrictMode),
  });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App]);
  }

  await wait(10);

  expect(client.getObservableQueries().size).toBe(1);
  expect(client).toHaveSuspenseCacheEntryUsing(query);
});

it("disposes of the queryRef when unmounting before it is used by useReadQuery even if it has been rerendered", async () => {
  const { query, mocks } = setupSimpleCase();
  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache: new InMemoryCache(),
  });
  const user = userEvent.setup();

  const renderStream = createDefaultProfiler<SimpleCaseData>();

  function App() {
    useTrackRenders();
    useBackgroundQuery(query);

    const [a, setA] = React.useState(0);

    return (
      <>
        <button onClick={() => setA(a + 1)}>Increment</button>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  const { unmount } = await renderStream.render(<App />, {
    wrapper: createClientWrapper(client),
  });
  const button = screen.getByText("Increment");

  await user.click(button);

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App]);
  }

  expect(client.getObservableQueries().size).toBe(1);
  expect(client).toHaveSuspenseCacheEntryUsing(query);

  await wait(0);

  unmount();
  await wait(0);
  expect(client.getObservableQueries().size).toBe(0);
});

it("allows the client to be overridden", async () => {
  const { query } = setupSimpleCase();

  const globalClient = new ApolloClient({
    link: new ApolloLink(() => of({ data: { greeting: "global hello" } })),
    cache: new InMemoryCache(),
  });

  const localClient = new ApolloClient({
    link: new ApolloLink(() => of({ data: { greeting: "local hello" } })),
    cache: new InMemoryCache(),
  });

  const renderStream = createDefaultProfiler<SimpleCaseData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, { client: localClient });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, {
    wrapper: createClientWrapper(globalClient),
  });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "local hello" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it("passes context to the link", async () => {
  const query = gql`
    query ContextQuery {
      context
    }
  `;

  const link = new ApolloLink((operation) => {
    return new Observable((observer) => {
      const { valueA, valueB } = operation.getContext();

      observer.next({ data: { context: { valueA, valueB } } });
      observer.complete();
    });
  });

  const renderStream = createDefaultProfiler();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, {
      context: { valueA: "A", valueB: "B" },
    });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createMockWrapper({ link }) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { context: { valueA: "A", valueB: "B" } },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it("returns initial cache data followed by network data when the fetch policy is `cache-and-network`", async () => {
  const { query } = setupSimpleCase();
  const cache = new InMemoryCache();
  const link = new MockLink([
    {
      request: { query },
      result: { data: { greeting: "from link" } },
      delay: 20,
    },
  ]);

  const client = new ApolloClient({ link, cache });

  cache.writeQuery({ query, data: { greeting: "from cache" } });

  const renderStream = createDefaultProfiler<SimpleCaseData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, {
      fetchPolicy: "cache-and-network",
    });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "from cache" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "from link" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it("all data is present in the cache, no network request is made", async () => {
  const { query } = setupSimpleCase();
  const cache = new InMemoryCache();

  let fetchCount = 0;
  const link = new ApolloLink((operation) => {
    fetchCount++;
    return new Observable((observer) => {
      setTimeout(() => {
        observer.next({ data: { greeting: "from link" } });
        observer.complete();
      }, 20);
    });
  });

  const client = new ApolloClient({ link, cache });

  cache.writeQuery({ query, data: { greeting: "from cache" } });

  const renderStream = createDefaultProfiler<SimpleCaseData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, {
      fetchPolicy: "cache-first",
    });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  const { snapshot, renderedComponents } = await renderStream.takeRender();

  expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
  expect(snapshot.result).toStrictEqualTyped({
    data: { greeting: "from cache" },
    dataState: "complete",
    error: undefined,
    networkStatus: NetworkStatus.ready,
  });

  expect(fetchCount).toBe(0);

  await expect(renderStream).not.toRerender({ timeout: 50 });
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

  const client = new ApolloClient({ link, cache });

  {
    // we expect a "Missing field 'foo' while writing result..." error
    // when writing hello to the cache, so we'll silence the console.error
    using _consoleSpy = spyOnConsole("error");
    cache.writeQuery({ query, data: { hello: "from cache" } });
  }

  const renderStream = createDefaultProfiler();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, {
      fetchPolicy: "cache-first",
    });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { foo: "bar", hello: "from link" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it("existing data in the cache is ignored when fetchPolicy is 'network-only'", async () => {
  const { query } = setupSimpleCase();
  const cache = new InMemoryCache();
  const link = new MockLink([
    {
      request: { query },
      result: { data: { greeting: "from link" } },
      delay: 20,
    },
  ]);

  const client = new ApolloClient({ link, cache });

  cache.writeQuery({ query, data: { greeting: "from cache" } });

  const renderStream = createDefaultProfiler<SimpleCaseData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, {
      fetchPolicy: "network-only",
    });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "from link" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(client.cache.extract()).toEqual({
    ROOT_QUERY: { __typename: "Query", greeting: "from link" },
  });

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it("fetches data from the network but does not update the cache when fetchPolicy is 'no-cache'", async () => {
  const { query } = setupSimpleCase();
  const cache = new InMemoryCache();
  const link = new MockLink([
    {
      request: { query },
      result: { data: { greeting: "from link" } },
      delay: 20,
    },
  ]);

  const client = new ApolloClient({ link, cache });

  cache.writeQuery({ query, data: { greeting: "from cache" } });

  const renderStream = createDefaultProfiler<SimpleCaseData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, { fetchPolicy: "no-cache" });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "from link" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(client.cache.extract()).toEqual({
    ROOT_QUERY: { __typename: "Query", greeting: "from cache" },
  });

  await expect(renderStream).not.toRerender({ timeout: 50 });
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

  const user = userEvent.setup();

  const query: TypedDocumentNode<Data, Variables> = gql`
    query TodoItemQuery($id: ID!) {
      todo(id: $id) {
        id
        name
        completed
      }
    }
  `;

  const mocks: MockLink.MockedResponse<Data, Variables>[] = [
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

  const renderStream = createRenderStream({
    initialSnapshot: {
      isPending: false,
      result: null as useReadQuery.Result<Data> | null,
    },
  });

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [id, setId] = React.useState("1");
    const [isPending, startTransition] = React.useTransition();
    const [queryRef] = useBackgroundQuery(query, {
      variables: { id },
    });

    renderStream.mergeSnapshot({ isPending });

    return (
      <>
        <button
          onClick={() => {
            startTransition(() => {
              setId("2");
            });
          }}
        >
          Change todo
        </button>
        <ApolloProvider client={client}>
          <Suspense fallback={<SuspenseFallback />}>
            <ReadQueryHook queryRef={queryRef} />
          </Suspense>
        </ApolloProvider>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot).toStrictEqualTyped({
      isPending: false,
      result: {
        data: { todo: { id: "1", name: "Clean room", completed: false } },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  await user.click(screen.getByText("Change todo"));

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    // startTransition will avoid rendering the suspense fallback for already
    // revealed content if the state update inside the transition causes the
    // component to suspend.
    //
    // Here we should not see the suspense fallback while the component suspends
    // until the todo is finished loading. Seeing the suspense fallback is an
    // indication that we are suspending the component too late in the process.

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot).toStrictEqualTyped({
      isPending: true,
      result: {
        data: { todo: { id: "1", name: "Clean room", completed: false } },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    // Eventually we should see the updated todo content once its done
    // suspending.
    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot).toStrictEqualTyped({
      isPending: false,
      result: {
        data: { todo: { id: "2", name: "Take out trash", completed: true } },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }
});

it('does not suspend deferred queries with data in the cache and using a "cache-and-network" fetch policy', async () => {
  interface Data {
    greeting: {
      __typename: string;
      message: string;
      recipient: { name: string; __typename: string };
    };
  }

  const query: TypedDocumentNode<Data> = gql`
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
  const client = new ApolloClient({
    cache,
    link,
    incrementalHandler: new Defer20220824Handler(),
  });

  const renderStream = createDefaultProfiler<Data>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, {
      fetchPolicy: "cache-and-network",
    });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello cached",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
      },
      dataState: "complete",
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
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
      },
      dataState: "streaming",
      error: undefined,
      networkStatus: NetworkStatus.streaming,
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
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "Person", name: "Alice" },
        },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it("reacts to cache updates", async () => {
  const { query, mocks } = setupSimpleCase();

  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache: new InMemoryCache(),
  });

  const renderStream = createDefaultProfiler<SimpleCaseData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query);

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
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
    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello again" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.writeQuery({
    query,
    data: { greeting: "You again?" },
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "You again?" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it("reacts to variables updates", async () => {
  const { query, mocks } = setupVariablesCase();

  const renderStream = createDefaultProfiler<VariablesCaseData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App({ id }: { id: string }) {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, { variables: { id } });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  const { rerender } = await renderStream.render(<App id="1" />, {
    wrapper: createMockWrapper({
      mocks: addDelayToMocks(mocks, 150, true),
    }),
  });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await rerender(<App id="2" />);

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: {
        character: { __typename: "Character", id: "2", name: "Black Widow" },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it("does not suspend when `skip` is true", async () => {
  const { query, mocks } = setupSimpleCase();

  const renderStream = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, { skip: true });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        {queryRef && <ReadQueryHook queryRef={queryRef} />}
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createMockWrapper({ mocks }) });

  const { renderedComponents } = await renderStream.takeRender();

  expect(renderedComponents).toStrictEqual([App]);

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it("does not suspend when using `skipToken` in options", async () => {
  const { query, mocks } = setupSimpleCase();

  const renderStream = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, skipToken);

    return (
      <Suspense fallback={<SuspenseFallback />}>
        {queryRef && <ReadQueryHook queryRef={queryRef} />}
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createMockWrapper({ mocks }) });

  const { renderedComponents } = await renderStream.takeRender();

  expect(renderedComponents).toStrictEqual([App]);

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it("suspends when `skip` becomes `false` after it was `true`", async () => {
  const { query, mocks } = setupSimpleCase();
  const user = userEvent.setup();

  const renderStream = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [skip, setSkip] = React.useState(true);
    const [queryRef] = useBackgroundQuery(query, { skip });

    return (
      <>
        <button onClick={() => setSkip(false)}>Run query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createMockWrapper({ mocks }) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App]);
  }

  await user.click(screen.getByText("Run query"));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it("suspends when switching away from `skipToken` in options", async () => {
  const { query, mocks } = setupSimpleCase();

  const user = userEvent.setup();
  const renderStream = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [skip, setSkip] = React.useState(true);
    const [queryRef] = useBackgroundQuery(query, skip ? skipToken : undefined);

    return (
      <>
        <button onClick={() => setSkip(false)}>Run query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createMockWrapper({ mocks }) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App]);
  }

  await user.click(screen.getByText("Run query"));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it("renders skip result, does not suspend, and maintains `data` when `skip` becomes `true` after it was `false`", async () => {
  const { query, mocks } = setupSimpleCase();

  const user = userEvent.setup();
  const renderStream = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [skip, setSkip] = React.useState(false);
    const [queryRef] = useBackgroundQuery(query, { skip });

    return (
      <>
        <button onClick={() => setSkip((skip) => !skip)}>Toggle skip</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createMockWrapper({ mocks }) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await user.click(screen.getByText("Toggle skip"));

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it("renders skip result, does not suspend, and maintains `data` when switching back to `skipToken`", async () => {
  const { query, mocks } = setupSimpleCase();
  const user = userEvent.setup();
  const renderStream = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [skip, setSkip] = React.useState(false);
    const [queryRef] = useBackgroundQuery(query, skip ? skipToken : undefined);

    return (
      <>
        <button onClick={() => setSkip((skip) => !skip)}>Toggle skip</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createMockWrapper({ mocks }) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await user.click(screen.getByText("Toggle skip"));

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it("does not make network requests when `skip` is `true`", async () => {
  const { query, mocks } = setupSimpleCase();
  const user = userEvent.setup();

  let fetchCount = 0;

  const link = new ApolloLink((operation) => {
    return new Observable((observer) => {
      fetchCount++;

      const mock = mocks.find(({ request }) =>
        equal(request.query, operation.query)
      );

      if (!mock) {
        throw new Error("Could not find mock for operation");
      }

      observer.next((mock as any).result);
      observer.complete();
    });
  });

  const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
  });

  const renderStream = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [skip, setSkip] = React.useState(true);
    const [queryRef] = useBackgroundQuery(query, { skip });

    return (
      <>
        <button onClick={() => setSkip((skip) => !skip)}>Toggle skip</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  // initial skipped result
  await renderStream.takeRender();
  expect(fetchCount).toBe(0);

  // Toggle skip to `false`
  await user.click(screen.getByText("Toggle skip"));

  expect(fetchCount).toBe(1);
  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  // Toggle skip to `true`
  await user.click(screen.getByText("Toggle skip"));

  expect(fetchCount).toBe(1);
  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it("does not make network requests when `skipToken` is used", async () => {
  const { query, mocks } = setupSimpleCase();
  const renderStream = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);
  const user = userEvent.setup();

  let fetchCount = 0;

  const link = new ApolloLink((operation) => {
    return new Observable((observer) => {
      fetchCount++;

      const mock = mocks.find(({ request }) =>
        equal(request.query, operation.query)
      );

      if (!mock) {
        throw new Error("Could not find mock for operation");
      }

      observer.next((mock as any).result);
      observer.complete();
    });
  });

  const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
  });

  function App() {
    useTrackRenders();
    const [skip, setSkip] = React.useState(true);
    const [queryRef] = useBackgroundQuery(query, skip ? skipToken : undefined);

    return (
      <>
        <button onClick={() => setSkip((skip) => !skip)}>Toggle skip</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  // initial skipped result
  await renderStream.takeRender();
  expect(fetchCount).toBe(0);

  // Toggle skip to `false`
  await user.click(screen.getByText("Toggle skip"));

  expect(fetchCount).toBe(1);
  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  // Toggle skip to `true`
  await user.click(screen.getByText("Toggle skip"));

  expect(fetchCount).toBe(1);
  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it("does not make network requests when `skipToken` is used in strict mode", async () => {
  const { query, mocks } = setupSimpleCase();
  const renderStream = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);
  const user = userEvent.setup();

  let fetchCount = 0;

  const link = new ApolloLink((operation) => {
    return new Observable((observer) => {
      fetchCount++;

      const mock = mocks.find(({ request }) =>
        equal(request.query, operation.query)
      );

      if (!mock) {
        throw new Error("Could not find mock for operation");
      }

      observer.next((mock as any).result);
      observer.complete();
    });
  });

  const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
  });

  function App() {
    useTrackRenders();
    const [skip, setSkip] = React.useState(true);
    const [queryRef] = useBackgroundQuery(query, skip ? skipToken : undefined);

    return (
      <>
        <button onClick={() => setSkip((skip) => !skip)}>Toggle skip</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, {
    wrapper: createClientWrapper(client, React.StrictMode),
  });

  // initial skipped result
  await renderStream.takeRender();
  expect(fetchCount).toBe(0);

  // Toggle skip to `false`
  await user.click(screen.getByText("Toggle skip"));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(fetchCount).toBe(1);

  // Toggle skip to `true`
  await user.click(screen.getByText("Toggle skip"));

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(fetchCount).toBe(1);

  await expect(renderStream).not.toRerender();
});

it("does not make network requests when using `skip` option in strict mode", async () => {
  const { query, mocks } = setupSimpleCase();
  const renderStream = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);
  const user = userEvent.setup();

  let fetchCount = 0;

  const link = new ApolloLink((operation) => {
    return new Observable((observer) => {
      fetchCount++;

      const mock = mocks.find(({ request }) =>
        equal(request.query, operation.query)
      );

      if (!mock) {
        throw new Error("Could not find mock for operation");
      }

      observer.next((mock as any).result);
      observer.complete();
    });
  });

  const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
  });

  function App() {
    useTrackRenders();
    const [skip, setSkip] = React.useState(true);
    const [queryRef] = useBackgroundQuery(query, { skip });

    return (
      <>
        <button onClick={() => setSkip((skip) => !skip)}>Toggle skip</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, {
    wrapper: createClientWrapper(client, React.StrictMode),
  });

  // initial skipped result
  await renderStream.takeRender();
  expect(fetchCount).toBe(0);

  // Toggle skip to `false`
  await user.click(screen.getByText("Toggle skip"));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(fetchCount).toBe(1);

  // Toggle skip to `true`
  await user.click(screen.getByText("Toggle skip"));

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(fetchCount).toBe(1);

  await expect(renderStream).not.toRerender();
});

it("result is referentially stable", async () => {
  const { query, mocks } = setupSimpleCase();

  let result: useReadQuery.Result<SimpleCaseData> | null = null;

  const renderStream = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query);

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  const { rerender } = await renderStream.render(<App />, {
    wrapper: createMockWrapper({ mocks }),
  });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });

    result = snapshot.result;
  }

  await rerender(<App />);

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toBe(result);
  }
});

it("`skip` option works with `startTransition`", async () => {
  const { query, mocks } = setupSimpleCase();

  const user = userEvent.setup();
  const renderStream = createRenderStream({
    initialSnapshot: {
      isPending: false,
      result: null as useReadQuery.Result<SimpleCaseData> | null,
    },
  });
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [skip, setSkip] = React.useState(true);
    const [isPending, startTransition] = React.useTransition();
    const [queryRef] = useBackgroundQuery(query, { skip });

    renderStream.mergeSnapshot({ isPending });

    return (
      <>
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(() => {
              setSkip((skip) => !skip);
            })
          }
        >
          Toggle skip
        </button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createMockWrapper({ mocks }) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App]);
  }

  // Toggle skip to `false`
  await user.click(screen.getByText("Toggle skip"));

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App]);
    expect(snapshot).toStrictEqualTyped({
      isPending: true,
      result: null,
    });
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot).toStrictEqualTyped({
      isPending: false,
      result: {
        data: { greeting: "Hello" },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  await expect(renderStream).not.toRerender();
});

it("`skipToken` works with `startTransition`", async () => {
  const { query, mocks } = setupSimpleCase();
  const user = userEvent.setup();

  const renderStream = createRenderStream({
    initialSnapshot: {
      isPending: false,
      result: null as useReadQuery.Result<SimpleCaseData> | null,
    },
  });

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [skip, setSkip] = React.useState(true);
    const [isPending, startTransition] = React.useTransition();
    const [queryRef] = useBackgroundQuery(query, skip ? skipToken : undefined);

    renderStream.mergeSnapshot({ isPending });

    return (
      <>
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(() => {
              setSkip((skip) => !skip);
            })
          }
        >
          Toggle skip
        </button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createMockWrapper({ mocks }) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App]);
  }

  // Toggle skip to `false`
  await user.click(screen.getByText("Toggle skip"));

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App]);
    expect(snapshot).toStrictEqualTyped({
      isPending: true,
      result: null,
    });
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot).toStrictEqualTyped({
      isPending: false,
      result: {
        data: { greeting: "Hello" },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it("applies `errorPolicy` on next fetch when it changes between renders", async () => {
  const { query } = setupSimpleCase();
  const user = userEvent.setup();

  const mocks = [
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

  const renderStream = createErrorProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);
  const { ErrorBoundary } = createTrackedErrorComponents(renderStream);

  function App() {
    useTrackRenders();
    const [errorPolicy, setErrorPolicy] = React.useState<ErrorPolicy>("none");
    const [queryRef, { refetch }] = useBackgroundQuery(query, {
      errorPolicy,
    });

    return (
      <>
        <button onClick={() => setErrorPolicy("all")}>
          Change error policy
        </button>
        <button onClick={() => refetch()}>Refetch greeting</button>
        <Suspense fallback={<SuspenseFallback />}>
          <ErrorBoundary>
            <ReadQueryHook queryRef={queryRef} />
          </ErrorBoundary>
        </Suspense>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createMockWrapper({ mocks }) });

  // initial render
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { greeting: "Hello" },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await user.click(screen.getByText("Change error policy"));
  await renderStream.takeRender();

  await user.click(screen.getByText("Refetch greeting"));
  await renderStream.takeRender();

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot).toStrictEqualTyped({
      error: null,
      result: {
        data: { greeting: "Hello" },
        dataState: "complete",
        error: new CombinedGraphQLErrors({ errors: [{ message: "oops" }] }),
        networkStatus: NetworkStatus.error,
      },
    });
  }
});

it("applies `context` on next fetch when it changes between renders", async () => {
  interface Data {
    context: Record<string, any>;
  }

  const user = userEvent.setup();

  const query: TypedDocumentNode<Data> = gql`
    query {
      context
    }
  `;

  const link = new ApolloLink((operation) => {
    return new Observable((observer) => {
      setTimeout(() => {
        const { phase } = operation.getContext();
        observer.next({ data: { context: { phase } } });
        observer.complete();
      }, 10);
    });
  });

  const client = new ApolloClient({ link, cache: new InMemoryCache() });

  const renderStream = createDefaultProfiler<Data>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [phase, setPhase] = React.useState("initial");
    const [queryRef, { refetch }] = useBackgroundQuery(query, {
      context: { phase },
    });

    return (
      <>
        <button onClick={() => setPhase("rerender")}>Update context</button>
        <button onClick={() => refetch()}>Refetch</button>
        <Suspense fallback={<SuspenseFallback />}>
          <ReadQueryHook queryRef={queryRef} />
        </Suspense>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { context: { phase: "initial" } },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await user.click(screen.getByText("Update context"));
  await renderStream.takeRender();

  await user.click(screen.getByText("Refetch"));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { context: { phase: "rerender" } },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it("applies changed `refetchWritePolicy` to next fetch when changing between renders", async () => {
  interface Data {
    primes: number[];
  }

  const user = userEvent.setup();

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
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [refetchWritePolicy, setRefetchWritePolicy] =
      React.useState<RefetchWritePolicy>("merge");

    const [queryRef, { refetch }] = useBackgroundQuery(query, {
      refetchWritePolicy,
      variables: { min: 0, max: 12 },
    });

    return (
      <>
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
          <ReadQueryHook queryRef={queryRef} />
        </Suspense>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  // initial suspended render
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { primes: [2, 3, 5, 7, 11] },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
    expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);
  }

  await user.click(screen.getByText("Refetch next"));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { primes: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29] },
      dataState: "complete",
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

  await user.click(screen.getByText("Change refetch write policy"));
  await renderStream.takeRender();

  await user.click(screen.getByText("Refetch last"));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { primes: [31, 37, 41, 43, 47] },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
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
  const query: TypedDocumentNode<
    VariablesCaseData,
    Record<string, never>
  > = gql`
    query CharacterQuery($id: ID!) {
      character(id: $id) {
        id
        name
      }
    }
  `;

  interface PartialData {
    character: {
      __typename: "Character";
      id: string;
    };
  }

  const user = userEvent.setup();

  const partialQuery: TypedDocumentNode<PartialData> = gql`
    query {
      character {
        __typename
        id
      }
    }
  `;

  const mocks: MockLink.MockedResponse<VariablesCaseData>[] = [
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
    {
      request: { query },
      result: {
        data: {
          character: {
            __typename: "Character",
            id: "1",
            name: "Doctor Strange (refetched)",
          },
        },
      },
      delay: 10,
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

  const renderStream = createDefaultProfiler<VariablesCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [returnPartialData, setReturnPartialData] = React.useState(false);
    const [queryRef] = useBackgroundQuery(query, { returnPartialData });

    return (
      <>
        <button onClick={() => setReturnPartialData(true)}>
          Update partial data
        </button>
        <Suspense fallback={<SuspenseFallback />}>
          <ReadQueryHook queryRef={queryRef} />
        </Suspense>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  // initial suspended render
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: {
        character: { __typename: "Character", id: "1", name: "Doctor Strange" },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await user.click(screen.getByText("Update partial data"));
  await renderStream.takeRender();

  cache.modify({
    id: cache.identify({ __typename: "Character", id: "1" }),
    fields: {
      name: (_, { DELETE }) => DELETE,
    },
  });

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { character: { __typename: "Character", id: "1" } },
      dataState: "partial",
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: {
        character: {
          __typename: "Character",
          id: "1",
          name: "Doctor Strange (refetched)",
        },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender();
});

it("applies updated `fetchPolicy` on next fetch when it changes between renders", async () => {
  const { query, mocks } = setupVariablesCase();

  const user = userEvent.setup();
  const cache = new InMemoryCache();

  cache.writeQuery({
    query,
    variables: { id: "1" },
    data: {
      character: {
        __typename: "Character",
        id: "1",
        name: "Spider-Cacheman",
      },
    },
  });

  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache,
  });

  const renderStream = createDefaultProfiler<VariablesCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    const [fetchPolicy, setFetchPolicy] =
      React.useState<useBackgroundQuery.FetchPolicy>("cache-first");

    const [queryRef, { refetch }] = useBackgroundQuery(query, {
      fetchPolicy,
      variables: { id: "1" },
    });

    return (
      <>
        <button onClick={() => setFetchPolicy("no-cache")}>
          Change fetch policy
        </button>
        <button onClick={() => refetch()}>Refetch</button>
        <Suspense fallback={<SuspenseFallback />}>
          <ReadQueryHook queryRef={queryRef} />
        </Suspense>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: {
        character: {
          __typename: "Character",
          id: "1",
          name: "Spider-Cacheman",
        },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await user.click(screen.getByText("Change fetch policy"));
  {
    const { snapshot } = await renderStream.takeRender();

    // ensure we haven't changed the result yet just by changing the fetch policy
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        character: {
          __typename: "Character",
          id: "1",
          name: "Spider-Cacheman",
        },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await user.click(screen.getByText("Refetch"));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  // Because we switched to a `no-cache` fetch policy, we should not see the
  // newly fetched data in the cache after the fetch occurred.
  expect(cache.readQuery({ query, variables: { id: "1" } })).toStrictEqualTyped(
    {
      character: {
        __typename: "Character",
        id: "1",
        name: "Spider-Cacheman",
      },
    }
  );
});

it("properly handles changing options along with changing `variables`", async () => {
  const { query } = setupVariablesCase();
  const user = userEvent.setup();
  const mocks: MockLink.MockedResponse<VariablesCaseData>[] = [
    {
      request: { query, variables: { id: "1" } },
      result: {
        errors: [new GraphQLError("oops")],
      },
      delay: 10,
    },
    {
      request: { query, variables: { id: "2" } },
      result: {
        data: {
          character: {
            __typename: "Character",
            id: "2",
            name: "Hulk",
          },
        },
      },
      delay: 10,
    },
  ];

  const cache = new InMemoryCache();

  cache.writeQuery({
    query,
    variables: {
      id: "1",
    },
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

  const renderStream = createErrorProfiler<VariablesCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);
  const { ErrorBoundary } = createTrackedErrorComponents(renderStream);

  function App() {
    useTrackRenders();
    const [id, setId] = React.useState("1");

    const [queryRef, { refetch }] = useBackgroundQuery(query, {
      errorPolicy: id === "1" ? "all" : "none",
      variables: { id },
    });

    return (
      <>
        <button onClick={() => setId("1")}>Get first character</button>
        <button onClick={() => setId("2")}>Get second character</button>
        <button onClick={() => refetch()}>Refetch</button>
        <ErrorBoundary>
          <Suspense fallback={<SuspenseFallback />}>
            <ReadQueryHook queryRef={queryRef} />
          </Suspense>
        </ErrorBoundary>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot).toStrictEqualTyped({
      error: null,
      result: {
        data: {
          character: {
            __typename: "Character",
            id: "1",
            name: "Doctor Strangecache",
          },
        },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  await user.click(screen.getByText("Get second character"));
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot).toStrictEqualTyped({
      error: null,
      result: {
        data: {
          character: {
            __typename: "Character",
            id: "2",
            name: "Hulk",
          },
        },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  await user.click(screen.getByText("Get first character"));

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot).toStrictEqualTyped({
      error: null,
      result: {
        data: {
          character: {
            __typename: "Character",
            id: "1",
            name: "Doctor Strangecache",
          },
        },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  await user.click(screen.getByText("Refetch"));
  await renderStream.takeRender();

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    // Ensure we render the inline error instead of the error boundary, which
    // tells us the error policy was properly applied.
    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot).toStrictEqualTyped({
      error: null,
      result: {
        data: {
          character: {
            __typename: "Character",
            id: "1",
            name: "Doctor Strangecache",
          },
        },
        dataState: "complete",
        error: new CombinedGraphQLErrors({ errors: [{ message: "oops" }] }),
        networkStatus: NetworkStatus.error,
      },
    });
  }
});

it('does not suspend when partial data is in the cache and using a "cache-first" fetch policy with returnPartialData', async () => {
  const { query, mocks } = setupVariablesCase();
  const cache = new InMemoryCache();

  {
    // Disable missing field warning
    using _consoleSpy = spyOnConsole("error");
    cache.writeQuery({
      query,
      // @ts-expect-error writing partial query data
      data: { character: { __typename: "Character", id: "1" } },
      variables: { id: "1" },
    });
  }

  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache,
  });

  const renderStream = createDefaultProfiler<DeepPartial<VariablesCaseData>>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, {
      fetchPolicy: "cache-first",
      returnPartialData: true,
      variables: { id: "1" },
    });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { character: { __typename: "Character", id: "1" } },
      dataState: "partial",
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it('suspends and does not use partial data from other variables in the cache when changing variables and using a "cache-first" fetch policy with returnPartialData: true', async () => {
  const { query, mocks } = setupVariablesCase();
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
    data: { character: { __typename: "Character", id: "1" } },
    variables: { id: "1" },
  });

  const renderStream = createDefaultProfiler<DeepPartial<VariablesCaseData>>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App({ id }: { id: string }) {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, {
      fetchPolicy: "cache-first",
      returnPartialData: true,
      variables: { id },
    });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  const { rerender } = await renderStream.render(<App id="1" />, {
    wrapper: createMockWrapper({
      cache,
      mocks: addDelayToMocks(mocks, 150, true),
    }),
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { character: { __typename: "Character", id: "1" } },
      dataState: "partial",
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await rerender(<App id="2" />);

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        character: { __typename: "Character", id: "2", name: "Black Widow" },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it('suspends when partial data is in the cache and using a "network-only" fetch policy with returnPartialData', async () => {
  const { query, mocks } = setupVariablesCase();

  const partialQuery = gql`
    query ($id: String!) {
      character(id: $id) {
        id
      }
    }
  `;

  const cache = new InMemoryCache();

  cache.writeQuery({
    query: partialQuery,
    variables: { id: "1" },
    data: { character: { __typename: "Character", id: "1" } },
  });

  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache,
  });

  const renderStream = createDefaultProfiler<DeepPartial<VariablesCaseData>>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, {
      fetchPolicy: "network-only",
      returnPartialData: true,
      variables: { id: "1" },
    });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it('suspends when partial data is in the cache and using a "no-cache" fetch policy with returnPartialData', async () => {
  using _consoleSpy = spyOnConsole("warn");
  const { query, mocks } = setupVariablesCase();

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
    data: { character: { __typename: "Character", id: "1" } },
    variables: { id: "1" },
  });

  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache,
  });

  const renderStream = createDefaultProfiler<DeepPartial<VariablesCaseData>>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, {
      fetchPolicy: "no-cache",
      returnPartialData: true,
      variables: { id: "1" },
    });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it('warns when using returnPartialData with a "no-cache" fetch policy', async () => {
  using _consoleSpy = spyOnConsole("warn");

  const query: TypedDocumentNode<SimpleCaseData> = gql`
    query UserQuery {
      greeting
    }
  `;
  const mocks = [
    {
      request: { query },
      result: { data: { greeting: "Hello" } },
    },
  ];

  renderHook(
    () =>
      useBackgroundQuery(query, {
        fetchPolicy: "no-cache",
        returnPartialData: true,
      }),
    {
      wrapper: ({ children }) => (
        <MockedProvider mocks={mocks}>{children}</MockedProvider>
      ),
    }
  );

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    "Using `returnPartialData` with a `no-cache` fetch policy has no effect. To read partial data from the cache, consider using an alternate fetch policy."
  );
});

it('does not suspend when partial data is in the cache and using a "cache-and-network" fetch policy with returnPartialData', async () => {
  const { query, mocks } = setupVariablesCase();

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
    data: { character: { __typename: "Character", id: "1" } },
    variables: { id: "1" },
  });

  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache,
  });

  const renderStream = createDefaultProfiler<DeepPartial<VariablesCaseData>>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, {
      fetchPolicy: "cache-and-network",
      returnPartialData: true,
      variables: { id: "1" },
    });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { character: { __typename: "Character", id: "1" } },
      dataState: "partial",
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it('suspends and does not use partial data when changing variables and using a "cache-and-network" fetch policy with returnPartialData', async () => {
  const { query, mocks } = setupVariablesCase();
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
    data: { character: { __typename: "Character", id: "1" } },
    variables: { id: "1" },
  });

  const renderStream = createDefaultProfiler<DeepPartial<VariablesCaseData>>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App({ id }: { id: string }) {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, {
      fetchPolicy: "cache-and-network",
      returnPartialData: true,
      variables: { id },
    });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  const { rerender } = await renderStream.render(<App id="1" />, {
    wrapper: createMockWrapper({
      cache,
      mocks: addDelayToMocks(mocks, 150, true),
    }),
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { character: { __typename: "Character", id: "1" } },
      dataState: "partial",
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await rerender(<App id="2" />);

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        character: { __typename: "Character", id: "2", name: "Black Widow" },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
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

  const query: TypedDocumentNode<QueryData> = gql`
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

  // We are intentionally writing partial data to the cache. Supress console
  // warnings to avoid unnecessary noise in the test.
  {
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

  const client = new ApolloClient({
    link,
    cache,
    incrementalHandler: new Defer20220824Handler(),
  });

  const renderStream = createDefaultProfiler<DeepPartial<QueryData>>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, {
      fetchPolicy: "cache-first",
      returnPartialData: true,
    });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        greeting: {
          __typename: "Greeting",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
      },
      dataState: "partial",
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
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
      },
      dataState: "streaming",
      error: undefined,
      networkStatus: NetworkStatus.streaming,
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
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "Person", name: "Alice" },
        },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender({ timeout: 50 });
});

it.each<useBackgroundQuery.FetchPolicy>([
  "cache-first",
  "network-only",
  "cache-and-network",
])(
  'responds to cache updates in strict mode while using a "%s" fetch policy',
  async (fetchPolicy) => {
    const { query, mocks } = setupSimpleCase();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const renderStream = createDefaultProfiler<SimpleCaseData>();
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(renderStream);

    function App() {
      useTrackRenders();
      const [queryRef] = useBackgroundQuery(query, { fetchPolicy });

      return (
        <Suspense fallback={<SuspenseFallback />}>
          <ReadQueryHook queryRef={queryRef} />
        </Suspense>
      );
    }

    using _disabledAct = disableActEnvironment();
    await renderStream.render(<App />, {
      wrapper: createClientWrapper(client, React.StrictMode),
    });

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result).toStrictEqualTyped({
        data: { greeting: "Hello" },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    client.writeQuery({
      query,
      data: { greeting: "Updated hello" },
    });

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result).toStrictEqualTyped({
        data: { greeting: "Updated hello" },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    await expect(renderStream).not.toRerender({ timeout: 50 });
  }
);

it("masks queries when dataMasking is `true`", async () => {
  type UserFieldsFragment = {
    age: number;
  } & { " $fragmentName"?: "UserFieldsFragment" };

  interface Query {
    currentUser: {
      __typename: "User";
      id: number;
      name: string;
    } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
  }

  const query: TypedDocumentNode<Query, Record<string, never>> = gql`
    query MaskedQuery {
      currentUser {
        id
        name
        ...UserFields
      }
    }

    fragment UserFields on User {
      age
    }
  `;

  const mocks = [
    {
      request: { query },
      result: {
        data: {
          currentUser: {
            __typename: "User",
            id: 1,
            name: "Test User",
            age: 30,
          },
        },
      },
    },
  ];

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  const renderStream = createDefaultProfiler<Query>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query);

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, {
    wrapper: createClientWrapper(client),
  });

  // loading
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: {
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
        },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it("does not mask query when dataMasking is `false`", async () => {
  type UserFieldsFragment = {
    age: number;
  } & { " $fragmentName"?: "UserFieldsFragment" };

  interface Query {
    currentUser: {
      __typename: "User";
      id: number;
      name: string;
      age: number;
    } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
  }

  const query: TypedDocumentNode<Query, Record<string, never>> = gql`
    query MaskedQuery {
      currentUser {
        id
        name
        ...UserFields
      }
    }

    fragment UserFields on User {
      age
    }
  `;

  const mocks = [
    {
      request: { query },
      result: {
        data: {
          currentUser: {
            __typename: "User",
            id: 1,
            name: "Test User",
            age: 30,
          },
        },
      },
    },
  ];

  const client = new ApolloClient({
    dataMasking: false,
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  const renderStream = createDefaultProfiler<Query>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query);

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  // loading
  await renderStream.takeRender();

  const { snapshot } = await renderStream.takeRender();

  expect(snapshot.result).toStrictEqualTyped({
    data: {
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
      },
    },
    dataState: "complete",
    error: undefined,
    networkStatus: NetworkStatus.ready,
  });
});

it("does not mask query by default", async () => {
  type UserFieldsFragment = {
    age: number;
  } & { " $fragmentName"?: "UserFieldsFragment" };

  interface Query {
    currentUser: {
      __typename: "User";
      id: number;
      name: string;
      age: number;
    } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
  }

  const query: TypedDocumentNode<Query, Record<string, never>> = gql`
    query MaskedQuery {
      currentUser {
        id
        name
        ...UserFields
      }
    }

    fragment UserFields on User {
      age
    }
  `;

  const mocks = [
    {
      request: { query },
      result: {
        data: {
          currentUser: {
            __typename: "User",
            id: 1,
            name: "Test User",
            age: 30,
          },
        },
      },
    },
  ];

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  const renderStream = createDefaultProfiler<Query>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query);

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  // loading
  await renderStream.takeRender();

  const { snapshot } = await renderStream.takeRender();

  expect(snapshot.result).toStrictEqualTyped({
    data: {
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
      },
    },
    dataState: "complete",
    error: undefined,
    networkStatus: NetworkStatus.ready,
  });
});

it("masks queries updated by the cache", async () => {
  type UserFieldsFragment = {
    age: number;
  } & { " $fragmentName"?: "UserFieldsFragment" };

  interface Query {
    currentUser: {
      __typename: "User";
      id: number;
      name: string;
    } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
  }

  const query: TypedDocumentNode<Query, Record<string, never>> = gql`
    query MaskedQuery {
      currentUser {
        id
        name
        ...UserFields
      }
    }

    fragment UserFields on User {
      age
    }
  `;

  const mocks = [
    {
      request: { query },
      result: {
        data: {
          currentUser: {
            __typename: "User",
            id: 1,
            name: "Test User",
            age: 30,
          },
        },
      },
    },
  ];

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  const renderStream = createDefaultProfiler<Query>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query);

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  // loading
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: {
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
        },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.writeQuery({
    query,
    data: {
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User (updated)",
        // @ts-ignore TODO: Determine how to handle cache writes with masked
        // query type
        age: 35,
      },
    },
  });

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: {
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User (updated)",
        },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it("does not rerender when updating field in named fragment", async () => {
  type UserFieldsFragment = {
    age: number;
  } & { " $fragmentName"?: "UserFieldsFragment" };

  interface Query {
    currentUser: {
      __typename: "User";
      id: number;
      name: string;
    } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
  }

  const query: TypedDocumentNode<Query, Record<string, never>> = gql`
    query MaskedQuery {
      currentUser {
        id
        name
        ...UserFields
      }
    }

    fragment UserFields on User {
      age
    }
  `;

  const mocks = [
    {
      request: { query },
      result: {
        data: {
          currentUser: {
            __typename: "User",
            id: 1,
            name: "Test User",
            age: 30,
          },
        },
      },
    },
  ];

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  const renderStream = createDefaultProfiler<Query>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query);

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, {
    wrapper: createClientWrapper(client),
  });

  // loading
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: {
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
        },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.writeQuery({
    query,
    data: {
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
        // @ts-ignore TODO: Determine how to handle cache writes with masked
        // query type
        age: 35,
      },
    },
  });

  await expect(renderStream).not.toRerender();

  expect(client.readQuery({ query })).toStrictEqualTyped({
    currentUser: {
      __typename: "User",
      id: 1,
      name: "Test User",
      age: 35,
    },
  });
});

it("masks result from cache when using with cache-first fetch policy", async () => {
  type UserFieldsFragment = {
    age: number;
  } & { " $fragmentName"?: "UserFieldsFragment" };

  interface Query {
    currentUser: {
      __typename: "User";
      id: number;
      name: string;
    } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
  }

  const query: TypedDocumentNode<Query, Record<string, never>> = gql`
    query MaskedQuery {
      currentUser {
        id
        name
        ...UserFields
      }
    }

    fragment UserFields on User {
      age
    }
  `;

  const mocks = [
    {
      request: { query },
      result: {
        data: {
          currentUser: {
            __typename: "User",
            id: 1,
            name: "Test User",
            age: 30,
          },
        },
      },
    },
  ];

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  client.writeQuery({
    query,
    data: {
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 30,
      },
    },
  });

  const renderStream = createDefaultProfiler<Query>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, {
      fetchPolicy: "cache-first",
    });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  const { snapshot } = await renderStream.takeRender();

  expect(snapshot.result).toStrictEqualTyped({
    data: {
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
      },
    },
    dataState: "complete",
    error: undefined,
    networkStatus: NetworkStatus.ready,
  });
});

it("masks cache and network result when using cache-and-network fetch policy", async () => {
  type UserFieldsFragment = {
    age: number;
  } & { " $fragmentName"?: "UserFieldsFragment" };

  interface Query {
    currentUser: {
      __typename: "User";
      id: number;
      name: string;
    } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
  }

  const query: TypedDocumentNode<Query, Record<string, never>> = gql`
    query MaskedQuery {
      currentUser {
        id
        name
        ...UserFields
      }
    }

    fragment UserFields on User {
      age
    }
  `;

  const mocks = [
    {
      request: { query },
      result: {
        data: {
          currentUser: {
            __typename: "User",
            id: 1,
            name: "Test User (server)",
            age: 35,
          },
        },
      },
      delay: 20,
    },
  ];

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  client.writeQuery({
    query,
    data: {
      currentUser: {
        __typename: "User",
        id: 1,
        name: "Test User",
        age: 34,
      },
    },
  });

  const renderStream = createDefaultProfiler<Query>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, {
      fetchPolicy: "cache-and-network",
    });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: {
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
        },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: {
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User (server)",
        },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it("masks partial cache data when returnPartialData is `true`", async () => {
  type UserFieldsFragment = {
    __typename: "User";
    age: number;
  } & { " $fragmentName"?: "UserFieldsFragment" };

  interface Query {
    currentUser: {
      __typename: "User";
      id: number;
      name: string;
    } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
  }

  const query: TypedDocumentNode<Query, Record<string, never>> = gql`
    query MaskedQuery {
      currentUser {
        id
        name
        ...UserFields
      }
    }

    fragment UserFields on User {
      age
    }
  `;

  const mocks = [
    {
      request: { query },
      result: {
        data: {
          currentUser: {
            __typename: "User",
            id: 1,
            name: "Test User (server)",
            age: 35,
          },
        },
      },
      delay: 20,
    },
  ];

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  {
    using _ = spyOnConsole("error");
    client.writeQuery({
      query,
      data: {
        // @ts-expect-error writing partial cache data
        currentUser: {
          __typename: "User",
          id: 1,
          age: 34,
        },
      },
    });
  }

  const renderStream = createDefaultProfiler<DeepPartial<Query>>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, { returnPartialData: true });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: {
        currentUser: {
          __typename: "User",
          id: 1,
        },
      },
      dataState: "partial",
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: {
        currentUser: {
          __typename: "User",
          id: 1,
          name: "Test User (server)",
        },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it("masks partial data returned from data on errors with errorPolicy `all`", async () => {
  type UserFieldsFragment = {
    age: number;
  } & { " $fragmentName"?: "UserFieldsFragment" };

  interface Query {
    currentUser: {
      __typename: "User";
      id: number;
      name: string | null;
    } & { " $fragmentRefs"?: { UserFieldsFragment: UserFieldsFragment } };
  }

  const query: TypedDocumentNode<Query, Record<string, never>> = gql`
    query MaskedQuery {
      currentUser {
        id
        name
        ...UserFields
      }
    }

    fragment UserFields on User {
      age
    }
  `;

  const mocks = [
    {
      request: { query },
      result: {
        data: {
          currentUser: {
            __typename: "User",
            id: 1,
            name: null,
            age: 34,
          },
        },
        errors: [new GraphQLError("Couldn't get name")],
      },
      delay: 20,
    },
  ];

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  const renderStream = createDefaultProfiler<Query | undefined>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(renderStream);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, { errorPolicy: "all" });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  // loading
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: {
        currentUser: {
          __typename: "User",
          id: 1,
          name: null,
        },
      },
      dataState: "complete",
      error: new CombinedGraphQLErrors({
        data: {
          currentUser: {
            __typename: "User",
            id: 1,
            name: null,
            age: 34,
          },
        },
        errors: [{ message: "Couldn't get name" }],
      }),
      networkStatus: NetworkStatus.error,
    });
  }
});

describe("refetch", () => {
  it("re-suspends when calling `refetch`", async () => {
    const { query, mocks: defaultMocks } = setupVariablesCase();
    const user = userEvent.setup();
    const renderStream = createDefaultProfiler<VariablesCaseData>();
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(renderStream);

    const mocks: MockLink.MockedResponse<VariablesCaseData>[] = [
      ...defaultMocks,
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "1",
              name: "Spider-Man (refetched)",
            },
          },
        },
        delay: 10,
      },
    ];

    function App() {
      useTrackRenders();
      const [queryRef, { refetch }] = useBackgroundQuery(query, {
        variables: { id: "1" },
      });

      return (
        <>
          <button onClick={() => refetch()}>Refetch</button>
          <Suspense fallback={<SuspenseFallback />}>
            <ReadQueryHook queryRef={queryRef} />
          </Suspense>
        </>
      );
    }

    using _disabledAct = disableActEnvironment();
    await renderStream.render(<App />, {
      wrapper: createMockWrapper({ mocks }),
    });

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result).toStrictEqualTyped({
        data: {
          character: {
            __typename: "Character",
            id: "1",
            name: "Spider-Man",
          },
        },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    await user.click(screen.getByText("Refetch"));

    {
      // parent component re-suspends
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result).toStrictEqualTyped({
        data: {
          character: {
            __typename: "Character",
            id: "1",
            name: "Spider-Man (refetched)",
          },
        },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    await expect(renderStream).not.toRerender({ timeout: 50 });
  });

  it("re-suspends when calling `refetch` with new variables", async () => {
    const { query, mocks } = setupVariablesCase();
    const user = userEvent.setup();
    const renderStream = createDefaultProfiler<VariablesCaseData>();
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(renderStream);

    function App() {
      useTrackRenders();
      const [queryRef, { refetch }] = useBackgroundQuery(query, {
        variables: { id: "1" },
      });

      return (
        <>
          <button onClick={() => refetch({ id: "2" })}>Refetch</button>
          <Suspense fallback={<SuspenseFallback />}>
            <ReadQueryHook queryRef={queryRef} />
          </Suspense>
        </>
      );
    }

    using _disabledAct = disableActEnvironment();
    await renderStream.render(<App />, {
      wrapper: createMockWrapper({ mocks }),
    });

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result).toStrictEqualTyped({
        data: {
          character: {
            __typename: "Character",
            id: "1",
            name: "Spider-Man",
          },
        },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    await user.click(screen.getByText("Refetch"));

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result).toStrictEqualTyped({
        data: {
          character: {
            __typename: "Character",
            id: "2",
            name: "Black Widow",
          },
        },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    await expect(renderStream).not.toRerender({ timeout: 50 });
  });

  it("re-suspends multiple times when calling `refetch` multiple times", async () => {
    const { query, mocks: defaultMocks } = setupVariablesCase();
    const user = userEvent.setup();
    const renderStream = createDefaultProfiler<VariablesCaseData>();
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(renderStream);

    const mocks: MockLink.MockedResponse<VariablesCaseData>[] = [
      ...defaultMocks,
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "1",
              name: "Spider-Man (refetched)",
            },
          },
        },
        delay: 20,
      },
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "1",
              name: "Spider-Man (refetched again)",
            },
          },
        },
        delay: 20,
      },
    ];

    function App() {
      useTrackRenders();
      const [queryRef, { refetch }] = useBackgroundQuery(query, {
        variables: { id: "1" },
      });

      return (
        <>
          <button onClick={() => refetch()}>Refetch</button>
          <Suspense fallback={<SuspenseFallback />}>
            <ReadQueryHook queryRef={queryRef} />
          </Suspense>
        </>
      );
    }

    using _disabledAct = disableActEnvironment();
    await renderStream.render(<App />, {
      wrapper: createMockWrapper({ mocks }),
    });

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result).toStrictEqualTyped({
        data: {
          character: { __typename: "Character", id: "1", name: "Spider-Man" },
        },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    const button = screen.getByText("Refetch");

    await user.click(button);

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result).toStrictEqualTyped({
        data: {
          character: {
            __typename: "Character",
            id: "1",
            name: "Spider-Man (refetched)",
          },
        },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    await user.click(button);

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result).toStrictEqualTyped({
        data: {
          character: {
            __typename: "Character",
            id: "1",
            name: "Spider-Man (refetched again)",
          },
        },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    await expect(renderStream).not.toRerender({ timeout: 50 });
  });

  it("throws errors when errors are returned after calling `refetch`", async () => {
    using _consoleSpy = spyOnConsole("error");
    const { query, mocks: defaultMocks } = setupVariablesCase();
    const user = userEvent.setup();
    const mocks: MockLink.MockedResponse<VariablesCaseData>[] = [
      ...defaultMocks,
      {
        request: { query, variables: { id: "1" } },
        result: {
          errors: [new GraphQLError("Something went wrong")],
        },
        delay: 10,
      },
    ];

    const renderStream = createErrorProfiler<VariablesCaseData>();
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(renderStream);
    const { ErrorBoundary } = createTrackedErrorComponents(renderStream);

    function App() {
      useTrackRenders();
      const [queryRef, { refetch }] = useBackgroundQuery(query, {
        variables: { id: "1" },
      });

      return (
        <>
          <button onClick={() => refetch()}>Refetch</button>
          <Suspense fallback={<SuspenseFallback />}>
            <ErrorBoundary>
              <ReadQueryHook queryRef={queryRef} />
            </ErrorBoundary>
          </Suspense>
        </>
      );
    }

    using _disabledAct = disableActEnvironment();
    await renderStream.render(<App />, {
      wrapper: createMockWrapper({ mocks }),
    });

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot).toStrictEqualTyped({
        error: null,
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "1",
              name: "Spider-Man",
            },
          },
          dataState: "complete",
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }

    await user.click(screen.getByText("Refetch"));

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot, renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual(["ErrorFallback"]);
      expect(snapshot.error).toEqual(
        new CombinedGraphQLErrors({
          errors: [{ message: "Something went wrong" }],
        })
      );
    }

    await expect(renderStream).not.toRerender({ timeout: 50 });
  });

  it('ignores errors returned after calling `refetch` when errorPolicy is set to "ignore"', async () => {
    const { query, mocks: defaultMocks } = setupVariablesCase();
    const user = userEvent.setup();
    const mocks = [
      ...defaultMocks,
      {
        request: { query, variables: { id: "1" } },
        result: {
          errors: [new GraphQLError("Something went wrong")],
        },
        delay: 10,
      },
    ];

    const renderStream = createErrorProfiler<VariablesCaseData | undefined>();
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(renderStream);
    const { ErrorBoundary } = createTrackedErrorComponents(renderStream);

    function App() {
      useTrackRenders();
      const [queryRef, { refetch }] = useBackgroundQuery(query, {
        variables: { id: "1" },
        errorPolicy: "ignore",
      });

      return (
        <>
          <button onClick={() => refetch()}>Refetch</button>
          <Suspense fallback={<SuspenseFallback />}>
            <ErrorBoundary>
              <ReadQueryHook queryRef={queryRef} />
            </ErrorBoundary>
          </Suspense>
        </>
      );
    }

    using _disabledAct = disableActEnvironment();
    await renderStream.render(<App />, {
      wrapper: createMockWrapper({ mocks }),
    });

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot).toStrictEqualTyped({
        error: null,
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "1",
              name: "Spider-Man",
            },
          },
          dataState: "complete",
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }

    await user.click(screen.getByText("Refetch"));

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot).toStrictEqualTyped({
        error: null,
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "1",
              name: "Spider-Man",
            },
          },
          dataState: "complete",
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }

    await expect(renderStream).not.toRerender({ timeout: 50 });
  });

  it('returns errors after calling `refetch` when errorPolicy is set to "all"', async () => {
    const { query, mocks: defaultMocks } = setupVariablesCase();
    const user = userEvent.setup();
    const mocks = [
      ...defaultMocks,
      {
        request: { query, variables: { id: "1" } },
        result: {
          errors: [new GraphQLError("Something went wrong")],
        },
        delay: 10,
      },
    ];

    const renderStream = createErrorProfiler<VariablesCaseData | undefined>();
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(renderStream);
    const { ErrorBoundary } = createTrackedErrorComponents(renderStream);

    function App() {
      useTrackRenders();
      const [queryRef, { refetch }] = useBackgroundQuery(query, {
        variables: { id: "1" },
        errorPolicy: "all",
      });

      return (
        <>
          <button onClick={() => refetch()}>Refetch</button>
          <Suspense fallback={<SuspenseFallback />}>
            <ErrorBoundary>
              <ReadQueryHook queryRef={queryRef} />
            </ErrorBoundary>
          </Suspense>
        </>
      );
    }

    using _disabledAct = disableActEnvironment();
    await renderStream.render(<App />, {
      wrapper: createMockWrapper({ mocks }),
    });

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot).toStrictEqualTyped({
        error: null,
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "1",
              name: "Spider-Man",
            },
          },
          dataState: "complete",
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }

    await user.click(screen.getByText("Refetch"));

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot).toStrictEqualTyped({
        error: null,
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "1",
              name: "Spider-Man",
            },
          },
          dataState: "complete",
          error: new CombinedGraphQLErrors({
            errors: [{ message: "Something went wrong" }],
          }),
          networkStatus: NetworkStatus.error,
        },
      });
    }

    await expect(renderStream).not.toRerender({ timeout: 50 });
  });

  it('handles partial data results after calling `refetch` when errorPolicy is set to "all"', async () => {
    type VariablesCaseData = {
      character: {
        __typename: "Character";
        id: string;
        name: string | null;
      };
    };
    const query: TypedDocumentNode<VariablesCaseData, VariablesCaseVariables> =
      gql`
        query CharacterQuery($id: ID!) {
          character(id: $id) {
            id
            name
          }
        }
      `;
    const { mocks: defaultMocks } = setupVariablesCase();
    const user = userEvent.setup();
    const mocks = [
      ...defaultMocks,
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: { character: { __typename: "Character", id: "1", name: null } },
          errors: [new GraphQLError("Something went wrong")],
        },
        delay: 10,
      },
    ];

    const renderStream = createErrorProfiler<VariablesCaseData | undefined>();
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(renderStream);
    const { ErrorBoundary } = createTrackedErrorComponents(renderStream);

    function App() {
      useTrackRenders();
      const [queryRef, { refetch }] = useBackgroundQuery(query, {
        variables: { id: "1" },
        errorPolicy: "all",
      });

      return (
        <>
          <button onClick={() => refetch()}>Refetch</button>
          <Suspense fallback={<SuspenseFallback />}>
            <ErrorBoundary>
              <ReadQueryHook queryRef={queryRef} />
            </ErrorBoundary>
          </Suspense>
        </>
      );
    }

    using _disabledAct = disableActEnvironment();
    await renderStream.render(<App />, {
      wrapper: createMockWrapper({ mocks }),
    });

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot).toStrictEqualTyped({
        error: null,
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "1",
              name: "Spider-Man",
            },
          },
          dataState: "complete",
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }

    await user.click(screen.getByText("Refetch"));

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot).toStrictEqualTyped({
        error: null,
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "1",
              name: null,
            },
          },
          dataState: "complete",
          error: new CombinedGraphQLErrors({
            data: {
              character: {
                __typename: "Character",
                id: "1",
                name: null,
              },
            },
            errors: [{ message: "Something went wrong" }],
          }),
          networkStatus: NetworkStatus.error,
        },
      });
    }

    await expect(renderStream).not.toRerender({ timeout: 50 });
  });

  it("can refetch after error is encountered", async () => {
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

    const user = userEvent.setup();

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
          data: null,
          errors: [new GraphQLError("Oops couldn't fetch")],
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

    const renderStream = createErrorProfiler<Data>();
    const { SuspenseFallback } = createDefaultTrackedComponents(renderStream);

    function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
      useTrackRenders();
      renderStream.mergeSnapshot({ error });

      return <button onClick={resetErrorBoundary}>Retry</button>;
    }

    function App() {
      useTrackRenders();
      const [queryRef, { refetch }] = useBackgroundQuery(query, {
        variables: { id: "1" },
      });

      return (
        <Suspense fallback={<SuspenseFallback />}>
          <ReactErrorBoundary
            onReset={() => refetch()}
            FallbackComponent={ErrorFallback}
          >
            <Todo queryRef={queryRef} />
          </ReactErrorBoundary>
        </Suspense>
      );
    }

    function Todo({ queryRef }: { queryRef: QueryRef<Data> }) {
      useTrackRenders();
      renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

      return null;
    }

    using _disabledAct = disableActEnvironment();
    await renderStream.render(<App />, {
      wrapper: createMockWrapper({ mocks }),
    });

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      // Disable error message shown in the console due to an uncaught error.
      using _consoleSpy = spyOnConsole("error");
      const { snapshot, renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([ErrorFallback]);
      expect(snapshot).toStrictEqualTyped({
        error: new CombinedGraphQLErrors({
          data: null,
          errors: [{ message: "Oops couldn't fetch" }],
        }),
        result: null,
      });
    }

    await user.click(screen.getByText("Retry"));

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot, renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([Todo]);
      expect(snapshot).toStrictEqualTyped({
        // TODO: We should reset the snapshot between renders to better capture
        // the actual result. This makes it seem like the error is rendered, but
        // in this is just leftover from the previous snapshot.
        error: new CombinedGraphQLErrors({
          data: null,
          errors: [{ message: "Oops couldn't fetch" }],
        }),
        result: {
          data: { todo: { id: "1", name: "Clean room", completed: true } },
          dataState: "complete",
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }
  });

  it("throws errors on refetch after error is encountered after first fetch with error", async () => {
    // Disable error message shown in the console due to an uncaught error.
    using _consoleSpy = spyOnConsole("error");
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

    const user = userEvent.setup();
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
          data: null,
          errors: [new GraphQLError("Oops couldn't fetch")],
        },
        delay: 10,
      },
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: null,
          errors: [new GraphQLError("Oops couldn't fetch again")],
        },
        delay: 10,
      },
    ];

    const renderStream = createErrorProfiler<Data>();
    const { SuspenseFallback } = createDefaultTrackedComponents(renderStream);

    function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
      useTrackRenders();
      renderStream.mergeSnapshot({ error });

      return <button onClick={resetErrorBoundary}>Retry</button>;
    }

    function App() {
      useTrackRenders();
      const [queryRef, { refetch }] = useBackgroundQuery(query, {
        variables: { id: "1" },
      });

      return (
        <Suspense fallback={<SuspenseFallback />}>
          <ReactErrorBoundary
            onReset={() => refetch()}
            FallbackComponent={ErrorFallback}
          >
            <Todo queryRef={queryRef} />
          </ReactErrorBoundary>
        </Suspense>
      );
    }

    function Todo({ queryRef }: { queryRef: QueryRef<Data> }) {
      useTrackRenders();
      renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

      return null;
    }

    using _disabledAct = disableActEnvironment();
    await renderStream.render(<App />, {
      wrapper: createMockWrapper({ mocks }),
    });

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot, renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([ErrorFallback]);
      expect(snapshot).toStrictEqualTyped({
        error: new CombinedGraphQLErrors({
          data: null,
          errors: [{ message: "Oops couldn't fetch" }],
        }),
        result: null,
      });
    }

    await user.click(screen.getByText("Retry"));

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot, renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([ErrorFallback]);
      expect(snapshot).toStrictEqualTyped({
        error: new CombinedGraphQLErrors({
          data: null,
          errors: [{ message: "Oops couldn't fetch again" }],
        }),
        result: null,
      });
    }
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

    const user = userEvent.setup();

    const query: TypedDocumentNode<Data, Variables> = gql`
      query TodoItemQuery($id: ID!) {
        todo(id: $id) {
          id
          name
          completed
        }
      }
    `;

    const mocks: MockLink.MockedResponse<Data, Variables>[] = [
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

    const renderStream = createRenderStream({
      initialSnapshot: {
        isPending: false,
        result: null as useReadQuery.Result<Data> | null,
      },
    });

    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(renderStream);

    function App() {
      useTrackRenders();
      const [isPending, startTransition] = React.useTransition();
      const [queryRef, { refetch }] = useBackgroundQuery(query, {
        variables: { id: "1" },
      });

      renderStream.mergeSnapshot({ isPending });

      return (
        <>
          <button
            onClick={() => {
              startTransition(() => {
                void refetch();
              });
            }}
          >
            Refetch
          </button>
          <Suspense fallback={<SuspenseFallback />}>
            <ReadQueryHook queryRef={queryRef} />
          </Suspense>
        </>
      );
    }

    using _disabledAct = disableActEnvironment();
    await renderStream.render(<App />, {
      wrapper: createMockWrapper({ mocks }),
    });

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot).toStrictEqualTyped({
        isPending: false,
        result: {
          data: { todo: { id: "1", name: "Clean room", completed: false } },
          dataState: "complete",
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }

    await user.click(screen.getByText("Refetch"));

    {
      // startTransition will avoid rendering the suspense fallback for already
      // revealed content if the state update inside the transition causes the
      // component to suspend.
      //
      // Here we should not see the suspense fallback while the component
      // suspends until the todo is finished loading. Seeing the suspense
      // fallback is an indication that we are suspending the component too late
      // in the process.
      const { snapshot, renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
      expect(snapshot).toStrictEqualTyped({
        isPending: true,
        result: {
          data: { todo: { id: "1", name: "Clean room", completed: false } },
          dataState: "complete",
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }

    {
      const { snapshot, renderedComponents } = await renderStream.takeRender();

      // Eventually we should see the updated todo content once its done
      // suspending.
      expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
      expect(snapshot).toStrictEqualTyped({
        isPending: false,
        result: {
          data: { todo: { id: "1", name: "Clean room", completed: true } },
          dataState: "complete",
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }
  });

  it('honors refetchWritePolicy set to "merge"', async () => {
    const user = userEvent.setup();

    const query: TypedDocumentNode<QueryData, { min: number; max: number }> =
      gql`
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
      createDefaultTrackedComponents(renderStream);

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache,
    });

    function App() {
      useTrackRenders();
      const [queryRef, { refetch }] = useBackgroundQuery(query, {
        variables: { min: 0, max: 12 },
        refetchWritePolicy: "merge",
      });

      return (
        <>
          <button onClick={() => refetch({ min: 12, max: 30 })}>Refetch</button>
          <Suspense fallback={<SuspenseFallback />}>
            <ReadQueryHook queryRef={queryRef} />
          </Suspense>
        </>
      );
    }

    using _disabledAct = disableActEnvironment();
    await renderStream.render(<App />, {
      wrapper: createClientWrapper(client),
    });

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result).toStrictEqualTyped({
        data: { primes: [2, 3, 5, 7, 11] },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
      expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);
    }

    await user.click(screen.getByText("Refetch"));

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result).toStrictEqualTyped({
        data: { primes: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29] },
        dataState: "complete",
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
  });

  it('defaults refetchWritePolicy to "overwrite"', async () => {
    const user = userEvent.setup();

    const query: TypedDocumentNode<QueryData, { min: number; max: number }> =
      gql`
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

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache,
    });

    const renderStream = createDefaultProfiler<QueryData>();
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(renderStream);

    function App() {
      useTrackRenders();
      const [queryRef, { refetch }] = useBackgroundQuery(query, {
        variables: { min: 0, max: 12 },
      });

      return (
        <>
          <button onClick={() => refetch({ min: 12, max: 30 })}>Refetch</button>
          <Suspense fallback={<SuspenseFallback />}>
            <ReadQueryHook queryRef={queryRef} />
          </Suspense>
        </>
      );
    }

    using _disabledAct = disableActEnvironment();
    await renderStream.render(<App />, {
      wrapper: createClientWrapper(client),
    });

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result).toStrictEqualTyped({
        data: { primes: [2, 3, 5, 7, 11] },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
      expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);
    }

    await user.click(screen.getByText("Refetch"));

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result).toStrictEqualTyped({
        data: { primes: [13, 17, 19, 23, 29] },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
      expect(mergeParams).toEqual([
        [undefined, [2, 3, 5, 7, 11]],
        [undefined, [13, 17, 19, 23, 29]],
      ]);
    }
  });
});

describe("fetchMore", () => {
  it("re-suspends when calling `fetchMore` with different variables", async () => {
    const { query, link } = setupPaginatedCase();
    const cache = new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            letters: { keyArgs: false },
          },
        },
      },
    });
    const user = userEvent.setup();
    const renderStream = createDefaultProfiler<PaginatedCaseData>();
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(renderStream);

    function App() {
      useTrackRenders();
      const [queryRef, { fetchMore }] = useBackgroundQuery(query);

      return (
        <>
          <button
            onClick={() => fetchMore({ variables: { offset: 2, limit: 2 } })}
          >
            Fetch more
          </button>
          <Suspense fallback={<SuspenseFallback />}>
            <ReadQueryHook queryRef={queryRef} />
          </Suspense>
        </>
      );
    }

    using _disabledAct = disableActEnvironment();
    await renderStream.render(<App />, {
      wrapper: createMockWrapper({ cache, link }),
    });

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();
      expect(snapshot.result).toStrictEqualTyped({
        data: {
          letters: [
            { __typename: "Letter", position: 1, letter: "A" },
            { __typename: "Letter", position: 2, letter: "B" },
          ],
        },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    await user.click(screen.getByText("Fetch more"));

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();
      expect(snapshot.result).toStrictEqualTyped({
        data: {
          letters: [
            { __typename: "Letter", position: 3, letter: "C" },
            { __typename: "Letter", position: 4, letter: "D" },
          ],
        },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    await expect(renderStream).not.toRerender({ timeout: 50 });
  });

  it("properly uses `updateQuery` when calling `fetchMore`", async () => {
    const { query, link } = setupPaginatedCase();
    const user = userEvent.setup();
    const renderStream = createDefaultProfiler<PaginatedCaseData>();
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(renderStream);

    function App() {
      useTrackRenders();
      const [queryRef, { fetchMore }] = useBackgroundQuery(query);

      return (
        <>
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
            <ReadQueryHook queryRef={queryRef} />
          </Suspense>
        </>
      );
    }

    using _disabledAct = disableActEnvironment();
    await renderStream.render(<App />, {
      wrapper: createMockWrapper({ link }),
    });

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();
      expect(snapshot.result).toStrictEqualTyped({
        data: {
          letters: [
            { __typename: "Letter", position: 1, letter: "A" },
            { __typename: "Letter", position: 2, letter: "B" },
          ],
        },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    await user.click(screen.getByText("Fetch more"));

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result).toStrictEqualTyped({
        data: {
          letters: [
            { __typename: "Letter", position: 1, letter: "A" },
            { __typename: "Letter", position: 2, letter: "B" },
            { __typename: "Letter", position: 3, letter: "C" },
            { __typename: "Letter", position: 4, letter: "D" },
          ],
        },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    await expect(renderStream).not.toRerender({ timeout: 50 });
  });

  it("properly uses cache field policies when calling `fetchMore` without `updateQuery`", async () => {
    const { query, link } = setupPaginatedCase();
    const user = userEvent.setup();
    const renderStream = createDefaultProfiler<PaginatedCaseData>();
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(renderStream);

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
      const [queryRef, { fetchMore }] = useBackgroundQuery(query);

      return (
        <>
          <button
            onClick={() => fetchMore({ variables: { offset: 2, limit: 2 } })}
          >
            Fetch more
          </button>
          <Suspense fallback={<SuspenseFallback />}>
            <ReadQueryHook queryRef={queryRef} />
          </Suspense>
        </>
      );
    }

    using _disabledAct = disableActEnvironment();
    await renderStream.render(<App />, {
      wrapper: createClientWrapper(client),
    });

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();
      expect(snapshot.result).toStrictEqualTyped({
        data: {
          letters: [
            { __typename: "Letter", position: 1, letter: "A" },
            { __typename: "Letter", position: 2, letter: "B" },
          ],
        },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    await user.click(screen.getByText("Fetch more"));

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result).toStrictEqualTyped({
        data: {
          letters: [
            { __typename: "Letter", position: 1, letter: "A" },
            { __typename: "Letter", position: 2, letter: "B" },
            { __typename: "Letter", position: 3, letter: "C" },
            { __typename: "Letter", position: 4, letter: "D" },
          ],
        },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    await expect(renderStream).not.toRerender({ timeout: 50 });
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

    const user = userEvent.setup();

    const query: TypedDocumentNode<Data, Variables> = gql`
      query TodosQuery($offset: Int!) {
        todos(offset: $offset) {
          id
          name
          completed
        }
      }
    `;

    const mocks: MockLink.MockedResponse<Data, Variables>[] = [
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

    const renderStream = createRenderStream({
      initialSnapshot: {
        isPending: false,
        result: null as useReadQuery.Result<Data> | null,
      },
    });
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(renderStream);

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

    function App() {
      useTrackRenders();
      const [isPending, startTransition] = React.useTransition();
      const [queryRef, { fetchMore }] = useBackgroundQuery(query, {
        variables: { offset: 0 },
      });

      renderStream.mergeSnapshot({ isPending });

      return (
        <>
          <button
            onClick={() => {
              startTransition(() => {
                void fetchMore({ variables: { offset: 1 } });
              });
            }}
          >
            Load more
          </button>
          <Suspense fallback={<SuspenseFallback />}>
            <ReadQueryHook queryRef={queryRef} />
          </Suspense>
        </>
      );
    }

    using _disabledAct = disableActEnvironment();
    await renderStream.render(<App />, {
      wrapper: createClientWrapper(client),
    });

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot).toStrictEqualTyped({
        isPending: false,
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
          dataState: "complete",
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }

    await user.click(screen.getByText("Load more"));

    {
      // startTransition will avoid rendering the suspense fallback for already
      // revealed content if the state update inside the transition causes the
      // component to suspend.
      //
      // Here we should not see the suspense fallback while the component suspends
      // until the todo is finished loading. Seeing the suspense fallback is an
      // indication that we are suspending the component too late in the process.
      const { snapshot, renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
      expect(snapshot).toStrictEqualTyped({
        isPending: true,
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
          dataState: "complete",
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }

    {
      // Eventually we should see the updated todos content once its done
      // suspending.
      const { snapshot, renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
      expect(snapshot).toStrictEqualTyped({
        isPending: false,
        result: {
          data: {
            todos: [
              {
                __typename: "Todo",
                id: "1",
                name: "Clean room",
                completed: false,
              },
              {
                __typename: "Todo",
                id: "2",
                name: "Take out trash",
                completed: true,
              },
            ],
          },
          dataState: "complete",
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }

    await expect(renderStream).not.toRerender();
  });

  // https://github.com/apollographql/apollo-client/issues/11708
  it("`fetchMore` works with startTransition when setting errorPolicy as default option in ApolloClient constructor", async () => {
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
    const user = userEvent.setup();

    const query: TypedDocumentNode<Data, Variables> = gql`
      query TodosQuery($offset: Int!) {
        todos(offset: $offset) {
          id
          name
          completed
        }
      }
    `;

    const mocks: MockLink.MockedResponse<Data, Variables>[] = [
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

    const renderStream = createRenderStream({
      initialSnapshot: {
        isPending: false,
        result: null as useReadQuery.Result<Data> | null,
      },
    });

    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(renderStream);

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
      defaultOptions: {
        watchQuery: {
          errorPolicy: "all",
        },
      },
    });

    function App() {
      useTrackRenders();
      const [isPending, startTransition] = React.useTransition();
      const [queryRef, { fetchMore }] = useBackgroundQuery(query, {
        variables: { offset: 0 },
      });

      renderStream.mergeSnapshot({ isPending });

      return (
        <>
          <button
            onClick={() => {
              startTransition(() => {
                void fetchMore({ variables: { offset: 1 } });
              });
            }}
          >
            Load more
          </button>
          <Suspense fallback={<SuspenseFallback />}>
            <ReadQueryHook queryRef={queryRef} />
          </Suspense>
        </>
      );
    }

    using _disabledAct = disableActEnvironment();
    await renderStream.render(<App />, {
      wrapper: createClientWrapper(client),
    });

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot).toStrictEqualTyped({
        isPending: false,
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
          dataState: "complete",
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }

    await user.click(screen.getByText("Load more"));

    {
      const { snapshot, renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
      expect(snapshot).toStrictEqualTyped({
        isPending: true,
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
          dataState: "complete",
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }

    {
      const { snapshot, renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
      expect(snapshot).toStrictEqualTyped({
        isPending: false,
        result: {
          data: {
            todos: [
              {
                __typename: "Todo",
                id: "1",
                name: "Clean room",
                completed: false,
              },
              {
                __typename: "Todo",
                id: "2",
                name: "Take out trash",
                completed: true,
              },
            ],
          },
          dataState: "complete",
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }

    await expect(renderStream).not.toRerender();
  });

  it("can subscribe to subscriptions and react to cache updates via `subscribeToMore`", async () => {
    interface SubscriptionData {
      greetingUpdated: string;
    }

    type UpdateQueryFn = NonNullable<
      ObservableQuery.SubscribeToMoreOptions<
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

    const link = ApolloLink.split(
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
        result: null as useReadQuery.Result<SimpleCaseData> | null,
      },
    });

    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(renderStream);

    function App() {
      useTrackRenders();
      const [queryRef, { subscribeToMore }] = useBackgroundQuery(query);

      renderStream.mergeSnapshot({ subscribeToMore });

      return (
        <Suspense fallback={<SuspenseFallback />}>
          <ReadQueryHook queryRef={queryRef} />
        </Suspense>
      );
    }

    using _disabledAct = disableActEnvironment();
    await renderStream.render(<App />, {
      wrapper: createClientWrapper(client),
    });

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { renderedComponents, snapshot } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([ReadQueryHook]);
      expect(snapshot.result).toStrictEqualTyped({
        data: { greeting: "Hello" },
        dataState: "complete",
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
      expect(snapshot.result).toStrictEqualTyped({
        data: { greeting: "Subscription hello" },
        dataState: "complete",
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledWith(
      { greeting: "Hello" },
      {
        complete: true,
        previousData: { greeting: "Hello" },
        subscriptionData: {
          data: { greetingUpdated: "Subscription hello" },
        },
        variables: {},
      }
    );
  });
});

describe.skip("type tests", () => {
  it("returns unknown when TData cannot be inferred", () => {
    const query = gql`
      query {
        hello
      }
    `;

    const [queryRef] = useBackgroundQuery(query);
    const { data, dataState } = useReadQuery(queryRef);

    expectTypeOf(queryRef).toEqualTypeOf<
      QueryRef<unknown, OperationVariables, "complete" | "streaming">
    >;
    expectTypeOf(data).toEqualTypeOf<unknown>();
    expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();
  });

  it("disallows wider variables type than specified", () => {
    const { query } = setupVariablesCase();

    useBackgroundQuery(query, {
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  });

  it("returns TData in default case", () => {
    const { query } = setupVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(query, { variables: { id: "1" } });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        VariablesCaseData | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, { variables: { id: "1" } });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        VariablesCaseData | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }
    }

    const { query: maskedQuery } = setupMaskedVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(maskedQuery, {
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, { variables: { id: "1" } });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, { variables: { id: "1" } });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }
    }
  });

  it('returns TData | undefined with errorPolicy: "ignore"', () => {
    const { query } = setupVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(query, {
        errorPolicy: "ignore",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "empty"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        VariablesCaseData | undefined | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "empty"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }

      if (dataState === "empty") {
        expectTypeOf(data).toEqualTypeOf<undefined>();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, { errorPolicy: "ignore", variables: { id: "1" } });

      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "empty"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        VariablesCaseData | undefined | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "empty"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }

      if (dataState === "empty") {
        expectTypeOf(data).toEqualTypeOf<undefined>();
      }
    }

    const { query: maskedQuery } = setupMaskedVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(maskedQuery, {
        errorPolicy: "ignore",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "empty"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | MaskedVariablesCaseData
        | undefined
        | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "empty"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }

      if (dataState === "empty") {
        expectTypeOf(data).toEqualTypeOf<undefined>();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, { errorPolicy: "ignore", variables: { id: "1" } });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "empty"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | MaskedVariablesCaseData
        | undefined
        | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "empty"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }

      if (dataState === "empty") {
        expectTypeOf(data).toEqualTypeOf<undefined>();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, { errorPolicy: "ignore", variables: { id: "1" } });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "empty"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | MaskedVariablesCaseData
        | undefined
        | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "empty"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }

      if (dataState === "empty") {
        expectTypeOf(data).toEqualTypeOf<undefined>();
      }
    }
  });

  it('returns TData | undefined with errorPolicy: "all"', () => {
    const { query } = setupVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(query, {
        errorPolicy: "all",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "empty"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        VariablesCaseData | undefined | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "empty"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }

      if (dataState === "empty") {
        expectTypeOf(data).toEqualTypeOf<undefined>();
      }
    }

    {
      const [queryRef] = useBackgroundQuery(query, {
        errorPolicy: "all",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "empty"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        VariablesCaseData | undefined | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "empty"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }

      if (dataState === "empty") {
        expectTypeOf(data).toEqualTypeOf<undefined>();
      }
    }

    const { query: maskedQuery } = setupMaskedVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(maskedQuery, {
        errorPolicy: "all",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "empty"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | MaskedVariablesCaseData
        | undefined
        | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "empty"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }

      if (dataState === "empty") {
        expectTypeOf(data).toEqualTypeOf<undefined>();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, { errorPolicy: "all", variables: { id: "1" } });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "empty"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | MaskedVariablesCaseData
        | undefined
        | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "empty"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }

      if (dataState === "empty") {
        expectTypeOf(data).toEqualTypeOf<undefined>();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, { errorPolicy: "all", variables: { id: "1" } });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "empty"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | MaskedVariablesCaseData
        | undefined
        | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "empty"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }

      if (dataState === "empty") {
        expectTypeOf(data).toEqualTypeOf<undefined>();
      }
    }
  });

  it('returns TData with errorPolicy: "none"', () => {
    const { query } = setupVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(query, {
        errorPolicy: "none",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        VariablesCaseData | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }
    }

    {
      const [queryRef] = useBackgroundQuery(query, {
        errorPolicy: "none",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        VariablesCaseData | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }
    }

    const { query: maskedQuery } = setupMaskedVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(maskedQuery, {
        errorPolicy: "none",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, { errorPolicy: "none", variables: { id: "1" } });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, { errorPolicy: "none", variables: { id: "1" } });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }
    }
  });

  it("returns DeepPartial<TData> with returnPartialData: true", () => {
    const { query } = setupVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(query, {
        returnPartialData: true,
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "partial"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | VariablesCaseData
        | DeepPartial<VariablesCaseData>
        | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "partial"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }

      if (dataState === "partial") {
        expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, { returnPartialData: true, variables: { id: "1" } });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "partial"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | VariablesCaseData
        | DeepPartial<VariablesCaseData>
        | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "partial"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }

      if (dataState === "partial") {
        expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
      }
    }

    const { query: maskedQuery } = setupMaskedVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(maskedQuery, {
        returnPartialData: true,
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "partial"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | MaskedVariablesCaseData
        | DeepPartial<MaskedVariablesCaseData>
        | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "partial"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }

      if (dataState === "partial") {
        expectTypeOf(data).toEqualTypeOf<
          DeepPartial<MaskedVariablesCaseData>
        >();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, { returnPartialData: true, variables: { id: "1" } });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "partial"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | MaskedVariablesCaseData
        | DeepPartial<MaskedVariablesCaseData>
        | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "partial"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }

      if (dataState === "partial") {
        expectTypeOf(data).toEqualTypeOf<
          DeepPartial<MaskedVariablesCaseData>
        >();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, { returnPartialData: true, variables: { id: "1" } });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "partial"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | MaskedVariablesCaseData
        | DeepPartial<MaskedVariablesCaseData>
        | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "partial"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }

      if (dataState === "partial") {
        expectTypeOf(data).toEqualTypeOf<
          DeepPartial<MaskedVariablesCaseData>
        >();
      }
    }
  });

  it("returns TData with returnPartialData: false", () => {
    const { query } = setupVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(query, {
        returnPartialData: false,
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        VariablesCaseData | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, { returnPartialData: false, variables: { id: "1" } });

      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        VariablesCaseData | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }
    }

    const { query: maskedQuery } = setupMaskedVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(maskedQuery, {
        returnPartialData: false,
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, { returnPartialData: false, variables: { id: "1" } });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, { returnPartialData: false, variables: { id: "1" } });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }
    }
  });

  it("returns DeepPartial<TData> with returnPartialData: boolean", () => {
    const { query } = setupVariablesCase();

    const options = {
      returnPartialData: true,
      variables: { id: "1" },
    };

    {
      const [queryRef] = useBackgroundQuery(query, options);
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "partial"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | VariablesCaseData
        | DeepPartial<VariablesCaseData>
        | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "partial"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }

      if (dataState === "partial") {
        expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, options);

      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "partial"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | VariablesCaseData
        | DeepPartial<VariablesCaseData>
        | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "partial"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }

      if (dataState === "partial") {
        expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
      }
    }
  });

  it("returns TData with returnPartialData: true and fetchPolicy: no-cache", () => {
    const { query } = setupVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(query, {
        returnPartialData: true,
        fetchPolicy: "no-cache",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        VariablesCaseData | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, {
        returnPartialData: true,
        fetchPolicy: "no-cache",
        variables: { id: "1" },
      });

      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        VariablesCaseData | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }
    }
  });

  it("returns TData when passing an option that does not affect TData", () => {
    const { query } = setupVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(query, {
        fetchPolicy: "no-cache",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        VariablesCaseData | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, { fetchPolicy: "no-cache", variables: { id: "1" } });

      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        VariablesCaseData | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }
    }

    const { query: maskedQuery } = setupMaskedVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(maskedQuery, {
        fetchPolicy: "no-cache",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, { fetchPolicy: "no-cache", variables: { id: "1" } });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, { fetchPolicy: "no-cache", variables: { id: "1" } });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }
    }
  });

  it("handles combinations of options", () => {
    const { query } = setupVariablesCase();
    const { query: maskedQuery } = setupMaskedVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(query, {
        returnPartialData: true,
        errorPolicy: "ignore",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "partial" | "empty"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | VariablesCaseData
        | DeepPartial<VariablesCaseData>
        | undefined
        | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "partial" | "empty"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }

      if (dataState === "partial") {
        expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
      }

      if (dataState === "empty") {
        expectTypeOf(data).toEqualTypeOf<undefined>();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, {
        returnPartialData: true,
        errorPolicy: "ignore",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "partial" | "empty"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | VariablesCaseData
        | DeepPartial<VariablesCaseData>
        | DataValue.Streaming<VariablesCaseData>
        | undefined
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "partial" | "empty"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }

      if (dataState === "partial") {
        expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
      }

      if (dataState === "empty") {
        expectTypeOf(data).toEqualTypeOf<undefined>();
      }
    }

    {
      const [queryRef] = useBackgroundQuery(maskedQuery, {
        returnPartialData: true,
        errorPolicy: "ignore",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "partial" | "empty"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | MaskedVariablesCaseData
        | DeepPartial<MaskedVariablesCaseData>
        | DataValue.Streaming<MaskedVariablesCaseData>
        | undefined
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "partial" | "empty"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }

      if (dataState === "partial") {
        expectTypeOf(data).toEqualTypeOf<
          DeepPartial<MaskedVariablesCaseData>
        >();
      }

      if (dataState === "empty") {
        expectTypeOf(data).toEqualTypeOf<undefined>();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, {
        returnPartialData: true,
        errorPolicy: "ignore",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "partial" | "empty"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | MaskedVariablesCaseData
        | DeepPartial<MaskedVariablesCaseData>
        | DataValue.Streaming<MaskedVariablesCaseData>
        | undefined
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "partial" | "empty"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }

      if (dataState === "partial") {
        expectTypeOf(data).toEqualTypeOf<
          DeepPartial<MaskedVariablesCaseData>
        >();
      }

      if (dataState === "empty") {
        expectTypeOf(data).toEqualTypeOf<undefined>();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, {
        returnPartialData: true,
        errorPolicy: "ignore",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "partial" | "empty"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | MaskedVariablesCaseData
        | DeepPartial<MaskedVariablesCaseData>
        | DataValue.Streaming<MaskedVariablesCaseData>
        | undefined
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "partial" | "empty"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }

      if (dataState === "partial") {
        expectTypeOf(data).toEqualTypeOf<
          DeepPartial<MaskedVariablesCaseData>
        >();
      }

      if (dataState === "empty") {
        expectTypeOf(data).toEqualTypeOf<undefined>();
      }
    }

    {
      const [queryRef] = useBackgroundQuery(query, {
        returnPartialData: true,
        errorPolicy: "none",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "partial"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | VariablesCaseData
        | DeepPartial<VariablesCaseData>
        | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "partial"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }

      if (dataState === "partial") {
        expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, {
        returnPartialData: true,
        errorPolicy: "none",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "partial"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | VariablesCaseData
        | DeepPartial<VariablesCaseData>
        | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "partial"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }

      if (dataState === "partial") {
        expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
      }
    }

    {
      const [queryRef] = useBackgroundQuery(maskedQuery, {
        returnPartialData: true,
        errorPolicy: "none",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "partial"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | MaskedVariablesCaseData
        | DeepPartial<MaskedVariablesCaseData>
        | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "partial"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }

      if (dataState === "partial") {
        expectTypeOf(data).toEqualTypeOf<
          DeepPartial<MaskedVariablesCaseData>
        >();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, {
        returnPartialData: true,
        errorPolicy: "none",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "partial"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | MaskedVariablesCaseData
        | DeepPartial<MaskedVariablesCaseData>
        | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "partial"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }

      if (dataState === "partial") {
        expectTypeOf(data).toEqualTypeOf<
          DeepPartial<MaskedVariablesCaseData>
        >();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, {
        returnPartialData: true,
        errorPolicy: "none",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming" | "partial"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        | MaskedVariablesCaseData
        | DeepPartial<MaskedVariablesCaseData>
        | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<
        "complete" | "streaming" | "partial"
      >();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }

      if (dataState === "partial") {
        expectTypeOf(data).toEqualTypeOf<
          DeepPartial<MaskedVariablesCaseData>
        >();
      }
    }
  });

  it("returns correct TData type when combined options that do not affect TData", () => {
    const { query } = setupVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(query, {
        fetchPolicy: "no-cache",
        returnPartialData: true,
        errorPolicy: "none",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        VariablesCaseData | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, {
        fetchPolicy: "no-cache",
        returnPartialData: true,
        errorPolicy: "none",
        variables: { id: "1" },
      });

      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          VariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        VariablesCaseData | DataValue.Streaming<VariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<VariablesCaseData>
        >();
      }
    }

    const { query: maskedQuery } = setupMaskedVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(maskedQuery, {
        fetchPolicy: "no-cache",
        returnPartialData: true,
        errorPolicy: "none",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, {
        fetchPolicy: "no-cache",
        returnPartialData: true,
        errorPolicy: "none",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, {
        fetchPolicy: "no-cache",
        returnPartialData: true,
        errorPolicy: "none",
        variables: { id: "1" },
      });
      const { data, dataState } = useReadQuery(queryRef);

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryRef<
          MaskedVariablesCaseData,
          VariablesCaseVariables,
          "complete" | "streaming"
        >
      >;
      expectTypeOf(data).toEqualTypeOf<
        MaskedVariablesCaseData | DataValue.Streaming<MaskedVariablesCaseData>
      >();
      expectTypeOf(dataState).toEqualTypeOf<"complete" | "streaming">();

      if (dataState === "complete") {
        expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData>();
      }

      if (dataState === "streaming") {
        expectTypeOf(data).toEqualTypeOf<
          DataValue.Streaming<MaskedVariablesCaseData>
        >();
      }
    }
  });

  it("returns QueryRef<TData> | undefined when `skip` is present", () => {
    const { query } = setupVariablesCase();
    const { query: maskedQuery } = setupMaskedVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(query, {
        skip: true,
        variables: { id: "1" },
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        | QueryRef<
            VariablesCaseData,
            VariablesCaseVariables,
            "complete" | "streaming"
          >
        | undefined
      >;
    }

    {
      const [queryRef] = useBackgroundQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, { skip: true, variables: { id: "1" } });

      expectTypeOf(queryRef).toEqualTypeOf<
        | QueryRef<
            VariablesCaseData,
            VariablesCaseVariables,
            "complete" | "streaming"
          >
        | undefined
      >();
    }

    {
      const [queryRef] = useBackgroundQuery(maskedQuery, {
        skip: true,
        variables: { id: "1" },
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        | QueryRef<
            MaskedVariablesCaseData,
            VariablesCaseVariables,
            "complete" | "streaming"
          >
        | undefined
      >();
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, { skip: true, variables: { id: "1" } });

      expectTypeOf(queryRef).toEqualTypeOf<
        | QueryRef<
            MaskedVariablesCaseData,
            VariablesCaseVariables,
            "complete" | "streaming"
          >
        | undefined
      >();
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, { skip: true, variables: { id: "1" } });

      expectTypeOf(queryRef).toEqualTypeOf<
        | QueryRef<
            MaskedVariablesCaseData,
            VariablesCaseVariables,
            "complete" | "streaming"
          >
        | undefined
      >();
    }

    // TypeScript is too smart and using a `const` or `let` boolean variable
    // for the `skip` option results in a false positive. Using an options
    // object allows us to properly check for a dynamic case.
    const options = {
      skip: true,
    };

    {
      const [queryRef] = useBackgroundQuery(query, {
        skip: options.skip,
        variables: { id: "1" },
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        | QueryRef<
            VariablesCaseData,
            VariablesCaseVariables,
            "complete" | "streaming"
          >
        | undefined
      >();
    }

    {
      const [queryRef] = useBackgroundQuery(maskedQuery, {
        skip: options.skip,
        variables: { id: "1" },
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        | QueryRef<
            MaskedVariablesCaseData,
            VariablesCaseVariables,
            "complete" | "streaming"
          >
        | undefined
      >();
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, { skip: options.skip, variables: { id: "1" } });

      expectTypeOf(queryRef).toEqualTypeOf<
        | QueryRef<
            MaskedVariablesCaseData,
            VariablesCaseVariables,
            "complete" | "streaming"
          >
        | undefined
      >();
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, { skip: options.skip, variables: { id: "1" } });

      expectTypeOf(queryRef).toEqualTypeOf<
        | QueryRef<
            MaskedVariablesCaseData,
            VariablesCaseVariables,
            "complete" | "streaming"
          >
        | undefined
      >();
    }
  });

  it("returns `undefined` when using `skipToken` unconditionally", () => {
    const { query } = setupVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(query, skipToken);

      expectTypeOf(queryRef).toEqualTypeOf<undefined>();
    }

    {
      const [queryRef] = useBackgroundQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, skipToken);

      expectTypeOf(queryRef).toEqualTypeOf<undefined>();
    }

    const { query: maskedQuery } = setupMaskedVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(maskedQuery, skipToken);

      expectTypeOf(queryRef).toEqualTypeOf<undefined>();
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, skipToken);

      expectTypeOf(queryRef).toEqualTypeOf<undefined>();
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, skipToken);

      expectTypeOf(queryRef).toEqualTypeOf<undefined>();
    }
  });

  it("returns QueryRef<TData> | undefined when using conditional `skipToken`", () => {
    const { query } = setupVariablesCase();
    const options = {
      skip: true,
    };

    {
      const [queryRef] = useBackgroundQuery(
        query,
        options.skip ? skipToken : { variables: { id: "1" } }
      );

      expectTypeOf(queryRef).toEqualTypeOf<
        | QueryRef<
            VariablesCaseData,
            VariablesCaseVariables,
            "complete" | "streaming"
          >
        | undefined
      >();
    }

    {
      const [queryRef] = useBackgroundQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, options.skip ? skipToken : { variables: { id: "1" } });

      expectTypeOf(queryRef).toEqualTypeOf<
        | QueryRef<
            VariablesCaseData,
            VariablesCaseVariables,
            "complete" | "streaming"
          >
        | undefined
      >();
    }

    const { query: maskedQuery } = setupMaskedVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(
        maskedQuery,
        options.skip ? skipToken : { variables: { id: "1" } }
      );

      expectTypeOf(queryRef).toEqualTypeOf<
        | QueryRef<
            MaskedVariablesCaseData,
            VariablesCaseVariables,
            "complete" | "streaming"
          >
        | undefined
      >();
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, options.skip ? skipToken : { variables: { id: "1" } });

      expectTypeOf(queryRef).toEqualTypeOf<
        | QueryRef<
            MaskedVariablesCaseData,
            VariablesCaseVariables,
            "complete" | "streaming"
          >
        | undefined
      >();
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(maskedQuery, options.skip ? skipToken : { variables: { id: "1" } });

      expectTypeOf(queryRef).toEqualTypeOf<
        | QueryRef<
            MaskedVariablesCaseData,
            VariablesCaseVariables,
            "complete" | "streaming"
          >
        | undefined
      >();
    }
  });

  it("returns QueryRef<DeepPartial<TData>> | undefined when using `skipToken` with `returnPartialData`", () => {
    const { query } = setupVariablesCase();
    const options = {
      skip: true,
    };

    {
      const [queryRef] = useBackgroundQuery(
        query,
        options.skip ? skipToken : (
          { returnPartialData: true, variables: { id: "1" } }
        )
      );

      expectTypeOf(queryRef).toEqualTypeOf<
        | QueryRef<
            VariablesCaseData,
            VariablesCaseVariables,
            "complete" | "streaming" | "partial"
          >
        | undefined
      >();
    }

    {
      const [queryRef] = useBackgroundQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(
        query,
        options.skip ? skipToken : (
          { returnPartialData: true, variables: { id: "1" } }
        )
      );

      expectTypeOf(queryRef).toEqualTypeOf<
        | QueryRef<
            VariablesCaseData,
            VariablesCaseVariables,
            "complete" | "streaming" | "partial"
          >
        | undefined
      >();
    }

    const { query: maskedQuery } = setupMaskedVariablesCase();

    {
      const [queryRef] = useBackgroundQuery(
        maskedQuery,
        options.skip ? skipToken : (
          { returnPartialData: true, variables: { id: "1" } }
        )
      );

      expectTypeOf(queryRef).toEqualTypeOf<
        | QueryRef<
            MaskedVariablesCaseData,
            VariablesCaseVariables,
            "complete" | "streaming" | "partial"
          >
        | undefined
      >();
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(
        maskedQuery,
        options.skip ? skipToken : (
          { returnPartialData: true, variables: { id: "1" } }
        )
      );

      expectTypeOf(queryRef).toEqualTypeOf<
        | QueryRef<
            MaskedVariablesCaseData,
            VariablesCaseVariables,
            "complete" | "streaming" | "partial"
          >
        | undefined
      >();
    }

    {
      const [queryRef] = useBackgroundQuery<
        MaskedVariablesCaseData,
        VariablesCaseVariables
      >(
        maskedQuery,
        options.skip ? skipToken : (
          { returnPartialData: true, variables: { id: "1" } }
        )
      );

      expectTypeOf(queryRef).toEqualTypeOf<
        | QueryRef<
            MaskedVariablesCaseData,
            VariablesCaseVariables,
            "complete" | "streaming" | "partial"
          >
        | undefined
      >();
    }
  });

  it("uses proper masked types for refetch", async () => {
    const { query, unmaskedQuery } = setupMaskedVariablesCase();

    {
      const [, { refetch }] = useBackgroundQuery(query, {
        variables: { id: "1" },
      });
      const { data } = await refetch();

      expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData | undefined>();
    }

    {
      const [, { refetch }] = useBackgroundQuery(unmaskedQuery, {
        variables: { id: "1" },
      });
      const { data } = await refetch();

      expectTypeOf(data).toEqualTypeOf<UnmaskedVariablesCaseData | undefined>();
    }
  });

  it("uses proper masked types for fetchMore", async () => {
    const { query, unmaskedQuery } = setupMaskedVariablesCase();

    {
      const [, { fetchMore }] = useBackgroundQuery(query, {
        variables: { id: "1" },
      });

      const { data } = await fetchMore({
        updateQuery: (queryData, { fetchMoreResult }) => {
          expectTypeOf(queryData).toEqualTypeOf<UnmaskedVariablesCaseData>();

          expectTypeOf(
            fetchMoreResult
          ).toEqualTypeOf<UnmaskedVariablesCaseData>();

          return {} as UnmaskedVariablesCaseData;
        },
      });

      expectTypeOf(data).toEqualTypeOf<MaskedVariablesCaseData | undefined>();
    }

    {
      const [, { fetchMore }] = useBackgroundQuery(unmaskedQuery, {
        variables: { id: "1" },
      });

      const { data } = await fetchMore({
        updateQuery: (queryData, { fetchMoreResult }) => {
          expectTypeOf(queryData).toEqualTypeOf<UnmaskedVariablesCaseData>();
          expectTypeOf(queryData).not.toEqualTypeOf<MaskedVariablesCaseData>();

          expectTypeOf(
            fetchMoreResult
          ).toEqualTypeOf<UnmaskedVariablesCaseData>();
          expectTypeOf(
            fetchMoreResult
          ).not.toEqualTypeOf<MaskedVariablesCaseData>();

          return {} as UnmaskedVariablesCaseData;
        },
      });

      expectTypeOf(data).toEqualTypeOf<UnmaskedVariablesCaseData | undefined>();
    }
  });

  it("uses proper masked types for subscribeToMore", async () => {
    type CharacterFragment = {
      __typename: "Character";
      name: string;
    } & { " $fragmentName": "CharacterFragment" };

    type Subscription = {
      pushLetter: {
        __typename: "Character";
        id: number;
      } & { " $fragmentRefs": { CharacterFragment: CharacterFragment } };
    };

    type UnmaskedSubscription = {
      pushLetter: {
        __typename: "Character";
        id: number;
        name: string;
      };
    };

    const { query, unmaskedQuery } = setupMaskedVariablesCase();

    {
      const [, { subscribeToMore }] = useBackgroundQuery(query, {
        variables: { id: "1" },
      });

      const subscription: TypedDocumentNode<
        Subscription,
        { letterId: string }
      > = gql`
        subscription LetterPushed($letterId: ID!) {
          pushLetter(letterId: $letterId) {
            id
            ...CharacterFragment
          }
        }

        fragment CharacterFragment on Character {
          name
        }
      `;

      subscribeToMore({
        document: subscription,
        updateQuery: (
          queryData,
          { subscriptionData, variables, complete, previousData }
        ) => {
          expectTypeOf(queryData).toEqualTypeOf<
            DeepPartial<UnmaskedVariablesCaseData>
          >();
          expectTypeOf(queryData).not.toEqualTypeOf<MaskedVariablesCaseData>();
          expectTypeOf(previousData).toEqualTypeOf<
            | UnmaskedVariablesCaseData
            | DeepPartial<UnmaskedVariablesCaseData>
            | undefined
          >();

          if (complete) {
            // Should narrow the type
            expectTypeOf(
              previousData
            ).toEqualTypeOf<UnmaskedVariablesCaseData>();
            expectTypeOf(
              previousData
            ).not.toEqualTypeOf<MaskedVariablesCaseData>();
          } else {
            expectTypeOf(previousData).toEqualTypeOf<
              DeepPartial<UnmaskedVariablesCaseData> | undefined
            >();
          }

          expectTypeOf(
            subscriptionData.data
          ).toEqualTypeOf<UnmaskedSubscription>();
          expectTypeOf(subscriptionData.data).not.toEqualTypeOf<Subscription>();

          expectTypeOf(variables).toEqualTypeOf<
            VariablesCaseVariables | undefined
          >();

          return {} as UnmaskedVariablesCaseData;
        },
      });
    }

    {
      const [, { subscribeToMore }] = useBackgroundQuery(unmaskedQuery, {
        variables: { id: "1" },
      });

      const subscription: TypedDocumentNode<Subscription, never> = gql`
        subscription {
          pushLetter {
            id
            ...CharacterFragment
          }
        }

        fragment CharacterFragment on Character {
          name
        }
      `;

      subscribeToMore({
        document: subscription,
        updateQuery: (
          queryData,
          { subscriptionData, variables, complete, previousData }
        ) => {
          expectTypeOf(queryData).toEqualTypeOf<
            DeepPartial<UnmaskedVariablesCaseData>
          >();
          expectTypeOf(queryData).not.toEqualTypeOf<MaskedVariablesCaseData>();

          expectTypeOf(previousData).toEqualTypeOf<
            | UnmaskedVariablesCaseData
            | DeepPartial<UnmaskedVariablesCaseData>
            | undefined
          >();

          if (complete) {
            // Should narrow the type
            expectTypeOf(
              previousData
            ).toEqualTypeOf<UnmaskedVariablesCaseData>();
            expectTypeOf(
              previousData
            ).not.toEqualTypeOf<MaskedVariablesCaseData>();
          } else {
            expectTypeOf(previousData).toEqualTypeOf<
              DeepPartial<UnmaskedVariablesCaseData> | undefined
            >();
          }

          expectTypeOf(
            subscriptionData.data
          ).toEqualTypeOf<UnmaskedSubscription>();
          expectTypeOf(subscriptionData.data).not.toEqualTypeOf<Subscription>();

          expectTypeOf(variables).toEqualTypeOf<
            VariablesCaseVariables | undefined
          >();

          return queryData as UnmaskedVariablesCaseData;
        },
      });
    }
  });

  test("variables are optional and can be anything with an DocumentNode", () => {
    const query = gql``;

    useBackgroundQuery(query);
    useBackgroundQuery(query, {});
    useBackgroundQuery(query, { variables: {} });
    useBackgroundQuery(query, { variables: { foo: "bar" } });
    useBackgroundQuery(query, { variables: { bar: "baz" } });

    let skip!: boolean;
    useBackgroundQuery(query, skip ? skipToken : undefined);
    useBackgroundQuery(query, skip ? skipToken : {});
    useBackgroundQuery(query, skip ? skipToken : { variables: {} });
    useBackgroundQuery(query, skip ? skipToken : { variables: { foo: "bar" } });
    useBackgroundQuery(query, skip ? skipToken : { variables: { bar: "baz" } });
  });

  test("variables are optional and can be anything with unspecified TVariables on a TypedDocumentNode", () => {
    const query: TypedDocumentNode<{ greeting: string }> = gql``;

    useBackgroundQuery(query);
    useBackgroundQuery(query, {});
    useBackgroundQuery(query, { variables: {} });
    useBackgroundQuery(query, { variables: { foo: "bar" } });
    useBackgroundQuery(query, { variables: { bar: "baz" } });

    let skip!: boolean;
    useBackgroundQuery(query, skip ? skipToken : undefined);
    useBackgroundQuery(query, skip ? skipToken : {});
    useBackgroundQuery(query, skip ? skipToken : { variables: {} });
    useBackgroundQuery(query, skip ? skipToken : { variables: { foo: "bar" } });
    useBackgroundQuery(query, skip ? skipToken : { variables: { bar: "baz" } });
  });

  test("variables are optional when TVariables are empty", () => {
    const query: TypedDocumentNode<
      { greeting: string },
      Record<string, never>
    > = gql``;

    useBackgroundQuery(query);
    useBackgroundQuery(query, {});
    useBackgroundQuery(query, { variables: {} });
    useBackgroundQuery(query, {
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });

    let skip!: boolean;
    useBackgroundQuery(query, skip ? skipToken : undefined);
    useBackgroundQuery(query, skip ? skipToken : {});
    useBackgroundQuery(query, skip ? skipToken : { variables: {} });
    useBackgroundQuery(
      query,
      // @ts-expect-error unknown variables
      skip ? skipToken : { variables: { foo: "bar" } }
    );
  });

  test("is invalid when TVariables is `never`", () => {
    const query: TypedDocumentNode<{ greeting: string }, never> = gql``;

    // @ts-expect-error
    useBackgroundQuery(query);
    // @ts-expect-error
    useBackgroundQuery(query, {});
    useBackgroundQuery(query, {
      // @ts-expect-error
      variables: {},
    });
    useBackgroundQuery(query, {
      // @ts-expect-error
      variables: undefined,
    });
    useBackgroundQuery(query, {
      // @ts-expect-error
      variables: {
        foo: "bar",
      },
    });

    let skip!: boolean;
    // @ts-expect-error
    useBackgroundQuery(query, skip ? skipToken : undefined);
    useBackgroundQuery(
      query,
      // @ts-expect-error
      skip ? skipToken : {}
    );
    useBackgroundQuery(
      query,
      // @ts-expect-error
      skip ? skipToken : { variables: {} }
    );
    useBackgroundQuery(
      query,
      // @ts-expect-error
      skip ? skipToken : { variables: undefined }
    );
    useBackgroundQuery(
      query,
      // @ts-expect-error unknown variables
      skip ? skipToken : { variables: { foo: "bar" } }
    );
  });

  test("optional variables are optional", () => {
    const query: TypedDocumentNode<{ posts: string[] }, { limit?: number }> =
      gql``;

    useBackgroundQuery(query);
    useBackgroundQuery(query, {});
    useBackgroundQuery(query, { variables: {} });
    useBackgroundQuery(query, { variables: { limit: 10 } });
    useBackgroundQuery(query, {
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    useBackgroundQuery(query, {
      variables: {
        limit: 10,
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });

    let skip!: boolean;
    useBackgroundQuery(query, skip ? skipToken : undefined);
    useBackgroundQuery(query, skip ? skipToken : {});
    useBackgroundQuery(query, skip ? skipToken : { variables: {} });
    useBackgroundQuery(query, skip ? skipToken : { variables: { limit: 10 } });
    useBackgroundQuery(
      query,
      skip ? skipToken : (
        {
          variables: {
            // @ts-expect-error unknown variables
            foo: "bar",
          },
        }
      )
    );
    useBackgroundQuery(
      query,
      skip ? skipToken : (
        {
          variables: {
            limit: 10,
            // @ts-expect-error unknown variables
            foo: "bar",
          },
        }
      )
    );
  });

  test("enforces required variables when TVariables includes required variables", () => {
    const query: TypedDocumentNode<{ character: string }, { id: string }> =
      gql``;

    // @ts-expect-error empty variables
    useBackgroundQuery(query);
    // @ts-expect-error empty variables
    useBackgroundQuery(query, {});
    // @ts-expect-error empty variables
    useBackgroundQuery(query, { variables: {} });
    useBackgroundQuery(query, { variables: { id: "1" } });
    useBackgroundQuery(query, {
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    useBackgroundQuery(query, {
      variables: {
        id: "1",
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });

    let skip!: boolean;
    // @ts-expect-error missing variables option
    useBackgroundQuery(query, skip ? skipToken : undefined);
    useBackgroundQuery(
      query,
      // @ts-expect-error missing variables option
      skip ? skipToken : {}
    );
    useBackgroundQuery(
      query,
      // @ts-expect-error missing required variables
      skip ? skipToken : { variables: {} }
    );
    useBackgroundQuery(query, skip ? skipToken : { variables: { id: "1" } });
    useBackgroundQuery(
      query,
      skip ? skipToken : (
        {
          variables: {
            // @ts-expect-error unknown variables
            foo: "bar",
          },
        }
      )
    );
    useBackgroundQuery(
      query,
      skip ? skipToken : (
        {
          variables: {
            id: "1",
            // @ts-expect-error unknown variables
            foo: "bar",
          },
        }
      )
    );
  });

  test("requires variables with mixed TVariables", () => {
    const query: TypedDocumentNode<
      { character: string },
      { id: string; language?: string }
    > = gql``;

    // @ts-expect-error empty variables
    useBackgroundQuery(query);
    // @ts-expect-error empty variables
    useBackgroundQuery(query, {});
    // @ts-expect-error empty variables
    useBackgroundQuery(query, { variables: {} });
    useBackgroundQuery(query, { variables: { id: "1" } });
    useBackgroundQuery(query, {
      // @ts-expect-error missing required variables
      variables: { language: "en" },
    });
    useBackgroundQuery(query, { variables: { id: "1", language: "en" } });
    useBackgroundQuery(query, {
      variables: {
        id: "1",
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    useBackgroundQuery(query, {
      variables: {
        id: "1",
        language: "en",
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });

    let skip!: boolean;
    // @ts-expect-error missing variables option
    useBackgroundQuery(query, skip ? skipToken : undefined);
    useBackgroundQuery(
      query,
      // @ts-expect-error missing variables option
      skip ? skipToken : {}
    );
    useBackgroundQuery(
      query,
      // @ts-expect-error missing required variables
      skip ? skipToken : { variables: {} }
    );
    useBackgroundQuery(query, skip ? skipToken : { variables: { id: "1" } });
    useBackgroundQuery(
      query,
      skip ? skipToken : { variables: { id: "1", language: "en" } }
    );
    useBackgroundQuery(
      query,
      skip ? skipToken : (
        {
          variables: {
            id: "1",
            // @ts-expect-error unknown variables
            foo: "bar",
          },
        }
      )
    );
    useBackgroundQuery(
      query,
      skip ? skipToken : (
        {
          variables: {
            id: "1",
            language: "en",
            // @ts-expect-error unknown variables
            foo: "bar",
          },
        }
      )
    );
  });
});
