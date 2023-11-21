import React, { Fragment, StrictMode, Suspense } from "react";
import {
  act,
  render,
  screen,
  renderHook,
  RenderHookOptions,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary, ErrorBoundaryProps } from "react-error-boundary";
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
import { profile, spyOnConsole } from "../../../testing/internal";

interface SimpleQueryData {
  greeting: string;
}

function useSimpleQueryCase(
  mockOverrides?: MockedResponse<SimpleQueryData, never>[]
) {
  const query: TypedDocumentNode<SimpleQueryData, never> = gql`
    query GreetingQuery {
      greeting
    }
  `;

  const mocks: MockedResponse<SimpleQueryData, never>[] = mockOverrides || [
    {
      request: { query },
      result: { data: { greeting: "Hello" } },
      delay: 10,
    },
  ];

  return { query, mocks };
}

function renderIntegrationTest({
  client,
}: {
  client?: ApolloClient<NormalizedCacheObject>;
} = {}) {
  const query: TypedDocumentNode<QueryData, never> = gql`
    query SimpleQuery {
      foo {
        bar
      }
    }
  `;

  const user = userEvent.setup();

  const mocks = [
    {
      request: { query },
      result: { data: { foo: { bar: "hello" } } },
      delay: 10,
    },
  ];
  const _client =
    client ||
    new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });
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
  const errorBoundaryProps: ErrorBoundaryProps = {
    fallback: <div>Error</div>,
    onError: (error) => {
      renders.errorCount++;
      renders.errors.push(error);
    },
  };

  interface QueryData {
    foo: { bar: string };
  }

  function SuspenseFallback() {
    renders.suspenseCount++;
    return <div>loading</div>;
  }

  function Child({ queryRef }: { queryRef: QueryReference<QueryData> }) {
    const { data } = useReadQuery(queryRef);
    // count renders in the child component
    renders.count++;
    return <div>{data.foo.bar}</div>;
  }

  function Parent() {
    const [queryRef, loadQuery] = useInteractiveQuery(query);
    return (
      <div>
        <button onClick={() => loadQuery()}>Load query</button>
        {queryRef && <Child queryRef={queryRef} />}
      </div>
    );
  }

  function App() {
    return (
      <ApolloProvider client={_client}>
        <ErrorBoundary {...errorBoundaryProps}>
          <Suspense fallback={<SuspenseFallback />}>
            <Parent />
          </Suspense>
        </ErrorBoundary>
      </ApolloProvider>
    );
  }

  const utils = render(<App />);

  return {
    ...utils,
    query,
    client: _client,
    renders,
    user,
    loadQueryButton: screen.getByText("Load query"),
  };
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

function useVariablesIntegrationTestCase() {
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
  let mocks = [...CHARACTERS].map((name, index) => ({
    request: { query, variables: { id: String(index + 1) } },
    result: { data: { character: { id: String(index + 1), name } } },
    delay: 20,
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
  options?: InteractiveQueryHookOptions;
  cache?: InMemoryCache;
  errorPolicy?: ErrorPolicy;
}) {
  const user = userEvent.setup();
  let { mocks: _mocks, query } = useVariablesIntegrationTestCase();

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

function renderPaginatedIntegrationTest({
  updateQuery,
  fieldPolicies,
}: {
  fieldPolicies?: boolean;
  updateQuery?: boolean;
  mocks?: {
    request: {
      query: DocumentNode;
      variables: { offset: number; limit: number };
    };
    result: {
      data: {
        letters: {
          letter: string;
          position: number;
        }[];
      };
    };
  }[];
} = {}) {
  interface QueryData {
    letters: {
      letter: string;
      position: number;
    }[];
  }

  interface Variables {
    limit?: number;
    offset?: number;
  }

  const query: TypedDocumentNode<QueryData, Variables> = gql`
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

  const cacheWithTypePolicies = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          letters: concatPagination(),
        },
      },
    },
  });
  const client = new ApolloClient({
    cache: fieldPolicies ? cacheWithTypePolicies : new InMemoryCache(),
    link,
  });
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
    queryRef,
    fetchMore,
  }: {
    fetchMore: FetchMoreFunction<QueryData, OperationVariables>;
    queryRef: QueryReference<QueryData>;
  }) {
    const { data, error } = useReadQuery(queryRef);
    // count renders in the child component
    renders.count++;
    return (
      <div>
        {error ? <div>{error.message}</div> : null}
        <button
          onClick={() => {
            const fetchMoreOpts: FetchMoreQueryOptions<Variables, QueryData> & {
              updateQuery?: (
                previousQueryResult: QueryData,
                options: {
                  fetchMoreResult: QueryData;
                  variables: Variables;
                }
              ) => QueryData;
            } = { variables: { offset: 2, limit: 2 } };

            if (updateQuery) {
              fetchMoreOpts.updateQuery = (prev, { fetchMoreResult }) => ({
                letters: prev.letters.concat(fetchMoreResult.letters),
              });
            }

            fetchMore(fetchMoreOpts);
          }}
        >
          Fetch more
        </button>
        <ul>
          {data.letters.map(({ letter, position }) => (
            <li data-testid="letter" key={position}>
              {letter}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  function ParentWithVariables() {
    const [queryRef, { fetchMore }] = useInteractiveQuery(query, {
      variables: { limit: 2, offset: 0 },
    });
    return <Child fetchMore={fetchMore} queryRef={queryRef} />;
  }

  function App() {
    return (
      <ApolloProvider client={client}>
        <ErrorBoundary {...errorBoundaryProps}>
          <Suspense fallback={<SuspenseFallback />}>
            <ParentWithVariables />
          </Suspense>
        </ErrorBoundary>
      </ApolloProvider>
    );
  }

  const { ...rest } = render(<App />);
  return { ...rest, data, query, client, renders };
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

it("loads a query when the load query function is called", async () => {
  const user = userEvent.setup();
  const { query, mocks } = useSimpleQueryCase();

  function SuspenseFallback() {
    ProfiledApp.updateSnapshot((snapshot) => ({
      ...snapshot,
      suspenseCount: snapshot.suspenseCount + 1,
    }));

    return <p>Loading</p>;
  }

  function Parent() {
    const [queryRef, loadQuery] = useInteractiveQuery(query);

    ProfiledApp.updateSnapshot((snapshot) => ({
      ...snapshot,
      parentRenderCount: snapshot.parentRenderCount + 1,
    }));

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <Greeting queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  function Greeting({
    queryRef,
  }: {
    queryRef: QueryReference<SimpleQueryData>;
  }) {
    const result = useReadQuery(queryRef);

    ProfiledApp.updateSnapshot((snapshot) => ({
      ...snapshot,
      result,
      childRenderCount: snapshot.childRenderCount + 1,
    }));

    return <div>{result.data.greeting}</div>;
  }

  const ProfiledApp = profile<{
    result: UseReadQueryResult<SimpleQueryData> | null;
    suspenseCount: number;
    parentRenderCount: number;
    childRenderCount: number;
  }>({
    Component: () => (
      <MockedProvider mocks={mocks}>
        <Parent />
      </MockedProvider>
    ),
    snapshotDOM: true,
    initialSnapshot: {
      result: null,
      suspenseCount: 0,
      parentRenderCount: 0,
      childRenderCount: 0,
    },
  });

  render(<ProfiledApp />);

  {
    const { snapshot } = await ProfiledApp.takeRender();
    expect(snapshot).toEqual({
      result: null,
      suspenseCount: 0,
      parentRenderCount: 1,
      childRenderCount: 0,
    });
  }

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { snapshot, withinDOM } = await ProfiledApp.takeRender();

    expect(withinDOM().getByText("Loading")).toBeInTheDocument();
    expect(snapshot).toEqual({
      result: null,
      suspenseCount: 1,
      parentRenderCount: 2,
      childRenderCount: 0,
    });
  }

  {
    const { snapshot, withinDOM } = await ProfiledApp.takeRender();

    expect(withinDOM().getByText("Hello")).toBeInTheDocument();
    expect(snapshot).toEqual({
      result: {
        data: { greeting: "Hello" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      suspenseCount: 1,
      parentRenderCount: 2,
      childRenderCount: 1,
    });
  }

  await expect(ProfiledApp).not.toRerender();
});

it("allows the client to be overridden", async () => {
  const user = userEvent.setup();
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

  function SuspenseFallback() {
    return <p>Loading</p>;
  }

  function Parent() {
    const [queryRef, loadQuery] = useInteractiveQuery(query, {
      client: localClient,
    });

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <Greeting queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  function Greeting({
    queryRef,
  }: {
    queryRef: QueryReference<SimpleQueryData>;
  }) {
    const result = useReadQuery(queryRef);

    ProfiledApp.updateSnapshot({ result });

    return <div>{result.data.greeting}</div>;
  }

  const ProfiledApp = profile<{
    result: UseReadQueryResult<SimpleQueryData> | null;
  }>({
    Component: () => (
      <ApolloProvider client={globalClient}>
        <Parent />
      </ApolloProvider>
    ),
    snapshotDOM: true,
    initialSnapshot: {
      result: null,
    },
  });

  render(<ProfiledApp />);

  {
    const { snapshot } = await ProfiledApp.takeRender();
    expect(snapshot.result).toEqual(null);
  }

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { snapshot, withinDOM } = await ProfiledApp.takeRender();

    expect(withinDOM().getByText("Loading")).toBeInTheDocument();
    expect(snapshot.result).toEqual(null);
  }

  {
    const { snapshot, withinDOM } = await ProfiledApp.takeRender();

    expect(withinDOM().getByText("local hello")).toBeInTheDocument();
    expect(snapshot.result).toEqual({
      data: { greeting: "local hello" },
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(ProfiledApp).not.toRerender();
});

it("passes context to the link", async () => {
  interface QueryData {
    context: Record<string, any>;
  }

  const user = userEvent.setup();
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

  function SuspenseFallback() {
    return <p>Loading</p>;
  }

  function Parent() {
    const [queryRef, loadQuery] = useInteractiveQuery(query, {
      context: { valueA: "A", valueB: "B" },
    });

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <Child queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  function Child({ queryRef }: { queryRef: QueryReference<QueryData> }) {
    const result = useReadQuery(queryRef);

    ProfiledApp.updateSnapshot({ result });

    return null;
  }

  const ProfiledApp = profile<{
    result: UseReadQueryResult<QueryData> | null;
  }>({
    Component: () => (
      <ApolloProvider client={client}>
        <Parent />
      </ApolloProvider>
    ),
    snapshotDOM: true,
    initialSnapshot: {
      result: null,
    },
  });

  render(<ProfiledApp />);

  {
    const { snapshot } = await ProfiledApp.takeRender();
    expect(snapshot.result).toEqual(null);
  }

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { snapshot, withinDOM } = await ProfiledApp.takeRender();

    expect(withinDOM().getByText("Loading")).toBeInTheDocument();
    expect(snapshot.result).toEqual(null);
  }

  {
    const { snapshot } = await ProfiledApp.takeRender();

    expect(snapshot.result).toEqual({
      data: { context: { valueA: "A", valueB: "B" } },
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(ProfiledApp).not.toRerender();
});

it('enables canonical results when canonizeResults is "true"', async () => {
  interface Result {
    __typename: string;
    value: number;
  }

  interface QueryData {
    results: Result[];
  }

  const user = userEvent.setup();
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

  function SuspenseFallback() {
    return <p>Loading</p>;
  }

  function Parent() {
    const [queryRef, loadQuery] = useInteractiveQuery(query, {
      canonizeResults: true,
    });

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <Child queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  function Child({ queryRef }: { queryRef: QueryReference<QueryData> }) {
    const result = useReadQuery(queryRef);

    ProfiledApp.updateSnapshot({ result });

    return null;
  }

  const ProfiledApp = profile<{
    result: UseReadQueryResult<QueryData> | null;
  }>({
    Component: () => (
      <ApolloProvider client={client}>
        <Parent />
      </ApolloProvider>
    ),
    initialSnapshot: {
      result: null,
    },
  });

  render(<ProfiledApp />);

  {
    const { snapshot } = await ProfiledApp.takeRender();
    expect(snapshot.result).toEqual(null);
  }

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { snapshot } = await ProfiledApp.takeRender();

    const resultSet = new Set(snapshot.result!.data.results);
    const values = Array.from(resultSet).map((item) => item.value);

    expect(snapshot.result).toEqual({
      data: { results },
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
    expect(resultSet.size).toBe(5);
    expect(values).toEqual([0, 1, 2, 3, 5]);
  }

  await expect(ProfiledApp).not.toRerender();
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

  const user = userEvent.setup();
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

  function SuspenseFallback() {
    return <p>Loading</p>;
  }

  function Parent() {
    const [queryRef, loadQuery] = useInteractiveQuery(query, {
      canonizeResults: false,
    });

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <Child queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  function Child({ queryRef }: { queryRef: QueryReference<QueryData> }) {
    const result = useReadQuery(queryRef);

    ProfiledApp.updateSnapshot({ result });

    return null;
  }

  const ProfiledApp = profile<{
    result: UseReadQueryResult<QueryData> | null;
  }>({
    Component: () => (
      <MockedProvider cache={cache}>
        <Parent />
      </MockedProvider>
    ),
    initialSnapshot: {
      result: null,
    },
  });

  render(<ProfiledApp />);

  {
    const { snapshot } = await ProfiledApp.takeRender();
    expect(snapshot.result).toEqual(null);
  }

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { snapshot } = await ProfiledApp.takeRender();

    const resultSet = new Set(snapshot.result!.data.results);
    const values = Array.from(resultSet).map((item) => item.value);

    expect(snapshot.result).toEqual({
      data: { results },
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
    expect(resultSet.size).toBe(6);
    expect(values).toEqual([0, 1, 1, 2, 3, 5]);
  }

  await expect(ProfiledApp).not.toRerender();
});

// // TODO(FIXME): test fails, should return cache data first if it exists
// it.skip('returns initial cache data followed by network data when the fetch policy is `cache-and-network`', async () => {
//   const query = gql`
//     {
//       hello
//     }
//   `;
//   const cache = new InMemoryCache();
//   const link = mockSingleLink({
//     request: { query },
//     result: { data: { hello: 'from link' } },
//     delay: 20,
//   });

//   const client = new ApolloClient({
//     link,
//     cache,
//   });

//   cache.writeQuery({ query, data: { hello: 'from cache' } });

//   const { result } = renderHook(
//     () => useInteractiveQuery(query, { fetchPolicy: 'cache-and-network' }),
//     {
//       wrapper: ({ children }) => (
//         <ApolloProvider client={client}>{children}</ApolloProvider>
//       ),
//     }
//   );

//   const [queryRef] = result.current;

//   const _result = await queryRef[QUERY_REFERENCE_SYMBOL].promise;

//   expect(_result).toEqual({
//     data: { hello: 'from link' },
//     loading: false,
//     networkStatus: 7,
//   });
// });

it("all data is present in the cache, no network request is made", async () => {
  const query = gql`
    query {
      hello
    }
  `;
  const user = userEvent.setup();
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

  function SuspenseFallback() {
    ProfiledApp.updateSnapshot((snapshot) => ({
      ...snapshot,
      suspenseCount: snapshot.suspenseCount + 1,
    }));

    return <p>Loading</p>;
  }

  function Parent() {
    const [queryRef, loadQuery] = useInteractiveQuery(query);

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <Child queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  function Child({ queryRef }: { queryRef: QueryReference<unknown> }) {
    const result = useReadQuery(queryRef);

    ProfiledApp.updateSnapshot((snapshot) => ({ ...snapshot, result }));

    return null;
  }

  const ProfiledApp = profile<{
    result: UseReadQueryResult<unknown> | null;
    suspenseCount: number;
  }>({
    Component: () => (
      <ApolloProvider client={client}>
        <Parent />
      </ApolloProvider>
    ),
    initialSnapshot: {
      result: null,
      suspenseCount: 0,
    },
  });

  render(<ProfiledApp />);

  {
    const { snapshot } = await ProfiledApp.takeRender();
    expect(snapshot.result).toEqual(null);
  }

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { snapshot } = await ProfiledApp.takeRender();

    expect(snapshot.suspenseCount).toBe(0);
    expect(snapshot.result).toEqual({
      data: { hello: "from cache" },
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(ProfiledApp).not.toRerender();
});

it("partial data is present in the cache so it is ignored and network request is made", async () => {
  const user = userEvent.setup();
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

  function SuspenseFallback() {
    ProfiledApp.updateSnapshot((snapshot) => ({
      ...snapshot,
      suspenseCount: snapshot.suspenseCount + 1,
    }));

    return <p>Loading</p>;
  }

  function Parent() {
    const [queryRef, loadQuery] = useInteractiveQuery(query);

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <Child queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  function Child({ queryRef }: { queryRef: QueryReference<unknown> }) {
    const result = useReadQuery(queryRef);

    ProfiledApp.updateSnapshot((snapshot) => ({ ...snapshot, result }));

    return null;
  }

  const ProfiledApp = profile<{
    result: UseReadQueryResult<unknown> | null;
    suspenseCount: number;
  }>({
    Component: () => (
      <ApolloProvider client={client}>
        <Parent />
      </ApolloProvider>
    ),
    initialSnapshot: {
      result: null,
      suspenseCount: 0,
    },
  });

  render(<ProfiledApp />);

  {
    const { snapshot } = await ProfiledApp.takeRender();
    expect(snapshot.suspenseCount).toBe(0);
    expect(snapshot.result).toBe(null);
  }

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { snapshot } = await ProfiledApp.takeRender();

    expect(snapshot.suspenseCount).toBe(1);
    expect(snapshot.result).toBe(null);
  }

  {
    const { snapshot } = await ProfiledApp.takeRender();

    expect(snapshot.suspenseCount).toBe(1);
    expect(snapshot.result).toEqual({
      data: { foo: "bar", hello: "from link" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(ProfiledApp).not.toRerender();
});

it("existing data in the cache is ignored when `fetchPolicy` is 'network-only'", async () => {
  const user = userEvent.setup();
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

  function SuspenseFallback() {
    ProfiledApp.updateSnapshot((snapshot) => ({
      ...snapshot,
      suspenseCount: snapshot.suspenseCount + 1,
    }));

    return <p>Loading</p>;
  }

  function Parent() {
    const [queryRef, loadQuery] = useInteractiveQuery(query, {
      fetchPolicy: "network-only",
    });

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <Child queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  function Child({ queryRef }: { queryRef: QueryReference<unknown> }) {
    const result = useReadQuery(queryRef);

    ProfiledApp.updateSnapshot((snapshot) => ({ ...snapshot, result }));

    return null;
  }

  const ProfiledApp = profile<{
    result: UseReadQueryResult<unknown> | null;
    suspenseCount: number;
  }>({
    Component: () => (
      <ApolloProvider client={client}>
        <Parent />
      </ApolloProvider>
    ),
    initialSnapshot: {
      result: null,
      suspenseCount: 0,
    },
  });

  render(<ProfiledApp />);

  {
    const { snapshot } = await ProfiledApp.takeRender();
    expect(snapshot.suspenseCount).toBe(0);
    expect(snapshot.result).toBe(null);
  }

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { snapshot } = await ProfiledApp.takeRender();

    expect(snapshot.suspenseCount).toBe(1);
    expect(snapshot.result).toBe(null);
  }

  {
    const { snapshot } = await ProfiledApp.takeRender();

    expect(snapshot.suspenseCount).toBe(1);
    expect(snapshot.result).toEqual({
      data: { hello: "from link" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(ProfiledApp).not.toRerender();
});

it("fetches data from the network but does not update the cache when `fetchPolicy` is 'no-cache'", async () => {
  const user = userEvent.setup();
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

  function SuspenseFallback() {
    ProfiledApp.updateSnapshot((snapshot) => ({
      ...snapshot,
      suspenseCount: snapshot.suspenseCount + 1,
    }));

    return <p>Loading</p>;
  }

  function Parent() {
    const [queryRef, loadQuery] = useInteractiveQuery(query, {
      fetchPolicy: "no-cache",
    });

    return (
      <>
        <button onClick={() => loadQuery()}>Load query</button>
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <Child queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  function Child({ queryRef }: { queryRef: QueryReference<unknown> }) {
    const result = useReadQuery(queryRef);

    ProfiledApp.updateSnapshot((snapshot) => ({ ...snapshot, result }));

    return null;
  }

  const ProfiledApp = profile<{
    result: UseReadQueryResult<unknown> | null;
    suspenseCount: number;
  }>({
    Component: () => (
      <ApolloProvider client={client}>
        <Parent />
      </ApolloProvider>
    ),
    initialSnapshot: {
      result: null,
      suspenseCount: 0,
    },
  });

  render(<ProfiledApp />);

  {
    const { snapshot } = await ProfiledApp.takeRender();
    expect(snapshot.suspenseCount).toBe(0);
    expect(snapshot.result).toBe(null);
  }

  await act(() => user.click(screen.getByText("Load query")));

  {
    const { snapshot } = await ProfiledApp.takeRender();

    expect(snapshot.suspenseCount).toBe(1);
    expect(snapshot.result).toBe(null);
  }

  {
    const { snapshot } = await ProfiledApp.takeRender();

    expect(snapshot.suspenseCount).toBe(1);
    expect(snapshot.result).toEqual({
      data: { hello: "from link" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
    expect(client.extract()).toEqual({
      ROOT_QUERY: { __typename: "Query", hello: "from cache" },
    });
  }

  await expect(ProfiledApp).not.toRerender();
});

describe("integration tests with useReadQuery", () => {
  it("suspends and renders hello", async () => {
    const user = userEvent.setup();
    const { renders, loadQueryButton } = renderIntegrationTest();

    expect(renders.suspenseCount).toBe(0);

    await act(() => user.click(loadQueryButton));

    expect(await screen.findByText("loading")).toBeInTheDocument();

    // the parent component re-renders when promise fulfilled
    expect(await screen.findByText("hello")).toBeInTheDocument();
    expect(renders.suspenseCount).toBe(1);
    expect(renders.count).toBe(1);
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
      const [queryRef, loadQuery] = useInteractiveQuery(query);

      return (
        <div>
          <button onClick={() => loadQuery({ id: "1" })}>
            Load first todo
          </button>
          {queryRef && (
            <Todo queryRef={queryRef} onChange={(id) => loadQuery({ id })} />
          )}
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

    render(<App />);

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

    const user = userEvent.setup();

    const query: TypedDocumentNode<Data, never> = gql`
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
    let renders = 0;
    let suspenseCount = 0;

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
      suspenseCount++;
      return <p>Loading</p>;
    }

    function Parent() {
      const [queryRef, loadQuery] = useInteractiveQuery(query, {
        fetchPolicy: "cache-and-network",
      });
      return (
        <div>
          <button onClick={() => loadQuery()}>Load todo</button>
          {queryRef && <Todo queryRef={queryRef} />}
        </div>
      );
    }

    function Todo({ queryRef }: { queryRef: QueryReference<Data> }) {
      const { data, networkStatus, error } = useReadQuery(queryRef);
      const { greeting } = data;
      renders++;

      return (
        <>
          <div>Message: {greeting.message}</div>
          <div>Recipient: {greeting.recipient.name}</div>
          <div>Network status: {networkStatus}</div>
          <div>Error: {error ? error.message : "none"}</div>
        </>
      );
    }

    render(<App />);

    await act(() => user.click(screen.getByText("Load todo")));

    expect(screen.getByText(/Message/i)).toHaveTextContent(
      "Message: Hello cached"
    );
    expect(screen.getByText(/Recipient/i)).toHaveTextContent(
      "Recipient: Cached Alice"
    );
    expect(screen.getByText(/Network status/i)).toHaveTextContent(
      "Network status: 1" // loading
    );
    expect(screen.getByText(/Error/i)).toHaveTextContent("none");

    link.simulateResult({
      result: {
        data: {
          greeting: { __typename: "Greeting", message: "Hello world" },
        },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/Message/i)).toHaveTextContent(
        "Message: Hello world"
      );
    });
    expect(screen.getByText(/Recipient/i)).toHaveTextContent(
      "Recipient: Cached Alice"
    );
    expect(screen.getByText(/Network status/i)).toHaveTextContent(
      "Network status: 7" // ready
    );
    expect(screen.getByText(/Error/i)).toHaveTextContent("none");

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

    await waitFor(() => {
      expect(screen.getByText(/Recipient/i)).toHaveTextContent(
        "Recipient: Alice"
      );
    });
    expect(screen.getByText(/Message/i)).toHaveTextContent(
      "Message: Hello world"
    );
    expect(screen.getByText(/Network status/i)).toHaveTextContent(
      "Network status: 7" // ready
    );
    expect(screen.getByText(/Error/i)).toHaveTextContent("none");

    expect(renders).toBe(3);
    expect(suspenseCount).toBe(0);
  });
});

it("reacts to cache updates", async () => {
  const { renders, client, query, loadQueryButton, user } =
    renderIntegrationTest();

  await act(() => user.click(loadQueryButton));

  expect(renders.suspenseCount).toBe(1);
  expect(screen.getByText("loading")).toBeInTheDocument();

  // the parent component re-renders when promise fulfilled
  expect(await screen.findByText("hello")).toBeInTheDocument();
  expect(renders.count).toBe(1);

  client.writeQuery({
    query,
    data: { foo: { bar: "baz" } },
  });

  // the parent component re-renders when promise fulfilled
  expect(await screen.findByText("baz")).toBeInTheDocument();

  expect(renders.count).toBe(2);
  expect(renders.suspenseCount).toBe(1);

  client.writeQuery({
    query,
    data: { foo: { bar: "bat" } },
  });

  expect(await screen.findByText("bat")).toBeInTheDocument();

  expect(renders.suspenseCount).toBe(1);
});

it("reacts to variables updates", async () => {
  const { renders, user, loadQueryButton } = renderVariablesIntegrationTest({
    variables: { id: "1" },
  });

  await act(() => user.click(loadQueryButton));

  expect(renders.suspenseCount).toBe(1);
  expect(screen.getByText("loading")).toBeInTheDocument();

  expect(await screen.findByText("1 - Spider-Man")).toBeInTheDocument();

  await act(() => user.click(screen.getByText("Change variables")));

  expect(renders.suspenseCount).toBe(2);
  expect(screen.getByText("loading")).toBeInTheDocument();

  expect(await screen.findByText("2 - Black Widow")).toBeInTheDocument();
});

it("applies `errorPolicy` on next fetch when it changes between renders", async () => {
  interface Data {
    greeting: string;
  }

  const user = userEvent.setup();

  const query: TypedDocumentNode<Data> = gql`
    query {
      greeting
    }
  `;

  const mocks = [
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

  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache: new InMemoryCache(),
  });

  function SuspenseFallback() {
    return <div>Loading...</div>;
  }

  function Parent() {
    const [errorPolicy, setErrorPolicy] = React.useState<ErrorPolicy>("none");
    const [queryRef, { refetch }] = useInteractiveQuery(query, {
      errorPolicy,
    });

    return (
      <>
        <button onClick={() => setErrorPolicy("all")}>
          Change error policy
        </button>
        <button onClick={() => refetch()}>Refetch greeting</button>
        <Suspense fallback={<SuspenseFallback />}>
          <Greeting queryRef={queryRef} />
        </Suspense>
      </>
    );
  }

  function Greeting({ queryRef }: { queryRef: QueryReference<Data> }) {
    const { data, error } = useReadQuery(queryRef);

    return error ? (
      <div data-testid="error">{error.message}</div>
    ) : (
      <div data-testid="greeting">{data.greeting}</div>
    );
  }

  function App() {
    return (
      <ApolloProvider client={client}>
        <ErrorBoundary fallback={<div data-testid="error">Error boundary</div>}>
          <Parent />
        </ErrorBoundary>
      </ApolloProvider>
    );
  }

  render(<App />);

  expect(await screen.findByTestId("greeting")).toHaveTextContent("Hello");

  await act(() => user.click(screen.getByText("Change error policy")));
  await act(() => user.click(screen.getByText("Refetch greeting")));

  // Ensure we aren't rendering the error boundary and instead rendering the
  // error message in the Greeting component.
  expect(await screen.findByTestId("error")).toHaveTextContent("oops");
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
    return Observable.of({
      data: {
        context: operation.getContext(),
      },
    });
  });

  const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
  });

  function SuspenseFallback() {
    return <div>Loading...</div>;
  }

  function Parent() {
    const [phase, setPhase] = React.useState("initial");
    const [queryRef, { refetch }] = useInteractiveQuery(query, {
      context: { phase },
    });

    return (
      <>
        <button onClick={() => setPhase("rerender")}>Update context</button>
        <button onClick={() => refetch()}>Refetch</button>
        <Suspense fallback={<SuspenseFallback />}>
          <Context queryRef={queryRef} />
        </Suspense>
      </>
    );
  }

  function Context({ queryRef }: { queryRef: QueryReference<Data> }) {
    const { data } = useReadQuery(queryRef);

    return <div data-testid="context">{data.context.phase}</div>;
  }

  function App() {
    return (
      <ApolloProvider client={client}>
        <Parent />
      </ApolloProvider>
    );
  }

  render(<App />);

  expect(await screen.findByTestId("context")).toHaveTextContent("initial");

  await act(() => user.click(screen.getByText("Update context")));
  await act(() => user.click(screen.getByText("Refetch")));

  expect(await screen.findByTestId("context")).toHaveTextContent("rerender");
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

  const client = new ApolloClient({
    link: new MockLink([]),
    cache,
  });

  const result: { current: Data | null } = {
    current: null,
  };

  function SuspenseFallback() {
    return <div>Loading...</div>;
  }

  function Parent() {
    const [canonizeResults, setCanonizeResults] = React.useState(false);
    const [queryRef] = useInteractiveQuery(query, {
      canonizeResults,
    });

    return (
      <>
        <button onClick={() => setCanonizeResults(true)}>
          Canonize results
        </button>
        <Suspense fallback={<SuspenseFallback />}>
          <Results queryRef={queryRef} />
        </Suspense>
      </>
    );
  }

  function Results({ queryRef }: { queryRef: QueryReference<Data> }) {
    const { data } = useReadQuery(queryRef);

    result.current = data;

    return null;
  }

  function App() {
    return (
      <ApolloProvider client={client}>
        <Parent />
      </ApolloProvider>
    );
  }

  render(<App />);

  function verifyCanonicalResults(data: Data, canonized: boolean) {
    const resultSet = new Set(data.results);
    const values = Array.from(resultSet).map((item) => item.value);

    expect(data).toEqual({ results });

    if (canonized) {
      expect(data.results.length).toBe(6);
      expect(resultSet.size).toBe(5);
      expect(values).toEqual([0, 1, 2, 3, 5]);
    } else {
      expect(data.results.length).toBe(6);
      expect(resultSet.size).toBe(6);
      expect(values).toEqual([0, 1, 1, 2, 3, 5]);
    }
  }

  verifyCanonicalResults(result.current!, false);

  await act(() => user.click(screen.getByText("Canonize results")));

  verifyCanonicalResults(result.current!, true);
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

  function SuspenseFallback() {
    return <div>Loading...</div>;
  }

  function Parent() {
    const [refetchWritePolicy, setRefetchWritePolicy] =
      React.useState<RefetchWritePolicy>("merge");

    const [queryRef, { refetch }] = useInteractiveQuery(query, {
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
          <Primes queryRef={queryRef} />
        </Suspense>
      </>
    );
  }

  function Primes({ queryRef }: { queryRef: QueryReference<Data> }) {
    const { data } = useReadQuery(queryRef);

    return <span data-testid="primes">{data.primes.join(", ")}</span>;
  }

  function App() {
    return (
      <ApolloProvider client={client}>
        <Parent />
      </ApolloProvider>
    );
  }

  render(<App />);

  const primes = await screen.findByTestId("primes");

  expect(primes).toHaveTextContent("2, 3, 5, 7, 11");
  expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);

  await act(() => user.click(screen.getByText("Refetch next")));

  await waitFor(() => {
    expect(primes).toHaveTextContent("2, 3, 5, 7, 11, 13, 17, 19, 23, 29");
  });

  expect(mergeParams).toEqual([
    [undefined, [2, 3, 5, 7, 11]],
    [
      [2, 3, 5, 7, 11],
      [13, 17, 19, 23, 29],
    ],
  ]);

  await act(() => user.click(screen.getByText("Change refetch write policy")));

  await act(() => user.click(screen.getByText("Refetch last")));

  await waitFor(() => {
    expect(primes).toHaveTextContent("31, 37, 41, 43, 47");
  });

  expect(mergeParams).toEqual([
    [undefined, [2, 3, 5, 7, 11]],
    [
      [2, 3, 5, 7, 11],
      [13, 17, 19, 23, 29],
    ],
    [undefined, [31, 37, 41, 43, 47]],
  ]);
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

  const user = userEvent.setup();

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

  function SuspenseFallback() {
    return <div>Loading...</div>;
  }

  function Parent() {
    const [returnPartialData, setReturnPartialData] = React.useState(false);

    const [queryRef] = useInteractiveQuery(fullQuery, {
      returnPartialData,
    });

    return (
      <>
        <button onClick={() => setReturnPartialData(true)}>
          Update partial data
        </button>
        <Suspense fallback={<SuspenseFallback />}>
          <Character queryRef={queryRef} />
        </Suspense>
      </>
    );
  }

  function Character({ queryRef }: { queryRef: QueryReference<Data> }) {
    const { data } = useReadQuery(queryRef);

    return (
      <span data-testid="character">{data.character.name ?? "unknown"}</span>
    );
  }

  function App() {
    return (
      <ApolloProvider client={client}>
        <Parent />
      </ApolloProvider>
    );
  }

  render(<App />);

  const character = await screen.findByTestId("character");

  expect(character).toHaveTextContent("Doctor Strange");

  await act(() => user.click(screen.getByText("Update partial data")));

  cache.modify({
    id: cache.identify({ __typename: "Character", id: "1" }),
    fields: {
      name: (_, { DELETE }) => DELETE,
    },
  });

  await waitFor(() => {
    expect(character).toHaveTextContent("unknown");
  });

  await waitFor(() => {
    expect(character).toHaveTextContent("Doctor Strange (refetched)");
  });
});

it("applies updated `fetchPolicy` on next fetch when it changes between renders", async () => {
  interface Data {
    character: {
      __typename: "Character";
      id: string;
      name: string;
    };
  }

  const user = userEvent.setup();

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

  function SuspenseFallback() {
    return <div>Loading...</div>;
  }

  function Parent() {
    const [fetchPolicy, setFetchPolicy] =
      React.useState<InteractiveQueryHookFetchPolicy>("cache-first");

    const [queryRef, { refetch }] = useInteractiveQuery(query, {
      fetchPolicy,
    });

    return (
      <>
        <button onClick={() => setFetchPolicy("no-cache")}>
          Change fetch policy
        </button>
        <button onClick={() => refetch()}>Refetch</button>
        <Suspense fallback={<SuspenseFallback />}>
          <Character queryRef={queryRef} />
        </Suspense>
      </>
    );
  }

  function Character({ queryRef }: { queryRef: QueryReference<Data> }) {
    const { data } = useReadQuery(queryRef);

    return <span data-testid="character">{data.character.name}</span>;
  }

  function App() {
    return (
      <ApolloProvider client={client}>
        <Parent />
      </ApolloProvider>
    );
  }

  render(<App />);

  const character = await screen.findByTestId("character");

  expect(character).toHaveTextContent("Doctor Strangecache");

  await act(() => user.click(screen.getByText("Change fetch policy")));
  await act(() => user.click(screen.getByText("Refetch")));
  await waitFor(() => {
    expect(character).toHaveTextContent("Doctor Strange");
  });

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

it("properly handles changing options along with changing `variables`", async () => {
  interface Data {
    character: {
      __typename: "Character";
      id: string;
      name: string;
    };
  }

  const user = userEvent.setup();
  const query: TypedDocumentNode<Data, { id: string }> = gql`
    query ($id: ID!) {
      character(id: $id) {
        __typename
        id
        name
      }
    }
  `;

  const mocks = [
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

  function SuspenseFallback() {
    return <div>Loading...</div>;
  }

  function Parent() {
    const [id, setId] = React.useState("1");

    const [queryRef, { refetch }] = useInteractiveQuery(query, {
      errorPolicy: id === "1" ? "all" : "none",
      variables: { id },
    });

    return (
      <>
        <button onClick={() => setId("1")}>Get first character</button>
        <button onClick={() => setId("2")}>Get second character</button>
        <button onClick={() => refetch()}>Refetch</button>
        <ErrorBoundary fallback={<div data-testid="error">Error boundary</div>}>
          <Suspense fallback={<SuspenseFallback />}>
            <Character queryRef={queryRef} />
          </Suspense>
        </ErrorBoundary>
      </>
    );
  }

  function Character({ queryRef }: { queryRef: QueryReference<Data> }) {
    const { data, error } = useReadQuery(queryRef);

    return error ? (
      <div data-testid="error">{error.message}</div>
    ) : (
      <span data-testid="character">{data.character.name}</span>
    );
  }

  function App() {
    return (
      <ApolloProvider client={client}>
        <Parent />
      </ApolloProvider>
    );
  }

  render(<App />);

  const character = await screen.findByTestId("character");

  expect(character).toHaveTextContent("Doctor Strangecache");

  await act(() => user.click(screen.getByText("Get second character")));

  await waitFor(() => {
    expect(character).toHaveTextContent("Hulk");
  });

  await act(() => user.click(screen.getByText("Get first character")));

  await waitFor(() => {
    expect(character).toHaveTextContent("Doctor Strangecache");
  });

  await act(() => user.click(screen.getByText("Refetch")));

  // Ensure we render the inline error instead of the error boundary, which
  // tells us the error policy was properly applied.
  expect(await screen.findByTestId("error")).toHaveTextContent("oops");
});

describe("refetch", () => {
  it("re-suspends when calling `refetch`", async () => {
    const { renders } = renderVariablesIntegrationTest({
      variables: { id: "1" },
    });

    expect(renders.suspenseCount).toBe(1);
    expect(screen.getByText("loading")).toBeInTheDocument();

    expect(await screen.findByText("1 - Spider-Man")).toBeInTheDocument();

    const button = screen.getByText("Refetch");
    const user = userEvent.setup();
    await act(() => user.click(button));

    // parent component re-suspends
    expect(renders.suspenseCount).toBe(2);
    expect(renders.count).toBe(2);

    expect(
      await screen.findByText("1 - Spider-Man (updated)")
    ).toBeInTheDocument();
  });
  it("re-suspends when calling `refetch` with new variables", async () => {
    interface QueryData {
      character: {
        id: string;
        name: string;
      };
    }

    interface QueryVariables {
      id: string;
    }
    const query: TypedDocumentNode<QueryData, QueryVariables> = gql`
      query CharacterQuery($id: ID!) {
        character(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
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

    const { renders } = renderVariablesIntegrationTest({
      variables: { id: "1" },
      mocks,
    });

    expect(renders.suspenseCount).toBe(1);
    expect(screen.getByText("loading")).toBeInTheDocument();

    expect(await screen.findByText("1 - Captain Marvel")).toBeInTheDocument();

    const newVariablesRefetchButton = screen.getByText(
      "Set variables to id: 2"
    );
    const refetchButton = screen.getByText("Refetch");
    const user = userEvent.setup();
    await act(() => user.click(newVariablesRefetchButton));
    await act(() => user.click(refetchButton));

    expect(await screen.findByText("2 - Captain America")).toBeInTheDocument();

    // parent component re-suspends
    expect(renders.suspenseCount).toBe(2);
    expect(renders.count).toBe(3);

    // extra render puts an additional frame into the array
    expect(renders.frames).toMatchObject([
      {
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
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
  it("re-suspends multiple times when calling `refetch` multiple times", async () => {
    const { renders } = renderVariablesIntegrationTest({
      variables: { id: "1" },
    });

    expect(renders.suspenseCount).toBe(1);
    expect(screen.getByText("loading")).toBeInTheDocument();

    expect(await screen.findByText("1 - Spider-Man")).toBeInTheDocument();

    const button = screen.getByText("Refetch");
    const user = userEvent.setup();
    await act(() => user.click(button));

    // parent component re-suspends
    expect(renders.suspenseCount).toBe(2);
    expect(renders.count).toBe(2);

    expect(
      await screen.findByText("1 - Spider-Man (updated)")
    ).toBeInTheDocument();

    await act(() => user.click(button));

    // parent component re-suspends
    expect(renders.suspenseCount).toBe(3);
    expect(renders.count).toBe(3);

    expect(
      await screen.findByText("1 - Spider-Man (updated again)")
    ).toBeInTheDocument();
  });
  it("throws errors when errors are returned after calling `refetch`", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    interface QueryData {
      character: {
        id: string;
        name: string;
      };
    }

    interface QueryVariables {
      id: string;
    }
    const query: TypedDocumentNode<QueryData, QueryVariables> = gql`
      query CharacterQuery($id: ID!) {
        character(id: $id) {
          id
          name
        }
      }
    `;
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
    const { renders } = renderVariablesIntegrationTest({
      variables: { id: "1" },
      mocks,
    });

    expect(renders.suspenseCount).toBe(1);
    expect(screen.getByText("loading")).toBeInTheDocument();

    expect(await screen.findByText("1 - Captain Marvel")).toBeInTheDocument();

    const button = screen.getByText("Refetch");
    const user = userEvent.setup();
    await act(() => user.click(button));

    await waitFor(() => {
      expect(renders.errorCount).toBe(1);
    });

    expect(renders.errors).toEqual([
      new ApolloError({
        graphQLErrors: [new GraphQLError("Something went wrong")],
      }),
    ]);

    consoleSpy.mockRestore();
  });
  it('ignores errors returned after calling `refetch` when errorPolicy is set to "ignore"', async () => {
    interface QueryData {
      character: {
        id: string;
        name: string;
      };
    }

    interface QueryVariables {
      id: string;
    }
    const query: TypedDocumentNode<QueryData, QueryVariables> = gql`
      query CharacterQuery($id: ID!) {
        character(id: $id) {
          id
          name
        }
      }
    `;
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

    const { renders } = renderVariablesIntegrationTest({
      variables: { id: "1" },
      errorPolicy: "ignore",
      mocks,
    });

    expect(await screen.findByText("1 - Captain Marvel")).toBeInTheDocument();

    const button = screen.getByText("Refetch");
    const user = userEvent.setup();
    await act(() => user.click(button));

    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
  });
  it('returns errors after calling `refetch` when errorPolicy is set to "all"', async () => {
    interface QueryData {
      character: {
        id: string;
        name: string;
      };
    }

    interface QueryVariables {
      id: string;
    }
    const query: TypedDocumentNode<QueryData, QueryVariables> = gql`
      query CharacterQuery($id: ID!) {
        character(id: $id) {
          id
          name
        }
      }
    `;
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

    const { renders } = renderVariablesIntegrationTest({
      variables: { id: "1" },
      errorPolicy: "all",
      mocks,
    });

    expect(await screen.findByText("1 - Captain Marvel")).toBeInTheDocument();

    const button = screen.getByText("Refetch");
    const user = userEvent.setup();
    await act(() => user.click(button));

    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
  });
  it('handles partial data results after calling `refetch` when errorPolicy is set to "all"', async () => {
    interface QueryData {
      character: {
        id: string;
        name: string;
      };
    }

    interface QueryVariables {
      id: string;
    }
    const query: TypedDocumentNode<QueryData, QueryVariables> = gql`
      query CharacterQuery($id: ID!) {
        character(id: $id) {
          id
          name
        }
      }
    `;
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
          data: { character: { id: "1", name: null } },
          errors: [new GraphQLError("Something went wrong")],
        },
      },
    ];

    const { renders } = renderVariablesIntegrationTest({
      variables: { id: "1" },
      errorPolicy: "all",
      mocks,
    });

    expect(await screen.findByText("1 - Captain Marvel")).toBeInTheDocument();

    const button = screen.getByText("Refetch");
    const user = userEvent.setup();
    await act(() => user.click(button));

    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();

    const expectedError = new ApolloError({
      graphQLErrors: [new GraphQLError("Something went wrong")],
    });

    expect(renders.frames).toMatchObject([
      {
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: mocks[1].result.data,
        networkStatus: NetworkStatus.error,
        error: expectedError,
      },
    ]);
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

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache: new InMemoryCache(),
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
      const [id, setId] = React.useState("1");
      const [queryRef, { refetch }] = useInteractiveQuery(query, {
        variables: { id },
      });
      return <Todo refetch={refetch} queryRef={queryRef} onChange={setId} />;
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

    render(<App />);

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
});

describe("fetchMore", () => {
  function getItemTexts() {
    return screen.getAllByTestId(/letter/).map(
      // eslint-disable-next-line testing-library/no-node-access
      (li) => li.firstChild!.textContent
    );
  }
  it("re-suspends when calling `fetchMore` with different variables", async () => {
    const { renders } = renderPaginatedIntegrationTest();

    expect(renders.suspenseCount).toBe(1);
    expect(screen.getByText("loading")).toBeInTheDocument();

    const items = await screen.findAllByTestId(/letter/i);
    expect(items).toHaveLength(2);
    expect(getItemTexts()).toStrictEqual(["A", "B"]);

    const button = screen.getByText("Fetch more");
    const user = userEvent.setup();
    await act(() => user.click(button));

    // parent component re-suspends
    expect(renders.suspenseCount).toBe(2);
    await waitFor(() => {
      expect(renders.count).toBe(2);
    });

    expect(getItemTexts()).toStrictEqual(["C", "D"]);
  });
  it("properly uses `updateQuery` when calling `fetchMore`", async () => {
    const { renders } = renderPaginatedIntegrationTest({
      updateQuery: true,
    });

    expect(renders.suspenseCount).toBe(1);
    expect(screen.getByText("loading")).toBeInTheDocument();

    const items = await screen.findAllByTestId(/letter/i);

    expect(items).toHaveLength(2);
    expect(getItemTexts()).toStrictEqual(["A", "B"]);

    const button = screen.getByText("Fetch more");
    const user = userEvent.setup();
    await act(() => user.click(button));

    // parent component re-suspends
    expect(renders.suspenseCount).toBe(2);
    await waitFor(() => {
      expect(renders.count).toBe(2);
    });

    const moreItems = await screen.findAllByTestId(/letter/i);
    expect(moreItems).toHaveLength(4);
    expect(getItemTexts()).toStrictEqual(["A", "B", "C", "D"]);
  });
  it("properly uses cache field policies when calling `fetchMore` without `updateQuery`", async () => {
    const { renders } = renderPaginatedIntegrationTest({
      fieldPolicies: true,
    });
    expect(renders.suspenseCount).toBe(1);
    expect(screen.getByText("loading")).toBeInTheDocument();

    const items = await screen.findAllByTestId(/letter/i);

    expect(items).toHaveLength(2);
    expect(getItemTexts()).toStrictEqual(["A", "B"]);

    const button = screen.getByText("Fetch more");
    const user = userEvent.setup();
    await act(() => user.click(button));

    // parent component re-suspends
    expect(renders.suspenseCount).toBe(2);
    await waitFor(() => {
      expect(renders.count).toBe(2);
    });

    const moreItems = await screen.findAllByTestId(/letter/i);
    expect(moreItems).toHaveLength(4);
    expect(getItemTexts()).toStrictEqual(["A", "B", "C", "D"]);
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
      const [queryRef, { fetchMore }] = useInteractiveQuery(query, {
        variables: { offset: 0 },
      });
      return <Todo fetchMore={fetchMore} queryRef={queryRef} />;
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

    render(<App />);

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
      const [queryRef, { refetch }] = useInteractiveQuery(query, {
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
      const [queryRef, { refetch }] = useInteractiveQuery(query, {
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
      const [queryRef] = useInteractiveQuery(fullQuery, {
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
      const [queryRef] = useInteractiveQuery(fullQuery, {
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

    consoleSpy.mockRestore();
  });

  it('warns when using returnPartialData with a "no-cache" fetch policy', async () => {
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
      const [queryRef] = useInteractiveQuery(fullQuery, {
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
});

describe.skip("type tests", () => {
  it("returns unknown when TData cannot be inferred", () => {
    const query = gql`
      query {
        hello
      }
    `;

    const [queryRef, loadQuery] = useInteractiveQuery(query);

    invariant(queryRef);

    const { data } = useReadQuery(queryRef);

    expectTypeOf(data).toEqualTypeOf<unknown>();
    expectTypeOf(loadQuery).toEqualTypeOf<
      (variables: OperationVariables) => void
    >();
  });

  it("enforces variables argument to loadQuery function when TVariables is specified", () => {
    const { query } = useVariablesIntegrationTestCase();

    const [, loadQuery] = useInteractiveQuery(query);

    expectTypeOf(loadQuery).toEqualTypeOf<
      (variables: VariablesCaseVariables) => void
    >();
    // @ts-expect-error enforces variables argument when type is specified
    loadQuery();
  });

  it("disallows wider variables type", () => {
    const { query } = useVariablesIntegrationTestCase();

    const [, loadQuery] = useInteractiveQuery(query);

    expectTypeOf(loadQuery).toEqualTypeOf<
      (variables: VariablesCaseVariables) => void
    >();
    // @ts-expect-error does not allow wider TVariables type
    loadQuery({ id: "1", foo: "bar" });
  });

  it("does not allow variables argument to loadQuery when TVariables is `never`", () => {
    const query: TypedDocumentNode<SimpleQueryData, never> = gql`
      query {
        greeting
      }
    `;

    const [, loadQuery] = useInteractiveQuery(query);

    expectTypeOf(loadQuery).toEqualTypeOf<() => void>();
    // @ts-expect-error does not allow variables argument when TVariables is `never`
    loadQuery({});
  });

  it("returns TData in default case", () => {
    const { query } = useVariablesIntegrationTestCase();

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
    const { query } = useVariablesIntegrationTestCase();

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
    const { query } = useVariablesIntegrationTestCase();

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
    const { query } = useVariablesIntegrationTestCase();

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
    const { query } = useVariablesIntegrationTestCase();

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
    const { query } = useVariablesIntegrationTestCase();

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
    const { query } = useVariablesIntegrationTestCase();

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
    const { query } = useVariablesIntegrationTestCase();

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
    const { query } = useVariablesIntegrationTestCase();

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
