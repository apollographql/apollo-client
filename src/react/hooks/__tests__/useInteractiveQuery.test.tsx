import React, { Fragment, StrictMode, Suspense, useState } from "react";
import {
  act,
  render,
  screen,
  renderHook,
  RenderHookOptions,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Options as UserEventOptions } from "@testing-library/user-event";
import {
  ErrorBoundary,
  ErrorBoundary as ReactErrorBoundary,
  ErrorBoundaryProps,
} from "react-error-boundary";
import { expectTypeOf } from "expect-type";
import { GraphQLError } from "graphql";
import {
  gql,
  ApolloError,
  DocumentNode,
  ApolloClient,
  ErrorPolicy,
  NormalizedCacheObject,
  NetworkStatus,
  ApolloCache,
  TypedDocumentNode,
  ApolloLink,
  Observable,
  FetchMoreQueryOptions,
  OperationVariables,
  ApolloQueryResult,
} from "../../../core";
import {
  MockedProvider,
  MockedProviderProps,
  MockedResponse,
  MockLink,
  MockSubscriptionLink,
} from "../../../testing";
import {
  concatPagination,
  offsetLimitPagination,
  DeepPartial,
} from "../../../utilities";
import { useInteractiveQuery } from "../useInteractiveQuery";
import type { UseReadQueryResult } from "../useReadQuery";
import { useReadQuery } from "../useReadQuery";
import { ApolloProvider } from "../../context";
import { InMemoryCache } from "../../../cache";
import { QueryReference } from "../../../react";
import {
  InteractiveQueryHookOptions,
  InteractiveQueryHookFetchPolicy,
} from "../../types/types";
import { FetchMoreFunction, RefetchFunction } from "../useSuspenseQuery";
import { RefetchWritePolicy } from "../../../core/watchQueryOptions";
import invariant from "ts-invariant";
import { profile, profileHook, spyOnConsole } from "../../../testing/internal";

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
  const query: TypedDocumentNode<
    VariablesCaseData,
    VariablesCaseVariables
  > = gql`
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
  const query: TypedDocumentNode<
    PaginatedQueryData,
    PaginatedQueryVariables
  > = gql`
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

function createDefaultProfiledComponents<TData = unknown>() {
  const SuspenseFallback = profile({
    Component: () => <p>Loading</p>,
  });

  const ReadQueryHook = profileHook<
    UseReadQueryResult<TData>,
    { queryRef: QueryReference<TData> }
  >(({ queryRef }) => useReadQuery(queryRef));

  const ErrorFallback = profile<{ error: Error | null }, { error: Error }>({
    Component: ({ error }) => {
      ErrorFallback.updateSnapshot({ error });

      return <div>Oops</div>;
    },
    initialSnapshot: {
      error: null,
    },
  });

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

function renderWithMocks(ui: React.ReactElement, props: MockedProviderProps) {
  const user = userEvent.setup();

  const utils = render(ui, {
    wrapper: ({ children }) => (
      <MockedProvider {...props}>{children}</MockedProvider>
    ),
  });

  return { ...utils, user };
}

function renderWithClient(
  ui: React.ReactElement,
  options: { client: ApolloClient<any> }
) {
  const { client } = options;
  const user = userEvent.setup();

  const utils = render(ui, {
    wrapper: ({ children }) => (
      <ApolloProvider client={client}>{children}</ApolloProvider>
    ),
  });

  return { ...utils, user };
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
  options?: InteractiveQueryHookOptions;
  cache?: InMemoryCache;
  errorPolicy?: ErrorPolicy;
}) {
  const user = userEvent.setup();
  let { mocks: _mocks, query } = useVariablesQueryCase();

  // duplicate mocks with (updated) in the name for refetches
  _mocks = [..._mocks, ..._mocks, ..._mocks].map((mock, index) => {
    return {
      ...mock,
      request: mock.request,
      result: {
        data: {
          character: {
            ...mock.result.data.character,
            name:
              index > 3
                ? index > 7
                  ? `${mock.result.data.character.name} (updated again)`
                  : `${mock.result.data.character.name} (updated)`
                : mock.result.data.character.name,
          },
        },
      },
    };
  });
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
    onChange,
    queryRef,
  }: {
    onChange: (variables: VariablesCaseVariables) => void;
    queryRef: QueryReference<VariablesCaseData>;
  }) {
    const { data, error, networkStatus } = useReadQuery(queryRef);
    // count renders in the child component
    renders.count++;
    renders.frames.push({ data, networkStatus, error });

    return (
      <div>
        {error ? <div>{error.message}</div> : null}
        <button onClick={() => onChange({ id: "2" })}>Change variables</button>
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
    const [queryRef, loadQuery] = useInteractiveQuery(query, {
      ...options,
      variables,
      errorPolicy,
    });
    return (
      <div>
        <button onClick={() => loadQuery(variables)}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <Child onChange={loadQuery} queryRef={queryRef} />}
        </Suspense>
      </div>
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
        <ErrorBoundary {...errorBoundaryProps}>
          <ParentWithVariables
            variables={variables}
            errorPolicy={errorPolicy}
          />
        </ErrorBoundary>
      </ApolloProvider>
    );
  }

  const { ...rest } = render(
    <App errorPolicy={errorPolicy} variables={variables} />
  );
  const rerender = ({ variables }: { variables: VariablesCaseVariables }) => {
    return rest.rerender(<App variables={variables} />);
  };
  return {
    ...rest,
    query,
    rerender,
    client,
    renders,
    mocks: mocks || _mocks,
    user,
    loadQueryButton: screen.getByText("Load query"),
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
              <ErrorBoundary
                fallback={<div>Error</div>}
                onError={(error) => {
                  renders.errorCount++;
                  renders.errors.push(error);
                }}
              >
                <ApolloProvider client={client}>{children}</ApolloProvider>
              </ErrorBoundary>
            </Suspense>
          </Wrapper>
        );
      },
    }
  );

  return { ...view, renders };
}

it("loads a query and suspends when the load query function is called", async () => {
  const { query, mocks } = useSimpleQueryCase();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<SimpleQueryData>();

  const App = profile({
    Component: () => {
      const [queryRef, loadQuery] = useInteractiveQuery(query);

      return (
        <>
          <button onClick={() => loadQuery()}>Load query</button>
          <Suspense fallback={<SuspenseFallback />}>
            {queryRef && <ReadQueryHook queryRef={queryRef} />}
          </Suspense>
        </>
      );
    },
  });

  const { user } = renderWithMocks(<App />, { mocks });

  expect(SuspenseFallback).not.toHaveRendered();

  await act(() => user.click(screen.getByText("Load query")));

  expect(SuspenseFallback).toHaveRendered();
  expect(ReadQueryHook).not.toHaveRendered();
  expect(App).toHaveRenderedTimes(2);

  const snapshot = await ReadQueryHook.takeSnapshot();

  expect(snapshot).toEqual({
    data: { greeting: "Hello" },
    error: undefined,
    networkStatus: NetworkStatus.ready,
  });

  expect(SuspenseFallback).toHaveRenderedTimes(1);
  expect(ReadQueryHook).toHaveRenderedTimes(1);
  expect(App).toHaveRenderedTimes(3);
});

it("loads a query with variables and suspends by passing variables to the loadQuery function", async () => {
  const { query, mocks } = useVariablesQueryCase();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<VariablesCaseData>();

  const App = profile({
    Component: () => {
      const [queryRef, loadQuery] = useInteractiveQuery(query);

      return (
        <>
          <button onClick={() => loadQuery({ id: "1" })}>Load query</button>
          <Suspense fallback={<SuspenseFallback />}>
            {queryRef && <ReadQueryHook queryRef={queryRef} />}
          </Suspense>
        </>
      );
    },
  });

  const { user } = renderWithMocks(<App />, { mocks });

  expect(SuspenseFallback).not.toHaveRendered();

  await act(() => user.click(screen.getByText("Load query")));

  expect(SuspenseFallback).toHaveRendered();
  expect(ReadQueryHook).not.toHaveRendered();
  expect(App).toHaveRenderedTimes(2);

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: { character: { id: "1", name: "Spider-Man" } },
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  expect(SuspenseFallback).toHaveRenderedTimes(1);
  expect(ReadQueryHook).toHaveRenderedTimes(1);
  expect(App).toHaveRenderedTimes(3);

  await expect(App).not.toRerender();
});

it("changes variables on a query and resuspends when passing new variables to the loadQuery function", async () => {
  const { query, mocks } = useVariablesQueryCase();

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<VariablesCaseData>();

  const App = profile({
    Component: () => {
      const [queryRef, loadQuery] = useInteractiveQuery(query);

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
    },
  });

  const { user } = renderWithMocks(<App />, { mocks });

  expect(SuspenseFallback).not.toHaveRendered();

  await act(() => user.click(screen.getByText("Load 1st character")));

  expect(SuspenseFallback).toHaveRendered();
  expect(ReadQueryHook).not.toHaveRendered();
  expect(App).toHaveRenderedTimes(2);

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: { character: { id: "1", name: "Spider-Man" } },
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await act(() => user.click(screen.getByText("Load 2nd character")));

  expect(SuspenseFallback).toHaveRenderedTimes(2);

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: { character: { id: "2", name: "Black Widow" } },
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  expect(SuspenseFallback).toHaveRenderedTimes(2);
  expect(App).toHaveRenderedTimes(5);
  expect(ReadQueryHook).toHaveRenderedTimes(2);
});

it("allows the client to be overridden", async () => {
  const { query } = useSimpleQueryCase();

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

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<SimpleQueryData>();

  function App() {
    const [queryRef, loadQuery] = useInteractiveQuery(query, {
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

  const { user } = renderWithClient(<App />, { client: globalClient });

  await act(() => user.click(screen.getByText("Load query")));

  const snapshot = await ReadQueryHook.takeSnapshot();

  expect(snapshot).toEqual({
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

        observer.next({ data: { context: { valueA, valueB } } });
        observer.complete();
      });
    }),
  });

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<QueryData>();

  function App() {
    const [queryRef, loadQuery] = useInteractiveQuery(query, {
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

  const { user } = renderWithClient(<App />, { client });

  await act(() => user.click(screen.getByText("Load query")));

  const snapshot = await ReadQueryHook.takeSnapshot();

  expect(snapshot).toEqual({
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

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<QueryData>();

  function App() {
    const [queryRef, loadQuery] = useInteractiveQuery(query, {
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

  const { user } = renderWithClient(<App />, { client });

  await act(() => user.click(screen.getByText("Load query")));

  const snapshot = await ReadQueryHook.takeSnapshot();
  const resultSet = new Set(snapshot.data.results);
  const values = Array.from(resultSet).map((item) => item.value);

  expect(snapshot).toEqual({
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

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<QueryData>();

  function App() {
    const [queryRef, loadQuery] = useInteractiveQuery(query, {
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

  const { user } = renderWithMocks(<App />, { cache });

  await act(() => user.click(screen.getByText("Load query")));

  const snapshot = await ReadQueryHook.takeSnapshot();
  const resultSet = new Set(snapshot.data.results);
  const values = Array.from(resultSet).map((item) => item.value);

  expect(snapshot).toEqual({
    data: { results },
    networkStatus: NetworkStatus.ready,
    error: undefined,
  });
  expect(resultSet.size).toBe(6);
  expect(values).toEqual([0, 1, 1, 2, 3, 5]);
});

it("returns initial cache data followed by network data when the fetch policy is `cache-and-network`", async () => {
  const query: TypedDocumentNode<{ hello: string }, never> = gql`
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

  const { SuspenseFallback, ReadQueryHook } = createDefaultProfiledComponents<{
    hello: string;
  }>();

  const App = profile({
    Component: () => {
      const [queryRef, loadQuery] = useInteractiveQuery(query, {
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
    },
  });

  const { user } = renderWithClient(<App />, { client });

  await act(() => user.click(screen.getByText("Load query")));

  expect(SuspenseFallback).not.toHaveRendered();

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: { hello: "from cache" },
      networkStatus: NetworkStatus.loading,
      error: undefined,
    });
  }

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
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

  const { SuspenseFallback, ReadQueryHook } = createDefaultProfiledComponents();

  function App() {
    const [queryRef, loadQuery] = useInteractiveQuery(query);

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(<App />, { client });

  await act(() => user.click(screen.getByText("Load query")));

  expect(SuspenseFallback).not.toHaveRendered();

  const snapshot = await ReadQueryHook.takeSnapshot();

  expect(snapshot).toEqual({
    data: { hello: "from cache" },
    networkStatus: NetworkStatus.ready,
    error: undefined,
  });
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

  const { SuspenseFallback, ReadQueryHook } = createDefaultProfiledComponents();

  function App() {
    const [queryRef, loadQuery] = useInteractiveQuery(query);

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(<App />, { client });

  await act(() => user.click(screen.getByText("Load query")));

  expect(SuspenseFallback).toHaveRendered();

  const snapshot = await ReadQueryHook.takeSnapshot();

  expect(snapshot).toEqual({
    data: { foo: "bar", hello: "from link" },
    error: undefined,
    networkStatus: NetworkStatus.ready,
  });
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

  const { SuspenseFallback, ReadQueryHook } = createDefaultProfiledComponents();

  function App() {
    const [queryRef, loadQuery] = useInteractiveQuery(query, {
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

  const { user } = renderWithClient(<App />, { client });

  await act(() => user.click(screen.getByText("Load query")));

  expect(SuspenseFallback).toHaveRendered();

  const snapshot = await ReadQueryHook.takeSnapshot();

  expect(snapshot).toEqual({
    data: { hello: "from link" },
    error: undefined,
    networkStatus: NetworkStatus.ready,
  });
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

  const { SuspenseFallback, ReadQueryHook } = createDefaultProfiledComponents();

  function App() {
    const [queryRef, loadQuery] = useInteractiveQuery(query, {
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

  const { user } = renderWithClient(<App />, { client });

  await act(() => user.click(screen.getByText("Load query")));

  expect(SuspenseFallback).toHaveRendered();

  const snapshot = await ReadQueryHook.takeSnapshot();

  expect(snapshot).toEqual({
    data: { hello: "from link" },
    error: undefined,
    networkStatus: NetworkStatus.ready,
  });

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
    const [queryRef, loadQuery] = useInteractiveQuery(query);

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
    queryRef: QueryReference<Data>;
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

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<Data>();

  function App() {
    const [queryRef, loadQuery] = useInteractiveQuery(query, {
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

  const { user } = renderWithClient(<App />, { client });

  await act(() => user.click(screen.getByText("Load todo")));

  expect(SuspenseFallback).not.toHaveRendered();

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
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
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
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
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
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

it("reacts to cache updates", async () => {
  const { query, mocks } = useSimpleQueryCase();
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<SimpleQueryData>();

  function App() {
    const [queryRef, loadQuery] = useInteractiveQuery(query);

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <ReadQueryHook queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  const { user } = renderWithClient(<App />, { client });

  await act(() => user.click(screen.getByText("Load query")));

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
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
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: { greeting: "Updated Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it("applies `errorPolicy` on next fetch when it changes between renders", async () => {
  const { query } = useSimpleQueryCase();

  const mocks: MockedResponse<SimpleQueryData>[] = [
    {
      request: { query },
      result: { data: { greeting: "Hello" } },
    },
    {
      request: { query },
      result: {
        errors: [new GraphQLError("oops")],
      },
    },
  ];

  const { SuspenseFallback, ReadQueryHook, ErrorBoundary, ErrorFallback } =
    createDefaultProfiledComponents<SimpleQueryData>();

  function App() {
    const [errorPolicy, setErrorPolicy] = useState<ErrorPolicy>("none");
    const [queryRef, loadQuery, { refetch }] = useInteractiveQuery(query, {
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

  const { user } = renderWithMocks(<App />, { mocks });

  await act(() => user.click(screen.getByText("Load query")));

  expect(SuspenseFallback).toHaveRendered();

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Change error policy")));
  await act(() => user.click(screen.getByText("Refetch greeting")));

  expect(SuspenseFallback).toHaveRenderedTimes(2);

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: { greeting: "Hello" },
      error: new ApolloError({ graphQLErrors: [new GraphQLError("oops")] }),
      networkStatus: NetworkStatus.error,
    });
  }

  // Ensure we aren't rendering the error boundary and instead rendering the
  // error message in the hook component.
  expect(ErrorFallback).not.toHaveRendered();
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
    return Observable.of({
      data: {
        phase: operation.getContext().phase,
      },
    });
  });

  const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
  });

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<Data>();

  function App() {
    const [phase, setPhase] = React.useState("initial");
    const [queryRef, loadQuery, { refetch }] = useInteractiveQuery(query, {
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

  const { user } = renderWithClient(<App />, { client });

  await act(() => user.click(screen.getByText("Load query")));

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot.data).toEqual({
      phase: "initial",
    });
  }

  await act(() => user.click(screen.getByText("Update context")));
  await act(() => user.click(screen.getByText("Refetch")));
  await ReadQueryHook.takeSnapshot();

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot.data).toEqual({
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

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<Data>();

  function App() {
    const [canonizeResults, setCanonizeResults] = React.useState(false);
    const [queryRef, loadQuery] = useInteractiveQuery(query, {
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

  const { user } = renderWithClient(<App />, { client });

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { data } = await ReadQueryHook.takeSnapshot();
    const resultSet = new Set(data.results);
    const values = Array.from(resultSet).map((item) => item.value);

    expect(data.results.length).toBe(6);
    expect(resultSet.size).toBe(6);
    expect(values).toEqual([0, 1, 1, 2, 3, 5]);
  }

  await act(() => user.click(screen.getByText("Canonize results")));

  {
    const { data } = await ReadQueryHook.takeSnapshot();
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

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<Data>();

  function App() {
    const [refetchWritePolicy, setRefetchWritePolicy] =
      React.useState<RefetchWritePolicy>("merge");

    const [queryRef, loadQuery, { refetch }] = useInteractiveQuery(query, {
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

  const { user } = renderWithClient(<App />, { client });

  await act(() => user.click(screen.getByText("Load query")));

  {
    const snapshot = await ReadQueryHook.takeSnapshot();
    const { primes } = snapshot.data;

    expect(primes).toEqual([2, 3, 5, 7, 11]);
    expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);
  }

  await act(() => user.click(screen.getByText("Refetch next")));

  {
    const snapshot = await ReadQueryHook.takeSnapshot();
    const { primes } = snapshot.data;

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
  await ReadQueryHook.takeSnapshot();
  await act(() => user.click(screen.getByText("Refetch last")));

  {
    const snapshot = await ReadQueryHook.takeSnapshot();
    const { primes } = snapshot.data;

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

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<Data>();

  function App() {
    const [returnPartialData, setReturnPartialData] = React.useState(false);

    const [queryRef, loadQuery] = useInteractiveQuery(fullQuery, {
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

  const { user } = renderWithClient(<App />, { client });

  await act(() => user.click(screen.getByText("Load query")));

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: {
        character: { __typename: "Character", id: "1", name: "Doctor Strange" },
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Update partial data")));
  await ReadQueryHook.takeSnapshot();

  cache.modify({
    id: cache.identify({ __typename: "Character", id: "1" }),
    fields: {
      name: (_, { DELETE }) => DELETE,
    },
  });

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: {
        character: { __typename: "Character", id: "1" },
      },
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
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

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<Data>();

  function App() {
    const [fetchPolicy, setFetchPolicy] =
      React.useState<InteractiveQueryHookFetchPolicy>("cache-first");

    const [queryRef, loadQuery, { refetch }] = useInteractiveQuery(query, {
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

  const { user } = renderWithClient(<App />, { client });

  await act(() => user.click(screen.getByText("Load query")));

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
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
  await ReadQueryHook.takeSnapshot();
  await act(() => user.click(screen.getByText("Refetch")));

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
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

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<VariablesCaseData>();

  function App() {
    const [queryRef, loadQuery, { refetch }] = useInteractiveQuery(query);

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

  const { user } = renderWithMocks(<App />, { mocks });

  expect(SuspenseFallback).not.toHaveRendered();

  await act(() => user.click(screen.getByText("Load query")));

  expect(SuspenseFallback).toHaveRendered();

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: { character: { id: "1", name: "Spider-Man" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Refetch")));

  expect(SuspenseFallback).toHaveRenderedTimes(2);

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: { character: { id: "1", name: "Spider-Man (updated)" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it("re-suspends when calling `refetch` with new variables", async () => {
  const { query } = useVariablesQueryCase();

  const mocks: MockedResponse<VariablesCaseData>[] = [
    {
      request: { query, variables: { id: "1" } },
      result: {
        data: { character: { id: "1", name: "Captain Marvel" } },
      },
    },
    {
      request: { query, variables: { id: "2" } },
      result: {
        data: { character: { id: "2", name: "Captain America" } },
      },
    },
  ];

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<VariablesCaseData>();

  function App() {
    const [queryRef, loadQuery, { refetch }] = useInteractiveQuery(query);

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

  const { user } = renderWithMocks(<App />, { mocks });

  await act(() => user.click(screen.getByText("Load query")));

  expect(SuspenseFallback).toHaveRendered();

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: { character: { id: "1", name: "Captain Marvel" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Refetch with ID 2")));

  expect(SuspenseFallback).toHaveRenderedTimes(2);

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: { character: { id: "2", name: "Captain America" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
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
    },
  ];

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<VariablesCaseData>();

  function App() {
    const [queryRef, loadQuery, { refetch }] = useInteractiveQuery(query);

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

  const { user } = renderWithMocks(<App />, { mocks });

  await act(() => user.click(screen.getByText("Load query")));

  expect(SuspenseFallback).toHaveRendered();
  await ReadQueryHook.takeSnapshot();

  const button = screen.getByText("Refetch");

  await act(() => user.click(button));
  expect(SuspenseFallback).toHaveRenderedTimes(2);

  await act(() => user.click(button));
  expect(SuspenseFallback).toHaveRenderedTimes(3);
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

  const { SuspenseFallback, ReadQueryHook, ErrorBoundary, ErrorFallback } =
    createDefaultProfiledComponents<VariablesCaseData>();

  function App() {
    const [queryRef, loadQuery, { refetch }] = useInteractiveQuery(query);

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

  const { user } = renderWithMocks(<App />, { mocks });

  await act(() => user.click(screen.getByText("Load query")));
  await ReadQueryHook.waitForNextSnapshot();
  await act(() => user.click(screen.getByText("Refetch")));

  {
    const { snapshot } = await ErrorFallback.takeRender();

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
    },
    {
      request: { query, variables: { id: "1" } },
      result: {
        errors: [new GraphQLError("Something went wrong")],
      },
    },
  ];

  const { SuspenseFallback, ReadQueryHook, ErrorBoundary, ErrorFallback } =
    createDefaultProfiledComponents<VariablesCaseData | undefined>();

  function App() {
    const [queryRef, loadQuery, { refetch }] = useInteractiveQuery(query, {
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

  const { user } = renderWithMocks(<App />, { mocks });

  await act(() => user.click(screen.getByText("Load query")));
  await ReadQueryHook.takeSnapshot();
  await act(() => user.click(screen.getByText("Refetch")));

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: { character: { id: "1", name: "Captain Marvel" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
    expect(ErrorFallback).not.toHaveRendered();
  }
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

  const { SuspenseFallback, ReadQueryHook, ErrorBoundary, ErrorFallback } =
    createDefaultProfiledComponents<VariablesCaseData | undefined>();

  function App() {
    const [queryRef, loadQuery, { refetch }] = useInteractiveQuery(query, {
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

  const { user } = renderWithMocks(<App />, { mocks });

  await act(() => user.click(screen.getByText("Load query")));
  await ReadQueryHook.waitForNextSnapshot();
  await act(() => user.click(screen.getByText("Refetch")));

  // TODO: Figure out why there is an extra render here.
  // Perhaps related? https://github.com/apollographql/apollo-client/issues/11315
  await ReadQueryHook.takeSnapshot();
  const snapshot = await ReadQueryHook.takeSnapshot();

  expect(snapshot).toEqual({
    data: { character: { id: "1", name: "Captain Marvel" } },
    error: new ApolloError({
      graphQLErrors: [new GraphQLError("Something went wrong")],
    }),
    networkStatus: NetworkStatus.error,
  });
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

  const { SuspenseFallback, ReadQueryHook, ErrorBoundary, ErrorFallback } =
    createDefaultProfiledComponents<VariablesCaseData | undefined>();

  function App() {
    const [queryRef, loadQuery, { refetch }] = useInteractiveQuery(query, {
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

  const { user } = renderWithMocks(<App />, { mocks });

  await act(() => user.click(screen.getByText("Load query")));
  await ReadQueryHook.waitForNextSnapshot();
  await act(() => user.click(screen.getByText("Refetch")));

  // TODO: Figure out why there is an extra render here.
  // Perhaps related? https://github.com/apollographql/apollo-client/issues/11315
  await ReadQueryHook.takeSnapshot();
  const snapshot = await ReadQueryHook.takeSnapshot();

  expect(snapshot).toEqual({
    data: { character: { id: "1", name: null } },
    error: new ApolloError({
      graphQLErrors: [new GraphQLError("Something went wrong")],
    }),
    networkStatus: NetworkStatus.error,
  });
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

  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache: new InMemoryCache(),
  });

  function SuspenseFallback() {
    return <p>Loading</p>;
  }

  function App() {
    const [id, setId] = React.useState("1");
    const [queryRef, loadQuery, { refetch }] = useInteractiveQuery(query);

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
    queryRef: QueryReference<Data>;
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
  const { query, client } = usePaginatedQueryCase();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<PaginatedQueryData>();

  function App() {
    const [queryRef, loadQuery, { fetchMore }] = useInteractiveQuery(query);

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

  const { user } = renderWithClient(<App />, { client });

  await act(() => user.click(screen.getByText("Load query")));

  expect(SuspenseFallback).toHaveRendered();

  {
    const snapshot = await ReadQueryHook.waitForNextSnapshot();

    expect(snapshot).toEqual({
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

  expect(SuspenseFallback).toHaveRenderedTimes(2);

  // TODO: Figure out why there is an extra render here.
  // Perhaps related? https://github.com/apollographql/apollo-client/issues/11315
  await ReadQueryHook.takeSnapshot();

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: {
        letters: [
          { letter: "C", position: 3 },
          { letter: "D", position: 4 },
        ],
      },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});

it("properly uses `updateQuery` when calling `fetchMore`", async () => {
  const { query, client } = usePaginatedQueryCase();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<PaginatedQueryData>();

  function App() {
    const [queryRef, loadQuery, { fetchMore }] = useInteractiveQuery(query);

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

  const { user } = renderWithClient(<App />, { client });

  await act(() => user.click(screen.getByText("Load query")));

  expect(SuspenseFallback).toHaveRendered();

  {
    const snapshot = await ReadQueryHook.waitForNextSnapshot();

    expect(snapshot).toEqual({
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

  expect(SuspenseFallback).toHaveRenderedTimes(2);

  // TODO: Figure out why there is an extra render here.
  // Perhaps related? https://github.com/apollographql/apollo-client/issues/11315
  await ReadQueryHook.takeSnapshot();

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
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
});

it("properly uses cache field policies when calling `fetchMore` without `updateQuery`", async () => {
  const { query, link } = usePaginatedQueryCase();
  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<PaginatedQueryData>();

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
    const [queryRef, loadQuery, { fetchMore }] = useInteractiveQuery(query);

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

  const { user } = renderWithClient(<App />, { client });

  await act(() => user.click(screen.getByText("Load query")));

  expect(SuspenseFallback).toHaveRendered();

  {
    const snapshot = await ReadQueryHook.waitForNextSnapshot();

    expect(snapshot).toEqual({
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

  expect(SuspenseFallback).toHaveRenderedTimes(2);

  // TODO: Figure out why there is an extra render here.
  // Perhaps related? https://github.com/apollographql/apollo-client/issues/11315
  await ReadQueryHook.takeSnapshot();

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
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
    const [queryRef, loadQuery, { fetchMore }] = useInteractiveQuery(query);

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

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<QueryData>();

  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache,
  });

  function App() {
    const [queryRef, loadQuery, { refetch }] = useInteractiveQuery(query, {
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

  const { user } = renderWithClient(<App />, { client });

  await act(() => user.click(screen.getByText("Load query")));

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: { primes: [2, 3, 5, 7, 11] },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
    expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);
  }

  await act(() => user.click(screen.getByText("Refetch")));

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
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

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<QueryData>();

  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache,
  });

  function App() {
    const [queryRef, loadQuery, { refetch }] = useInteractiveQuery(query);

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

  const { user } = renderWithClient(<App />, { client });

  await act(() => user.click(screen.getByText("Load query")));

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: { primes: [2, 3, 5, 7, 11] },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
    expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);
  }

  await act(() => user.click(screen.getByText("Refetch")));

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
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

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<DeepPartial<Data>>();

  const cache = new InMemoryCache();

  cache.writeQuery({
    query: partialQuery,
    data: { character: { id: "1" } },
  });

  const client = new ApolloClient({ link: new MockLink(mocks), cache });

  function App() {
    const [queryRef, loadQuery] = useInteractiveQuery(fullQuery, {
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

  const { user } = renderWithClient(<App />, { client });

  await act(() => user.click(screen.getByText("Load query")));

  expect(SuspenseFallback).not.toHaveRendered();

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: { character: { id: "1" } },
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: { character: { id: "1", name: "Doctor Strange" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  expect(SuspenseFallback).not.toHaveRendered();
});

it('suspends and does not use partial data when changing variables and using a "cache-first" fetch policy with returnPartialData', async () => {
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

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<DeepPartial<VariablesCaseData>>();

  function App() {
    const [queryRef, loadQuery] = useInteractiveQuery(query, {
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

  const { user } = renderWithMocks(<App />, { mocks, cache });

  await act(() => user.click(screen.getByText("Load query")));

  expect(SuspenseFallback).not.toHaveRendered();

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: { character: { id: "1" } },
      error: undefined,
      networkStatus: NetworkStatus.loading,
    });
  }

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: { character: { id: "1", name: "Spider-Man" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Change variables")));

  expect(SuspenseFallback).toHaveRendered();

  {
    const snapshot = await ReadQueryHook.takeSnapshot();

    expect(snapshot).toEqual({
      data: { character: { id: "2", name: "Black Widow" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
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

  const { SuspenseFallback, ReadQueryHook } =
    createDefaultProfiledComponents<DeepPartial<Data>>();

  const cache = new InMemoryCache();

  cache.writeQuery({
    query: partialQuery,
    data: { character: { id: "1" } },
  });

  function App() {
    const [queryRef, loadQuery] = useInteractiveQuery(fullQuery, {
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

  const { user } = renderWithMocks(<App />, { mocks, cache });

  await act(() => user.click(screen.getByText("Load query")));

  expect(SuspenseFallback).toHaveRendered();

  const snapshot = await ReadQueryHook.takeSnapshot();

  expect(snapshot).toEqual({
    data: { character: { id: "1", name: "Doctor Strange" } },
    error: undefined,
    networkStatus: NetworkStatus.ready,
  });
});

it.skip('suspends when partial data is in the cache and using a "no-cache" fetch policy with returnPartialData', async () => {
  const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
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
    const [queryRef] = useInteractiveQuery(fullQuery, {
      fetchPolicy: "no-cache",
      returnPartialData: true,
    });

    return <Todo queryRef={queryRef} />;
  }

  function Todo({ queryRef }: { queryRef: QueryReference<DeepPartial<Data>> }) {
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

  consoleSpy.mockRestore();
});

it.skip('warns when using returnPartialData with a "no-cache" fetch policy', async () => {
  const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

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
      useInteractiveQuery(query, {
        fetchPolicy: "no-cache",
        returnPartialData: true,
      }),
    { mocks }
  );

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    "Using `returnPartialData` with a `no-cache` fetch policy has no effect. To read partial data from the cache, consider using an alternate fetch policy."
  );

  consoleSpy.mockRestore();
});

it.skip('does not suspend when partial data is in the cache and using a "cache-and-network" fetch policy with returnPartialData', async () => {
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
    const [queryRef] = useInteractiveQuery(fullQuery, {
      fetchPolicy: "cache-and-network",
      returnPartialData: true,
    });

    return <Todo queryRef={queryRef} />;
  }

  function Todo({ queryRef }: { queryRef: QueryReference<DeepPartial<Data>> }) {
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

it.skip('suspends and does not use partial data when changing variables and using a "cache-and-network" fetch policy with returnPartialData', async () => {
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

it.skip('does not suspend deferred queries with partial data in the cache and using a "cache-first" fetch policy with `returnPartialData`', async () => {
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

  const user = userEvent.setup();

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

  // We are intentionally writing partial data to the cache. Supress console
  // warnings to avoid unnecessary noise in the test.
  const consoleSpy = jest.spyOn(console, "error").mockImplementation();
  cache.writeQuery({
    query,
    data: {
      greeting: {
        __typename: "Greeting",
        recipient: { __typename: "Person", name: "Cached Alice" },
      },
    },
  });
  consoleSpy.mockRestore();

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
    const [queryRef, loadTodo] = useInteractiveQuery(query, {
      fetchPolicy: "cache-first",
      returnPartialData: true,
    });

    return (
      <div>
        <button onClick={() => loadTodo()}>Load todo</button>
        {queryRef && <Todo queryRef={queryRef} />}
      </div>
    );
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

  await act(() => user.click(screen.getByText("Load todo")));

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

describe.skip("type tests", () => {
  it("returns unknown when TData cannot be inferred", () => {
    const query = gql``;

    const [queryRef, loadQuery] = useInteractiveQuery(query);

    invariant(queryRef);

    const { data } = useReadQuery(queryRef);

    expectTypeOf(data).toEqualTypeOf<unknown>();
  });

  it("variables are optional and can be anything with an untyped DocumentNode", () => {
    const query = gql``;

    const [, loadQuery] = useInteractiveQuery(query);

    loadQuery();
    loadQuery({});
    loadQuery({ foo: "bar" });
    loadQuery({ bar: "baz" });
  });

  it("variables are optional and can be anything with unspecified TVariables on a TypedDocumentNode", () => {
    const query: TypedDocumentNode<{ greeting: string }> = gql``;

    const [, loadQuery] = useInteractiveQuery(query);

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

    const [, loadQuery] = useInteractiveQuery(query);

    loadQuery();
    loadQuery({});
    // @ts-expect-error unknown variable
    loadQuery({ foo: "bar" });
  });

  it("does not allow variables when TVariables is `never`", () => {
    const query: TypedDocumentNode<{ greeting: string }, never> = gql``;

    const [, loadQuery] = useInteractiveQuery(query);

    loadQuery();
    // @ts-expect-error no variables argument allowed
    loadQuery({});
    // @ts-expect-error no variables argument allowed
    loadQuery({ foo: "bar" });
  });

  it("optional variables are optional to loadQuery", () => {
    const query: TypedDocumentNode<
      { posts: string[] },
      { limit?: number }
    > = gql``;

    const [, loadQuery] = useInteractiveQuery(query);

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
    const query: TypedDocumentNode<
      { character: string },
      { id: string }
    > = gql``;

    const [, loadQuery] = useInteractiveQuery(query);

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

    const [, loadQuery] = useInteractiveQuery(query);

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
      const [queryRef] = useInteractiveQuery(query);

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    {
      const [queryRef] = useInteractiveQuery<
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
      const [queryRef] = useInteractiveQuery(query, {
        errorPolicy: "ignore",
      });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<VariablesCaseData | undefined>();
    }

    {
      const [queryRef] = useInteractiveQuery<
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
      const [queryRef] = useInteractiveQuery(query, {
        errorPolicy: "all",
      });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<VariablesCaseData | undefined>();
    }

    {
      const [queryRef] = useInteractiveQuery<
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
      const [queryRef] = useInteractiveQuery(query, {
        errorPolicy: "none",
      });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    {
      const [queryRef] = useInteractiveQuery<
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
      const [queryRef] = useInteractiveQuery(query, {
        returnPartialData: true,
      });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }

    {
      const [queryRef] = useInteractiveQuery<
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
      const [queryRef] = useInteractiveQuery(query, {
        returnPartialData: false,
      });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    {
      const [queryRef] = useInteractiveQuery<
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
      const [queryRef] = useInteractiveQuery(query, {
        fetchPolicy: "no-cache",
      });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<VariablesCaseData>();
    }

    {
      const [queryRef] = useInteractiveQuery<
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
      const [queryRef] = useInteractiveQuery(query, {
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
      const [queryRef] = useInteractiveQuery<
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
      const [queryRef] = useInteractiveQuery(query, {
        returnPartialData: true,
        errorPolicy: "none",
      });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }

    {
      const [queryRef] = useInteractiveQuery<
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
      const [queryRef] = useInteractiveQuery(query, {
        fetchPolicy: "no-cache",
        returnPartialData: true,
        errorPolicy: "none",
      });

      invariant(queryRef);

      const { data } = useReadQuery(queryRef);

      expectTypeOf(data).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
    }

    {
      const [queryRef] = useInteractiveQuery<
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
