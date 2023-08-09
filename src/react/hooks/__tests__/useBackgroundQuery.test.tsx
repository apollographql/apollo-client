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
  MockedResponse,
  MockedProvider,
  MockLink,
  MockSubscriptionLink,
  mockSingleLink,
} from "../../../testing";
import {
  concatPagination,
  offsetLimitPagination,
  DeepPartial,
} from "../../../utilities";
import { useBackgroundQuery } from "../useBackgroundQuery";
import { useReadQuery } from "../useReadQuery";
import { ApolloProvider } from "../../context";
import { unwrapQueryRef, QueryReference } from "../../cache/QueryReference";
import { InMemoryCache } from "../../../cache";
import {
  SuspenseQueryHookFetchPolicy,
  SuspenseQueryHookOptions,
} from "../../types/types";
import equal from "@wry/equality";
import { RefetchWritePolicy } from "../../../core/watchQueryOptions";
import { skipToken } from "../constants";

function renderIntegrationTest({
  client,
}: {
  client?: ApolloClient<NormalizedCacheObject>;
} = {}) {
  const query: TypedDocumentNode<QueryData> = gql`
    query SimpleQuery {
      foo {
        bar
      }
    }
  `;

  const mocks = [
    {
      request: { query },
      result: { data: { foo: { bar: "hello" } } },
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
    const [queryRef] = useBackgroundQuery(query);
    return <Child queryRef={queryRef} />;
  }

  function ParentWithVariables() {
    const [queryRef] = useBackgroundQuery(query);
    return <Child queryRef={queryRef} />;
  }

  function App({ variables }: { variables?: Record<string, unknown> }) {
    return (
      <ApolloProvider client={_client}>
        <ErrorBoundary {...errorBoundaryProps}>
          <Suspense fallback={<SuspenseFallback />}>
            {variables ? <ParentWithVariables /> : <Parent />}
          </Suspense>
        </ErrorBoundary>
      </ApolloProvider>
    );
  }

  const { ...rest } = render(<App />);
  return { ...rest, query, client: _client, renders };
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
                index > 3
                  ? index > 7
                    ? `${result.data.character.name} (updated again)`
                    : `${result.data.character.name} (updated)`
                  : result.data.character.name,
            },
          },
        },
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
        {error ? <div>{error.message}</div> : null}
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
        <ErrorBoundary {...errorBoundaryProps}>
          <Suspense fallback={<SuspenseFallback />}>
            <ParentWithVariables
              variables={variables}
              errorPolicy={errorPolicy}
            />
          </Suspense>
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
  return { ...rest, query, rerender, client, renders, mocks: mocks || _mocks };
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
    onFetchMore,
  }: {
    onFetchMore: (options: FetchMoreQueryOptions<Variables, QueryData>) => void;
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

            onFetchMore(fetchMoreOpts);
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
    const [queryRef, { fetchMore }] = useBackgroundQuery(query, {
      variables: { limit: 2, offset: 0 },
    });
    return <Child onFetchMore={fetchMore} queryRef={queryRef} />;
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

describe("useBackgroundQuery", () => {
  it("fetches a simple query with minimal config", async () => {
    const query = gql`
      query {
        hello
      }
    `;
    const mocks = [
      {
        request: { query },
        result: { data: { hello: "world 1" } },
      },
    ];
    const { result } = renderHook(() => useBackgroundQuery(query), {
      wrapper: ({ children }) => (
        <MockedProvider mocks={mocks}>{children}</MockedProvider>
      ),
    });

    const [queryRef] = result.current;

    const _result = await unwrapQueryRef(queryRef).promise;

    expect(_result).toEqual({
      data: { hello: "world 1" },
      loading: false,
      networkStatus: 7,
    });
  });

  it("allows the client to be overridden", async () => {
    const query: TypedDocumentNode<SimpleQueryData> = gql`
      query UserQuery {
        greeting
      }
    `;

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

    const { result } = renderSuspenseHook(
      () => useBackgroundQuery(query, { client: localClient }),
      { client: globalClient }
    );

    const [queryRef] = result.current;

    const _result = await unwrapQueryRef(queryRef).promise;

    await waitFor(() => {
      expect(_result).toEqual({
        data: { greeting: "local hello" },
        loading: false,
        networkStatus: NetworkStatus.ready,
      });
    });
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

    const { result } = renderHook(
      () =>
        useBackgroundQuery(query, {
          context: { valueA: "A", valueB: "B" },
        }),
      {
        wrapper: ({ children }) => (
          <MockedProvider link={link}>{children}</MockedProvider>
        ),
      }
    );

    const [queryRef] = result.current;

    const _result = await unwrapQueryRef(queryRef).promise;

    await waitFor(() => {
      expect(_result).toMatchObject({
        data: { context: { valueA: "A", valueB: "B" } },
        networkStatus: NetworkStatus.ready,
      });
    });
  });

  it('enables canonical results when canonizeResults is "true"', async () => {
    interface Result {
      __typename: string;
      value: number;
    }

    const cache = new InMemoryCache({
      typePolicies: {
        Result: {
          keyFields: false,
        },
      },
    });

    const query: TypedDocumentNode<{ results: Result[] }> = gql`
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

    const { result } = renderHook(
      () =>
        useBackgroundQuery(query, {
          canonizeResults: true,
        }),
      {
        wrapper: ({ children }) => (
          <MockedProvider cache={cache}>{children}</MockedProvider>
        ),
      }
    );

    const [queryRef] = result.current;

    const _result = await unwrapQueryRef(queryRef).promise;
    const resultSet = new Set(_result.data.results);
    const values = Array.from(resultSet).map((item) => item.value);

    expect(_result.data).toEqual({ results });
    expect(_result.data.results.length).toBe(6);
    expect(resultSet.size).toBe(5);
    expect(values).toEqual([0, 1, 2, 3, 5]);
  });

  it("can disable canonical results when the cache's canonizeResults setting is true", async () => {
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

    const query: TypedDocumentNode<{ results: Result[] }> = gql`
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

    const { result } = renderHook(
      () =>
        useBackgroundQuery(query, {
          canonizeResults: false,
        }),
      {
        wrapper: ({ children }) => (
          <MockedProvider cache={cache}>{children}</MockedProvider>
        ),
      }
    );

    const [queryRef] = result.current;

    const _result = await unwrapQueryRef(queryRef).promise;
    const resultSet = new Set(_result.data.results);
    const values = Array.from(resultSet).map((item) => item.value);

    expect(_result.data).toEqual({ results });
    expect(_result.data.results.length).toBe(6);
    expect(resultSet.size).toBe(6);
    expect(values).toEqual([0, 1, 1, 2, 3, 5]);
  });

  // TODO(FIXME): test fails, should return cache data first if it exists
  it.skip("returns initial cache data followed by network data when the fetch policy is `cache-and-network`", async () => {
    const query = gql`
      {
        hello
      }
    `;
    const cache = new InMemoryCache();
    const link = mockSingleLink({
      request: { query },
      result: { data: { hello: "from link" } },
      delay: 20,
    });

    const client = new ApolloClient({
      link,
      cache,
    });

    cache.writeQuery({ query, data: { hello: "from cache" } });

    const { result } = renderHook(
      () => useBackgroundQuery(query, { fetchPolicy: "cache-and-network" }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    const [queryRef] = result.current;

    const _result = await unwrapQueryRef(queryRef).promise;

    expect(_result).toEqual({
      data: { hello: "from link" },
      loading: false,
      networkStatus: 7,
    });
  });

  it("all data is present in the cache, no network request is made", async () => {
    const query = gql`
      {
        hello
      }
    `;
    const cache = new InMemoryCache();
    const link = mockSingleLink({
      request: { query },
      result: { data: { hello: "from link" } },
      delay: 20,
    });

    const client = new ApolloClient({
      link,
      cache,
    });

    cache.writeQuery({ query, data: { hello: "from cache" } });

    const { result } = renderHook(
      () => useBackgroundQuery(query, { fetchPolicy: "cache-first" }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    const [queryRef] = result.current;

    const _result = await unwrapQueryRef(queryRef).promise;

    expect(_result).toEqual({
      data: { hello: "from cache" },
      loading: false,
      networkStatus: 7,
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
    const link = mockSingleLink({
      request: { query },
      result: { data: { hello: "from link", foo: "bar" } },
      delay: 20,
    });

    const client = new ApolloClient({
      link,
      cache,
    });

    // we expect a "Missing field 'foo' while writing result..." error
    // when writing hello to the cache, so we'll silence the console.error
    const originalConsoleError = console.error;
    console.error = () => {
      /* noop */
    };
    cache.writeQuery({ query, data: { hello: "from cache" } });
    console.error = originalConsoleError;

    const { result } = renderHook(
      () => useBackgroundQuery(query, { fetchPolicy: "cache-first" }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    const [queryRef] = result.current;

    const _result = await unwrapQueryRef(queryRef).promise;

    expect(_result).toEqual({
      data: { foo: "bar", hello: "from link" },
      loading: false,
      networkStatus: 7,
    });
  });

  it("existing data in the cache is ignored", async () => {
    const query = gql`
      {
        hello
      }
    `;
    const cache = new InMemoryCache();
    const link = mockSingleLink({
      request: { query },
      result: { data: { hello: "from link" } },
      delay: 20,
    });

    const client = new ApolloClient({
      link,
      cache,
    });

    cache.writeQuery({ query, data: { hello: "from cache" } });

    const { result } = renderHook(
      () => useBackgroundQuery(query, { fetchPolicy: "network-only" }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    const [queryRef] = result.current;

    const _result = await unwrapQueryRef(queryRef).promise;

    expect(_result).toEqual({
      data: { hello: "from link" },
      loading: false,
      networkStatus: 7,
    });
    expect(client.cache.extract()).toEqual({
      ROOT_QUERY: { __typename: "Query", hello: "from link" },
    });
  });

  it("fetches data from the network but does not update the cache", async () => {
    const query = gql`
      {
        hello
      }
    `;
    const cache = new InMemoryCache();
    const link = mockSingleLink({
      request: { query },
      result: { data: { hello: "from link" } },
      delay: 20,
    });

    const client = new ApolloClient({
      link,
      cache,
    });

    cache.writeQuery({ query, data: { hello: "from cache" } });

    const { result } = renderHook(
      () => useBackgroundQuery(query, { fetchPolicy: "no-cache" }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    const [queryRef] = result.current;

    const _result = await unwrapQueryRef(queryRef).promise;

    expect(_result).toEqual({
      data: { hello: "from link" },
      loading: false,
      networkStatus: 7,
    });
    // ...but not updated in the cache
    expect(client.cache.extract()).toEqual({
      ROOT_QUERY: { __typename: "Query", hello: "from cache" },
    });
  });

  describe("integration tests with useReadQuery", () => {
    it("suspends and renders hello", async () => {
      const { renders } = renderIntegrationTest();
      // ensure the hook suspends immediately
      expect(renders.suspenseCount).toBe(1);
      expect(screen.getByText("loading")).toBeInTheDocument();

      // the parent component re-renders when promise fulfilled
      expect(await screen.findByText("hello")).toBeInTheDocument();
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
        const [id, setId] = React.useState("1");
        const [queryRef] = useBackgroundQuery(query, {
          variables: { id },
        });
        return <Todo queryRef={queryRef} onChange={setId} />;
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
        const [queryRef] = useBackgroundQuery(query, {
          fetchPolicy: "cache-and-network",
        });
        return <Todo queryRef={queryRef} />;
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
    const { renders, client, query } = renderIntegrationTest();

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
    const { renders, rerender } = renderVariablesIntegrationTest({
      variables: { id: "1" },
    });

    expect(renders.suspenseCount).toBe(1);
    expect(screen.getByText("loading")).toBeInTheDocument();

    expect(await screen.findByText("1 - Spider-Man")).toBeInTheDocument();

    rerender({ variables: { id: "2" } });

    expect(renders.suspenseCount).toBe(2);
    expect(screen.getByText("loading")).toBeInTheDocument();

    expect(await screen.findByText("2 - Black Widow")).toBeInTheDocument();
  });

  it("does not suspend when `skip` is true", async () => {
    interface Data {
      greeting: string;
    }

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
    ];

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache: new InMemoryCache(),
    });

    function SuspenseFallback() {
      return <div>Loading...</div>;
    }

    function Parent() {
      const [queryRef] = useBackgroundQuery(query, { skip: true });

      return (
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <Greeting queryRef={queryRef} />}
        </Suspense>
      );
    }

    function Greeting({ queryRef }: { queryRef: QueryReference<Data> }) {
      const { data } = useReadQuery(queryRef);

      return <div data-testid="greeting">{data.greeting}</div>;
    }

    function App() {
      return (
        <ApolloProvider client={client}>
          <Parent />
        </ApolloProvider>
      );
    }

    render(<App />);

    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    expect(screen.queryByTestId("greeting")).not.toBeInTheDocument();
  });

  it("does not suspend when using `skipToken` in options", async () => {
    interface Data {
      greeting: string;
    }

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
    ];

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache: new InMemoryCache(),
    });

    function SuspenseFallback() {
      return <div>Loading...</div>;
    }

    function Parent() {
      const [queryRef] = useBackgroundQuery(query, skipToken);

      return (
        <Suspense fallback={<SuspenseFallback />}>
          {queryRef && <Greeting queryRef={queryRef} />}
        </Suspense>
      );
    }

    function Greeting({ queryRef }: { queryRef: QueryReference<Data> }) {
      const { data } = useReadQuery(queryRef);

      return <div data-testid="greeting">{data.greeting}</div>;
    }

    function App() {
      return (
        <ApolloProvider client={client}>
          <Parent />
        </ApolloProvider>
      );
    }

    render(<App />);

    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    expect(screen.queryByTestId("greeting")).not.toBeInTheDocument();
  });

  it("suspends when `skip` becomes `false` after it was `true`", async () => {
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
    ];

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache: new InMemoryCache(),
    });

    function SuspenseFallback() {
      return <div>Loading...</div>;
    }

    function Parent() {
      const [skip, setSkip] = React.useState(true);
      const [queryRef] = useBackgroundQuery(query, { skip });

      return (
        <>
          <button onClick={() => setSkip(false)}>Run query</button>
          <Suspense fallback={<SuspenseFallback />}>
            {queryRef && <Greeting queryRef={queryRef} />}
          </Suspense>
        </>
      );
    }

    function Greeting({ queryRef }: { queryRef: QueryReference<Data> }) {
      const { data } = useReadQuery(queryRef);

      return <div data-testid="greeting">{data.greeting}</div>;
    }

    function App() {
      return (
        <ApolloProvider client={client}>
          <Parent />
        </ApolloProvider>
      );
    }

    render(<App />);

    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    expect(screen.queryByTestId("greeting")).not.toBeInTheDocument();

    await act(() => user.click(screen.getByText("Run query")));

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("greeting")).toHaveTextContent("Hello");
    });
  });

  it("suspends when switching away from `skipToken` in options", async () => {
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
    ];

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache: new InMemoryCache(),
    });

    function SuspenseFallback() {
      return <div>Loading...</div>;
    }

    function Parent() {
      const [skip, setSkip] = React.useState(true);
      const [queryRef] = useBackgroundQuery(
        query,
        skip ? skipToken : undefined
      );

      return (
        <>
          <button onClick={() => setSkip(false)}>Run query</button>
          <Suspense fallback={<SuspenseFallback />}>
            {queryRef && <Greeting queryRef={queryRef} />}
          </Suspense>
        </>
      );
    }

    function Greeting({ queryRef }: { queryRef: QueryReference<Data> }) {
      const { data } = useReadQuery(queryRef);

      return <div data-testid="greeting">{data.greeting}</div>;
    }

    function App() {
      return (
        <ApolloProvider client={client}>
          <Parent />
        </ApolloProvider>
      );
    }

    render(<App />);

    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    expect(screen.queryByTestId("greeting")).not.toBeInTheDocument();

    await act(() => user.click(screen.getByText("Run query")));

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("greeting")).toHaveTextContent("Hello");
    });
  });

  it("renders skip result, does not suspend, and maintains `data` when `skip` becomes `true` after it was `false`", async () => {
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
    ];

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache: new InMemoryCache(),
    });

    function SuspenseFallback() {
      return <div>Loading...</div>;
    }

    function Parent() {
      const [skip, setSkip] = React.useState(false);
      const [queryRef] = useBackgroundQuery(query, { skip });

      return (
        <>
          <button onClick={() => setSkip((skip) => !skip)}>Toggle skip</button>
          <Suspense fallback={<SuspenseFallback />}>
            {queryRef && <Greeting queryRef={queryRef} />}
          </Suspense>
        </>
      );
    }

    function Greeting({ queryRef }: { queryRef: QueryReference<Data> }) {
      const { data } = useReadQuery(queryRef);

      return <div data-testid="greeting">{data.greeting}</div>;
    }

    function App() {
      return (
        <ApolloProvider client={client}>
          <Parent />
        </ApolloProvider>
      );
    }

    render(<App />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("greeting")).toHaveTextContent("Hello");
    });

    await act(() => user.click(screen.getByText("Toggle skip")));

    expect(screen.getByTestId("greeting")).toHaveTextContent("Hello");
  });

  it("renders skip result, does not suspend, and maintains `data` when switching back to `skipToken`", async () => {
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
    ];

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache: new InMemoryCache(),
    });

    function SuspenseFallback() {
      return <div>Loading...</div>;
    }

    function Parent() {
      const [skip, setSkip] = React.useState(false);
      const [queryRef] = useBackgroundQuery(
        query,
        skip ? skipToken : undefined
      );

      return (
        <>
          <button onClick={() => setSkip((skip) => !skip)}>Toggle skip</button>
          <Suspense fallback={<SuspenseFallback />}>
            {queryRef && <Greeting queryRef={queryRef} />}
          </Suspense>
        </>
      );
    }

    function Greeting({ queryRef }: { queryRef: QueryReference<Data> }) {
      const { data } = useReadQuery(queryRef);

      return <div data-testid="greeting">{data.greeting}</div>;
    }

    function App() {
      return (
        <ApolloProvider client={client}>
          <Parent />
        </ApolloProvider>
      );
    }

    render(<App />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("greeting")).toHaveTextContent("Hello");
    });

    await act(() => user.click(screen.getByText("Toggle skip")));

    expect(screen.getByTestId("greeting")).toHaveTextContent("Hello");
  });

  it("does not make network requests when `skip` is `true`", async () => {
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
    ];

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

        observer.next(mock.result);
        observer.complete();
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
      const [skip, setSkip] = React.useState(true);
      const [queryRef] = useBackgroundQuery(query, { skip });

      return (
        <>
          <button onClick={() => setSkip((skip) => !skip)}>Toggle skip</button>
          <Suspense fallback={<SuspenseFallback />}>
            {queryRef && <Greeting queryRef={queryRef} />}
          </Suspense>
        </>
      );
    }

    function Greeting({ queryRef }: { queryRef: QueryReference<Data> }) {
      const { data } = useReadQuery(queryRef);

      return <div data-testid="greeting">{data.greeting}</div>;
    }

    function App() {
      return (
        <ApolloProvider client={client}>
          <Parent />
        </ApolloProvider>
      );
    }

    render(<App />);

    expect(fetchCount).toBe(0);

    // Toggle skip to `false`
    await act(() => user.click(screen.getByText("Toggle skip")));

    expect(fetchCount).toBe(1);

    await waitFor(() => {
      expect(screen.getByTestId("greeting")).toHaveTextContent("Hello");
    });

    // Toggle skip to `true`
    await act(() => user.click(screen.getByText("Toggle skip")));

    expect(fetchCount).toBe(1);
  });

  it("does not make network requests when `skipToken` is used", async () => {
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
    ];

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

        observer.next(mock.result);
        observer.complete();
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
      const [skip, setSkip] = React.useState(true);
      const [queryRef] = useBackgroundQuery(
        query,
        skip ? skipToken : undefined
      );

      return (
        <>
          <button onClick={() => setSkip((skip) => !skip)}>Toggle skip</button>
          <Suspense fallback={<SuspenseFallback />}>
            {queryRef && <Greeting queryRef={queryRef} />}
          </Suspense>
        </>
      );
    }

    function Greeting({ queryRef }: { queryRef: QueryReference<Data> }) {
      const { data } = useReadQuery(queryRef);

      return <div data-testid="greeting">{data.greeting}</div>;
    }

    function App() {
      return (
        <ApolloProvider client={client}>
          <Parent />
        </ApolloProvider>
      );
    }

    render(<App />);

    expect(fetchCount).toBe(0);

    // Toggle skip to `false`
    await act(() => user.click(screen.getByText("Toggle skip")));

    expect(fetchCount).toBe(1);

    await waitFor(() => {
      expect(screen.getByTestId("greeting")).toHaveTextContent("Hello");
    });

    // Toggle skip to `true`
    await act(() => user.click(screen.getByText("Toggle skip")));

    expect(fetchCount).toBe(1);
  });

  it("`skip` result is referentially stable", async () => {
    interface Data {
      greeting: string;
    }

    interface CurrentResult {
      current: Data | undefined;
    }

    const user = userEvent.setup();

    const result: CurrentResult = {
      current: undefined,
    };

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
    ];

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache: new InMemoryCache(),
    });

    function SuspenseFallback() {
      return <div>Loading...</div>;
    }

    function Parent() {
      const [skip, setSkip] = React.useState(true);
      const [queryRef] = useBackgroundQuery(query, { skip });

      return (
        <>
          <button onClick={() => setSkip((skip) => !skip)}>Toggle skip</button>
          <Suspense fallback={<SuspenseFallback />}>
            {queryRef && <Greeting queryRef={queryRef} />}
          </Suspense>
        </>
      );
    }

    function Greeting({ queryRef }: { queryRef: QueryReference<Data> }) {
      const { data } = useReadQuery(queryRef);

      result.current = data;

      return <div data-testid="greeting">{data.greeting}</div>;
    }

    function App() {
      return (
        <ApolloProvider client={client}>
          <Parent />
        </ApolloProvider>
      );
    }

    const { rerender } = render(<App />);

    const skipResult = result.current;

    rerender(<App />);

    expect(result.current).toBe(skipResult);

    // Toggle skip to `false`
    await act(() => user.click(screen.getByText("Toggle skip")));

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("greeting")).toHaveTextContent("Hello");
    });

    const fetchedResult = result.current;

    rerender(<App />);

    expect(result.current).toBe(fetchedResult);
  });

  it("`skip` result is referentially stable when using `skipToken`", async () => {
    interface Data {
      greeting: string;
    }

    interface CurrentResult {
      current: Data | undefined;
    }

    const user = userEvent.setup();

    const result: CurrentResult = {
      current: undefined,
    };

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
    ];

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache: new InMemoryCache(),
    });

    function SuspenseFallback() {
      return <div>Loading...</div>;
    }

    function Parent() {
      const [skip, setSkip] = React.useState(true);
      const [queryRef] = useBackgroundQuery(
        query,
        skip ? skipToken : undefined
      );

      return (
        <>
          <button onClick={() => setSkip((skip) => !skip)}>Toggle skip</button>
          <Suspense fallback={<SuspenseFallback />}>
            {queryRef && <Greeting queryRef={queryRef} />}
          </Suspense>
        </>
      );
    }

    function Greeting({ queryRef }: { queryRef: QueryReference<Data> }) {
      const { data } = useReadQuery(queryRef);

      result.current = data;

      return <div data-testid="greeting">{data.greeting}</div>;
    }

    function App() {
      return (
        <ApolloProvider client={client}>
          <Parent />
        </ApolloProvider>
      );
    }

    const { rerender } = render(<App />);

    const skipResult = result.current;

    rerender(<App />);

    expect(result.current).toBe(skipResult);

    // Toggle skip to `false`
    await act(() => user.click(screen.getByText("Toggle skip")));

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("greeting")).toHaveTextContent("Hello");
    });

    const fetchedResult = result.current;

    rerender(<App />);

    expect(result.current).toBe(fetchedResult);
  });

  it("`skip` option works with `startTransition`", async () => {
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
        delay: 10,
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
      const [skip, setSkip] = React.useState(true);
      const [isPending, startTransition] = React.useTransition();
      const [queryRef] = useBackgroundQuery(query, { skip });

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
            {queryRef && <Greeting queryRef={queryRef} />}
          </Suspense>
        </>
      );
    }

    function Greeting({ queryRef }: { queryRef: QueryReference<Data> }) {
      const { data } = useReadQuery(queryRef);

      return <div data-testid="greeting">{data.greeting}</div>;
    }

    function App() {
      return (
        <ApolloProvider client={client}>
          <Parent />
        </ApolloProvider>
      );
    }

    render(<App />);

    const button = screen.getByText("Toggle skip");

    // Toggle skip to `false`
    await act(() => user.click(button));

    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    expect(button).toBeDisabled();
    expect(screen.queryByTestId("greeting")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("greeting")).toHaveTextContent("Hello");
    });
  });

  it("`skipToken` works with `startTransition`", async () => {
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
        delay: 10,
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
      const [skip, setSkip] = React.useState(true);
      const [isPending, startTransition] = React.useTransition();
      const [queryRef] = useBackgroundQuery(
        query,
        skip ? skipToken : undefined
      );

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
            {queryRef && <Greeting queryRef={queryRef} />}
          </Suspense>
        </>
      );
    }

    function Greeting({ queryRef }: { queryRef: QueryReference<Data> }) {
      const { data } = useReadQuery(queryRef);

      return <div data-testid="greeting">{data.greeting}</div>;
    }

    function App() {
      return (
        <ApolloProvider client={client}>
          <Parent />
        </ApolloProvider>
      );
    }

    render(<App />);

    const button = screen.getByText("Toggle skip");

    // Toggle skip to `false`
    await act(() => user.click(button));

    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    expect(button).toBeDisabled();
    expect(screen.queryByTestId("greeting")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("greeting")).toHaveTextContent("Hello");
    });
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
          <ErrorBoundary
            fallback={<div data-testid="error">Error boundary</div>}
          >
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
      const [queryRef, { refetch }] = useBackgroundQuery(query, {
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
      const [queryRef] = useBackgroundQuery(query, {
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

    await act(() =>
      user.click(screen.getByText("Change refetch write policy"))
    );

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

      const [queryRef] = useBackgroundQuery(fullQuery, {
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
        React.useState<SuspenseQueryHookFetchPolicy>("cache-first");

      const [queryRef, { refetch }] = useBackgroundQuery(query, {
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

      const [queryRef, { refetch }] = useBackgroundQuery(query, {
        errorPolicy: id === "1" ? "all" : "none",
        variables: { id },
      });

      return (
        <>
          <button onClick={() => setId("1")}>Get first character</button>
          <button onClick={() => setId("2")}>Get second character</button>
          <button onClick={() => refetch()}>Refetch</button>
          <ErrorBoundary
            fallback={<div data-testid="error">Error boundary</div>}
          >
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

      expect(
        await screen.findByText("2 - Captain America")
      ).toBeInTheDocument();

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

      expect(
        await screen.findByText("Something went wrong")
      ).toBeInTheDocument();
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

      expect(
        await screen.findByText("Something went wrong")
      ).toBeInTheDocument();

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
        const [queryRef, { refetch }] = useBackgroundQuery(query, {
          variables: { id },
        });
        const onRefetchHandler = () => {
          refetch();
        };
        return (
          <Todo
            onRefetch={onRefetchHandler}
            queryRef={queryRef}
            onChange={setId}
          />
        );
      }

      function Todo({
        queryRef,
        onRefetch,
      }: {
        onRefetch: () => void;
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
                  onRefetch();
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
        expect(screen.getByTestId("primes")).toHaveTextContent(
          "2, 3, 5, 7, 11"
        );
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
        expect(screen.getByTestId("primes")).toHaveTextContent(
          "2, 3, 5, 7, 11"
        );
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
      expectTypeOf(inferred).not.toEqualTypeOf<
        DeepPartial<VariablesCaseData>
      >();

      const [explicitQueryRef] = useBackgroundQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, {
        returnPartialData: false,
      });

      const { data: explicit } = useReadQuery(explicitQueryRef);

      expectTypeOf(explicit).toEqualTypeOf<VariablesCaseData>();
      expectTypeOf(explicit).not.toEqualTypeOf<
        DeepPartial<VariablesCaseData>
      >();
    });

    it("returns TData when passing an option that does not affect TData", () => {
      const { query } = useVariablesIntegrationTestCase();

      const [inferredQueryRef] = useBackgroundQuery(query, {
        fetchPolicy: "no-cache",
      });
      const { data: inferred } = useReadQuery(inferredQueryRef);

      expectTypeOf(inferred).toEqualTypeOf<VariablesCaseData>();
      expectTypeOf(inferred).not.toEqualTypeOf<
        DeepPartial<VariablesCaseData>
      >();

      const [explicitQueryRef] = useBackgroundQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, {
        fetchPolicy: "no-cache",
      });

      const { data: explicit } = useReadQuery(explicitQueryRef);

      expectTypeOf(explicit).toEqualTypeOf<VariablesCaseData>();
      expectTypeOf(explicit).not.toEqualTypeOf<
        DeepPartial<VariablesCaseData>
      >();
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
        QueryReference<VariablesCaseData> | undefined
      >();
      expectTypeOf(inferredQueryRef).not.toEqualTypeOf<
        QueryReference<VariablesCaseData>
      >();

      const [explicitQueryRef] = useBackgroundQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, { skip: true });

      expectTypeOf(explicitQueryRef).toEqualTypeOf<
        QueryReference<VariablesCaseData> | undefined
      >();
      expectTypeOf(explicitQueryRef).not.toEqualTypeOf<
        QueryReference<VariablesCaseData>
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
        QueryReference<VariablesCaseData> | undefined
      >();
      expectTypeOf(dynamicQueryRef).not.toEqualTypeOf<
        QueryReference<VariablesCaseData>
      >();
    });

    it("returns `undefined` when using `skipToken` unconditionally", () => {
      const { query } = useVariablesIntegrationTestCase();

      const [inferredQueryRef] = useBackgroundQuery(query, skipToken);

      expectTypeOf(inferredQueryRef).toEqualTypeOf<undefined>();
      expectTypeOf(inferredQueryRef).not.toEqualTypeOf<
        QueryReference<VariablesCaseData> | undefined
      >();

      const [explicitQueryRef] = useBackgroundQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, skipToken);

      expectTypeOf(explicitQueryRef).toEqualTypeOf<undefined>();
      expectTypeOf(explicitQueryRef).not.toEqualTypeOf<
        QueryReference<VariablesCaseData> | undefined
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
        QueryReference<VariablesCaseData> | undefined
      >();
      expectTypeOf(inferredQueryRef).not.toEqualTypeOf<
        QueryReference<VariablesCaseData>
      >();

      const [explicitQueryRef] = useBackgroundQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, options.skip ? skipToken : undefined);

      expectTypeOf(explicitQueryRef).toEqualTypeOf<
        QueryReference<VariablesCaseData> | undefined
      >();
      expectTypeOf(explicitQueryRef).not.toEqualTypeOf<
        QueryReference<VariablesCaseData>
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
        QueryReference<DeepPartial<VariablesCaseData>> | undefined
      >();
      expectTypeOf(inferredQueryRef).not.toEqualTypeOf<
        QueryReference<VariablesCaseData>
      >();

      const [explicitQueryRef] = useBackgroundQuery<VariablesCaseData>(
        query,
        options.skip ? skipToken : { returnPartialData: true }
      );

      expectTypeOf(explicitQueryRef).toEqualTypeOf<
        QueryReference<DeepPartial<VariablesCaseData>> | undefined
      >();
      expectTypeOf(explicitQueryRef).not.toEqualTypeOf<
        QueryReference<VariablesCaseData>
      >();
    });
  });
});
