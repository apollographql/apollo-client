import React, { Suspense } from "react";
import { createQueryPreloader } from "../createQueryPreloader";
import {
  ApolloClient,
  ApolloError,
  ApolloLink,
  InMemoryCache,
  NetworkStatus,
  OperationVariables,
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
import { PreloadedQueryRef, QueryRef, unwrapQueryRef } from "../../internal";
import { DeepPartial, Observable } from "../../../utilities";
import {
  createClientWrapper,
  SimpleCaseData,
  spyOnConsole,
  setupSimpleCase,
  setupVariablesCase,
  VariablesCaseData,
} from "../../../testing/internal";
import { ApolloProvider } from "../../context";
import { act, renderHook, screen } from "@testing-library/react";
import { UseReadQueryResult, useReadQuery } from "../../hooks";
import { GraphQLError } from "graphql";
import { ErrorBoundary } from "react-error-boundary";
import userEvent from "@testing-library/user-event";
import {
  createRenderStream,
  useTrackRenders,
} from "@testing-library/react-render-stream";

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
  queryRef: QueryRef<TData>;
}) {
  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as UseReadQueryResult<TData> | null,
      error: null as Error | null,
    },
  });

  function ReadQueryHook() {
    useTrackRenders({ name: "ReadQueryHook" });
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function SuspenseFallback() {
    useTrackRenders({ name: "SuspenseFallback" });
    return <p>Loading</p>;
  }

  function ErrorFallback({ error }: { error: Error }) {
    useTrackRenders({ name: "ErrorFallback" });
    renderStream.mergeSnapshot({ error });

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

  const utils = renderStream.render(<App />, {
    wrapper: ({ children }) => (
      <ApolloProvider client={client}>{children}</ApolloProvider>
    ),
  });

  function rerender() {
    return utils.rerender(<App />);
  }

  return { ...utils, rerender, renderStream };
}

test("loads a query and suspends when passed to useReadQuery", async () => {
  const { query, mocks } = setupSimpleCase();
  const client = createDefaultClient(mocks);
  const preloadQuery = createQueryPreloader(client);

  const queryRef = preloadQuery(query);

  const { renderStream } = renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "SuspenseFallback"]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

test("loads a query with variables and suspends when passed to useReadQuery", async () => {
  const { query, mocks } = setupVariablesCase();
  const client = createDefaultClient(mocks);
  const preloadQuery = createQueryPreloader(client);

  const queryRef = preloadQuery(query, {
    variables: { id: "1" },
  });

  const { renderStream } = renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "SuspenseFallback"]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

test("Auto disposes of the query ref if not retained within the given time", async () => {
  jest.useFakeTimers();
  const { query, mocks } = setupSimpleCase();
  const client = createDefaultClient(mocks);
  const preloadQuery = createQueryPreloader(client);

  const queryRef = preloadQuery(query);

  // We don't start the dispose timer until the promise is initially resolved
  // so we need to wait for it
  jest.advanceTimersByTime(20);
  await queryRef.toPromise();
  jest.advanceTimersByTime(30_000);

  expect(queryRef).toBeDisposed();
  expect(client.getObservableQueries().size).toBe(0);
  expect(client).not.toHaveSuspenseCacheEntryUsing(query);

  jest.useRealTimers();
});

test("Honors configured auto dispose timer on the client", async () => {
  jest.useFakeTimers();
  const { query, mocks } = setupSimpleCase();
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
    defaultOptions: {
      react: {
        suspense: {
          autoDisposeTimeoutMs: 5000,
        },
      },
    },
  });

  const preloadQuery = createQueryPreloader(client);

  const queryRef = preloadQuery(query);

  // We don't start the dispose timer until the promise is initially resolved
  // so we need to wait for it
  jest.advanceTimersByTime(20);
  await queryRef.toPromise();
  jest.advanceTimersByTime(5_000);

  expect(queryRef).toBeDisposed();
  expect(client.getObservableQueries().size).toBe(0);
  expect(client).not.toHaveSuspenseCacheEntryUsing(query);

  jest.useRealTimers();
});

test("useReadQuery auto-retains the queryRef and disposes of it when unmounted", async () => {
  jest.useFakeTimers();
  const { query, mocks } = setupSimpleCase();

  const client = createDefaultClient(mocks);
  const preloadQuery = createQueryPreloader(client);

  const queryRef = preloadQuery(query);

  const { unmount } = renderHook(() => useReadQuery(queryRef));

  // We don't start the dispose timer until the promise is initially resolved
  // so we need to wait for it
  jest.advanceTimersByTime(20);
  await act(() => queryRef.toPromise());
  jest.advanceTimersByTime(30_000);

  expect(queryRef).not.toBeDisposed();

  jest.useRealTimers();

  unmount();

  await wait(0);

  expect(queryRef).toBeDisposed();
  expect(client.getObservableQueries().size).toBe(0);
  expect(client).not.toHaveSuspenseCacheEntryUsing(query);
});

test("useReadQuery auto-resubscribes the query after its disposed", async () => {
  const { query } = setupSimpleCase();

  let fetchCount = 0;
  const link = new ApolloLink((operation) => {
    let count = ++fetchCount;
    return new Observable((observer) => {
      setTimeout(() => {
        observer.next({ data: { greeting: `Hello ${count}` } });
        observer.complete();
      }, 100);
    });
  });

  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as UseReadQueryResult<SimpleCaseData> | null,
    },
  });
  const user = userEvent.setup();
  const client = new ApolloClient({ cache: new InMemoryCache(), link });
  const preloadQuery = createQueryPreloader(client);

  const queryRef = preloadQuery(query);

  function SuspenseFallback() {
    useTrackRenders();
    return <div>Loading</div>;
  }

  function App() {
    useTrackRenders();
    const [show, setShow] = React.useState(true);

    return (
      <>
        <button onClick={() => setShow((show) => !show)}>Toggle</button>
        <Suspense fallback={<SuspenseFallback />}>
          {show && <ReadQueryHook />}
        </Suspense>
      </>
    );
  }

  function ReadQueryHook() {
    useTrackRenders();
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  const toggleButton = screen.getByText("Toggle");

  // initial render
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello 1" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(fetchCount).toBe(1);

  // unmount ReadQueryHook
  await act(() => user.click(toggleButton));
  await wait(0);
  await renderStream.takeRender();

  expect(queryRef).toBeDisposed();

  // mount ReadQueryHook
  await act(() => user.click(toggleButton));

  // Ensure we aren't refetching the data by checking we still render the same
  // cache result
  {
    const { renderedComponents, snapshot } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Hello 1" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(fetchCount).toBe(1);
  expect(queryRef).not.toBeDisposed();

  client.writeQuery({ query, data: { greeting: "Hello (cached)" } });

  // Ensure we can get cache updates again after remounting
  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello (cached)" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  // unmount ReadQueryHook
  await act(() => user.click(toggleButton));
  await renderStream.takeRender();
  await wait(0);

  expect(queryRef).toBeDisposed();

  // Write a cache result to ensure that remounting will read this result
  // instead of the old one
  client.writeQuery({ query, data: { greeting: "While you were away" } });
  // mount ReadQueryHook
  await act(() => user.click(toggleButton));

  expect(queryRef).not.toBeDisposed();

  // Ensure we read the newest cache result changed while this queryRef was
  // disposed
  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "While you were away" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(fetchCount).toBe(1);

  // unmount ReadQueryHook
  await act(() => user.click(toggleButton));
  await renderStream.takeRender();
  await wait(0);

  expect(queryRef).toBeDisposed();

  // Remove cached data to ensure remounting will refetch the data
  client.cache.modify({
    fields: {
      greeting: (_, { DELETE }) => DELETE,
    },
  });

  // we wait a moment to ensure no network request is triggered
  // by the `cache.modify` (even with a slight delay)
  await wait(10);
  expect(fetchCount).toBe(1);

  // mount ReadQueryHook
  await act(() => user.click(toggleButton));

  // this should now trigger a network request
  expect(fetchCount).toBe(2);
  expect(queryRef).not.toBeDisposed();

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello 2" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender();
});

test("useReadQuery handles auto-resubscribe with returnPartialData", async () => {
  const { query, mocks } = setupVariablesCase();

  let fetchCount = 0;
  const link = new ApolloLink((operation) => {
    fetchCount++;
    const mock = mocks.find(
      (mock) => mock.request.variables?.id === operation.variables.id
    );

    if (!mock) {
      throw new Error("Could not find mock for variables");
    }

    const result = mock.result as Record<string, any>;

    return new Observable((observer) => {
      setTimeout(() => {
        observer.next({ data: result.data });
        observer.complete();
      }, 100);
    });
  });

  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as UseReadQueryResult<DeepPartial<VariablesCaseData>> | null,
    },
  });
  const user = userEvent.setup();
  const client = new ApolloClient({ cache: new InMemoryCache(), link });
  const preloadQuery = createQueryPreloader(client);

  const queryRef = preloadQuery(query, {
    returnPartialData: true,
    variables: { id: "1" },
  });

  function SuspenseFallback() {
    useTrackRenders();
    return <div>Loading</div>;
  }

  function App() {
    useTrackRenders();
    const [show, setShow] = React.useState(true);

    return (
      <>
        <button onClick={() => setShow((show) => !show)}>Toggle</button>
        <Suspense fallback={<SuspenseFallback />}>
          {show && <ReadQueryHook />}
        </Suspense>
      </>
    );
  }

  function ReadQueryHook() {
    useTrackRenders();
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  const toggleButton = screen.getByText("Toggle");

  // initial render
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(fetchCount).toBe(1);

  // unmount ReadQueryHook
  await act(() => user.click(toggleButton));
  await wait(0);
  await renderStream.takeRender();

  expect(queryRef).toBeDisposed();

  // mount ReadQueryHook
  await act(() => user.click(toggleButton));

  // Ensure we aren't refetching the data by checking we still render the same
  // cache result
  {
    const { renderedComponents, snapshot } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(fetchCount).toBe(1);
  expect(queryRef).not.toBeDisposed();

  client.writeQuery({
    query,
    data: {
      character: {
        __typename: "Character",
        id: "1",
        name: "Spider-Man (cached)",
      },
    },
    variables: { id: "1" },
  });

  // Ensure we can get cache updates again after remounting
  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: {
        character: {
          __typename: "Character",
          id: "1",
          name: "Spider-Man (cached)",
        },
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  // unmount ReadQueryHook
  await act(() => user.click(toggleButton));
  await renderStream.takeRender();
  await wait(0);

  expect(queryRef).toBeDisposed();

  // Write a cache result to ensure that remounting will read this result
  // instead of the old one
  client.writeQuery({
    query,
    data: {
      character: {
        __typename: "Character",
        id: "1",
        name: "Spider-Man (Away)",
      },
    },
    variables: { id: "1" },
  });
  // mount ReadQueryHook
  await act(() => user.click(toggleButton));

  expect(queryRef).not.toBeDisposed();

  // Ensure we read the newest cache result changed while this queryRef was
  // disposed
  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: {
        character: {
          __typename: "Character",
          id: "1",
          name: "Spider-Man (Away)",
        },
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(fetchCount).toBe(1);

  // unmount ReadQueryHook
  await act(() => user.click(toggleButton));
  await renderStream.takeRender();
  await wait(0);

  expect(queryRef).toBeDisposed();

  // Remove cached data to ensure remounting will refetch the data
  client.cache.modify({
    id: "Character:1",
    fields: {
      name: (_, { DELETE }) => DELETE,
    },
  });

  // we wait a moment to ensure no network request is triggered
  // by the `cache.modify` (even with a slight delay)
  await wait(10);
  expect(fetchCount).toBe(1);

  // mount ReadQueryHook
  await act(() => user.click(toggleButton));

  // this should now trigger a network request
  expect(fetchCount).toBe(2);
  expect(queryRef).not.toBeDisposed();

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { character: { __typename: "Character", id: "1" } },
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  // unmount ReadQueryHook
  await act(() => user.click(toggleButton));
  await renderStream.takeRender();
  await wait(0);

  // Ensure that remounting without data in the cache will fetch and suspend
  client.clearStore();

  // mount ReadQueryHook
  await act(() => user.click(toggleButton));

  expect(fetchCount).toBe(3);

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender();
});

test("useReadQuery handles auto-resubscribe on network-only fetch policy", async () => {
  const { query } = setupSimpleCase();

  let fetchCount = 0;
  const link = new ApolloLink((operation) => {
    let count = ++fetchCount;
    return new Observable((observer) => {
      setTimeout(() => {
        observer.next({ data: { greeting: `Hello ${count}` } });
        observer.complete();
      }, 10);
    });
  });

  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as UseReadQueryResult<SimpleCaseData> | null,
    },
  });
  const user = userEvent.setup();
  const client = new ApolloClient({ cache: new InMemoryCache(), link });
  const preloadQuery = createQueryPreloader(client);

  const queryRef = preloadQuery(query, { fetchPolicy: "network-only" });

  function SuspenseFallback() {
    useTrackRenders();
    return <div>Loading</div>;
  }

  function App() {
    useTrackRenders();
    const [show, setShow] = React.useState(true);

    return (
      <>
        <button onClick={() => setShow((show) => !show)}>Toggle</button>
        <Suspense fallback={<SuspenseFallback />}>
          {show && <ReadQueryHook />}
        </Suspense>
      </>
    );
  }

  function ReadQueryHook() {
    useTrackRenders();
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  const toggleButton = screen.getByText("Toggle");

  // initial render
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello 1" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(fetchCount).toBe(1);

  // unmount ReadQueryHook
  await act(() => user.click(toggleButton));
  await wait(0);
  await renderStream.takeRender();

  expect(queryRef).toBeDisposed();

  // mount ReadQueryHook
  await act(() => user.click(toggleButton));

  // Ensure we aren't refetching the data by checking we still render the same
  // cache result
  {
    const { renderedComponents, snapshot } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Hello 1" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(fetchCount).toBe(1);
  expect(queryRef).not.toBeDisposed();

  client.writeQuery({ query, data: { greeting: "Hello (cached)" } });

  // Ensure we can get cache updates again after remounting
  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello (cached)" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  // unmount ReadQueryHook
  await act(() => user.click(toggleButton));
  await renderStream.takeRender();
  await wait(0);

  expect(queryRef).toBeDisposed();

  // Write a cache result to ensure that remounting will read this result
  // instead of the old one
  client.writeQuery({ query, data: { greeting: "While you were away" } });
  // mount ReadQueryHook
  await act(() => user.click(toggleButton));

  expect(queryRef).not.toBeDisposed();

  // Ensure we read the newest cache result changed while this queryRef was
  // disposed
  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "While you were away" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(fetchCount).toBe(1);

  // unmount ReadQueryHook
  await act(() => user.click(toggleButton));
  await renderStream.takeRender();
  await wait(0);

  expect(queryRef).toBeDisposed();

  // Remove cached data to ensure remounting will refetch the data
  client.cache.modify({
    fields: {
      greeting: (_, { DELETE }) => DELETE,
    },
  });

  // Ensure the delete doesn't immediately fetch
  await wait(10);
  expect(fetchCount).toBe(1);

  // mount ReadQueryHook
  await act(() => user.click(toggleButton));

  expect(fetchCount).toBe(2);
  expect(queryRef).not.toBeDisposed();

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello 2" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender();
});

test("useReadQuery handles auto-resubscribe on cache-and-network fetch policy", async () => {
  const { query } = setupSimpleCase();

  let fetchCount = 0;
  const link = new ApolloLink((operation) => {
    let count = ++fetchCount;
    return new Observable((observer) => {
      setTimeout(() => {
        observer.next({ data: { greeting: `Hello ${count}` } });
        observer.complete();
      }, 10);
    });
  });

  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as UseReadQueryResult<SimpleCaseData> | null,
    },
  });
  const user = userEvent.setup();
  const client = new ApolloClient({ cache: new InMemoryCache(), link });
  const preloadQuery = createQueryPreloader(client);

  const queryRef = preloadQuery(query, { fetchPolicy: "cache-and-network" });

  function SuspenseFallback() {
    useTrackRenders();
    return <div>Loading</div>;
  }

  function App() {
    useTrackRenders();
    const [show, setShow] = React.useState(true);

    return (
      <>
        <button onClick={() => setShow((show) => !show)}>Toggle</button>
        <Suspense fallback={<SuspenseFallback />}>
          {show && <ReadQueryHook />}
        </Suspense>
      </>
    );
  }

  function ReadQueryHook() {
    useTrackRenders();
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  const toggleButton = screen.getByText("Toggle");

  // initial render
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello 1" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(fetchCount).toBe(1);

  // unmount ReadQueryHook
  await act(() => user.click(toggleButton));
  await wait(0);
  await renderStream.takeRender();

  expect(queryRef).toBeDisposed();

  // mount ReadQueryHook
  await act(() => user.click(toggleButton));

  // Ensure we aren't refetching the data by checking we still render the same
  // cache result
  {
    const { renderedComponents, snapshot } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Hello 1" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(fetchCount).toBe(1);
  expect(queryRef).not.toBeDisposed();

  client.writeQuery({ query, data: { greeting: "Hello (cached)" } });

  // Ensure we can get cache updates again after remounting
  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello (cached)" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  // unmount ReadQueryHook
  await act(() => user.click(toggleButton));
  await renderStream.takeRender();
  await wait(0);

  expect(queryRef).toBeDisposed();

  // Write a cache result to ensure that remounting will read this result
  // instead of the old one
  client.writeQuery({ query, data: { greeting: "While you were away" } });
  // mount ReadQueryHook
  await act(() => user.click(toggleButton));

  expect(queryRef).not.toBeDisposed();

  // Ensure we read the newest cache result changed while this queryRef was
  // disposed
  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "While you were away" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(fetchCount).toBe(1);

  // unmount ReadQueryHook
  await act(() => user.click(toggleButton));
  await renderStream.takeRender();
  await wait(0);

  expect(queryRef).toBeDisposed();

  // Remove cached data to ensure remounting will refetch the data
  client.cache.modify({
    fields: {
      greeting: (_, { DELETE }) => DELETE,
    },
  });

  // Ensure delete doesn't refetch immediately
  await wait(10);
  expect(fetchCount).toBe(1);

  // mount ReadQueryHook
  await act(() => user.click(toggleButton));

  expect(fetchCount).toBe(2);
  expect(queryRef).not.toBeDisposed();

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello 2" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender();
});

test("useReadQuery handles auto-resubscribe on no-cache fetch policy", async () => {
  const { query } = setupSimpleCase();

  let fetchCount = 0;
  const link = new ApolloLink((operation) => {
    let count = ++fetchCount;
    return new Observable((observer) => {
      setTimeout(() => {
        observer.next({ data: { greeting: `Hello ${count}` } });
        observer.complete();
      }, 10);
    });
  });

  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as UseReadQueryResult<SimpleCaseData> | null,
    },
  });
  const user = userEvent.setup();
  const client = new ApolloClient({ cache: new InMemoryCache(), link });
  const preloadQuery = createQueryPreloader(client);

  const queryRef = preloadQuery(query, { fetchPolicy: "no-cache" });

  function SuspenseFallback() {
    useTrackRenders();
    return <div>Loading</div>;
  }

  function App() {
    useTrackRenders();
    const [show, setShow] = React.useState(true);

    return (
      <>
        <button onClick={() => setShow((show) => !show)}>Toggle</button>
        <Suspense fallback={<SuspenseFallback />}>
          {show && <ReadQueryHook />}
        </Suspense>
      </>
    );
  }

  function ReadQueryHook() {
    useTrackRenders();
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  const toggleButton = screen.getByText("Toggle");

  // initial render
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello 1" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(fetchCount).toBe(1);

  // unmount ReadQueryHook
  await act(() => user.click(toggleButton));
  await wait(0);
  await renderStream.takeRender();

  expect(queryRef).toBeDisposed();

  // mount ReadQueryHook
  await act(() => user.click(toggleButton));

  // Ensure we aren't refetching the data by checking we still render the same
  // result
  {
    const { renderedComponents, snapshot } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Hello 1" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(fetchCount).toBe(1);
  expect(queryRef).not.toBeDisposed();

  // Ensure caches writes for the query are ignored by the hook
  client.writeQuery({ query, data: { greeting: "Hello (cached)" } });

  await expect(renderStream).not.toRerender();

  // unmount ReadQueryHook
  await act(() => user.click(toggleButton));
  await renderStream.takeRender();
  await wait(0);

  expect(queryRef).toBeDisposed();

  // Write a cache result to ensure that remounting will ignore this result
  client.writeQuery({ query, data: { greeting: "While you were away" } });
  // mount ReadQueryHook
  await act(() => user.click(toggleButton));

  expect(queryRef).not.toBeDisposed();

  // Ensure we continue to read the same value
  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello 1" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(fetchCount).toBe(1);

  // unmount ReadQueryHook
  await act(() => user.click(toggleButton));
  await renderStream.takeRender();
  await wait(0);

  expect(queryRef).toBeDisposed();

  // Remove cached data to verify this type of cache change is also ignored
  client.cache.modify({
    fields: {
      greeting: (_, { DELETE }) => DELETE,
    },
  });

  // Ensure delete doesn't fire off request
  await wait(10);
  expect(fetchCount).toBe(1);

  // mount ReadQueryHook
  await act(() => user.click(toggleButton));

  expect(fetchCount).toBe(1);
  expect(queryRef).not.toBeDisposed();

  // Ensure we are still rendering the same result and haven't refetched
  // anything based on missing cache data
  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Hello 1" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender();
});

test("reacts to cache updates", async () => {
  const { query, mocks } = setupSimpleCase();
  const client = createDefaultClient(mocks);

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query);

  const { renderStream } = renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "SuspenseFallback"]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

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
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello (updated)" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

test("ignores cached result and suspends when `fetchPolicy` is network-only", async () => {
  const { query, mocks } = setupSimpleCase();

  const client = createDefaultClient(mocks);
  client.writeQuery({ query, data: { greeting: "Cached Hello" } });

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, {
    fetchPolicy: "network-only",
  });

  const { renderStream } = renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "SuspenseFallback"]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

test("does not cache results when `fetchPolicy` is no-cache", async () => {
  const { query, mocks } = setupSimpleCase();

  const client = createDefaultClient(mocks);

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, {
    fetchPolicy: "no-cache",
  });

  const { renderStream } = renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "SuspenseFallback"]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(client.extract()).toEqual({});
});

test("returns initial cache data followed by network data when `fetchPolicy` is cache-and-network", async () => {
  const { query, mocks } = setupSimpleCase();

  const client = createDefaultClient(mocks);
  client.writeQuery({ query, data: { greeting: "Cached Hello" } });

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, {
    fetchPolicy: "cache-and-network",
  });

  const { renderStream } = renderDefaultTestApp({ client, queryRef });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "ReadQueryHook"]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Cached Hello" },
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["ReadQueryHook"]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

test("returns cached data when all data is present in the cache", async () => {
  const { query, mocks } = setupSimpleCase();

  const client = createDefaultClient(mocks);
  client.writeQuery({ query, data: { greeting: "Cached Hello" } });

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query);

  const { renderStream } = renderDefaultTestApp({ client, queryRef });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "ReadQueryHook"]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Cached Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender();
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

  const { renderStream } = renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "SuspenseFallback"]);
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["ReadQueryHook"]);
    expect(snapshot.result).toEqual({
      data: { hello: "from link", foo: "bar" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender();
});

test("throws when error is returned", async () => {
  // Disable error messages shown by React when an error is thrown to an error
  // boundary
  using _consoleSpy = spyOnConsole("error");
  const { query } = setupSimpleCase();
  const mocks = [
    { request: { query }, result: { errors: [new GraphQLError("Oops")] } },
  ];
  const client = createDefaultClient(mocks);

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query);

  const { renderStream } = renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "SuspenseFallback"]);
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

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
  const { query } = setupSimpleCase();
  const mocks = [
    { request: { query }, result: { errors: [new GraphQLError("Oops")] } },
  ];
  const client = createDefaultClient(mocks);

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, { errorPolicy: "all" });

  const { renderStream } = renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "SuspenseFallback"]);
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

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
  const { query } = setupSimpleCase();
  const mocks = [
    { request: { query }, result: { errors: [new GraphQLError("Oops")] } },
  ];
  const client = createDefaultClient(mocks);

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, { errorPolicy: "ignore" });

  const { renderStream } = renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "SuspenseFallback"]);
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

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

  const { renderStream } = renderDefaultTestApp({ client, queryRef });

  // initial render
  await renderStream.takeRender();

  const { snapshot } = await renderStream.takeRender();

  expect(snapshot.result).toEqual({
    data: { context: { valueA: "A", valueB: "B" } },
    networkStatus: NetworkStatus.ready,
    error: undefined,
  });
});

test("creates unique query refs when calling preloadQuery with the same query", async () => {
  const { query } = setupSimpleCase();

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

  const unwrappedQueryRef1 = unwrapQueryRef(queryRef1);
  const unwrappedQueryRef2 = unwrapQueryRef(queryRef2);

  // Use Object.is inside expect to prevent circular reference errors on toBe
  expect(Object.is(queryRef1, queryRef2)).toBe(false);
  expect(Object.is(unwrappedQueryRef1, unwrappedQueryRef2)).toBe(false);

  await expect(queryRef1.toPromise()).resolves.toBe(queryRef1);
  await expect(queryRef2.toPromise()).resolves.toBe(queryRef2);
});

test("does not suspend and returns partial data when `returnPartialData` is `true`", async () => {
  const { query, mocks } = setupVariablesCase();
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
    data: { character: { __typename: "Character", id: "1" } },
    variables: { id: "1" },
  });

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, {
    variables: { id: "1" },
    returnPartialData: true,
  });

  const { renderStream } = renderDefaultTestApp({ client, queryRef });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "ReadQueryHook"]);
    expect(snapshot.result).toEqual({
      data: { character: { __typename: "Character", id: "1" } },
      networkStatus: NetworkStatus.loading,
      error: undefined,
    });
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["ReadQueryHook"]);
    expect(snapshot.result).toEqual({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
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

  const { renderStream } = renderDefaultTestApp({ client, queryRef });

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

  const { renderStream } = renderDefaultTestApp({ client, queryRef });

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

  const { renderStream } = renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "SuspenseFallback"]);
  }

  link.simulateResult({
    result: {
      data: { greeting: { message: "Hello world", __typename: "Greeting" } },
      hasNext: true,
    },
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

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
    const { snapshot, renderedComponents } = await renderStream.takeRender();

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
    preloadQuery(query, { returnPartialData: true, variables: {} });
    preloadQuery(query, { variables: { foo: "bar" } });
    preloadQuery(query, { variables: { foo: "bar", bar: 2 } });
  });

  test("variables are optional and can be anything with unspecified TVariables", () => {
    type Data = { greeting: string };
    const query: TypedDocumentNode<Data> = gql``;

    preloadQuery(query);
    preloadQuery<Data>(query);
    preloadQuery(query, { variables: {} });
    preloadQuery<Data>(query, { variables: {} });
    preloadQuery(query, { returnPartialData: true, variables: {} });
    preloadQuery<Data>(query, { returnPartialData: true, variables: {} });
    preloadQuery(query, { variables: { foo: "bar" } });
    preloadQuery<Data>(query, { variables: { foo: "bar" } });
    preloadQuery(query, { variables: { foo: "bar", bar: 2 } });
    preloadQuery<Data>(query, { variables: { foo: "bar", bar: 2 } });
  });

  test("variables are optional when TVariables are empty", () => {
    type Data = { greeting: string };
    type Variables = Record<string, never>;
    const query: TypedDocumentNode<Data, Variables> = gql``;

    preloadQuery(query);
    preloadQuery<Data, Variables>(query);
    preloadQuery(query, { variables: {} });
    preloadQuery<Data, Variables>(query, { variables: {} });
    preloadQuery(query, { returnPartialData: true, variables: {} });
    preloadQuery<Data, Variables>(query, {
      returnPartialData: true,
      variables: {},
    });
    preloadQuery(query, {
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    preloadQuery<Data, Variables>(query, {
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    preloadQuery(query, {
      returnPartialData: true,
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
    preloadQuery<Data, Variables>(query, {
      returnPartialData: true,
      variables: {
        // @ts-expect-error unknown variables
        foo: "bar",
      },
    });
  });

  test("does not allow variables when TVariables is `never`", () => {
    type Data = { greeting: string };
    const query: TypedDocumentNode<Data, never> = gql``;

    preloadQuery(query);
    preloadQuery<Data, never>(query);
    preloadQuery(query, { variables: {} });
    preloadQuery<Data, never>(query, { variables: {} });
    preloadQuery(query, { returnPartialData: true, variables: {} });
    preloadQuery<Data, never>(query, {
      returnPartialData: true,
      variables: {},
    });
    // @ts-expect-error no variables allowed
    preloadQuery(query, { variables: { foo: "bar" } });
    // @ts-expect-error no variables allowed
    preloadQuery<Data, never>(query, { variables: { foo: "bar" } });
    preloadQuery(query, {
      returnPartialData: true,
      variables: {
        // @ts-expect-error no variables allowed
        foo: "bar",
      },
    });
    preloadQuery<Data, never>(query, {
      returnPartialData: true,
      variables: {
        // @ts-expect-error no variables allowed
        foo: "bar",
      },
    });
  });

  test("optional variables are optional", () => {
    type Data = { posts: string[] };
    type Variables = { limit?: number };
    const query: TypedDocumentNode<Data, Variables> = gql``;

    preloadQuery(query);
    preloadQuery<Data, Variables>(query);
    preloadQuery(query, { variables: {} });
    preloadQuery<Data, Variables>(query, { variables: {} });
    preloadQuery(query, { returnPartialData: true, variables: {} });
    preloadQuery<Data, Variables>(query, {
      returnPartialData: true,
      variables: {},
    });
    preloadQuery(query, { variables: { limit: 10 } });
    preloadQuery<Data, Variables>(query, { variables: { limit: 10 } });
    preloadQuery(query, { returnPartialData: true, variables: { limit: 10 } });
    preloadQuery<Data, Variables>(query, {
      returnPartialData: true,
      variables: { limit: 10 },
    });
    preloadQuery(query, {
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery<Data, Variables>(query, {
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery(query, {
      returnPartialData: true,
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery<Data, Variables>(query, {
      returnPartialData: true,
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
    preloadQuery<Data, Variables>(query, {
      variables: {
        limit: 10,
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery(query, {
      returnPartialData: true,
      variables: {
        limit: 10,
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery<Data, Variables>(query, {
      returnPartialData: true,
      variables: {
        limit: 10,
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  });

  test("enforces required variables", () => {
    type Data = { character: string };
    type Variables = { id: string };
    const query: TypedDocumentNode<Data, Variables> = gql``;

    // @ts-expect-error missing variables option
    preloadQuery(query);
    // @ts-expect-error missing variables option
    preloadQuery<Data, Variables>(query);
    // @ts-expect-error missing variables option
    preloadQuery(query, { returnPartialData: true });
    // @ts-expect-error missing variables option
    preloadQuery<Data, Variables>(query, { returnPartialData: true });
    preloadQuery(query, {
      // @ts-expect-error empty variables
      variables: {},
    });
    preloadQuery<Data, Variables>(query, {
      // @ts-expect-error empty variables
      variables: {},
    });
    preloadQuery(query, {
      returnPartialData: true,
      // @ts-expect-error empty variables
      variables: {},
    });
    preloadQuery<Data, Variables>(query, {
      returnPartialData: true,
      // @ts-expect-error empty variables
      variables: {},
    });
    preloadQuery(query, { variables: { id: "1" } });
    preloadQuery<Data, Variables>(query, { variables: { id: "1" } });
    preloadQuery(query, { returnPartialData: true, variables: { id: "1" } });
    preloadQuery<Data, Variables>(query, {
      returnPartialData: true,
      variables: { id: "1" },
    });
    preloadQuery(query, {
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery<Data, Variables>(query, {
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery(query, {
      returnPartialData: true,
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery<Data, Variables>(query, {
      returnPartialData: true,
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
    preloadQuery<Data, Variables>(query, {
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery(query, {
      returnPartialData: true,
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery(query, {
      returnPartialData: true,
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  });

  test("requires variables with mixed TVariables", () => {
    type Data = { character: string };
    type Variables = { id: string; language?: string };
    const query: TypedDocumentNode<Data, Variables> = gql``;

    // @ts-expect-error missing variables argument
    preloadQuery(query);
    // @ts-expect-error missing variables argument
    preloadQuery<Data, Variables>(query);
    // @ts-expect-error missing variables argument
    preloadQuery(query, {});
    // @ts-expect-error missing variables argument
    preloadQuery<Data, Variables>(query, {});
    // @ts-expect-error missing variables option
    preloadQuery(query, { returnPartialData: true });
    // @ts-expect-error missing variables option
    preloadQuery<Data, Variables>(query, { returnPartialData: true });
    preloadQuery(query, {
      // @ts-expect-error missing required variables
      variables: {},
    });
    preloadQuery<Data, Variables>(query, {
      // @ts-expect-error missing required variables
      variables: {},
    });
    preloadQuery(query, {
      returnPartialData: true,
      // @ts-expect-error missing required variables
      variables: {},
    });
    preloadQuery<Data, Variables>(query, {
      returnPartialData: true,
      // @ts-expect-error missing required variables
      variables: {},
    });
    preloadQuery(query, { variables: { id: "1" } });
    preloadQuery<Data, Variables>(query, { variables: { id: "1" } });
    preloadQuery(query, {
      // @ts-expect-error missing required variable
      variables: { language: "en" },
    });
    preloadQuery<Data, Variables>(query, {
      // @ts-expect-error missing required variable
      variables: { language: "en" },
    });
    preloadQuery(query, { variables: { id: "1", language: "en" } });
    preloadQuery<Data, Variables>(query, {
      variables: { id: "1", language: "en" },
    });
    preloadQuery(query, {
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery<Data, Variables>(query, {
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery(query, {
      returnPartialData: true,
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery<Data, Variables>(query, {
      returnPartialData: true,
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
    preloadQuery<Data, Variables>(query, {
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery(query, {
      returnPartialData: true,
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery<Data, Variables>(query, {
      returnPartialData: true,
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
    preloadQuery<Data, Variables>(query, {
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

    expectTypeOf(queryRef).toEqualTypeOf<
      PreloadedQueryRef<unknown, OperationVariables>
    >();
  });

  test("returns QueryReference<TData> in default case", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData> = gql``;
      const queryRef = preloadQuery(query);

      expectTypeOf(queryRef).toEqualTypeOf<
        PreloadedQueryRef<SimpleCaseData, { [key: string]: any }>
      >();
    }

    {
      const query = gql``;
      const queryRef = preloadQuery<SimpleCaseData>(query);

      expectTypeOf(queryRef).toEqualTypeOf<
        PreloadedQueryRef<SimpleCaseData, OperationVariables>
      >();
    }
  });

  test("returns QueryReference<TData | undefined> with errorPolicy: 'ignore'", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData> = gql``;
      const queryRef = preloadQuery(query, { errorPolicy: "ignore" });

      expectTypeOf(queryRef).toEqualTypeOf<
        PreloadedQueryRef<SimpleCaseData | undefined, { [key: string]: any }>
      >();
    }

    {
      const query = gql``;
      const queryRef = preloadQuery<SimpleCaseData>(query, {
        errorPolicy: "ignore",
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        PreloadedQueryRef<SimpleCaseData | undefined, OperationVariables>
      >();
    }
  });

  test("returns QueryReference<TData | undefined> with errorPolicy: 'all'", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData> = gql``;
      const queryRef = preloadQuery(query, { errorPolicy: "all" });

      expectTypeOf(queryRef).toEqualTypeOf<
        PreloadedQueryRef<SimpleCaseData | undefined, { [key: string]: any }>
      >();
    }

    {
      const query = gql``;
      const queryRef = preloadQuery<SimpleCaseData>(query, {
        errorPolicy: "all",
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        PreloadedQueryRef<SimpleCaseData | undefined, OperationVariables>
      >();
    }
  });

  test("returns QueryReference<TData> with errorPolicy: 'none'", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData> = gql``;
      const queryRef = preloadQuery(query, { errorPolicy: "none" });

      expectTypeOf(queryRef).toEqualTypeOf<
        PreloadedQueryRef<SimpleCaseData, { [key: string]: any }>
      >();
    }

    {
      const query = gql``;
      const queryRef = preloadQuery<SimpleCaseData>(query, {
        errorPolicy: "none",
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        PreloadedQueryRef<SimpleCaseData, OperationVariables>
      >();
    }
  });

  test("returns QueryReference<DeepPartial<TData>> with returnPartialData: true", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData> = gql``;
      const queryRef = preloadQuery(query, { returnPartialData: true });

      expectTypeOf(queryRef).toEqualTypeOf<
        PreloadedQueryRef<DeepPartial<SimpleCaseData>, { [key: string]: any }>
      >();
    }

    {
      const query = gql``;
      const queryRef = preloadQuery<SimpleCaseData>(query, {
        returnPartialData: true,
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        PreloadedQueryRef<DeepPartial<SimpleCaseData>, OperationVariables>
      >();
    }
  });

  test("returns QueryReference<DeepPartial<TData>> with returnPartialData: false", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData> = gql``;
      const queryRef = preloadQuery(query, { returnPartialData: false });

      expectTypeOf(queryRef).toEqualTypeOf<
        PreloadedQueryRef<SimpleCaseData, OperationVariables>
      >();
    }

    {
      const query = gql``;
      const queryRef = preloadQuery<SimpleCaseData>(query, {
        returnPartialData: false,
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        PreloadedQueryRef<SimpleCaseData, OperationVariables>
      >();
    }
  });

  test("returns QueryReference<TData> when passing an option unrelated to TData", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData> = gql``;
      const queryRef = preloadQuery(query, { canonizeResults: true });

      expectTypeOf(queryRef).toEqualTypeOf<
        PreloadedQueryRef<SimpleCaseData, { [key: string]: any }>
      >();
    }

    {
      const query = gql``;
      const queryRef = preloadQuery<SimpleCaseData>(query, {
        canonizeResults: true,
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        PreloadedQueryRef<SimpleCaseData, OperationVariables>
      >();
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
        PreloadedQueryRef<
          DeepPartial<SimpleCaseData> | undefined,
          { [key: string]: any }
        >
      >();
    }

    {
      const query = gql``;
      const queryRef = preloadQuery<SimpleCaseData>(query, {
        returnPartialData: true,
        errorPolicy: "ignore",
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        PreloadedQueryRef<
          DeepPartial<SimpleCaseData> | undefined,
          OperationVariables
        >
      >();
    }

    {
      const query: TypedDocumentNode<SimpleCaseData> = gql``;
      const queryRef = preloadQuery(query, {
        returnPartialData: true,
        errorPolicy: "none",
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        PreloadedQueryRef<DeepPartial<SimpleCaseData>, { [key: string]: any }>
      >();
    }

    {
      const query = gql``;
      const queryRef = preloadQuery<SimpleCaseData>(query, {
        returnPartialData: true,
        errorPolicy: "none",
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        PreloadedQueryRef<DeepPartial<SimpleCaseData>, OperationVariables>
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
        PreloadedQueryRef<DeepPartial<SimpleCaseData>, { [key: string]: any }>
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
        PreloadedQueryRef<DeepPartial<SimpleCaseData>, OperationVariables>
      >();
    }
  });
});
