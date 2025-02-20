import React from "react";
import { screen } from "@testing-library/react";
import {
  ApolloClient,
  InMemoryCache,
  NetworkStatus,
  TypedDocumentNode,
  gql,
  split,
} from "../../../core/index.js";
import {
  SubscribeToMoreFunction,
  SubscribeToMoreUpdateQueryFn,
} from "../../../core/watchQueryOptions.js";
import {
  MockLink,
  MockSubscriptionLink,
  MockedResponse,
} from "../../../testing/index.js";
import {
  createClientWrapper,
  PaginatedCaseData,
  SimpleCaseData,
  setupPaginatedCase,
  setupSimpleCase,
} from "../../../testing/internal/index.js";
import { useQueryRefHandlers } from "../useQueryRefHandlers.js";
import { UseReadQueryResult, useReadQuery } from "../useReadQuery.js";
import { Suspense } from "react";
import { createQueryPreloader } from "../../query-preloader/createQueryPreloader.js";
import { userEvent } from "@testing-library/user-event";
import { QueryRef } from "../../internal/index.js";
import { useBackgroundQuery } from "../useBackgroundQuery.js";
import { useLoadableQuery } from "../useLoadableQuery.js";
import {
  concatPagination,
  getMainDefinition,
} from "../../../utilities/index.js";
import {
  createRenderStream,
  disableActEnvironment,
  useTrackRenders,
} from "@testing-library/react-render-stream";

test("does not interfere with updates from useReadQuery", async () => {
  const { query, mocks } = setupSimpleCase();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  using _disabledAct = disableActEnvironment();
  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as UseReadQueryResult<SimpleCaseData> | null,
    },
  });

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query);

  function SuspenseFallback() {
    useTrackRenders();
    return <p>Loading</p>;
  }

  function ReadQueryHook() {
    useTrackRenders();
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function App() {
    useTrackRenders();
    // We can ignore the return result here since we are testing the mechanics
    // of this hook to ensure it doesn't interfere with the updates from
    // useReadQuery
    useQueryRefHandlers(queryRef);

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook />
      </Suspense>
    );
  }

  const { rerender } = await renderStream.render(<App />, {
    wrapper: createClientWrapper(client),
  });
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

  client.writeQuery({ query, data: { greeting: "Hello again" } });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Hello again" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await rerender(<App />);

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Hello again" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

test("refetches and resuspends when calling refetch", async () => {
  const { query, mocks: defaultMocks } = setupSimpleCase();

  const user = userEvent.setup();

  const mocks = [
    defaultMocks[0],
    {
      request: { query },
      result: { data: { greeting: "Hello again" } },
      delay: 20,
    },
  ];

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  using _disabledAct = disableActEnvironment();
  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as UseReadQueryResult<SimpleCaseData> | null,
    },
  });

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query);

  function SuspenseFallback() {
    useTrackRenders();
    return <p>Loading</p>;
  }

  function ReadQueryHook() {
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function App() {
    useTrackRenders();
    const { refetch } = useQueryRefHandlers(queryRef);

    return (
      <>
        <button onClick={() => refetch()}>Refetch</button>
        <Suspense fallback={<SuspenseFallback />}>
          <ReadQueryHook />
        </Suspense>
      </>
    );
  }

  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

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

  await user.click(screen.getByText("Refetch"));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello again" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

test('honors refetchWritePolicy set to "merge"', async () => {
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

  const user = userEvent.setup();
  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache,
  });

  using _disabledAct = disableActEnvironment();
  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as UseReadQueryResult<QueryData> | null,
    },
  });

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, {
    refetchWritePolicy: "merge",
    variables: { min: 0, max: 12 },
  });

  function SuspenseFallback() {
    useTrackRenders();
    return <p>Loading</p>;
  }

  function ReadQueryHook() {
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function App() {
    useTrackRenders();
    const { refetch } = useQueryRefHandlers(queryRef);

    return (
      <>
        <button onClick={() => refetch({ min: 12, max: 30 })}>Refetch</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook />}
        </Suspense>
      </>
    );
  }

  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  // initial render
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

  await user.click(screen.getByText("Refetch"));
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

test('honors refetchWritePolicy set to "overwrite"', async () => {
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

  const user = userEvent.setup();
  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache,
  });

  using _disabledAct = disableActEnvironment();
  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as UseReadQueryResult<QueryData> | null,
    },
  });

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, {
    refetchWritePolicy: "overwrite",
    variables: { min: 0, max: 12 },
  });

  function SuspenseFallback() {
    useTrackRenders();
    return <p>Loading</p>;
  }

  function ReadQueryHook() {
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function App() {
    useTrackRenders();
    const { refetch } = useQueryRefHandlers(queryRef);

    return (
      <>
        <button onClick={() => refetch({ min: 12, max: 30 })}>Refetch</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook />}
        </Suspense>
      </>
    );
  }

  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  // initial render
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

  await user.click(screen.getByText("Refetch"));
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

  await expect(renderStream).not.toRerender();
});

test('defaults refetchWritePolicy to "overwrite"', async () => {
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

  const user = userEvent.setup();
  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache,
  });

  using _disabledAct = disableActEnvironment();
  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as UseReadQueryResult<QueryData> | null,
    },
  });

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, {
    variables: { min: 0, max: 12 },
  });

  function SuspenseFallback() {
    useTrackRenders();
    return <p>Loading</p>;
  }

  function ReadQueryHook() {
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function App() {
    useTrackRenders();
    const { refetch } = useQueryRefHandlers(queryRef);

    return (
      <>
        <button onClick={() => refetch({ min: 12, max: 30 })}>Refetch</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook />}
        </Suspense>
      </>
    );
  }

  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  // initial render
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

  await user.click(screen.getByText("Refetch"));
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

  await expect(renderStream).not.toRerender();
});

test("`refetch` works with startTransition", async () => {
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

  const mocks: MockedResponse[] = [
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

  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache: new InMemoryCache(),
  });

  using _disabledAct = disableActEnvironment();
  const renderStream = createRenderStream({
    initialSnapshot: {
      isPending: false,
      result: null as UseReadQueryResult<Data> | null,
    },
  });

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, { variables: { id: "1" } });

  function App() {
    useTrackRenders();
    const { refetch } = useQueryRefHandlers(queryRef);
    const [isPending, startTransition] = React.useTransition();

    renderStream.mergeSnapshot({ isPending });

    return (
      <>
        <button
          disabled={isPending}
          onClick={() => {
            startTransition(() => {
              void refetch();
            });
          }}
        >
          Refetch
        </button>
        <Suspense fallback={<SuspenseFallback />}>
          <Todo />
        </Suspense>
      </>
    );
  }

  function SuspenseFallback() {
    useTrackRenders();
    return <p>Loading</p>;
  }

  function Todo() {
    useTrackRenders();
    const result = useReadQuery(queryRef);
    const { todo } = result.data;

    renderStream.mergeSnapshot({ result });

    return (
      <div data-testid="todo">
        {todo.name}
        {todo.completed && " (completed)"}
      </div>
    );
  }

  await renderStream.render(<App />);

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot).toEqual({
      isPending: false,
      result: {
        data: { todo: { id: "1", name: "Clean room", completed: false } },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  const button = screen.getByText("Refetch");
  await user.click(button);

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, Todo]);
    expect(snapshot).toEqual({
      isPending: true,
      result: {
        data: { todo: { id: "1", name: "Clean room", completed: false } },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, Todo]);
    expect(snapshot).toEqual({
      isPending: false,
      result: {
        data: { todo: { id: "1", name: "Clean room", completed: true } },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  await expect(renderStream).not.toRerender();
});

test("`refetch` works with startTransition from useBackgroundQuery and usePreloadedQueryHandlers", async () => {
  const { query, mocks: defaultMocks } = setupSimpleCase();

  const user = userEvent.setup();

  const mocks = [
    defaultMocks[0],
    {
      request: { query },
      result: { data: { greeting: "Hello again" } },
      delay: 20,
    },
    {
      request: { query },
      result: { data: { greeting: "You again?" } },
      delay: 20,
    },
  ];

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  using _disabledAct = disableActEnvironment();
  const renderStream = createRenderStream({
    initialSnapshot: {
      useBackgroundQueryIsPending: false,
      usePreloadedQueryHandlersIsPending: false,
      result: null as UseReadQueryResult<SimpleCaseData> | null,
    },
  });

  function SuspenseFallback() {
    useTrackRenders();
    return <p>Loading</p>;
  }

  function ReadQueryHook({ queryRef }: { queryRef: QueryRef<SimpleCaseData> }) {
    useTrackRenders();
    const [isPending, startTransition] = React.useTransition();
    const { refetch } = useQueryRefHandlers(queryRef);

    renderStream.mergeSnapshot({
      usePreloadedQueryHandlersIsPending: isPending,
      result: useReadQuery(queryRef),
    });

    return (
      <button
        onClick={() =>
          startTransition(() => {
            void refetch();
          })
        }
      >
        Refetch from child
      </button>
    );
  }

  function App() {
    useTrackRenders();
    const [isPending, startTransition] = React.useTransition();
    const [queryRef, { refetch }] = useBackgroundQuery(query);

    renderStream.mergeSnapshot({ useBackgroundQueryIsPending: isPending });

    return (
      <>
        <button
          onClick={() =>
            startTransition(() => {
              void refetch();
            })
          }
        >
          Refetch from parent
        </button>
        <Suspense fallback={<SuspenseFallback />}>
          <ReadQueryHook queryRef={queryRef} />
        </Suspense>
      </>
    );
  }

  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

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

  await user.click(screen.getByText("Refetch from parent"));

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot).toEqual({
      useBackgroundQueryIsPending: true,
      usePreloadedQueryHandlersIsPending: false,
      result: {
        data: { greeting: "Hello" },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot).toEqual({
      useBackgroundQueryIsPending: false,
      usePreloadedQueryHandlersIsPending: false,
      result: {
        data: { greeting: "Hello again" },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  await user.click(screen.getByText("Refetch from child"));

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot).toEqual({
      useBackgroundQueryIsPending: false,
      usePreloadedQueryHandlersIsPending: true,
      result: {
        data: { greeting: "Hello again" },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot).toEqual({
      useBackgroundQueryIsPending: false,
      usePreloadedQueryHandlersIsPending: false,
      result: {
        data: { greeting: "You again?" },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  await expect(renderStream).not.toRerender();
});

test("refetches from queryRefs produced by useBackgroundQuery", async () => {
  const { query, mocks: defaultMocks } = setupSimpleCase();

  const user = userEvent.setup();

  const mocks = [
    defaultMocks[0],
    {
      request: { query },
      result: { data: { greeting: "Hello again" } },
      delay: 20,
    },
  ];

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  using _disabledAct = disableActEnvironment();
  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as UseReadQueryResult<SimpleCaseData> | null,
    },
  });

  function SuspenseFallback() {
    useTrackRenders();
    return <p>Loading</p>;
  }

  function ReadQueryHook({ queryRef }: { queryRef: QueryRef<SimpleCaseData> }) {
    const { refetch } = useQueryRefHandlers(queryRef);
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return <button onClick={() => refetch()}>Refetch</button>;
  }

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query);

    return (
      <>
        <Suspense fallback={<SuspenseFallback />}>
          <ReadQueryHook queryRef={queryRef} />
        </Suspense>
      </>
    );
  }

  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

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

  await user.click(screen.getByText("Refetch"));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello again" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

test("refetches from queryRefs produced by useLoadableQuery", async () => {
  const { query, mocks: defaultMocks } = setupSimpleCase();

  const user = userEvent.setup();

  const mocks = [
    defaultMocks[0],
    {
      request: { query },
      result: { data: { greeting: "Hello again" } },
      delay: 20,
    },
  ];

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  using _disabledAct = disableActEnvironment();
  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as UseReadQueryResult<SimpleCaseData> | null,
    },
  });

  function SuspenseFallback() {
    useTrackRenders();
    return <p>Loading</p>;
  }

  function ReadQueryHook({ queryRef }: { queryRef: QueryRef<SimpleCaseData> }) {
    const { refetch } = useQueryRefHandlers(queryRef);
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return <button onClick={() => refetch()}>Refetch</button>;
  }

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

  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  // initial render
  await renderStream.takeRender();

  await user.click(screen.getByText("Load query"));

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

  await user.click(screen.getByText("Refetch"));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello again" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

test("resuspends when calling `fetchMore`", async () => {
  const { query, link } = setupPaginatedCase();

  const user = userEvent.setup();

  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            letters: { keyArgs: false },
          },
        },
      },
    }),
    link,
  });
  const preloadQuery = createQueryPreloader(client);

  using _disabledAct = disableActEnvironment();
  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as UseReadQueryResult<PaginatedCaseData> | null,
    },
  });

  function SuspenseFallback() {
    useTrackRenders();
    return <p>Loading</p>;
  }

  function ReadQueryHook() {
    useTrackRenders();
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function App() {
    useTrackRenders();
    const { fetchMore } = useQueryRefHandlers(queryRef);

    return (
      <>
        <button
          onClick={() => fetchMore({ variables: { limit: 2, offset: 2 } })}
        >
          Load next
        </button>
        <Suspense fallback={<SuspenseFallback />}>
          <ReadQueryHook />
        </Suspense>
      </>
    );
  }

  const queryRef = preloadQuery(query);
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

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

  await user.click(screen.getByText("Load next"));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

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
});

test("properly uses `updateQuery` when calling `fetchMore`", async () => {
  const { query, link } = setupPaginatedCase();

  const user = userEvent.setup();

  const client = new ApolloClient({ cache: new InMemoryCache(), link });
  const preloadQuery = createQueryPreloader(client);

  using _disabledAct = disableActEnvironment();
  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as UseReadQueryResult<PaginatedCaseData> | null,
    },
  });

  function SuspenseFallback() {
    useTrackRenders();
    return <p>Loading</p>;
  }

  function ReadQueryHook() {
    useTrackRenders();
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function App() {
    useTrackRenders();
    const { fetchMore } = useQueryRefHandlers(queryRef);

    return (
      <>
        <button
          onClick={() =>
            fetchMore({
              variables: { limit: 2, offset: 2 },
              updateQuery: (prev, { fetchMoreResult }) => ({
                letters: prev.letters.concat(fetchMoreResult.letters),
              }),
            })
          }
        >
          Load next
        </button>
        <Suspense fallback={<SuspenseFallback />}>
          <ReadQueryHook />
        </Suspense>
      </>
    );
  }

  const queryRef = preloadQuery(query);
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

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

  await user.click(screen.getByText("Load next"));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: {
        letters: [
          { __typename: "Letter", letter: "A", position: 1 },
          { __typename: "Letter", letter: "B", position: 2 },
          { __typename: "Letter", letter: "C", position: 3 },
          { __typename: "Letter", letter: "D", position: 4 },
        ],
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

test("properly uses cache field policies when calling `fetchMore` without `updateQuery`", async () => {
  const { query, link } = setupPaginatedCase();

  const user = userEvent.setup();

  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            letters: concatPagination(),
          },
        },
      },
    }),
    link,
  });
  const preloadQuery = createQueryPreloader(client);

  using _disabledAct = disableActEnvironment();
  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as UseReadQueryResult<PaginatedCaseData> | null,
    },
  });

  function SuspenseFallback() {
    useTrackRenders();
    return <p>Loading</p>;
  }

  function ReadQueryHook() {
    useTrackRenders();
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function App() {
    useTrackRenders();
    const { fetchMore } = useQueryRefHandlers(queryRef);

    return (
      <>
        <button
          onClick={() => fetchMore({ variables: { limit: 2, offset: 2 } })}
        >
          Load next
        </button>
        <Suspense fallback={<SuspenseFallback />}>
          <ReadQueryHook />
        </Suspense>
      </>
    );
  }

  const queryRef = preloadQuery(query);
  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

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

  await user.click(screen.getByText("Load next"));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toEqual({
      data: {
        letters: [
          { __typename: "Letter", letter: "A", position: 1 },
          { __typename: "Letter", letter: "B", position: 2 },
          { __typename: "Letter", letter: "C", position: 3 },
          { __typename: "Letter", letter: "D", position: 4 },
        ],
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

test("paginates from queryRefs produced by useBackgroundQuery", async () => {
  const { query, link } = setupPaginatedCase();

  const user = userEvent.setup();
  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            letters: { keyArgs: false },
          },
        },
      },
    }),
    link,
  });

  using _disabledAct = disableActEnvironment();
  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as UseReadQueryResult<PaginatedCaseData> | null,
    },
  });

  function SuspenseFallback() {
    useTrackRenders();
    return <p>Loading</p>;
  }

  function ReadQueryHook({
    queryRef,
  }: {
    queryRef: QueryRef<PaginatedCaseData>;
  }) {
    useTrackRenders();
    const { fetchMore } = useQueryRefHandlers(queryRef);

    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return (
      <button onClick={() => fetchMore({ variables: { limit: 2, offset: 2 } })}>
        Load next
      </button>
    );
  }

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query);

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

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

  await user.click(screen.getByText("Load next"));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

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
});

test("paginates from queryRefs produced by useLoadableQuery", async () => {
  const { query, link } = setupPaginatedCase();

  const user = userEvent.setup();
  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            letters: { keyArgs: false },
          },
        },
      },
    }),
    link,
  });

  using _disabledAct = disableActEnvironment();
  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as UseReadQueryResult<PaginatedCaseData> | null,
    },
  });

  function SuspenseFallback() {
    useTrackRenders();
    return <p>Loading</p>;
  }

  function ReadQueryHook({
    queryRef,
  }: {
    queryRef: QueryRef<PaginatedCaseData>;
  }) {
    useTrackRenders();
    const { fetchMore } = useQueryRefHandlers(queryRef);

    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return (
      <button onClick={() => fetchMore({ variables: { limit: 2, offset: 2 } })}>
        Load next
      </button>
    );
  }

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

  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  // initial render
  await renderStream.takeRender();

  await user.click(screen.getByText("Load query"));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

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

  await user.click(screen.getByText("Load next"));

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([SuspenseFallback]);
  }

  {
    const { snapshot } = await renderStream.takeRender();

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
});

test("`fetchMore` works with startTransition", async () => {
  const { query, link } = setupPaginatedCase();

  const user = userEvent.setup();
  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            letters: { keyArgs: false },
          },
        },
      },
    }),
    link,
  });
  const preloadQuery = createQueryPreloader(client);

  using _disabledAct = disableActEnvironment();
  const renderStream = createRenderStream({
    initialSnapshot: {
      isPending: false,
      result: null as UseReadQueryResult<PaginatedCaseData> | null,
    },
  });

  function SuspenseFallback() {
    useTrackRenders();
    return <p>Loading</p>;
  }

  function ReadQueryHook() {
    useTrackRenders();
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function App() {
    useTrackRenders();
    const [isPending, startTransition] = React.useTransition();
    const { fetchMore } = useQueryRefHandlers(queryRef);

    renderStream.mergeSnapshot({ isPending });

    return (
      <>
        <button
          onClick={() =>
            startTransition(() => {
              void fetchMore({ variables: { offset: 2, limit: 2 } });
            })
          }
        >
          Load next
        </button>
        <Suspense fallback={<SuspenseFallback />}>
          <ReadQueryHook />
        </Suspense>
      </>
    );
  }

  const queryRef = preloadQuery(query);

  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

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

  await user.click(screen.getByText("Load next"));

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot).toEqual({
      isPending: true,
      result: {
        data: {
          letters: [
            { __typename: "Letter", letter: "A", position: 1 },
            { __typename: "Letter", letter: "B", position: 2 },
          ],
        },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot).toEqual({
      isPending: false,
      result: {
        data: {
          letters: [
            { __typename: "Letter", letter: "C", position: 3 },
            { __typename: "Letter", letter: "D", position: 4 },
          ],
        },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  await expect(renderStream).not.toRerender();
});

test("`fetchMore` works with startTransition from useBackgroundQuery and useQueryRefHandlers", async () => {
  const { query, link } = setupPaginatedCase();

  const user = userEvent.setup();
  const client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            letters: { keyArgs: false },
          },
        },
      },
    }),
    link,
  });

  using _disabledAct = disableActEnvironment();
  const renderStream = createRenderStream({
    initialSnapshot: {
      useBackgroundQueryIsPending: false,
      useQueryRefHandlersIsPending: false,
      result: null as UseReadQueryResult<PaginatedCaseData> | null,
    },
  });

  function SuspenseFallback() {
    useTrackRenders();
    return <p>Loading</p>;
  }

  function ReadQueryHook({
    queryRef,
  }: {
    queryRef: QueryRef<PaginatedCaseData>;
  }) {
    useTrackRenders();
    const [isPending, startTransition] = React.useTransition();
    const { fetchMore } = useQueryRefHandlers(queryRef);

    renderStream.mergeSnapshot({
      useQueryRefHandlersIsPending: isPending,
      result: useReadQuery(queryRef),
    });

    return (
      <button
        onClick={() =>
          startTransition(() => {
            void fetchMore({ variables: { offset: 4, limit: 2 } });
          })
        }
      >
        Paginate from child
      </button>
    );
  }

  function App() {
    useTrackRenders();
    const [isPending, startTransition] = React.useTransition();
    const [queryRef, { fetchMore }] = useBackgroundQuery(query);

    renderStream.mergeSnapshot({ useBackgroundQueryIsPending: isPending });

    return (
      <>
        <button
          onClick={() =>
            startTransition(() => {
              void fetchMore({ variables: { offset: 2, limit: 2 } });
            })
          }
        >
          Paginate from parent
        </button>
        <Suspense fallback={<SuspenseFallback />}>
          <ReadQueryHook queryRef={queryRef} />
        </Suspense>
      </>
    );
  }

  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

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

  await user.click(screen.getByText("Paginate from parent"));

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot).toEqual({
      useBackgroundQueryIsPending: true,
      useQueryRefHandlersIsPending: false,
      result: {
        data: {
          letters: [
            { __typename: "Letter", letter: "A", position: 1 },
            { __typename: "Letter", letter: "B", position: 2 },
          ],
        },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot).toEqual({
      useBackgroundQueryIsPending: false,
      useQueryRefHandlersIsPending: false,
      result: {
        data: {
          letters: [
            { __typename: "Letter", letter: "C", position: 3 },
            { __typename: "Letter", letter: "D", position: 4 },
          ],
        },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  await user.click(screen.getByText("Paginate from child"));

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot).toEqual({
      useBackgroundQueryIsPending: false,
      useQueryRefHandlersIsPending: true,
      result: {
        data: {
          letters: [
            { __typename: "Letter", letter: "C", position: 3 },
            { __typename: "Letter", letter: "D", position: 4 },
          ],
        },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot).toEqual({
      useBackgroundQueryIsPending: false,
      useQueryRefHandlersIsPending: false,
      result: {
        data: {
          letters: [
            { __typename: "Letter", letter: "E", position: 5 },
            { __typename: "Letter", letter: "F", position: 6 },
          ],
        },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  await expect(renderStream).not.toRerender();
});

test("can subscribe to subscriptions and react to cache updates via `subscribeToMore`", async () => {
  interface SubscriptionData {
    greetingUpdated: string;
  }

  type UpdateQueryFn = SubscribeToMoreUpdateQueryFn<
    SimpleCaseData,
    Record<string, never>,
    SubscriptionData
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

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query);

  using _disabledAct = disableActEnvironment();
  const renderStream = createRenderStream({
    initialSnapshot: {
      subscribeToMore: null as SubscribeToMoreFunction<
        SimpleCaseData,
        Record<string, never>
      > | null,
      result: null as UseReadQueryResult<SimpleCaseData> | null,
    },
  });

  function SuspenseFallback() {
    useTrackRenders();
    return <p>Loading</p>;
  }

  function ReadQueryHook() {
    useTrackRenders();
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function App() {
    useTrackRenders();
    // We can ignore the return result here since we are testing the mechanics
    // of this hook to ensure it doesn't interfere with the updates from
    // useReadQuery
    const { subscribeToMore } = useQueryRefHandlers(queryRef);

    renderStream.mergeSnapshot({ subscribeToMore });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook />
      </Suspense>
    );
  }

  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

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
      complete: true,
      previousData: { greeting: "Hello" },
      subscriptionData: {
        data: { greetingUpdated: "Subscription hello" },
      },
      variables: {},
    }
  );
});
