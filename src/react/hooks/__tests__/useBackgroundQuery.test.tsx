import React, { ComponentProps, Fragment, StrictMode, Suspense } from "react";
import {
  act,
  render,
  screen,
  screen as _screen,
  renderHook,
  RenderHookOptions,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ErrorBoundary as ReactErrorBoundary,
  ErrorBoundaryProps,
  FallbackProps,
} from "react-error-boundary";
import { expectTypeOf } from "expect-type";
import { GraphQLError } from "graphql";
import {
  gql,
  ApolloError,
  DocumentNode,
  ApolloClient,
  ErrorPolicy,
  NetworkStatus,
  ApolloCache,
  TypedDocumentNode,
  ApolloLink,
  Observable,
  OperationVariables,
  ApolloQueryResult,
} from "../../../core";
import {
  MockedResponse,
  MockLink,
  MockSubscriptionLink,
  mockSingleLink,
} from "../../../testing";
import {
  concatPagination,
  offsetLimitPagination,
  DeepPartial,
  cloneDeep,
} from "../../../utilities";
import { useBackgroundQuery } from "../useBackgroundQuery";
import { UseReadQueryResult, useReadQuery } from "../useReadQuery";
import { ApolloProvider } from "../../context";
import { QueryReference } from "../../cache/QueryReference";
import { InMemoryCache } from "../../../cache";
import {
  SuspenseQueryHookFetchPolicy,
  SuspenseQueryHookOptions,
} from "../../types/types";
import equal from "@wry/equality";
import { RefetchWritePolicy } from "../../../core/watchQueryOptions";
import { skipToken } from "../constants";
import {
  PaginatedCaseData,
  Profiler,
  SimpleCaseData,
  VariablesCaseData,
  VariablesCaseVariables,
  createProfiler,
  profile,
  renderWithClient,
  renderWithMocks,
  setupPaginatedCase,
  setupSimpleCase,
  setupVariablesCase,
  spyOnConsole,
  useTrackRenders,
} from "../../../testing/internal";

function useVariablesIntegrationTestCase() {
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
  let mocks = [...CHARACTERS].map((name, index) => ({
    request: { query, variables: { id: String(index + 1) } },
    result: { data: { character: { id: String(index + 1), name } } },
  }));
  return { mocks, query };
}

function renderVariablesIntegrationTest({
  variables,
  mocks,
  errorPolicy,
  options,
  cache,
}: {
  mocks?: {
    request: { query: DocumentNode; variables: { id: string } };
    result: {
      data?: {
        character: {
          id: string;
          name: string | null;
        };
      };
    };
  }[];
  variables: { id: string };
  options?: SuspenseQueryHookOptions;
  cache?: InMemoryCache;
  errorPolicy?: ErrorPolicy;
}) {
  let { mocks: _mocks, query } = useVariablesIntegrationTestCase();

  // duplicate mocks with (updated) in the name for refetches
  _mocks = [..._mocks, ..._mocks, ..._mocks].map(
    ({ request, result }, index) => {
      return {
        request: request,
        result: {
          data: {
            character: {
              ...result.data.character,
              name:
                index > 3 ?
                  index > 7 ?
                    `${result.data.character.name} (updated again)`
                  : `${result.data.character.name} (updated)`
                : result.data.character.name,
            },
          },
        },
        delay: 200,
      };
    }
  );
  const client = new ApolloClient({
    cache: cache || new InMemoryCache(),
    link: new MockLink(mocks || _mocks),
  });
  interface Renders {
    errors: Error[];
    errorCount: number;
    suspenseCount: number;
    count: number;
    frames: {
      data: VariablesCaseData;
      networkStatus: NetworkStatus;
      error: ApolloError | undefined;
    }[];
  }
  const renders: Renders = {
    errors: [],
    errorCount: 0,
    suspenseCount: 0,
    count: 0,
    frames: [],
  };

  const errorBoundaryProps: ErrorBoundaryProps = {
    fallback: <div>Error</div>,
    onError: (error) => {
      renders.errorCount++;
      renders.errors.push(error);
    },
  };

  function SuspenseFallback() {
    renders.suspenseCount++;
    return <div>loading</div>;
  }

  function Child({
    refetch,
    variables: _variables,
    queryRef,
  }: {
    variables: VariablesCaseVariables;
    refetch: (
      variables?: Partial<OperationVariables> | undefined
    ) => Promise<ApolloQueryResult<VariablesCaseData>>;
    queryRef: QueryReference<VariablesCaseData>;
  }) {
    const { data, error, networkStatus } = useReadQuery(queryRef);
    const [variables, setVariables] = React.useState(_variables);
    // count renders in the child component
    renders.count++;
    renders.frames.push({ data, networkStatus, error });

    return (
      <div>
        {error ?
          <div>{error.message}</div>
        : null}
        <button
          onClick={() => {
            refetch(variables);
          }}
        >
          Refetch
        </button>
        <button
          onClick={() => {
            setVariables({ id: "2" });
          }}
        >
          Set variables to id: 2
        </button>
        {data?.character.id} - {data?.character.name}
      </div>
    );
  }

  function ParentWithVariables({
    variables,
    errorPolicy = "none",
  }: {
    variables: VariablesCaseVariables;
    errorPolicy?: ErrorPolicy;
  }) {
    const [queryRef, { refetch }] = useBackgroundQuery(query, {
      ...options,
      variables,
      errorPolicy,
    });
    return (
      <Child refetch={refetch} variables={variables} queryRef={queryRef} />
    );
  }

  function App({
    variables,
    errorPolicy,
  }: {
    variables: VariablesCaseVariables;
    errorPolicy?: ErrorPolicy;
  }) {
    return (
      <ApolloProvider client={client}>
        <ReactErrorBoundary {...errorBoundaryProps}>
          <Suspense fallback={<SuspenseFallback />}>
            <ParentWithVariables
              variables={variables}
              errorPolicy={errorPolicy}
            />
          </Suspense>
        </ReactErrorBoundary>
      </ApolloProvider>
    );
  }

  const ProfiledApp = profile<Renders, ComponentProps<typeof App>>({
    Component: App,
    snapshotDOM: true,
    onRender: ({ replaceSnapshot }) => replaceSnapshot(cloneDeep(renders)),
  });

  const { ...rest } = render(
    <ProfiledApp errorPolicy={errorPolicy} variables={variables} />
  );
  const rerender = ({ variables }: { variables: VariablesCaseVariables }) => {
    return rest.rerender(<App variables={variables} />);
  };
  return {
    ...rest,
    ProfiledApp,
    query,
    rerender,
    client,
    renders,
    mocks: mocks || _mocks,
  };
}

type RenderSuspenseHookOptions<Props, TSerializedCache = {}> = Omit<
  RenderHookOptions<Props>,
  "wrapper"
> & {
  client?: ApolloClient<TSerializedCache>;
  link?: ApolloLink;
  cache?: ApolloCache<TSerializedCache>;
  mocks?: MockedResponse[];
  strictMode?: boolean;
};

interface Renders<Result> {
  errors: Error[];
  errorCount: number;
  suspenseCount: number;
  count: number;
  frames: Result[];
}

interface SimpleQueryData {
  greeting: string;
}

function renderSuspenseHook<Result, Props>(
  render: (initialProps: Props) => Result,
  options: RenderSuspenseHookOptions<Props> = Object.create(null)
) {
  function SuspenseFallback() {
    renders.suspenseCount++;

    return <div>loading</div>;
  }

  const renders: Renders<Result> = {
    errors: [],
    errorCount: 0,
    suspenseCount: 0,
    count: 0,
    frames: [],
  };

  const { mocks = [], strictMode, ...renderHookOptions } = options;

  const client =
    options.client ||
    new ApolloClient({
      cache: options.cache || new InMemoryCache(),
      link: options.link || new MockLink(mocks),
    });

  const view = renderHook(
    (props) => {
      renders.count++;

      const view = render(props);

      renders.frames.push(view);

      return view;
    },
    {
      ...renderHookOptions,
      wrapper: ({ children }) => {
        const Wrapper = strictMode ? StrictMode : Fragment;

        return (
          <Wrapper>
            <Suspense fallback={<SuspenseFallback />}>
              <ReactErrorBoundary
                fallback={<div>Error</div>}
                onError={(error) => {
                  renders.errorCount++;
                  renders.errors.push(error);
                }}
              >
                <ApolloProvider client={client}>{children}</ApolloProvider>
              </ReactErrorBoundary>
            </Suspense>
          </Wrapper>
        );
      },
    }
  );

  return { ...view, renders };
}

function createDefaultTrackedComponents<
  Snapshot extends { result: UseReadQueryResult<any> | null },
  TData = Snapshot["result"] extends UseReadQueryResult<infer TData> | null ?
    TData
  : unknown,
>(Profiler: Profiler<Snapshot>) {
  function SuspenseFallback() {
    useTrackRenders();
    return <div>Loading</div>;
  }

  function ReadQueryHook({ queryRef }: { queryRef: QueryReference<TData> }) {
    useTrackRenders();
    Profiler.mergeSnapshot({
      result: useReadQuery(queryRef),
    } as Partial<Snapshot>);

    return null;
  }

  return { SuspenseFallback, ReadQueryHook };
}

function createTrackedErrorComponents<Snapshot extends { error: Error | null }>(
  Profiler: Profiler<Snapshot>
) {
  function ErrorFallback({ error }: FallbackProps) {
    useTrackRenders({ name: "ErrorFallback" });
    Profiler.mergeSnapshot({ error } as Partial<Snapshot>);

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
  return createProfiler({
    initialSnapshot: {
      error: null as Error | null,
      result: null as UseReadQueryResult<TData> | null,
    },
  });
}
function createDefaultProfiler<TData = unknown>() {
  return createProfiler({
    initialSnapshot: {
      result: null as UseReadQueryResult<TData> | null,
    },
  });
}

it("fetches a simple query with minimal config", async () => {
  const { query, mocks } = setupSimpleCase();

  const Profiler = createDefaultProfiler<SimpleCaseData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query);

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  renderWithMocks(<App />, { mocks, wrapper: Profiler });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { renderedComponents, snapshot } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it("allows the client to be overridden", async () => {
  const { query } = setupSimpleCase();

  const globalClient = new ApolloClient({
    link: new ApolloLink(() =>
      Observable.of({ data: { greeting: "global hello" } })
    ),
    cache: new InMemoryCache(),
  });

  const localClient = new ApolloClient({
    link: new ApolloLink(() =>
      Observable.of({ data: { greeting: "local hello" } })
    ),
    cache: new InMemoryCache(),
  });

  const Profiler = createDefaultProfiler<SimpleCaseData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, { client: localClient });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  renderWithClient(<App />, { client: globalClient, wrapper: Profiler });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "local hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
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

  const Profiler = createDefaultProfiler();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

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

  renderWithMocks(<App />, { link, wrapper: Profiler });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { context: { valueA: "A", valueB: "B" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it('enables canonical results when canonizeResults is "true"', async () => {
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

  cache.writeQuery({ query, data: { results } });

  const Profiler = createDefaultProfiler<Data>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, { canonizeResults: true });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  renderWithMocks(<App />, { cache, wrapper: Profiler });

  const {
    snapshot: { result },
  } = await Profiler.takeRender();

  const resultSet = new Set(result!.data.results);
  const values = Array.from(resultSet).map((item) => item.value);

  expect(result!.data).toEqual({ results });
  expect(result!.data.results.length).toBe(6);
  expect(resultSet.size).toBe(5);
  expect(values).toEqual([0, 1, 2, 3, 5]);
});

it("can disable canonical results when the cache's canonizeResults setting is true", async () => {
  interface Result {
    __typename: string;
    value: number;
  }

  interface Data {
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

  cache.writeQuery({ query, data: { results } });

  const Profiler = createDefaultProfiler<Data>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, { canonizeResults: false });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  renderWithMocks(<App />, { cache, wrapper: Profiler });

  const { snapshot } = await Profiler.takeRender();
  const result = snapshot.result!;

  const resultSet = new Set(result.data.results);
  const values = Array.from(resultSet).map((item) => item.value);

  expect(result.data).toEqual({ results });
  expect(result.data.results.length).toBe(6);
  expect(resultSet.size).toBe(6);
  expect(values).toEqual([0, 1, 1, 2, 3, 5]);
});

it("returns initial cache data followed by network data when the fetch policy is `cache-and-network`", async () => {
  const { query } = setupSimpleCase();
  const cache = new InMemoryCache();
  const link = mockSingleLink({
    request: { query },
    result: { data: { greeting: "from link" } },
    delay: 20,
  });

  const client = new ApolloClient({ link, cache });

  cache.writeQuery({ query, data: { greeting: "from cache" } });

  const Profiler = createDefaultProfiler<SimpleCaseData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

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

  renderWithClient(<App />, { client, wrapper: Profiler });

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "from cache" },
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "from link" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(Profiler).not.toRerender();
});

it("all data is present in the cache, no network request is made", async () => {
  const { query } = setupSimpleCase();
  const cache = new InMemoryCache();
  const link = mockSingleLink({
    request: { query },
    result: { data: { greeting: "from link" } },
    delay: 20,
  });

  const client = new ApolloClient({ link, cache });

  cache.writeQuery({ query, data: { greeting: "from cache" } });

  const Profiler = createDefaultProfiler<SimpleCaseData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

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

  renderWithClient(<App />, { client, wrapper: Profiler });

  const { snapshot, renderedComponents } = await Profiler.takeRender();

  expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
  expect(snapshot.result).toEqual({
    data: { greeting: "from cache" },
    error: undefined,
    networkStatus: NetworkStatus.ready,
  });

  await expect(Profiler).not.toRerender();
});

it("partial data is present in the cache so it is ignored and network request is made", async () => {
  const query = gql`
    {
      hello
      foo
    }
  `;
  const cache = new InMemoryCache();
  const link = mockSingleLink({
    request: { query },
    result: { data: { hello: "from link", foo: "bar" } },
    delay: 20,
  });

  const client = new ApolloClient({ link, cache });

  {
    // we expect a "Missing field 'foo' while writing result..." error
    // when writing hello to the cache, so we'll silence the console.error
    using _consoleSpy = spyOnConsole("error");
    cache.writeQuery({ query, data: { hello: "from cache" } });
  }

  const Profiler = createDefaultProfiler();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

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

  renderWithClient(<App />, { client, wrapper: Profiler });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { foo: "bar", hello: "from link" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it("existing data in the cache is ignored when fetchPolicy is 'network-only'", async () => {
  const { query } = setupSimpleCase();
  const cache = new InMemoryCache();
  const link = mockSingleLink({
    request: { query },
    result: { data: { greeting: "from link" } },
    delay: 20,
  });

  const client = new ApolloClient({ link, cache });

  cache.writeQuery({ query, data: { greeting: "from cache" } });

  const Profiler = createDefaultProfiler<SimpleCaseData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

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

  renderWithClient(<App />, { client, wrapper: Profiler });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "from link" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(client.cache.extract()).toEqual({
    ROOT_QUERY: { __typename: "Query", greeting: "from link" },
  });
});

it("fetches data from the network but does not update the cache when fetchPolicy is 'no-cache'", async () => {
  const { query } = setupSimpleCase();
  const cache = new InMemoryCache();
  const link = mockSingleLink({
    request: { query },
    result: { data: { greeting: "from link" } },
    delay: 20,
  });

  const client = new ApolloClient({ link, cache });

  cache.writeQuery({ query, data: { greeting: "from cache" } });

  const Profiler = createDefaultProfiler<SimpleCaseData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, { fetchPolicy: "no-cache" });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  renderWithClient(<App />, { client, wrapper: Profiler });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "from link" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(client.cache.extract()).toEqual({
    ROOT_QUERY: { __typename: "Query", greeting: "from cache" },
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

  const mocks: MockedResponse<Data, Variables>[] = [
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

  const Profiler = createProfiler({
    initialSnapshot: {
      isPending: false,
      result: null as UseReadQueryResult<Data> | null,
    },
  });

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

  function App() {
    useTrackRenders();
    const [id, setId] = React.useState("1");
    const [isPending, startTransition] = React.useTransition();
    const [queryRef] = useBackgroundQuery(query, {
      variables: { id },
    });

    Profiler.mergeSnapshot({ isPending });

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

  renderWithClient(<App />, { client, wrapper: Profiler });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot).toEqual({
      isPending: false,
      result: {
        data: { todo: { id: "1", name: "Clean room", completed: false } },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  await act(() => user.click(screen.getByText("Change todo")));

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    // startTransition will avoid rendering the suspense fallback for already
    // revealed content if the state update inside the transition causes the
    // component to suspend.
    //
    // Here we should not see the suspense fallback while the component suspends
    // until the todo is finished loading. Seeing the suspense fallback is an
    // indication that we are suspending the component too late in the process.

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
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
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    // Eventually we should see the updated todo content once its done
    // suspending.
    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot).toEqual({
      isPending: false,
      result: {
        data: { todo: { id: "2", name: "Take out trash", completed: true } },
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
  const client = new ApolloClient({ cache, link });

  const Profiler = createDefaultProfiler<Data>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

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

  renderWithClient(<App />, { client, wrapper: Profiler });

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

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
    const { snapshot, renderedComponents } = await Profiler.takeRender();

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

  link.simulateResult({
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
  });

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

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

  await expect(Profiler).not.toRerender();
});

it("reacts to cache updates", async () => {
  const { query, mocks } = setupSimpleCase();

  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache: new InMemoryCache(),
  });

  const Profiler = createDefaultProfiler<SimpleCaseData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query);

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  renderWithClient(<App />, { client, wrapper: Profiler });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
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
    data: { greeting: "Hello again" },
  });

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Hello again" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.writeQuery({
    query,
    data: { greeting: "You again?" },
  });

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "You again?" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(Profiler).not.toRerender();
});

it("reacts to variables updates", async () => {
  const { query, mocks } = setupVariablesCase();

  const Profiler = createDefaultProfiler<VariablesCaseData>();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

  function App({ id }: { id: string }) {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, { variables: { id } });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  const { rerender } = renderWithMocks(<App id="1" />, {
    mocks,
    wrapper: Profiler,
  });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  rerender(<App id="2" />);

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: {
        character: { __typename: "Character", id: "2", name: "Black Widow" },
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it("does not suspend when `skip` is true", async () => {
  const { query, mocks } = setupSimpleCase();

  const Profiler = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, { skip: true });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        {queryRef && <ReadQueryHook queryRef={queryRef} />}
      </Suspense>
    );
  }

  renderWithMocks(<App />, { mocks, wrapper: Profiler });

  const { renderedComponents } = await Profiler.takeRender();

  expect(renderedComponents).toStrictEqual([App]);

  await expect(Profiler).not.toRerender();
});

it("does not suspend when using `skipToken` in options", async () => {
  const { query, mocks } = setupSimpleCase();

  const Profiler = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query, skipToken);

    return (
      <Suspense fallback={<SuspenseFallback />}>
        {queryRef && <ReadQueryHook queryRef={queryRef} />}
      </Suspense>
    );
  }

  renderWithMocks(<App />, { mocks, wrapper: Profiler });

  const { renderedComponents } = await Profiler.takeRender();

  expect(renderedComponents).toStrictEqual([App]);

  await expect(Profiler).not.toRerender();
});

it("suspends when `skip` becomes `false` after it was `true`", async () => {
  const { query, mocks } = setupSimpleCase();
  const user = userEvent.setup();

  const Profiler = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

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

  renderWithMocks(<App />, { mocks, wrapper: Profiler });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App]);
  }

  await act(() => user.click(screen.getByText("Run query")));

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
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

it("suspends when switching away from `skipToken` in options", async () => {
  const { query, mocks } = setupSimpleCase();

  const user = userEvent.setup();
  const Profiler = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

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

  renderWithMocks(<App />, { mocks, wrapper: Profiler });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App]);
  }

  await act(() => user.click(screen.getByText("Run query")));

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
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

it("renders skip result, does not suspend, and maintains `data` when `skip` becomes `true` after it was `false`", async () => {
  const { query, mocks } = setupSimpleCase();

  const user = userEvent.setup();
  const Profiler = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

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

  renderWithMocks(<App />, { mocks, wrapper: Profiler });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Toggle skip")));

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(Profiler).not.toRerender();
});

it("renders skip result, does not suspend, and maintains `data` when switching back to `skipToken`", async () => {
  const { query, mocks } = setupSimpleCase();
  const user = userEvent.setup();
  const Profiler = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

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

  renderWithMocks(<App />, { mocks, wrapper: Profiler });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Toggle skip")));

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(Profiler).not.toRerender();
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

  const Profiler = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

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

  renderWithClient(<App />, { client, wrapper: Profiler });

  // initial skipped result
  await Profiler.takeRender();
  expect(fetchCount).toBe(0);

  // Toggle skip to `false`
  await act(() => user.click(screen.getByText("Toggle skip")));

  expect(fetchCount).toBe(1);
  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  // Toggle skip to `true`
  await act(() => user.click(screen.getByText("Toggle skip")));

  expect(fetchCount).toBe(1);
  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it("does not make network requests when `skipToken` is used", async () => {
  const { query, mocks } = setupSimpleCase();
  const Profiler = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);
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

  renderWithClient(<App />, { client, wrapper: Profiler });

  // initial skipped result
  await Profiler.takeRender();
  expect(fetchCount).toBe(0);

  // Toggle skip to `false`
  await act(() => user.click(screen.getByText("Toggle skip")));

  expect(fetchCount).toBe(1);
  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  // Toggle skip to `true`
  await act(() => user.click(screen.getByText("Toggle skip")));

  expect(fetchCount).toBe(1);
  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it("result is referentially stable", async () => {
  const { query, mocks } = setupSimpleCase();

  let result: UseReadQueryResult<SimpleCaseData> | null = null;

  const Profiler = createDefaultProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

  function App() {
    useTrackRenders();
    const [queryRef] = useBackgroundQuery(query);

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook queryRef={queryRef} />
      </Suspense>
    );
  }

  const { rerender } = renderWithMocks(<App />, { mocks, wrapper: Profiler });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });

    result = snapshot.result;
  }

  rerender(<App />);

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toBe(result);
  }
});

it("`skip` option works with `startTransition`", async () => {
  const { query, mocks } = setupSimpleCase();

  const user = userEvent.setup();
  const Profiler = createProfiler({
    initialSnapshot: {
      isPending: false,
      result: null as UseReadQueryResult<SimpleCaseData> | null,
    },
  });
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

  function App() {
    useTrackRenders();
    const [skip, setSkip] = React.useState(true);
    const [isPending, startTransition] = React.useTransition();
    const [queryRef] = useBackgroundQuery(query, { skip });

    Profiler.mergeSnapshot({ isPending });

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

  renderWithMocks(<App />, { mocks, wrapper: Profiler });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App]);
  }

  // Toggle skip to `false`
  await act(() => user.click(screen.getByText("Toggle skip")));

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App]);
    expect(snapshot).toEqual({
      isPending: true,
      result: null,
    });
  }

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot).toEqual({
      isPending: false,
      result: {
        data: { greeting: "Hello" },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  await expect(Profiler).not.toRerender();
});

it("`skipToken` works with `startTransition`", async () => {
  const { query, mocks } = setupSimpleCase();
  const user = userEvent.setup();

  const Profiler = createProfiler({
    initialSnapshot: {
      isPending: false,
      result: null as UseReadQueryResult<SimpleCaseData> | null,
    },
  });

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

  function App() {
    useTrackRenders();
    const [skip, setSkip] = React.useState(true);
    const [isPending, startTransition] = React.useTransition();
    const [queryRef] = useBackgroundQuery(query, skip ? skipToken : undefined);

    Profiler.mergeSnapshot({ isPending });

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

  renderWithMocks(<App />, { mocks, wrapper: Profiler });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App]);
  }

  // Toggle skip to `false`
  await act(() => user.click(screen.getByText("Toggle skip")));

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App]);
    expect(snapshot).toEqual({
      isPending: true,
      result: null,
    });
  }

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot).toEqual({
      isPending: false,
      result: {
        data: { greeting: "Hello" },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  await expect(Profiler).not.toRerender();
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

  const Profiler = createErrorProfiler<SimpleCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);
  const { ErrorBoundary } = createTrackedErrorComponents(Profiler);

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

  renderWithMocks(<App />, { mocks, wrapper: Profiler });

  // initial render
  await Profiler.takeRender();

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Change error policy")));
  await Profiler.takeRender();

  await act(() => user.click(screen.getByText("Refetch greeting")));
  await Profiler.takeRender();

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot).toEqual({
      error: null,
      result: {
        data: { greeting: "Hello" },
        error: new ApolloError({ graphQLErrors: [new GraphQLError("oops")] }),
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

  const Profiler = createDefaultProfiler<Data>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

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

  renderWithClient(<App />, { client, wrapper: Profiler });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { context: { phase: "initial" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Update context")));
  await Profiler.takeRender();

  await act(() => user.click(screen.getByText("Refetch")));
  await Profiler.takeRender();

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { context: { phase: "rerender" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
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

  const user = userEvent.setup();

  cache.writeQuery({
    query,
    data: { results },
  });

  const Profiler = createDefaultProfiler<Data>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

  function App() {
    useTrackRenders();
    const [canonizeResults, setCanonizeResults] = React.useState(false);
    const [queryRef] = useBackgroundQuery(query, {
      canonizeResults,
    });

    return (
      <>
        <button onClick={() => setCanonizeResults(true)}>
          Canonize results
        </button>
        <Suspense fallback={<SuspenseFallback />}>
          <ReadQueryHook queryRef={queryRef} />
        </Suspense>
      </>
    );
  }

  renderWithMocks(<App />, { cache, wrapper: Profiler });

  {
    const { snapshot } = await Profiler.takeRender();
    const result = snapshot.result!;
    const resultSet = new Set(result.data.results);
    const values = Array.from(resultSet).map((item) => item.value);

    expect(result.data).toEqual({ results });
    expect(result.data.results.length).toBe(6);
    expect(resultSet.size).toBe(6);
    expect(values).toEqual([0, 1, 1, 2, 3, 5]);
  }

  await act(() => user.click(screen.getByText("Canonize results")));

  {
    const { snapshot } = await Profiler.takeRender();
    const result = snapshot.result!;
    const resultSet = new Set(result.data.results);
    const values = Array.from(resultSet).map((item) => item.value);

    expect(result.data).toEqual({ results });
    expect(result.data.results.length).toBe(6);
    expect(resultSet.size).toBe(5);
    expect(values).toEqual([0, 1, 2, 3, 5]);
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

  const Profiler = createDefaultProfiler<Data>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

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

  renderWithClient(<App />, { client, wrapper: Profiler });

  // initial suspended render
  await Profiler.takeRender();

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { primes: [2, 3, 5, 7, 11] },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
    expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);
  }

  await act(() => user.click(screen.getByText("Refetch next")));
  await Profiler.takeRender();

  {
    const { snapshot } = await Profiler.takeRender();

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

  await act(() => user.click(screen.getByText("Change refetch write policy")));
  await Profiler.takeRender();

  await act(() => user.click(screen.getByText("Refetch last")));
  await Profiler.takeRender();

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { primes: [31, 37, 41, 43, 47] },
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
  const { query } = setupVariablesCase();

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

  const mocks: MockedResponse<VariablesCaseData>[] = [
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

  const Profiler = createDefaultProfiler<VariablesCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

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

  renderWithClient(<App />, { client, wrapper: Profiler });

  // initial suspended render
  await Profiler.takeRender();

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: {
        character: { __typename: "Character", id: "1", name: "Doctor Strange" },
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Update partial data")));
  await Profiler.takeRender();

  cache.modify({
    id: cache.identify({ __typename: "Character", id: "1" }),
    fields: {
      name: (_, { DELETE }) => DELETE,
    },
  });

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { character: { __typename: "Character", id: "1" } },
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  {
    const { snapshot } = await Profiler.takeRender();

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

  const Profiler = createDefaultProfiler<VariablesCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);

  function App() {
    const [fetchPolicy, setFetchPolicy] =
      React.useState<SuspenseQueryHookFetchPolicy>("cache-first");

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

  renderWithClient(<App />, { client, wrapper: Profiler });

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: {
        character: {
          __typename: "Character",
          id: "1",
          name: "Spider-Cacheman",
        },
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Change fetch policy")));
  await Profiler.takeRender();

  await act(() => user.click(screen.getByText("Refetch")));
  await Profiler.takeRender();

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  // Because we switched to a `no-cache` fetch policy, we should not see the
  // newly fetched data in the cache after the fetch occurred.
  expect(cache.readQuery({ query, variables: { id: "1" } })).toEqual({
    character: {
      __typename: "Character",
      id: "1",
      name: "Spider-Cacheman",
    },
  });
});

it("properly handles changing options along with changing `variables`", async () => {
  const { query } = setupVariablesCase();
  const user = userEvent.setup();
  const mocks: MockedResponse<VariablesCaseData>[] = [
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

  const Profiler = createErrorProfiler<VariablesCaseData>();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultTrackedComponents(Profiler);
  const { ErrorBoundary } = createTrackedErrorComponents(Profiler);

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

  renderWithClient(<App />, { client, wrapper: Profiler });

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot).toEqual({
      error: null,
      result: {
        data: {
          character: {
            __typename: "Character",
            id: "1",
            name: "Doctor Strangecache",
          },
        },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  await act(() => user.click(screen.getByText("Get second character")));
  await Profiler.takeRender();

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot).toEqual({
      error: null,
      result: {
        data: {
          character: {
            __typename: "Character",
            id: "2",
            name: "Hulk",
          },
        },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  await act(() => user.click(screen.getByText("Get first character")));

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot).toEqual({
      error: null,
      result: {
        data: {
          character: {
            __typename: "Character",
            id: "1",
            name: "Doctor Strangecache",
          },
        },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      },
    });
  }

  await act(() => user.click(screen.getByText("Refetch")));
  await Profiler.takeRender();

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    // Ensure we render the inline error instead of the error boundary, which
    // tells us the error policy was properly applied.
    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot).toEqual({
      error: null,
      result: {
        data: {
          character: {
            __typename: "Character",
            id: "1",
            name: "Doctor Strangecache",
          },
        },
        error: new ApolloError({ graphQLErrors: [new GraphQLError("oops")] }),
        networkStatus: NetworkStatus.error,
      },
    });
  }
});

describe("refetch", () => {
  it("re-suspends when calling `refetch`", async () => {
    const { query, mocks: defaultMocks } = setupVariablesCase();
    const user = userEvent.setup();
    const Profiler = createDefaultProfiler<VariablesCaseData>();
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(Profiler);

    const mocks: MockedResponse<VariablesCaseData>[] = [
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

    renderWithMocks(<App />, { mocks, wrapper: Profiler });

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await Profiler.takeRender();

      expect(snapshot.result).toEqual({
        data: {
          character: {
            __typename: "Character",
            id: "1",
            name: "Spider-Man",
          },
        },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    await act(() => user.click(screen.getByText("Refetch")));

    {
      // parent component re-suspends
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await Profiler.takeRender();

      expect(snapshot.result).toEqual({
        data: {
          character: {
            __typename: "Character",
            id: "1",
            name: "Spider-Man (refetched)",
          },
        },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    await expect(Profiler).not.toRerender();
  });

  it("re-suspends when calling `refetch` with new variables", async () => {
    const { query, mocks } = setupVariablesCase();
    const user = userEvent.setup();
    const Profiler = createDefaultProfiler<VariablesCaseData>();
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(Profiler);

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

    renderWithMocks(<App />, { mocks, wrapper: Profiler });

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await Profiler.takeRender();

      expect(snapshot.result).toEqual({
        data: {
          character: {
            __typename: "Character",
            id: "1",
            name: "Spider-Man",
          },
        },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    await act(() => user.click(screen.getByText("Refetch")));

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await Profiler.takeRender();

      expect(snapshot.result).toEqual({
        data: {
          character: {
            __typename: "Character",
            id: "2",
            name: "Black Widow",
          },
        },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }
  });

  it("re-suspends multiple times when calling `refetch` multiple times", async () => {
    const { query, mocks: defaultMocks } = setupVariablesCase();
    const user = userEvent.setup();
    const Profiler = createDefaultProfiler<VariablesCaseData>();
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(Profiler);

    const mocks: MockedResponse<VariablesCaseData>[] = [
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

    renderWithMocks(<App />, { mocks, wrapper: Profiler });

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await Profiler.takeRender();

      expect(snapshot.result).toEqual({
        data: {
          character: { __typename: "Character", id: "1", name: "Spider-Man" },
        },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    const button = screen.getByText("Refetch");

    await act(() => user.click(button));

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await Profiler.takeRender();

      expect(snapshot.result).toEqual({
        data: {
          character: {
            __typename: "Character",
            id: "1",
            name: "Spider-Man (refetched)",
          },
        },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    await act(() => user.click(button));

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await Profiler.takeRender();

      expect(snapshot.result).toEqual({
        data: {
          character: {
            __typename: "Character",
            id: "1",
            name: "Spider-Man (refetched again)",
          },
        },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }
  });

  it("throws errors when errors are returned after calling `refetch`", async () => {
    using _consoleSpy = spyOnConsole("error");
    const { query, mocks: defaultMocks } = setupVariablesCase();
    const user = userEvent.setup();
    const mocks: MockedResponse<VariablesCaseData>[] = [
      ...defaultMocks,
      {
        request: { query, variables: { id: "1" } },
        result: {
          errors: [new GraphQLError("Something went wrong")],
        },
        delay: 10,
      },
    ];

    const Profiler = createErrorProfiler<VariablesCaseData>();
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(Profiler);
    const { ErrorBoundary } = createTrackedErrorComponents(Profiler);

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

    renderWithMocks(<App />, { mocks, wrapper: Profiler });

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await Profiler.takeRender();

      expect(snapshot).toEqual({
        error: null,
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "1",
              name: "Spider-Man",
            },
          },
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }

    await act(() => user.click(screen.getByText("Refetch")));

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot, renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual(["ErrorFallback"]);
      expect(snapshot.error).toEqual(
        new ApolloError({
          graphQLErrors: [new GraphQLError("Something went wrong")],
        })
      );
    }
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

    const Profiler = createErrorProfiler<VariablesCaseData | undefined>();
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(Profiler);
    const { ErrorBoundary } = createTrackedErrorComponents(Profiler);

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

    renderWithMocks(<App />, { mocks, wrapper: Profiler });

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await Profiler.takeRender();

      expect(snapshot).toEqual({
        error: null,
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "1",
              name: "Spider-Man",
            },
          },
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }

    await act(() => user.click(screen.getByText("Refetch")));

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await Profiler.takeRender();

      expect(snapshot).toEqual({
        error: null,
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "1",
              name: "Spider-Man",
            },
          },
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }
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

    const Profiler = createErrorProfiler<VariablesCaseData | undefined>();
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(Profiler);
    const { ErrorBoundary } = createTrackedErrorComponents(Profiler);

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

    renderWithMocks(<App />, { mocks, wrapper: Profiler });

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await Profiler.takeRender();

      expect(snapshot).toEqual({
        error: null,
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "1",
              name: "Spider-Man",
            },
          },
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }

    await act(() => user.click(screen.getByText("Refetch")));

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await Profiler.takeRender();

      expect(snapshot).toEqual({
        error: null,
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "1",
              name: "Spider-Man",
            },
          },
          error: new ApolloError({
            graphQLErrors: [new GraphQLError("Something went wrong")],
          }),
          networkStatus: NetworkStatus.error,
        },
      });
    }
  });

  it('handles partial data results after calling `refetch` when errorPolicy is set to "all"', async () => {
    const { query, mocks: defaultMocks } = setupVariablesCase();
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

    const Profiler = createErrorProfiler<VariablesCaseData | undefined>();
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(Profiler);
    const { ErrorBoundary } = createTrackedErrorComponents(Profiler);

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

    renderWithMocks(<App />, { mocks, wrapper: Profiler });

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await Profiler.takeRender();

      expect(snapshot).toEqual({
        error: null,
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "1",
              name: "Spider-Man",
            },
          },
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }

    await act(() => user.click(screen.getByText("Refetch")));

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await Profiler.takeRender();

      expect(snapshot).toEqual({
        error: null,
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "1",
              name: null,
            },
          },
          error: new ApolloError({
            graphQLErrors: [new GraphQLError("Something went wrong")],
          }),
          networkStatus: NetworkStatus.error,
        },
      });
    }
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

    const Profiler = createErrorProfiler<Data>();
    const { SuspenseFallback } = createDefaultTrackedComponents(Profiler);

    function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
      useTrackRenders();
      Profiler.mergeSnapshot({ error });

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

    function Todo({ queryRef }: { queryRef: QueryReference<Data> }) {
      useTrackRenders();
      Profiler.mergeSnapshot({ result: useReadQuery(queryRef) });

      return null;
    }

    renderWithMocks(<App />, { mocks, wrapper: Profiler });

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      // Disable error message shown in the console due to an uncaught error.
      using _consoleSpy = spyOnConsole("error");
      const { snapshot, renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([ErrorFallback]);
      expect(snapshot).toEqual({
        error: new ApolloError({
          graphQLErrors: [new GraphQLError("Oops couldn't fetch")],
        }),
        result: null,
      });
    }

    await act(() => user.click(screen.getByText("Retry")));

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot, renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([Todo]);
      expect(snapshot).toEqual({
        // TODO: We should reset the snapshot between renders to better capture
        // the actual result. This makes it seem like the error is rendered, but
        // in this is just leftover from the previous snapshot.
        error: new ApolloError({
          graphQLErrors: [new GraphQLError("Oops couldn't fetch")],
        }),
        result: {
          data: { todo: { id: "1", name: "Clean room", completed: true } },
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

    const Profiler = createErrorProfiler<Data>();
    const { SuspenseFallback } = createDefaultTrackedComponents(Profiler);

    function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
      useTrackRenders();
      Profiler.mergeSnapshot({ error });

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

    function Todo({ queryRef }: { queryRef: QueryReference<Data> }) {
      useTrackRenders();
      Profiler.mergeSnapshot({ result: useReadQuery(queryRef) });

      return null;
    }

    renderWithMocks(<App />, { mocks, wrapper: Profiler });

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot, renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([ErrorFallback]);
      expect(snapshot).toEqual({
        error: new ApolloError({
          graphQLErrors: [new GraphQLError("Oops couldn't fetch")],
        }),
        result: null,
      });
    }

    await act(() => user.click(screen.getByText("Retry")));

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot, renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([ErrorFallback]);
      expect(snapshot).toEqual({
        error: new ApolloError({
          graphQLErrors: [new GraphQLError("Oops couldn't fetch again")],
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

    const mocks: MockedResponse<Data, Variables>[] = [
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

    const Profiler = createProfiler({
      initialSnapshot: {
        isPending: false,
        result: null as UseReadQueryResult<Data> | null,
      },
    });

    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(Profiler);

    function App() {
      useTrackRenders();
      const [isPending, startTransition] = React.useTransition();
      const [queryRef, { refetch }] = useBackgroundQuery(query, {
        variables: { id: "1" },
      });

      Profiler.mergeSnapshot({ isPending });

      return (
        <>
          <button
            onClick={() => {
              startTransition(() => {
                refetch();
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

    renderWithMocks(<App />, { mocks, wrapper: Profiler });

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await Profiler.takeRender();

      expect(snapshot).toEqual({
        isPending: false,
        result: {
          data: { todo: { id: "1", name: "Clean room", completed: false } },
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }

    await act(() => user.click(screen.getByText("Refetch")));

    {
      // startTransition will avoid rendering the suspense fallback for already
      // revealed content if the state update inside the transition causes the
      // component to suspend.
      //
      // Here we should not see the suspense fallback while the component
      // suspends until the todo is finished loading. Seeing the suspense
      // fallback is an indication that we are suspending the component too late
      // in the process.
      const { snapshot, renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
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
      const { snapshot, renderedComponents } = await Profiler.takeRender();

      // Eventually we should see the updated todo content once its done
      // suspending.
      expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
      expect(snapshot).toEqual({
        isPending: false,
        result: {
          data: { todo: { id: "1", name: "Clean room", completed: true } },
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }
  });
});

describe("fetchMore", () => {
  it("re-suspends when calling `fetchMore` with different variables", async () => {
    const { query, link } = setupPaginatedCase();
    const user = userEvent.setup();
    const Profiler = createDefaultProfiler<PaginatedCaseData>();
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(Profiler);

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

    renderWithMocks(<App />, { link, wrapper: Profiler });

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await Profiler.takeRender();
      expect(snapshot.result).toEqual({
        data: {
          letters: [
            { __typename: "Letter", position: 1, letter: "A" },
            { __typename: "Letter", position: 2, letter: "B" },
          ],
        },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    await act(() => user.click(screen.getByText("Fetch more")));

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await Profiler.takeRender();
      expect(snapshot.result).toEqual({
        data: {
          letters: [
            { __typename: "Letter", position: 3, letter: "C" },
            { __typename: "Letter", position: 4, letter: "D" },
          ],
        },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }
  });

  it("properly uses `updateQuery` when calling `fetchMore`", async () => {
    const { query, link } = setupPaginatedCase();
    const user = userEvent.setup();
    const Profiler = createDefaultProfiler<PaginatedCaseData>();
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(Profiler);

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

    renderWithMocks(<App />, { link, wrapper: Profiler });

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await Profiler.takeRender();
      expect(snapshot.result).toEqual({
        data: {
          letters: [
            { __typename: "Letter", position: 1, letter: "A" },
            { __typename: "Letter", position: 2, letter: "B" },
          ],
        },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    await act(() => user.click(screen.getByText("Fetch more")));

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await Profiler.takeRender();
      expect(snapshot.result).toEqual({
        data: {
          letters: [
            { __typename: "Letter", position: 1, letter: "A" },
            { __typename: "Letter", position: 2, letter: "B" },
            { __typename: "Letter", position: 3, letter: "C" },
            { __typename: "Letter", position: 4, letter: "D" },
          ],
        },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }
  });

  it("properly uses cache field policies when calling `fetchMore` without `updateQuery`", async () => {
    const { query, link } = setupPaginatedCase();
    const user = userEvent.setup();
    const Profiler = createDefaultProfiler<PaginatedCaseData>();
    const { SuspenseFallback, ReadQueryHook } =
      createDefaultTrackedComponents(Profiler);

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

    renderWithClient(<App />, { client, wrapper: Profiler });

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await Profiler.takeRender();
      expect(snapshot.result).toEqual({
        data: {
          letters: [
            { __typename: "Letter", position: 1, letter: "A" },
            { __typename: "Letter", position: 2, letter: "B" },
          ],
        },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }

    await act(() => user.click(screen.getByText("Fetch more")));

    {
      const { renderedComponents } = await Profiler.takeRender();

      expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
    }

    {
      const { snapshot } = await Profiler.takeRender();
      expect(snapshot.result).toEqual({
        data: {
          letters: [
            { __typename: "Letter", position: 1, letter: "A" },
            { __typename: "Letter", position: 2, letter: "B" },
            { __typename: "Letter", position: 3, letter: "C" },
            { __typename: "Letter", position: 4, letter: "D" },
          ],
        },
        error: undefined,
        networkStatus: NetworkStatus.ready,
      });
    }
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

    const mocks: MockedResponse<Data, Variables>[] = [
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

    function App() {
      return (
        <ApolloProvider client={client}>
          <Suspense fallback={<SuspenseFallback />}>
            <Parent />
          </Suspense>
        </ApolloProvider>
      );
    }

    function SuspenseFallback() {
      return <p>Loading</p>;
    }

    function Parent() {
      const [queryRef, { fetchMore }] = useBackgroundQuery(query, {
        variables: { offset: 0 },
      });
      const onFetchMoreHandler = (variables: Variables) => {
        fetchMore({ variables });
      };
      return <Todo onFetchMore={onFetchMoreHandler} queryRef={queryRef} />;
    }

    function Todo({
      queryRef,
      onFetchMore,
    }: {
      onFetchMore: (variables: Variables) => void;
      queryRef: QueryReference<Data>;
    }) {
      const { data } = useReadQuery(queryRef);
      const [isPending, startTransition] = React.useTransition();
      const { todos } = data;

      return (
        <>
          <button
            onClick={() => {
              startTransition(() => {
                onFetchMore({ offset: 1 });
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

    const ProfiledApp = profile({ Component: App, snapshotDOM: true });
    render(<ProfiledApp />);

    {
      const { withinDOM } = await ProfiledApp.takeRender();
      expect(withinDOM().getByText("Loading")).toBeInTheDocument();
    }

    {
      const { withinDOM } = await ProfiledApp.takeRender();
      expect(withinDOM().getByTestId("todos")).toBeInTheDocument();
      expect(withinDOM().getByTestId("todo:1")).toBeInTheDocument();
    }

    const button = screen.getByText("Load more");
    await act(() => user.click(button));

    {
      const { withinDOM } = await ProfiledApp.takeRender();
      // startTransition will avoid rendering the suspense fallback for already
      // revealed content if the state update inside the transition causes the
      // component to suspend.
      //
      // Here we should not see the suspense fallback while the component suspends
      // until the todo is finished loading. Seeing the suspense fallback is an
      // indication that we are suspending the component too late in the process.
      expect(withinDOM().queryByText("Loading")).not.toBeInTheDocument();

      // We can ensure this works with isPending from useTransition in the process
      expect(withinDOM().getByTestId("todos")).toHaveAttribute(
        "aria-busy",
        "true"
      );

      // Ensure we are showing the stale UI until the new todo has loaded
      expect(withinDOM().getByTestId("todo:1")).toHaveTextContent("Clean room");
    }

    {
      const { withinDOM } = await ProfiledApp.takeRender();
      // Eventually we should see the updated todos content once its done
      // suspending.
      expect(withinDOM().getByTestId("todo:2")).toHaveTextContent(
        "Take out trash (completed)"
      );
      expect(withinDOM().getByTestId("todo:1")).toHaveTextContent("Clean room");
    }
  });

  it('honors refetchWritePolicy set to "merge"', async () => {
    const user = userEvent.setup();

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

    function SuspenseFallback() {
      return <div>loading</div>;
    }

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache,
    });

    function Child({
      refetch,
      queryRef,
    }: {
      refetch: (
        variables?: Partial<OperationVariables> | undefined
      ) => Promise<ApolloQueryResult<QueryData>>;
      queryRef: QueryReference<QueryData>;
    }) {
      const { data, error, networkStatus } = useReadQuery(queryRef);

      return (
        <div>
          <button
            onClick={() => {
              refetch({ min: 12, max: 30 });
            }}
          >
            Refetch
          </button>
          <div data-testid="primes">{data?.primes.join(", ")}</div>
          <div data-testid="network-status">{networkStatus}</div>
          <div data-testid="error">{error?.message || "undefined"}</div>
        </div>
      );
    }

    function Parent() {
      const [queryRef, { refetch }] = useBackgroundQuery(query, {
        variables: { min: 0, max: 12 },
        refetchWritePolicy: "merge",
      });
      return <Child refetch={refetch} queryRef={queryRef} />;
    }

    function App() {
      return (
        <ApolloProvider client={client}>
          <Suspense fallback={<SuspenseFallback />}>
            <Parent />
          </Suspense>
        </ApolloProvider>
      );
    }

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("primes")).toHaveTextContent("2, 3, 5, 7, 11");
    });
    expect(screen.getByTestId("network-status")).toHaveTextContent(
      "7" // ready
    );
    expect(screen.getByTestId("error")).toHaveTextContent("undefined");
    expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);

    await act(() => user.click(screen.getByText("Refetch")));

    await waitFor(() => {
      expect(screen.getByTestId("primes")).toHaveTextContent(
        "2, 3, 5, 7, 11, 13, 17, 19, 23, 29"
      );
    });
    expect(screen.getByTestId("network-status")).toHaveTextContent(
      "7" // ready
    );
    expect(screen.getByTestId("error")).toHaveTextContent("undefined");
    expect(mergeParams).toEqual([
      [undefined, [2, 3, 5, 7, 11]],
      [
        [2, 3, 5, 7, 11],
        [13, 17, 19, 23, 29],
      ],
    ]);
  });

  it('defaults refetchWritePolicy to "overwrite"', async () => {
    const user = userEvent.setup();

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

    function SuspenseFallback() {
      return <div>loading</div>;
    }

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache,
    });

    function Child({
      refetch,
      queryRef,
    }: {
      refetch: (
        variables?: Partial<OperationVariables> | undefined
      ) => Promise<ApolloQueryResult<QueryData>>;
      queryRef: QueryReference<QueryData>;
    }) {
      const { data, error, networkStatus } = useReadQuery(queryRef);

      return (
        <div>
          <button
            onClick={() => {
              refetch({ min: 12, max: 30 });
            }}
          >
            Refetch
          </button>
          <div data-testid="primes">{data?.primes.join(", ")}</div>
          <div data-testid="network-status">{networkStatus}</div>
          <div data-testid="error">{error?.message || "undefined"}</div>
        </div>
      );
    }

    function Parent() {
      const [queryRef, { refetch }] = useBackgroundQuery(query, {
        variables: { min: 0, max: 12 },
      });
      return <Child refetch={refetch} queryRef={queryRef} />;
    }

    function App() {
      return (
        <ApolloProvider client={client}>
          <Suspense fallback={<SuspenseFallback />}>
            <Parent />
          </Suspense>
        </ApolloProvider>
      );
    }

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("primes")).toHaveTextContent("2, 3, 5, 7, 11");
    });
    expect(screen.getByTestId("network-status")).toHaveTextContent(
      "7" // ready
    );
    expect(screen.getByTestId("error")).toHaveTextContent("undefined");
    expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);

    await act(() => user.click(screen.getByText("Refetch")));

    await waitFor(() => {
      expect(screen.getByTestId("primes")).toHaveTextContent(
        "13, 17, 19, 23, 29"
      );
    });
    expect(screen.getByTestId("network-status")).toHaveTextContent(
      "7" // ready
    );
    expect(screen.getByTestId("error")).toHaveTextContent("undefined");
    expect(mergeParams).toEqual([
      [undefined, [2, 3, 5, 7, 11]],
      [undefined, [13, 17, 19, 23, 29]],
    ]);
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
      },
    ];

    interface Renders {
      errors: Error[];
      errorCount: number;
      suspenseCount: number;
      count: number;
    }
    const renders: Renders = {
      errors: [],
      errorCount: 0,
      suspenseCount: 0,
      count: 0,
    };

    const cache = new InMemoryCache();

    cache.writeQuery({
      query: partialQuery,
      data: { character: { id: "1" } },
    });

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache,
    });

    function App() {
      return (
        <ApolloProvider client={client}>
          <Suspense fallback={<SuspenseFallback />}>
            <Parent />
          </Suspense>
        </ApolloProvider>
      );
    }

    function SuspenseFallback() {
      renders.suspenseCount++;
      return <p>Loading</p>;
    }

    function Parent() {
      const [queryRef] = useBackgroundQuery(fullQuery, {
        fetchPolicy: "cache-first",
        returnPartialData: true,
      });
      return <Todo queryRef={queryRef} />;
    }

    function Todo({
      queryRef,
    }: {
      queryRef: QueryReference<DeepPartial<Data>>;
    }) {
      const { data, networkStatus, error } = useReadQuery(queryRef);
      renders.count++;

      return (
        <>
          <div data-testid="character-id">{data.character?.id}</div>
          <div data-testid="character-name">{data.character?.name}</div>
          <div data-testid="network-status">{networkStatus}</div>
          <div data-testid="error">{error?.message || "undefined"}</div>
        </>
      );
    }

    render(<App />);

    expect(renders.suspenseCount).toBe(0);
    expect(screen.getByTestId("character-id")).toHaveTextContent("1");
    expect(screen.getByTestId("character-name")).toHaveTextContent("");
    expect(screen.getByTestId("network-status")).toHaveTextContent("1"); // loading
    expect(screen.getByTestId("error")).toHaveTextContent("undefined");

    await waitFor(() => {
      expect(screen.getByTestId("character-name")).toHaveTextContent(
        "Doctor Strange"
      );
    });
    expect(screen.getByTestId("character-id")).toHaveTextContent("1");
    expect(screen.getByTestId("network-status")).toHaveTextContent("7"); // ready
    expect(screen.getByTestId("error")).toHaveTextContent("undefined");

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(0);
  });

  it('suspends and does not use partial data when changing variables and using a "cache-first" fetch policy with returnPartialData', async () => {
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

    const { renders, mocks, rerender } = renderVariablesIntegrationTest({
      variables: { id: "1" },
      cache,
      options: {
        fetchPolicy: "cache-first",
        returnPartialData: true,
      },
    });
    expect(renders.suspenseCount).toBe(0);

    expect(await screen.findByText("1 - Spider-Man")).toBeInTheDocument();

    rerender({ variables: { id: "2" } });

    expect(await screen.findByText("2 - Black Widow")).toBeInTheDocument();

    expect(renders.frames[2]).toMatchObject({
      ...mocks[1].result,
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });

    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        data: { character: { id: "1" } },
        networkStatus: NetworkStatus.loading,
        error: undefined,
      },
      {
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
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
      },
    ];

    interface Renders {
      errors: Error[];
      errorCount: number;
      suspenseCount: number;
      count: number;
      frames: {
        data: DeepPartial<Data>;
        networkStatus: NetworkStatus;
        error: ApolloError | undefined;
      }[];
    }
    const renders: Renders = {
      errors: [],
      errorCount: 0,
      suspenseCount: 0,
      count: 0,
      frames: [],
    };

    const cache = new InMemoryCache();

    cache.writeQuery({
      query: partialQuery,
      data: { character: { id: "1" } },
    });

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache,
    });

    function App() {
      return (
        <ApolloProvider client={client}>
          <Suspense fallback={<SuspenseFallback />}>
            <Parent />
          </Suspense>
        </ApolloProvider>
      );
    }

    function SuspenseFallback() {
      renders.suspenseCount++;
      return <p>Loading</p>;
    }

    function Parent() {
      const [queryRef] = useBackgroundQuery(fullQuery, {
        fetchPolicy: "network-only",
        returnPartialData: true,
      });

      return <Todo queryRef={queryRef} />;
    }

    function Todo({
      queryRef,
    }: {
      queryRef: QueryReference<DeepPartial<Data>>;
    }) {
      const { data, networkStatus, error } = useReadQuery(queryRef);
      renders.frames.push({ data, networkStatus, error });
      renders.count++;
      return (
        <>
          <div data-testid="character-id">{data.character?.id}</div>
          <div data-testid="character-name">{data.character?.name}</div>
          <div data-testid="network-status">{networkStatus}</div>
          <div data-testid="error">{error?.message || "undefined"}</div>
        </>
      );
    }

    render(<App />);

    expect(renders.suspenseCount).toBe(1);

    await waitFor(() => {
      expect(screen.getByTestId("character-name")).toHaveTextContent(
        "Doctor Strange"
      );
    });
    expect(screen.getByTestId("character-id")).toHaveTextContent("1");
    expect(screen.getByTestId("network-status")).toHaveTextContent("7"); // ready
    expect(screen.getByTestId("error")).toHaveTextContent("undefined");

    expect(renders.count).toBe(1);
    expect(renders.suspenseCount).toBe(1);

    expect(renders.frames).toMatchObject([
      {
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
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
      },
    ];

    interface Renders {
      errors: Error[];
      errorCount: number;
      suspenseCount: number;
      count: number;
      frames: {
        data: DeepPartial<Data>;
        networkStatus: NetworkStatus;
        error: ApolloError | undefined;
      }[];
    }
    const renders: Renders = {
      errors: [],
      errorCount: 0,
      suspenseCount: 0,
      count: 0,
      frames: [],
    };

    const cache = new InMemoryCache();

    cache.writeQuery({
      query: partialQuery,
      data: { character: { id: "1" } },
    });

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache,
    });

    function App() {
      return (
        <ApolloProvider client={client}>
          <Suspense fallback={<SuspenseFallback />}>
            <Parent />
          </Suspense>
        </ApolloProvider>
      );
    }

    function SuspenseFallback() {
      renders.suspenseCount++;
      return <p>Loading</p>;
    }

    function Parent() {
      const [queryRef] = useBackgroundQuery(fullQuery, {
        fetchPolicy: "no-cache",
        returnPartialData: true,
      });

      return <Todo queryRef={queryRef} />;
    }

    function Todo({
      queryRef,
    }: {
      queryRef: QueryReference<DeepPartial<Data>>;
    }) {
      const { data, networkStatus, error } = useReadQuery(queryRef);
      renders.frames.push({ data, networkStatus, error });
      renders.count++;
      return (
        <>
          <div data-testid="character-id">{data.character?.id}</div>
          <div data-testid="character-name">{data.character?.name}</div>
          <div data-testid="network-status">{networkStatus}</div>
          <div data-testid="error">{error?.message || "undefined"}</div>
        </>
      );
    }

    render(<App />);

    expect(renders.suspenseCount).toBe(1);

    await waitFor(() => {
      expect(screen.getByTestId("character-name")).toHaveTextContent(
        "Doctor Strange"
      );
    });
    expect(screen.getByTestId("character-id")).toHaveTextContent("1");
    expect(screen.getByTestId("network-status")).toHaveTextContent("7"); // ready
    expect(screen.getByTestId("error")).toHaveTextContent("undefined");

    expect(renders.count).toBe(1);
    expect(renders.suspenseCount).toBe(1);

    expect(renders.frames).toMatchObject([
      {
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it('warns when using returnPartialData with a "no-cache" fetch policy', async () => {
    using _consoleSpy = spyOnConsole("warn");

    const query: TypedDocumentNode<SimpleQueryData> = gql`
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

    renderSuspenseHook(
      () =>
        useBackgroundQuery(query, {
          fetchPolicy: "no-cache",
          returnPartialData: true,
        }),
      { mocks }
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
      },
    ];

    interface Renders {
      errors: Error[];
      errorCount: number;
      suspenseCount: number;
      count: number;
      frames: {
        data: DeepPartial<Data>;
        networkStatus: NetworkStatus;
        error: ApolloError | undefined;
      }[];
    }
    const renders: Renders = {
      errors: [],
      errorCount: 0,
      suspenseCount: 0,
      count: 0,
      frames: [],
    };

    const cache = new InMemoryCache();

    cache.writeQuery({
      query: partialQuery,
      data: { character: { id: "1" } },
    });

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache,
    });

    function App() {
      return (
        <ApolloProvider client={client}>
          <Suspense fallback={<SuspenseFallback />}>
            <Parent />
          </Suspense>
        </ApolloProvider>
      );
    }

    function SuspenseFallback() {
      renders.suspenseCount++;
      return <p>Loading</p>;
    }

    function Parent() {
      const [queryRef] = useBackgroundQuery(fullQuery, {
        fetchPolicy: "cache-and-network",
        returnPartialData: true,
      });

      return <Todo queryRef={queryRef} />;
    }

    function Todo({
      queryRef,
    }: {
      queryRef: QueryReference<DeepPartial<Data>>;
    }) {
      const { data, networkStatus, error } = useReadQuery(queryRef);
      renders.frames.push({ data, networkStatus, error });
      renders.count++;
      return (
        <>
          <div data-testid="character-id">{data.character?.id}</div>
          <div data-testid="character-name">{data.character?.name}</div>
          <div data-testid="network-status">{networkStatus}</div>
          <div data-testid="error">{error?.message || "undefined"}</div>
        </>
      );
    }

    render(<App />);

    expect(renders.suspenseCount).toBe(0);
    expect(screen.getByTestId("character-id")).toHaveTextContent("1");
    // name is not present yet, since it's missing in partial data
    expect(screen.getByTestId("character-name")).toHaveTextContent("");
    expect(screen.getByTestId("network-status")).toHaveTextContent("1"); // loading
    expect(screen.getByTestId("error")).toHaveTextContent("undefined");

    await waitFor(() => {
      expect(screen.getByTestId("character-name")).toHaveTextContent(
        "Doctor Strange"
      );
    });
    expect(screen.getByTestId("character-id")).toHaveTextContent("1");
    expect(screen.getByTestId("network-status")).toHaveTextContent("7"); // ready
    expect(screen.getByTestId("error")).toHaveTextContent("undefined");

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(0);

    expect(renders.frames).toMatchObject([
      {
        data: { character: { id: "1" } },
        networkStatus: NetworkStatus.loading,
        error: undefined,
      },
      {
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it('suspends and does not use partial data when changing variables and using a "cache-and-network" fetch policy with returnPartialData', async () => {
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

    const { renders, mocks, rerender } = renderVariablesIntegrationTest({
      variables: { id: "1" },
      cache,
      options: {
        fetchPolicy: "cache-and-network",
        returnPartialData: true,
      },
    });

    expect(renders.suspenseCount).toBe(0);

    expect(await screen.findByText("1 - Spider-Man")).toBeInTheDocument();

    rerender({ variables: { id: "2" } });

    expect(await screen.findByText("2 - Black Widow")).toBeInTheDocument();

    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        data: { character: { id: "1" } },
        networkStatus: NetworkStatus.loading,
        error: undefined,
      },
      {
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
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

    interface Renders {
      errors: Error[];
      errorCount: number;
      suspenseCount: number;
      count: number;
      frames: {
        data: DeepPartial<QueryData>;
        networkStatus: NetworkStatus;
        error: ApolloError | undefined;
      }[];
    }
    const renders: Renders = {
      errors: [],
      errorCount: 0,
      suspenseCount: 0,
      count: 0,
      frames: [],
    };

    const client = new ApolloClient({
      link,
      cache,
    });

    function App() {
      return (
        <ApolloProvider client={client}>
          <Suspense fallback={<SuspenseFallback />}>
            <Parent />
          </Suspense>
        </ApolloProvider>
      );
    }

    function SuspenseFallback() {
      renders.suspenseCount++;
      return <p>Loading</p>;
    }

    function Parent() {
      const [queryRef] = useBackgroundQuery(query, {
        fetchPolicy: "cache-first",
        returnPartialData: true,
      });

      return <Todo queryRef={queryRef} />;
    }

    function Todo({
      queryRef,
    }: {
      queryRef: QueryReference<DeepPartial<QueryData>>;
    }) {
      const { data, networkStatus, error } = useReadQuery(queryRef);
      renders.frames.push({ data, networkStatus, error });
      renders.count++;
      return (
        <>
          <div data-testid="message">{data.greeting?.message}</div>
          <div data-testid="recipient">{data.greeting?.recipient?.name}</div>
          <div data-testid="network-status">{networkStatus}</div>
          <div data-testid="error">{error?.message || "undefined"}</div>
        </>
      );
    }

    render(<App />);

    expect(renders.suspenseCount).toBe(0);
    expect(screen.getByTestId("recipient")).toHaveTextContent("Cached Alice");
    // message is not present yet, since it's missing in partial data
    expect(screen.getByTestId("message")).toHaveTextContent("");
    expect(screen.getByTestId("network-status")).toHaveTextContent("1"); // loading
    expect(screen.getByTestId("error")).toHaveTextContent("undefined");

    link.simulateResult({
      result: {
        data: {
          greeting: { message: "Hello world", __typename: "Greeting" },
        },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("message")).toHaveTextContent("Hello world");
    });
    expect(screen.getByTestId("recipient")).toHaveTextContent("Cached Alice");
    expect(screen.getByTestId("network-status")).toHaveTextContent("7"); // ready
    expect(screen.getByTestId("error")).toHaveTextContent("undefined");

    link.simulateResult({
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
    });

    await waitFor(() => {
      expect(screen.getByTestId("recipient").textContent).toEqual("Alice");
    });
    expect(screen.getByTestId("message")).toHaveTextContent("Hello world");
    expect(screen.getByTestId("network-status")).toHaveTextContent("7"); // ready
    expect(screen.getByTestId("error")).toHaveTextContent("undefined");

    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(0);
    expect(renders.frames).toMatchObject([
      {
        data: {
          greeting: {
            __typename: "Greeting",
            recipient: { __typename: "Person", name: "Cached Alice" },
          },
        },
        networkStatus: NetworkStatus.loading,
        error: undefined,
      },
      {
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            recipient: { __typename: "Person", name: "Cached Alice" },
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            recipient: { __typename: "Person", name: "Alice" },
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
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
    const { data } = useReadQuery(queryRef);

    expectTypeOf(data).toEqualTypeOf<unknown>();
  });

  it("disallows wider variables type than specified", () => {
    const { query } = useVariablesIntegrationTestCase();

    // @ts-expect-error should not allow wider TVariables type
    useBackgroundQuery(query, { variables: { id: "1", foo: "bar" } });
  });

  it("returns TData in default case", () => {
    const { query } = useVariablesIntegrationTestCase();

    const [inferredQueryRef] = useBackgroundQuery(query);
    const { data: inferred } = useReadQuery(inferredQueryRef);

    expectTypeOf(inferred).toEqualTypeOf<VariablesCaseData>();
    expectTypeOf(inferred).not.toEqualTypeOf<VariablesCaseData | undefined>();

    const [explicitQueryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query);

    const { data: explicit } = useReadQuery(explicitQueryRef);

    expectTypeOf(explicit).toEqualTypeOf<VariablesCaseData>();
    expectTypeOf(explicit).not.toEqualTypeOf<VariablesCaseData | undefined>();
  });

  it('returns TData | undefined with errorPolicy: "ignore"', () => {
    const { query } = useVariablesIntegrationTestCase();

    const [inferredQueryRef] = useBackgroundQuery(query, {
      errorPolicy: "ignore",
    });
    const { data: inferred } = useReadQuery(inferredQueryRef);

    expectTypeOf(inferred).toEqualTypeOf<VariablesCaseData | undefined>();
    expectTypeOf(inferred).not.toEqualTypeOf<VariablesCaseData>();

    const [explicitQueryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      errorPolicy: "ignore",
    });

    const { data: explicit } = useReadQuery(explicitQueryRef);

    expectTypeOf(explicit).toEqualTypeOf<VariablesCaseData | undefined>();
    expectTypeOf(explicit).not.toEqualTypeOf<VariablesCaseData>();
  });

  it('returns TData | undefined with errorPolicy: "all"', () => {
    const { query } = useVariablesIntegrationTestCase();

    const [inferredQueryRef] = useBackgroundQuery(query, {
      errorPolicy: "all",
    });
    const { data: inferred } = useReadQuery(inferredQueryRef);

    expectTypeOf(inferred).toEqualTypeOf<VariablesCaseData | undefined>();
    expectTypeOf(inferred).not.toEqualTypeOf<VariablesCaseData>();

    const [explicitQueryRef] = useBackgroundQuery(query, {
      errorPolicy: "all",
    });
    const { data: explicit } = useReadQuery(explicitQueryRef);

    expectTypeOf(explicit).toEqualTypeOf<VariablesCaseData | undefined>();
    expectTypeOf(explicit).not.toEqualTypeOf<VariablesCaseData>();
  });

  it('returns TData with errorPolicy: "none"', () => {
    const { query } = useVariablesIntegrationTestCase();

    const [inferredQueryRef] = useBackgroundQuery(query, {
      errorPolicy: "none",
    });
    const { data: inferred } = useReadQuery(inferredQueryRef);

    expectTypeOf(inferred).toEqualTypeOf<VariablesCaseData>();
    expectTypeOf(inferred).not.toEqualTypeOf<VariablesCaseData | undefined>();

    const [explicitQueryRef] = useBackgroundQuery(query, {
      errorPolicy: "none",
    });
    const { data: explicit } = useReadQuery(explicitQueryRef);

    expectTypeOf(explicit).toEqualTypeOf<VariablesCaseData>();
    expectTypeOf(explicit).not.toEqualTypeOf<VariablesCaseData | undefined>();
  });

  it("returns DeepPartial<TData> with returnPartialData: true", () => {
    const { query } = useVariablesIntegrationTestCase();

    const [inferredQueryRef] = useBackgroundQuery(query, {
      returnPartialData: true,
    });
    const { data: inferred } = useReadQuery(inferredQueryRef);

    expectTypeOf(inferred).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    expectTypeOf(inferred).not.toEqualTypeOf<VariablesCaseData>();

    const [explicitQueryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      returnPartialData: true,
    });

    const { data: explicit } = useReadQuery(explicitQueryRef);

    expectTypeOf(explicit).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    expectTypeOf(explicit).not.toEqualTypeOf<VariablesCaseData>();
  });

  it("returns TData with returnPartialData: false", () => {
    const { query } = useVariablesIntegrationTestCase();

    const [inferredQueryRef] = useBackgroundQuery(query, {
      returnPartialData: false,
    });
    const { data: inferred } = useReadQuery(inferredQueryRef);

    expectTypeOf(inferred).toEqualTypeOf<VariablesCaseData>();
    expectTypeOf(inferred).not.toEqualTypeOf<DeepPartial<VariablesCaseData>>();

    const [explicitQueryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      returnPartialData: false,
    });

    const { data: explicit } = useReadQuery(explicitQueryRef);

    expectTypeOf(explicit).toEqualTypeOf<VariablesCaseData>();
    expectTypeOf(explicit).not.toEqualTypeOf<DeepPartial<VariablesCaseData>>();
  });

  it("returns TData when passing an option that does not affect TData", () => {
    const { query } = useVariablesIntegrationTestCase();

    const [inferredQueryRef] = useBackgroundQuery(query, {
      fetchPolicy: "no-cache",
    });
    const { data: inferred } = useReadQuery(inferredQueryRef);

    expectTypeOf(inferred).toEqualTypeOf<VariablesCaseData>();
    expectTypeOf(inferred).not.toEqualTypeOf<DeepPartial<VariablesCaseData>>();

    const [explicitQueryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      fetchPolicy: "no-cache",
    });

    const { data: explicit } = useReadQuery(explicitQueryRef);

    expectTypeOf(explicit).toEqualTypeOf<VariablesCaseData>();
    expectTypeOf(explicit).not.toEqualTypeOf<DeepPartial<VariablesCaseData>>();
  });

  it("handles combinations of options", () => {
    const { query } = useVariablesIntegrationTestCase();

    const [inferredPartialDataIgnoreQueryRef] = useBackgroundQuery(query, {
      returnPartialData: true,
      errorPolicy: "ignore",
    });
    const { data: inferredPartialDataIgnore } = useReadQuery(
      inferredPartialDataIgnoreQueryRef
    );

    expectTypeOf(inferredPartialDataIgnore).toEqualTypeOf<
      DeepPartial<VariablesCaseData> | undefined
    >();
    expectTypeOf(
      inferredPartialDataIgnore
    ).not.toEqualTypeOf<VariablesCaseData>();

    const [explicitPartialDataIgnoreQueryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      returnPartialData: true,
      errorPolicy: "ignore",
    });

    const { data: explicitPartialDataIgnore } = useReadQuery(
      explicitPartialDataIgnoreQueryRef
    );

    expectTypeOf(explicitPartialDataIgnore).toEqualTypeOf<
      DeepPartial<VariablesCaseData> | undefined
    >();
    expectTypeOf(
      explicitPartialDataIgnore
    ).not.toEqualTypeOf<VariablesCaseData>();

    const [inferredPartialDataNoneQueryRef] = useBackgroundQuery(query, {
      returnPartialData: true,
      errorPolicy: "none",
    });

    const { data: inferredPartialDataNone } = useReadQuery(
      inferredPartialDataNoneQueryRef
    );

    expectTypeOf(inferredPartialDataNone).toEqualTypeOf<
      DeepPartial<VariablesCaseData>
    >();
    expectTypeOf(
      inferredPartialDataNone
    ).not.toEqualTypeOf<VariablesCaseData>();

    const [explicitPartialDataNoneQueryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      returnPartialData: true,
      errorPolicy: "none",
    });

    const { data: explicitPartialDataNone } = useReadQuery(
      explicitPartialDataNoneQueryRef
    );

    expectTypeOf(explicitPartialDataNone).toEqualTypeOf<
      DeepPartial<VariablesCaseData>
    >();
    expectTypeOf(
      explicitPartialDataNone
    ).not.toEqualTypeOf<VariablesCaseData>();
  });

  it("returns correct TData type when combined options that do not affect TData", () => {
    const { query } = useVariablesIntegrationTestCase();

    const [inferredQueryRef] = useBackgroundQuery(query, {
      fetchPolicy: "no-cache",
      returnPartialData: true,
      errorPolicy: "none",
    });
    const { data: inferred } = useReadQuery(inferredQueryRef);

    expectTypeOf(inferred).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    expectTypeOf(inferred).not.toEqualTypeOf<VariablesCaseData>();

    const [explicitQueryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, {
      fetchPolicy: "no-cache",
      returnPartialData: true,
      errorPolicy: "none",
    });

    const { data: explicit } = useReadQuery(explicitQueryRef);

    expectTypeOf(explicit).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    expectTypeOf(explicit).not.toEqualTypeOf<VariablesCaseData>();
  });

  it("returns QueryReference<TData> | undefined when `skip` is present", () => {
    const { query } = useVariablesIntegrationTestCase();

    const [inferredQueryRef] = useBackgroundQuery(query, {
      skip: true,
    });

    expectTypeOf(inferredQueryRef).toEqualTypeOf<
      QueryReference<VariablesCaseData, VariablesCaseVariables> | undefined
    >();
    expectTypeOf(inferredQueryRef).not.toEqualTypeOf<
      QueryReference<VariablesCaseData>
    >();

    const [explicitQueryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, { skip: true });

    expectTypeOf(explicitQueryRef).toEqualTypeOf<
      QueryReference<VariablesCaseData, VariablesCaseVariables> | undefined
    >();
    expectTypeOf(explicitQueryRef).not.toEqualTypeOf<
      QueryReference<VariablesCaseData, VariablesCaseVariables>
    >();

    // TypeScript is too smart and using a `const` or `let` boolean variable
    // for the `skip` option results in a false positive. Using an options
    // object allows us to properly check for a dynamic case.
    const options = {
      skip: true,
    };

    const [dynamicQueryRef] = useBackgroundQuery(query, {
      skip: options.skip,
    });

    expectTypeOf(dynamicQueryRef).toEqualTypeOf<
      QueryReference<VariablesCaseData, VariablesCaseVariables> | undefined
    >();
    expectTypeOf(dynamicQueryRef).not.toEqualTypeOf<
      QueryReference<VariablesCaseData, VariablesCaseVariables>
    >();
  });

  it("returns `undefined` when using `skipToken` unconditionally", () => {
    const { query } = useVariablesIntegrationTestCase();

    const [inferredQueryRef] = useBackgroundQuery(query, skipToken);

    expectTypeOf(inferredQueryRef).toEqualTypeOf<undefined>();
    expectTypeOf(inferredQueryRef).not.toEqualTypeOf<
      QueryReference<VariablesCaseData, VariablesCaseVariables> | undefined
    >();

    const [explicitQueryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, skipToken);

    expectTypeOf(explicitQueryRef).toEqualTypeOf<undefined>();
    expectTypeOf(explicitQueryRef).not.toEqualTypeOf<
      QueryReference<VariablesCaseData, VariablesCaseVariables> | undefined
    >();
  });

  it("returns QueryReference<TData> | undefined when using conditional `skipToken`", () => {
    const { query } = useVariablesIntegrationTestCase();
    const options = {
      skip: true,
    };

    const [inferredQueryRef] = useBackgroundQuery(
      query,
      options.skip ? skipToken : undefined
    );

    expectTypeOf(inferredQueryRef).toEqualTypeOf<
      QueryReference<VariablesCaseData, VariablesCaseVariables> | undefined
    >();
    expectTypeOf(inferredQueryRef).not.toEqualTypeOf<
      QueryReference<VariablesCaseData, VariablesCaseVariables>
    >();

    const [explicitQueryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, options.skip ? skipToken : undefined);

    expectTypeOf(explicitQueryRef).toEqualTypeOf<
      QueryReference<VariablesCaseData, VariablesCaseVariables> | undefined
    >();
    expectTypeOf(explicitQueryRef).not.toEqualTypeOf<
      QueryReference<VariablesCaseData, VariablesCaseVariables>
    >();
  });

  it("returns QueryReference<DeepPartial<TData>> | undefined when using `skipToken` with `returnPartialData`", () => {
    const { query } = useVariablesIntegrationTestCase();
    const options = {
      skip: true,
    };

    const [inferredQueryRef] = useBackgroundQuery(
      query,
      options.skip ? skipToken : { returnPartialData: true }
    );

    expectTypeOf(inferredQueryRef).toEqualTypeOf<
      | QueryReference<DeepPartial<VariablesCaseData>, VariablesCaseVariables>
      | undefined
    >();
    expectTypeOf(inferredQueryRef).not.toEqualTypeOf<
      QueryReference<VariablesCaseData, VariablesCaseVariables>
    >();

    const [explicitQueryRef] = useBackgroundQuery<
      VariablesCaseData,
      VariablesCaseVariables
    >(query, options.skip ? skipToken : { returnPartialData: true });

    expectTypeOf(explicitQueryRef).toEqualTypeOf<
      | QueryReference<DeepPartial<VariablesCaseData>, VariablesCaseVariables>
      | undefined
    >();
    expectTypeOf(explicitQueryRef).not.toEqualTypeOf<
      QueryReference<VariablesCaseData, VariablesCaseVariables>
    >();
  });
});
