import React, { Fragment, StrictMode, Suspense, useTransition } from "react";
import {
  act,
  screen,
  render,
  renderHook,
  waitFor,
  RenderHookOptions,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "react-error-boundary";
import { GraphQLError } from "graphql";
import { InvariantError } from "ts-invariant";
import { equal } from "@wry/equality";
import { expectTypeOf } from "expect-type";

import {
  gql,
  ApolloCache,
  ApolloClient,
  ApolloError,
  ApolloLink,
  DocumentNode,
  InMemoryCache,
  Observable,
  OperationVariables,
  SubscribeToMoreOptions,
  TypedDocumentNode,
  split,
  NetworkStatus,
  ApolloQueryResult,
  ErrorPolicy,
} from "../../../core";
import {
  DeepPartial,
  compact,
  concatPagination,
  getMainDefinition,
  offsetLimitPagination,
} from "../../../utilities";
import {
  MockedProvider,
  MockedResponse,
  MockSubscriptionLink,
  MockLink,
} from "../../../testing";
import { ApolloProvider } from "../../context";
import { SuspenseQueryHookFetchPolicy, skipToken } from "../../../react";
import { UseSuspenseQueryResult, useSuspenseQuery } from "../useSuspenseQuery";
import {
  RefetchWritePolicy,
  WatchQueryFetchPolicy,
} from "../../../core/watchQueryOptions";
import {
  PaginatedCaseData,
  PaginatedCaseVariables,
  setupPaginatedCase,
  spyOnConsole,
} from "../../../testing/internal";

import {
  createRenderStream,
  renderToRenderStream,
  useTrackRenders,
} from "@testing-library/react-render-stream";

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

function useSimpleQueryCase() {
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

  return { query, mocks };
}

function usePaginatedCase() {
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

  const data = "ABCDEFG".split("").map((letter, index) => ({
    __typename: "Letter",
    letter,
    position: index + 1,
  }));

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

  return { query, link, data };
}

interface ErrorCaseData {
  currentUser: {
    id: string;
    name: string | null;
  };
}

function useErrorCase<TData extends ErrorCaseData>(
  {
    data,
    networkError,
    graphQLErrors,
  }: {
    data?: TData;
    networkError?: Error;
    graphQLErrors?: GraphQLError[];
  } = Object.create(null)
) {
  const query: TypedDocumentNode<TData, never> = gql`
    query MyQuery {
      currentUser {
        id
        name
      }
    }
  `;

  const mock: MockedResponse<TData> = compact({
    request: { query },
    result: (data || graphQLErrors) && compact({ data, errors: graphQLErrors }),
    error: networkError,
  });

  return { query, mocks: [mock] };
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
  const CHARACTERS = ["Spider-Man", "Black Widow", "Iron Man", "Hulk"];

  const query: TypedDocumentNode<VariablesCaseData, VariablesCaseVariables> =
    gql`
      query CharacterQuery($id: ID!) {
        character(id: $id) {
          id
          name
        }
      }
    `;

  const mocks = CHARACTERS.map((name, index) => ({
    request: { query, variables: { id: String(index + 1) } },
    result: {
      data: {
        character: { __typename: "Character", id: String(index + 1), name },
      },
    },
  }));

  return { query, mocks };
}

function wait(delay: number) {
  return new Promise((resolve) => setTimeout(resolve, delay));
}

describe("useSuspenseQuery", () => {
  it("validates the GraphQL query as a query", () => {
    using _consoleSpy = spyOnConsole("error");

    const query = gql`
      mutation ShouldThrow {
        createException
      }
    `;

    expect(() => {
      renderHook(() => useSuspenseQuery(query), {
        wrapper: ({ children }) => <MockedProvider>{children}</MockedProvider>,
      });
    }).toThrowError(
      new InvariantError(
        "Running a Query requires a graphql Query, but a Mutation was used instead."
      )
    );
  });

  it("ensures a valid fetch policy is used", () => {
    const INVALID_FETCH_POLICIES = ["cache-only", "standby"];
    using _consoleSpy = spyOnConsole("error");
    const { query } = useSimpleQueryCase();

    INVALID_FETCH_POLICIES.forEach((fetchPolicy: any) => {
      expect(() => {
        renderHook(() => useSuspenseQuery(query, { fetchPolicy }), {
          wrapper: ({ children }) => (
            <MockedProvider>{children}</MockedProvider>
          ),
        });
      }).toThrowError(
        new InvariantError(
          `The fetch policy \`${fetchPolicy}\` is not supported with suspense.`
        )
      );
    });
  });

  it("ensures a valid fetch policy is used when defined via global options", () => {
    const INVALID_FETCH_POLICIES: WatchQueryFetchPolicy[] = [
      "cache-only",
      "standby",
    ];
    using _consoleSpy = spyOnConsole("error");
    const { query } = useSimpleQueryCase();

    INVALID_FETCH_POLICIES.forEach((fetchPolicy) => {
      expect(() => {
        const client = new ApolloClient({
          cache: new InMemoryCache(),
          link: new MockLink([]),
          defaultOptions: {
            watchQuery: {
              fetchPolicy,
            },
          },
        });

        renderHook(() => useSuspenseQuery(query), {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        });
      }).toThrowError(
        new InvariantError(
          `The fetch policy \`${fetchPolicy}\` is not supported with suspense.`
        )
      );
    });
  });

  it("suspends a query and returns results", async () => {
    const { query, mocks } = useSimpleQueryCase();

    const Component = () => {
      const result = useSuspenseQuery(query);
      replaceSnapshot(result);
      return <div>{result.data.greeting}</div>;
    };

    const App = () => {
      return (
        <Suspense fallback={<div>loading</div>}>
          <ErrorBoundary fallback={<div>Error</div>}>
            <Component />
          </ErrorBoundary>
        </Suspense>
      );
    };

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { takeRender, replaceSnapshot } = renderToRenderStream<
      UseSuspenseQueryResult<SimpleQueryData, OperationVariables>
    >(<App />, {
      snapshotDOM: true,
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    });

    {
      // ensure the hook suspends immediately
      const { withinDOM, snapshot } = await takeRender();
      expect(withinDOM().getByText("loading")).toBeInTheDocument();
      expect(snapshot).toBeUndefined();
    }

    {
      const { withinDOM, snapshot } = await takeRender();
      expect(withinDOM().queryByText("loading")).not.toBeInTheDocument();
      expect(withinDOM().getByText("Hello")).toBeInTheDocument();
      expect(snapshot).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    }
  });

  it("suspends a query with variables and returns results", async () => {
    const { query, mocks } = useVariablesQueryCase();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { id: "1" } }),
      { mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    expect(renders.suspenseCount).toBe(1);
    expect(renders.count).toBe(2);
    expect(renders.frames).toMatchObject([
      {
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("returns the same results for the same variables", async () => {
    const { query, mocks } = useVariablesQueryCase();

    const { result, rerender, renders } = renderSuspenseHook(
      ({ id }) => useSuspenseQuery(query, { variables: { id } }),
      { mocks, initialProps: { id: "1" } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    const previousResult = result.current;

    rerender({ id: "1" });

    expect(result.current).toBe(previousResult);
    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
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
    ]);
  });

  it("ensures result is referentially stable", async () => {
    const { query, mocks } = useVariablesQueryCase();

    const { result, rerender } = renderSuspenseHook(
      ({ id }) => useSuspenseQuery(query, { variables: { id } }),
      { mocks, initialProps: { id: "1" } }
    );

    expect(screen.getByText("loading")).toBeInTheDocument();

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    const previousResult = result.current;

    rerender({ id: "1" });

    expect(result.current).toBe(previousResult);
  });

  it("ensures refetch, fetchMore, and subscribeToMore are referentially stable even after result data has changed", async () => {
    const { query, mocks } = useSimpleQueryCase();

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache: new InMemoryCache(),
    });

    const { result } = renderSuspenseHook(() => useSuspenseQuery(query), {
      client,
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    const previousResult = result.current;

    client.writeQuery({
      query,
      data: { greeting: "Updated cache greeting" },
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({
        greeting: "Updated cache greeting",
      });
    });

    expect(result.current.fetchMore).toBe(previousResult.fetchMore);
    expect(result.current.refetch).toBe(previousResult.refetch);
    expect(result.current.subscribeToMore).toBe(previousResult.subscribeToMore);
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

    const { result } = renderSuspenseHook(
      () => useSuspenseQuery(query, { canonizeResults: true }),
      { cache }
    );

    const { data } = result.current;
    const resultSet = new Set(data.results);
    const values = Array.from(resultSet).map((item) => item.value);

    expect(data).toEqual({ results });
    expect(data.results.length).toBe(6);
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

    const { result } = renderSuspenseHook(
      () => useSuspenseQuery(query, { canonizeResults: false }),
      { cache }
    );

    const { data } = result.current;
    const resultSet = new Set(data.results);
    const values = Array.from(resultSet).map((item) => item.value);

    expect(data).toEqual({ results });
    expect(data.results.length).toBe(6);
    expect(resultSet.size).toBe(6);
    expect(values).toEqual([0, 1, 1, 2, 3, 5]);
  });

  it("tears down the query on unmount", async () => {
    const { query, mocks } = useSimpleQueryCase();

    const client = new ApolloClient({
      link: new ApolloLink(() => Observable.of(mocks[0].result)),
      cache: new InMemoryCache(),
    });

    const { result, unmount } = renderSuspenseHook(
      () => useSuspenseQuery(query),
      { client }
    );

    await waitFor(() =>
      expect(result.current.data).toEqual(mocks[0].result.data)
    );

    expect(client.getObservableQueries().size).toBe(1);
    expect(client).toHaveSuspenseCacheEntryUsing(query);

    unmount();

    // We need to wait a tick since the cleanup is run in a setTimeout to
    // prevent strict mode bugs.
    await wait(0);

    expect(client.getObservableQueries().size).toBe(0);
    expect(client).not.toHaveSuspenseCacheEntryUsing(query);
  });

  it("tears down all queries when rendering with multiple variable sets", async () => {
    const { query, mocks } = useVariablesQueryCase();

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache: new InMemoryCache(),
    });

    const { rerender, result, unmount } = renderSuspenseHook(
      ({ id }) => useSuspenseQuery(query, { variables: { id } }),
      { client, initialProps: { id: "1" } }
    );

    await waitFor(() =>
      expect(result.current.data).toEqual(mocks[0].result.data)
    );

    rerender({ id: "2" });

    await waitFor(() => {
      expect(result.current.data).toEqual(mocks[1].result.data);
    });

    unmount();

    // We need to wait a tick since the cleanup is run in a setTimeout to
    // prevent strict mode bugs.
    await wait(0);

    expect(client.getObservableQueries().size).toBe(0);

    expect(client).not.toHaveSuspenseCacheEntryUsing(query, {
      variables: { id: "1" },
    });
    expect(client).not.toHaveSuspenseCacheEntryUsing(query, {
      variables: { id: "2" },
    });
  });

  it("tears down all queries when multiple clients are used", async () => {
    const { query } = useVariablesQueryCase();

    const client1 = new ApolloClient({
      link: new MockLink([
        {
          request: { query, variables: { id: "1" } },
          result: { data: { character: { id: "1", name: "Client 1" } } },
        },
      ]),
      cache: new InMemoryCache(),
    });

    const client2 = new ApolloClient({
      link: new MockLink([
        {
          request: { query, variables: { id: "1" } },
          result: { data: { character: { id: "1", name: "Client 2" } } },
        },
      ]),
      cache: new InMemoryCache(),
    });

    const { rerender, result, unmount } = renderSuspenseHook(
      ({ client }) =>
        useSuspenseQuery(query, { client, variables: { id: "1" } }),
      { initialProps: { client: client1 } }
    );

    await waitFor(() =>
      expect(result.current.data).toEqual({
        character: { id: "1", name: "Client 1" },
      })
    );

    rerender({ client: client2 });

    await waitFor(() => {
      expect(result.current.data).toEqual({
        character: { id: "1", name: "Client 2" },
      });
    });

    const variables = { id: "1" };

    unmount();

    // We need to wait a tick since the cleanup is run in a setTimeout to
    // prevent strict mode bugs.
    await wait(0);

    expect(client1.getObservableQueries().size).toBe(0);
    expect(client2.getObservableQueries().size).toBe(0);
    expect(client1).not.toHaveSuspenseCacheEntryUsing(query, {
      variables,
    });
    expect(client2).not.toHaveSuspenseCacheEntryUsing(query, {
      variables,
    });
  });

  it("tears down the query if the component never renders again after suspending", async () => {
    jest.useFakeTimers();
    const { query } = useSimpleQueryCase();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    function App() {
      const [showGreeting, setShowGreeting] = React.useState(true);

      return (
        <ApolloProvider client={client}>
          <button onClick={() => setShowGreeting(false)}>Hide greeting</button>
          {showGreeting && (
            <Suspense fallback="Loading greeting...">
              <Greeting />
            </Suspense>
          )}
        </ApolloProvider>
      );
    }

    function Greeting() {
      const { data } = useSuspenseQuery(query);

      return <span>{data.greeting}</span>;
    }

    render(<App />);

    // Ensure <Greeting /> suspends immediately
    expect(screen.getByText("Loading greeting...")).toBeInTheDocument();

    // Hide the greeting before it finishes loading data
    await act(() => user.click(screen.getByText("Hide greeting")));

    expect(screen.queryByText("Loading greeting...")).not.toBeInTheDocument();

    await act(() => {
      link.simulateResult({ result: { data: { greeting: "Hello" } } }, true);
      // Ensure simulateResult will deliver the result since its wrapped with
      // setTimeout
      jest.advanceTimersByTime(10);
    });

    expect(client.getObservableQueries().size).toBe(1);
    expect(client).toHaveSuspenseCacheEntryUsing(query);

    jest.advanceTimersByTime(30_000);

    expect(client.getObservableQueries().size).toBe(0);
    expect(client).not.toHaveSuspenseCacheEntryUsing(query);

    jest.useRealTimers();
  });

  it("has configurable auto dispose timer if the component never renders again after suspending", async () => {
    jest.useFakeTimers();
    const { query } = useSimpleQueryCase();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
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

    function App() {
      const [showGreeting, setShowGreeting] = React.useState(true);

      return (
        <ApolloProvider client={client}>
          <button onClick={() => setShowGreeting(false)}>Hide greeting</button>
          {showGreeting && (
            <Suspense fallback="Loading greeting...">
              <Greeting />
            </Suspense>
          )}
        </ApolloProvider>
      );
    }

    function Greeting() {
      const { data } = useSuspenseQuery(query);

      return <span>{data.greeting}</span>;
    }

    render(<App />);

    // Ensure <Greeting /> suspends immediately
    expect(screen.getByText("Loading greeting...")).toBeInTheDocument();

    // Hide the greeting before it finishes loading data
    await act(() => user.click(screen.getByText("Hide greeting")));

    expect(screen.queryByText("Loading greeting...")).not.toBeInTheDocument();

    await act(() => {
      link.simulateResult({ result: { data: { greeting: "Hello" } } }, true);
      // Ensure simulateResult will deliver the result since its wrapped with
      // setTimeout
      jest.advanceTimersByTime(10);
    });

    expect(client.getObservableQueries().size).toBe(1);
    expect(client).toHaveSuspenseCacheEntryUsing(query);

    jest.advanceTimersByTime(5_000);

    expect(client.getObservableQueries().size).toBe(0);
    expect(client).not.toHaveSuspenseCacheEntryUsing(query);

    jest.useRealTimers();
  });

  it("cancels auto dispose if the component renders before timer finishes", async () => {
    jest.useFakeTimers();
    const { query } = useSimpleQueryCase();
    const link = new ApolloLink(() => {
      return new Observable((observer) => {
        setTimeout(() => {
          observer.next({ data: { greeting: "Hello" } });
          observer.complete();
        }, 10);
      });
    });
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    function App() {
      return (
        <ApolloProvider client={client}>
          <Suspense fallback="Loading greeting...">
            <Greeting />
          </Suspense>
        </ApolloProvider>
      );
    }

    function Greeting() {
      const { data } = useSuspenseQuery(query);

      return <span>{data.greeting}</span>;
    }

    render(<App />);

    // Ensure <Greeting /> suspends immediately
    expect(screen.getByText("Loading greeting...")).toBeInTheDocument();

    jest.advanceTimersByTime(10);

    await waitFor(() => {
      expect(screen.getByText("Hello")).toBeInTheDocument();
    });

    jest.advanceTimersByTime(30_000);

    expect(client.getObservableQueries().size).toBe(1);
    expect(client).toHaveSuspenseCacheEntryUsing(query);

    jest.useRealTimers();
  });

  // https://github.com/apollographql/apollo-client/issues/11270
  it("does not leave component suspended if query completes if request takes longer than auto dispose timeout", async () => {
    jest.useFakeTimers();
    const { query } = useSimpleQueryCase();
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
      defaultOptions: {
        react: {
          suspense: {
            autoDisposeTimeoutMs: 10,
          },
        },
      },
    });

    function App() {
      return (
        <ApolloProvider client={client}>
          <Suspense fallback="Loading greeting...">
            <Greeting />
          </Suspense>
        </ApolloProvider>
      );
    }

    function Greeting() {
      const { data } = useSuspenseQuery(query);

      return <span>{data.greeting}</span>;
    }

    render(<App />);

    // Ensure <Greeting /> suspends immediately
    expect(screen.getByText("Loading greeting...")).toBeInTheDocument();

    jest.advanceTimersByTime(20);

    link.simulateResult({ result: { data: { greeting: "Hello" } } }, true);

    await waitFor(() => {
      expect(screen.queryByText("Loading greeting...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Hello")).toBeInTheDocument();

    jest.useRealTimers();
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

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { client: localClient }),
      { client: globalClient }
    );

    await waitFor(() =>
      expect(result.current.data).toEqual({ greeting: "local hello" })
    );

    expect(renders.frames).toMatchObject([
      {
        data: { greeting: "local hello" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("allows the client to be overridden in strict mode", async () => {
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

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { client: localClient }),
      { strictMode: true, client: globalClient }
    );

    await waitFor(() =>
      expect(result.current.data).toEqual({ greeting: "local hello" })
    );

    // React double invokes the render function in strict mode so we expect
    // to render 2 frames after the initial suspense.
    expect(renders.frames).toMatchObject([
      {
        data: { greeting: "local hello" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: { greeting: "local hello" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("returns the client used in the result", async () => {
    const { query } = useSimpleQueryCase();

    const client = new ApolloClient({
      link: new ApolloLink(() =>
        Observable.of({ data: { greeting: "hello" } })
      ),
      cache: new InMemoryCache(),
    });

    const { result } = renderSuspenseHook(() => useSuspenseQuery(query), {
      client,
    });

    // wait for query to finish suspending to avoid warnings
    await waitFor(() => {
      expect(result.current.data).toEqual({ greeting: "hello" });
    });

    expect(result.current.client).toBe(client);
  });

  it("suspends when changing variables", async () => {
    const { query, mocks } = useVariablesQueryCase();

    const { result, rerender, renders } = renderSuspenseHook(
      ({ id }) => useSuspenseQuery(query, { variables: { id } }),
      { mocks, initialProps: { id: "1" } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ id: "2" });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(4);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toMatchObject([
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

  it("suspends and fetches data from new client when changing clients", async () => {
    const { query } = useSimpleQueryCase();

    const client1 = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink([
        {
          request: { query },
          result: { data: { greeting: "Hello client 1" } },
        },
      ]),
    });

    const client2 = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink([
        {
          request: { query },
          result: { data: { greeting: "Hello client 2" } },
        },
      ]),
    });

    const { result, rerender, renders } = renderSuspenseHook(
      ({ client }) => useSuspenseQuery(query, { client }),
      { initialProps: { client: client1 } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { greeting: "Hello client 1" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ client: client2 });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { greeting: "Hello client 2" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(4);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toMatchObject([
      {
        data: { greeting: "Hello client 1" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: { greeting: "Hello client 2" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("allows custom query key so two components that share same query and variables do not interfere with each other", async () => {
    interface Data {
      todo: {
        id: number;
        name: string;
        completed: boolean;
      };
    }

    interface Variables {
      id: number;
    }

    const query: TypedDocumentNode<Data, Variables> = gql`
      query GetTodo($id: ID!) {
        todo(id: $id) {
          id
          name
          completed
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: 1 } },
        result: {
          data: { todo: { id: 1, name: "Take out trash", completed: false } },
        },
        delay: 20,
      },
      // refetch
      {
        request: { query, variables: { id: 1 } },
        result: {
          data: { todo: { id: 1, name: "Take out trash", completed: true } },
        },
        delay: 20,
      },
    ];

    const user = userEvent.setup();

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache: new InMemoryCache(),
    });

    function Spinner({ name }: { name: string }) {
      return <span>Loading {name}</span>;
    }

    function App() {
      return (
        <ApolloProvider client={client}>
          <Suspense fallback={<Spinner name="first" />}>
            <Todo name="first" />
          </Suspense>
          <Suspense fallback={<Spinner name="second" />}>
            <Todo name="second" />
          </Suspense>
        </ApolloProvider>
      );
    }

    function Todo({ name }: { name: string }) {
      const { data, refetch } = useSuspenseQuery(query, {
        // intentionally use no-cache to allow us to verify each suspense
        // component is independent of each other
        fetchPolicy: "no-cache",
        variables: { id: 1 },
        queryKey: [name],
      });

      return (
        <div>
          <button onClick={() => refetch()}>Refetch {name}</button>
          <span data-testid={[name, "data"].join(".")}>
            {data.todo.name} {data.todo.completed && "(completed)"}
          </span>
        </div>
      );
    }

    render(<App />);

    expect(screen.getByText("Loading first")).toBeInTheDocument();
    expect(screen.getByText("Loading second")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("first.data")).toHaveTextContent(
        "Take out trash"
      );
    });

    expect(screen.getByTestId("second.data")).toHaveTextContent(
      "Take out trash"
    );

    await act(() => user.click(screen.getByText("Refetch first")));

    // Ensure that refetching the first todo does not update the second todo
    // as well
    expect(screen.getByText("Loading first")).toBeInTheDocument();
    expect(screen.queryByText("Loading second")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("first.data")).toHaveTextContent(
        "Take out trash (completed)"
      );
    });

    // Ensure that refetching the first todo did not affect the second
    expect(screen.getByTestId("second.data")).toHaveTextContent(
      "Take out trash"
    );
  });

  it("suspends and refetches data when changing query keys", async () => {
    const { query } = useSimpleQueryCase();

    const mocks = [
      {
        request: { query },
        result: { data: { greeting: "Hello first fetch" } },
        delay: 20,
      },
      {
        request: { query },
        result: { data: { greeting: "Hello second fetch" } },
        delay: 20,
      },
    ];

    const { result, rerender, renders } = renderSuspenseHook(
      ({ queryKey }) =>
        // intentionally use a fetch policy that will execute a network request
        useSuspenseQuery(query, { queryKey, fetchPolicy: "network-only" }),
      { mocks, initialProps: { queryKey: ["first"] } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { greeting: "Hello first fetch" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ queryKey: ["second"] });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { greeting: "Hello second fetch" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(4);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toMatchObject([
      {
        data: { greeting: "Hello first fetch" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: { greeting: "Hello second fetch" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("suspends and refetches data when part of the query key changes", async () => {
    const { query } = useSimpleQueryCase();

    const mocks = [
      {
        request: { query },
        result: { data: { greeting: "Hello first fetch" } },
        delay: 20,
      },
      {
        request: { query },
        result: { data: { greeting: "Hello second fetch" } },
        delay: 20,
      },
    ];

    const { result, rerender, renders } = renderSuspenseHook(
      ({ queryKey }) =>
        // intentionally use a fetch policy that will execute a network request
        useSuspenseQuery(query, { queryKey, fetchPolicy: "network-only" }),
      { mocks, initialProps: { queryKey: ["greeting", 1] } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { greeting: "Hello first fetch" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ queryKey: ["greeting", 2] });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { greeting: "Hello second fetch" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(4);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toMatchObject([
      {
        data: { greeting: "Hello first fetch" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: { greeting: "Hello second fetch" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("suspends and refetches when using plain string query keys", async () => {
    const { query } = useSimpleQueryCase();

    const mocks = [
      {
        request: { query },
        result: { data: { greeting: "Hello first fetch" } },
        delay: 20,
      },
      {
        request: { query },
        result: { data: { greeting: "Hello second fetch" } },
        delay: 20,
      },
    ];

    const { result, rerender, renders } = renderSuspenseHook(
      ({ queryKey }) =>
        // intentionally use a fetch policy that will execute a network request
        useSuspenseQuery(query, { queryKey, fetchPolicy: "network-only" }),
      { mocks, initialProps: { queryKey: "first" } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { greeting: "Hello first fetch" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ queryKey: "second" });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { greeting: "Hello second fetch" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(4);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toMatchObject([
      {
        data: { greeting: "Hello first fetch" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: { greeting: "Hello second fetch" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("suspends and refetches when using numeric query keys", async () => {
    const { query } = useSimpleQueryCase();

    const mocks = [
      {
        request: { query },
        result: { data: { greeting: "Hello first fetch" } },
        delay: 20,
      },
      {
        request: { query },
        result: { data: { greeting: "Hello second fetch" } },
        delay: 20,
      },
    ];

    const { result, rerender, renders } = renderSuspenseHook(
      ({ queryKey }) =>
        // intentionally use a fetch policy that will execute a network request
        useSuspenseQuery(query, { queryKey, fetchPolicy: "network-only" }),
      { mocks, initialProps: { queryKey: 1 } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { greeting: "Hello first fetch" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ queryKey: 2 });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { greeting: "Hello second fetch" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(4);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toMatchObject([
      {
        data: { greeting: "Hello first fetch" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: { greeting: "Hello second fetch" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("responds to cache updates after changing variables", async () => {
    const { query, mocks } = useVariablesQueryCase();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { result, rerender, renders } = renderSuspenseHook(
      ({ id }) => useSuspenseQuery(query, { variables: { id } }),
      { client, initialProps: { id: "1" } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ id: "2" });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    client.writeQuery({
      query,
      variables: { id: "2" },
      data: { character: { id: "2", name: "Cached hero" } },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { character: { id: "2", name: "Cached hero" } },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.suspenseCount).toBe(2);
    expect(renders.count).toBe(5);
    expect(renders.frames).toMatchObject([
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
      {
        data: { character: { id: "2", name: "Cached hero" } },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("uses cached result and does not suspend when switching back to already used variables while using `cache-first` fetch policy", async () => {
    const { query, mocks } = useVariablesQueryCase();

    const { result, rerender, renders } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, {
          fetchPolicy: "cache-first",
          variables: { id },
        }),
      { mocks, initialProps: { id: "1" } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ id: "2" });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ id: "1" });

    expect(result.current).toMatchObject({
      ...mocks[0].result,
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });

    expect(renders.count).toBe(5);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toMatchObject([
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
      {
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("uses cached result with network request and does not suspend when switching back to already used variables while using `cache-and-network` fetch policy", async () => {
    const query: TypedDocumentNode<VariablesCaseData, VariablesCaseVariables> =
      gql`
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
          data: {
            character: { __typename: "Character", id: "1", name: "Spider-Man" },
          },
        },
      },
      {
        request: { query, variables: { id: "2" } },
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "2",
              name: "Black Widow",
            },
          },
        },
      },
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "1",
              name: "Spider-Man (refetch)",
            },
          },
        },
      },
    ];

    const { result, rerender, renders } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, {
          fetchPolicy: "cache-and-network",
          variables: { id },
        }),
      { mocks, initialProps: { id: "1" } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ id: "2" });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ id: "1" });

    expect(result.current).toMatchObject({
      ...mocks[0].result,
      networkStatus: NetworkStatus.loading,
      error: undefined,
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[2].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(6);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toMatchObject([
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
      {
        ...mocks[0].result,
        networkStatus: NetworkStatus.loading,
        error: undefined,
      },
      {
        ...mocks[2].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("refetches and suspends when switching back to already used variables while using `network-only` fetch policy", async () => {
    const query: TypedDocumentNode<VariablesCaseData, VariablesCaseVariables> =
      gql`
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
          data: {
            character: { __typename: "Character", id: "1", name: "Spider-Man" },
          },
        },
      },
      {
        request: { query, variables: { id: "2" } },
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "2",
              name: "Black Widow",
            },
          },
        },
      },
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "1",
              name: "Spider-Man (refetch)",
            },
          },
        },
      },
    ];

    const { result, rerender, renders } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, {
          fetchPolicy: "network-only",
          variables: { id },
        }),
      { mocks, initialProps: { id: "1" } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ id: "2" });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ id: "1" });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[2].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(6);
    expect(renders.suspenseCount).toBe(3);
    expect(renders.frames).toMatchObject([
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
      {
        ...mocks[2].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("refetches and suspends when switching back to already used variables while using `no-cache` fetch policy", async () => {
    const query: TypedDocumentNode<VariablesCaseData, VariablesCaseVariables> =
      gql`
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
          data: {
            character: { __typename: "Character", id: "1", name: "Spider-Man" },
          },
        },
      },
      {
        request: { query, variables: { id: "2" } },
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "2",
              name: "Black Widow",
            },
          },
        },
      },
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: {
            character: {
              __typename: "Character",
              id: "1",
              name: "Spider-Man (refetch)",
            },
          },
        },
      },
    ];

    const { result, rerender, renders } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, {
          fetchPolicy: "no-cache",
          variables: { id },
        }),
      { mocks, initialProps: { id: "1" } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ id: "2" });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ id: "1" });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[2].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(6);
    expect(renders.suspenseCount).toBe(3);
    expect(renders.frames).toMatchObject([
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
      {
        ...mocks[2].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("responds to cache updates after changing back to already fetched variables", async () => {
    const { query, mocks } = useVariablesQueryCase();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { result, rerender, renders } = renderSuspenseHook(
      ({ id }) => useSuspenseQuery(query, { variables: { id } }),
      { client, initialProps: { id: "1" } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ id: "2" });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ id: "1" });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    client.writeQuery({
      query,
      variables: { id: "1" },
      data: { character: { id: "1", name: "Cached hero" } },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { character: { id: "1", name: "Cached hero" } },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.suspenseCount).toBe(2);
    expect(renders.count).toBe(6);
    expect(renders.frames).toMatchObject([
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
      {
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: { character: { id: "1", name: "Cached hero" } },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it('does not suspend when data is in the cache and using a "cache-first" fetch policy', async () => {
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    cache.writeQuery({
      query,
      data: { greeting: "hello from cache" },
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: "cache-first" }),
      { cache, mocks }
    );

    expect(result.current).toMatchObject({
      data: { greeting: "hello from cache" },
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });

    expect(renders.count).toBe(1);
    expect(renders.suspenseCount).toBe(0);
    expect(renders.frames).toMatchObject([
      {
        data: { greeting: "hello from cache" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it('does not initiate a network request when data is in the cache and using a "cache-first" fetch policy', async () => {
    let fetchCount = 0;
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    const link = new ApolloLink(() => {
      return new Observable((observer) => {
        fetchCount++;

        const mock = mocks[0];

        observer.next(mock.result);
        observer.complete();
      });
    });

    cache.writeQuery({
      query,
      data: { greeting: "hello from cache" },
    });

    renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: "cache-first" }),
      { cache, link, initialProps: { id: "1" } }
    );

    expect(fetchCount).toBe(0);
  });

  it('suspends when partial data is in the cache and using a "cache-first" fetch policy', async () => {
    const fullQuery = gql`
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

    const cache = new InMemoryCache();

    cache.writeQuery({
      query: partialQuery,
      data: { character: { id: "1" } },
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(fullQuery, { fetchPolicy: "cache-first" }),
      { cache, mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it('does not suspend when partial data is in the cache and using a "cache-first" fetch policy with returnPartialData', async () => {
    const fullQuery = gql`
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

    const cache = new InMemoryCache();

    cache.writeQuery({
      query: partialQuery,
      data: { character: { id: "1" } },
    });

    const { result, renders } = renderSuspenseHook(
      () =>
        useSuspenseQuery(fullQuery, {
          fetchPolicy: "cache-first",
          returnPartialData: true,
        }),
      { cache, mocks }
    );

    expect(renders.suspenseCount).toBe(0);
    expect(result.current).toMatchObject({
      data: { character: { id: "1" } },
      networkStatus: NetworkStatus.loading,
      error: undefined,
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

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

  it('suspends and does not use partial data when changing variables and using a "cache-first" fetch policy with returnPartialData', async () => {
    const { query: fullQuery, mocks } = useVariablesQueryCase();

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

    const { result, renders, rerender } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(fullQuery, {
          fetchPolicy: "cache-first",
          returnPartialData: true,
          variables: { id },
        }),
      { cache, mocks, initialProps: { id: "1" } }
    );

    expect(renders.suspenseCount).toBe(0);
    expect(result.current).toMatchObject({
      data: { character: { id: "1" } },
      networkStatus: NetworkStatus.loading,
      error: undefined,
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ id: "2" });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(4);
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

  it('suspends when data is in the cache and using a "network-only" fetch policy', async () => {
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    cache.writeQuery({
      query,
      data: { greeting: "hello from cache" },
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: "network-only" }),
      { cache, mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        data: { greeting: "Hello" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it('suspends when partial data is in the cache and using a "network-only" fetch policy with returnPartialData', async () => {
    const fullQuery = gql`
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

    const cache = new InMemoryCache();

    cache.writeQuery({
      query: partialQuery,
      data: { character: { id: "1" } },
    });

    const { result, renders } = renderSuspenseHook(
      () =>
        useSuspenseQuery(fullQuery, {
          fetchPolicy: "network-only",
          returnPartialData: true,
        }),
      { cache, mocks }
    );

    expect(renders.suspenseCount).toBe(1);

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it('suspends and does not overwrite cache when data is in the cache and using a "no-cache" fetch policy', async () => {
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    cache.writeQuery({
      query,
      data: { greeting: "hello from cache" },
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: "no-cache" }),
      { cache, mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    const cachedData = cache.readQuery({ query });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        data: { greeting: "Hello" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
    expect(cachedData).toEqual({ greeting: "hello from cache" });
  });

  it('maintains results when rerendering a query using a "no-cache" fetch policy', async () => {
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    const { result, rerender, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: "no-cache" }),
      { cache, mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        data: { greeting: "Hello" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);

    rerender();

    expect(result.current).toMatchObject({
      ...mocks[0].result,
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        data: { greeting: "Hello" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: { greeting: "Hello" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it('suspends when partial data is in the cache and using a "no-cache" fetch policy with returnPartialData', async () => {
    using _consoleSpy = spyOnConsole("warn");

    const fullQuery = gql`
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

    const cache = new InMemoryCache();

    cache.writeQuery({
      query: partialQuery,
      data: { character: { id: "1" } },
    });

    const { result, renders } = renderSuspenseHook(
      () =>
        useSuspenseQuery(fullQuery, {
          fetchPolicy: "no-cache",
          returnPartialData: true,
        }),
      { cache, mocks }
    );

    expect(renders.suspenseCount).toBe(1);

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(2);
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
    using consoleSpy = spyOnConsole("warn");

    const { query, mocks } = useSimpleQueryCase();

    renderSuspenseHook(
      () =>
        useSuspenseQuery(query, {
          fetchPolicy: "no-cache",
          returnPartialData: true,
        }),
      { mocks }
    );

    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpy.warn).toHaveBeenCalledWith(
      "Using `returnPartialData` with a `no-cache` fetch policy has no effect. To read partial data from the cache, consider using an alternate fetch policy."
    );
  });

  it('does not suspend when data is in the cache and using a "cache-and-network" fetch policy', async () => {
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    cache.writeQuery({
      query,
      data: { greeting: "hello from cache" },
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: "cache-and-network" }),
      { cache, mocks }
    );

    expect(result.current).toMatchObject({
      data: { greeting: "hello from cache" },
      networkStatus: NetworkStatus.loading,
      error: undefined,
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(0);
    expect(renders.frames).toMatchObject([
      {
        data: { greeting: "hello from cache" },
        networkStatus: NetworkStatus.loading,
        error: undefined,
      },
      {
        data: { greeting: "Hello" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it('does not suspend when partial data is in the cache and using a "cache-and-network" fetch policy with returnPartialData', async () => {
    const fullQuery = gql`
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

    const cache = new InMemoryCache();

    cache.writeQuery({
      query: partialQuery,
      data: { character: { id: "1" } },
    });

    const { result, renders } = renderSuspenseHook(
      () =>
        useSuspenseQuery(fullQuery, {
          fetchPolicy: "cache-and-network",
          returnPartialData: true,
        }),
      { cache, mocks }
    );

    expect(renders.suspenseCount).toBe(0);
    expect(result.current).toMatchObject({
      data: { character: { id: "1" } },
      networkStatus: NetworkStatus.loading,
      error: undefined,
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

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
    const { query: fullQuery, mocks } = useVariablesQueryCase();

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

    const { result, renders, rerender } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(fullQuery, {
          fetchPolicy: "cache-and-network",
          returnPartialData: true,
          variables: { id },
        }),
      { cache, mocks, initialProps: { id: "1" } }
    );

    expect(renders.suspenseCount).toBe(0);
    expect(result.current).toMatchObject({
      data: { character: { id: "1" } },
      networkStatus: NetworkStatus.loading,
      error: undefined,
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ id: "2" });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(4);
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

  it.each<SuspenseQueryHookFetchPolicy>([
    "cache-first",
    "network-only",
    "cache-and-network",
  ])(
    'writes to the cache when using a "%s" fetch policy',
    async (fetchPolicy) => {
      const { query, mocks } = useVariablesQueryCase();

      const cache = new InMemoryCache();

      const { result } = renderSuspenseHook(
        ({ id }) => useSuspenseQuery(query, { fetchPolicy, variables: { id } }),
        { cache, mocks, initialProps: { id: "1" } }
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mocks[0].result.data);
      });

      const cachedData = cache.readQuery({ query, variables: { id: "1" } });

      expect(cachedData).toEqual(mocks[0].result.data);
    }
  );

  it('does not write to the cache when using a "no-cache" fetch policy', async () => {
    const { query, mocks } = useVariablesQueryCase();

    const cache = new InMemoryCache();

    const { result } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, { fetchPolicy: "no-cache", variables: { id } }),
      { cache, mocks, initialProps: { id: "1" } }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mocks[0].result.data);
    });

    const cachedData = cache.readQuery({ query, variables: { id: "1" } });

    expect(cachedData).toBeNull();
  });

  it.each<SuspenseQueryHookFetchPolicy>([
    "cache-first",
    "network-only",
    "cache-and-network",
  ])(
    'responds to cache updates when using a "%s" fetch policy',
    async (fetchPolicy) => {
      const { query, mocks } = useSimpleQueryCase();

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink(mocks),
      });

      const { result, renders } = renderSuspenseHook(
        () => useSuspenseQuery(query, { fetchPolicy }),
        { client }
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mocks[0].result.data);
      });

      client.writeQuery({
        query,
        data: { greeting: "Updated hello" },
      });

      await waitFor(() => {
        expect(result.current).toMatchObject({
          data: { greeting: "Updated hello" },
          networkStatus: NetworkStatus.ready,
          error: undefined,
        });
      });
      expect(renders.suspenseCount).toBe(1);
      expect(renders.count).toBe(3);
      expect(renders.frames).toMatchObject([
        {
          ...mocks[0].result,
          networkStatus: NetworkStatus.ready,
          error: undefined,
        },
        {
          data: { greeting: "Updated hello" },
          networkStatus: NetworkStatus.ready,
          error: undefined,
        },
      ]);
    }
  );

  it('does not respond to cache updates when using a "no-cache" fetch policy', async () => {
    const { query, mocks } = useSimpleQueryCase();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: "no-cache" }),
      { client }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mocks[0].result.data);
    });

    client.writeQuery({
      query,
      data: { greeting: "Updated hello" },
    });

    // Wait for a while to ensure no updates happen asynchronously
    await wait(100);

    expect(result.current).toMatchObject({
      ...mocks[0].result,
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
    expect(renders.suspenseCount).toBe(1);
    expect(renders.count).toBe(2);
    expect(renders.frames).toMatchObject([
      {
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it.each<SuspenseQueryHookFetchPolicy>([
    "cache-first",
    "network-only",
    "no-cache",
    "cache-and-network",
  ])(
    're-suspends the component when changing variables and using a "%s" fetch policy',
    async (fetchPolicy) => {
      const { query, mocks } = useVariablesQueryCase();

      const { result, rerender, renders } = renderSuspenseHook(
        ({ id }) => useSuspenseQuery(query, { fetchPolicy, variables: { id } }),
        { mocks, initialProps: { id: "1" } }
      );

      expect(renders.suspenseCount).toBe(1);
      await waitFor(() => {
        expect(result.current).toMatchObject({
          ...mocks[0].result,
          error: undefined,
        });
      });

      rerender({ id: "2" });

      await waitFor(() => {
        expect(result.current).toMatchObject({
          ...mocks[1].result,
          networkStatus: NetworkStatus.ready,
          error: undefined,
        });
      });

      // Renders:
      // 1. Initiate fetch and suspend
      // 2. Unsuspend and return results from initial fetch
      // 3. Change variables and suspend
      // 5. Unsuspend and return results from refetch
      expect(renders.count).toBe(4);
      expect(renders.suspenseCount).toBe(2);
      expect(renders.frames).toMatchObject([
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
    }
  );

  it.each<SuspenseQueryHookFetchPolicy>([
    "cache-first",
    "network-only",
    "no-cache",
    "cache-and-network",
  ])(
    're-suspends the component when changing queries and using a "%s" fetch policy',
    async (fetchPolicy) => {
      const query1: TypedDocumentNode<{ hello: string }> = gql`
        query Query1 {
          hello
        }
      `;

      const query2: TypedDocumentNode<{ world: string }> = gql`
        query Query2 {
          world
        }
      `;

      const mocks = [
        {
          request: { query: query1 },
          result: { data: { hello: "query1" } },
        },
        {
          request: { query: query2 },
          result: { data: { world: "query2" } },
        },
      ];

      const { result, rerender, renders } = renderSuspenseHook(
        ({ query }) => useSuspenseQuery(query, { fetchPolicy }),
        { mocks, initialProps: { query: query1 as DocumentNode } }
      );

      expect(renders.suspenseCount).toBe(1);
      await waitFor(() => {
        expect(result.current).toMatchObject({
          ...mocks[0].result,
          networkStatus: NetworkStatus.ready,
          error: undefined,
        });
      });

      rerender({ query: query2 });

      await waitFor(() => {
        expect(result.current).toMatchObject({
          ...mocks[1].result,
          networkStatus: NetworkStatus.ready,
          error: undefined,
        });
      });

      // Renders:
      // 1. Initiate fetch and suspend
      // 2. Unsuspend and return results from initial fetch
      // 3. Change queries and suspend
      // 5. Unsuspend and return results from refetch
      expect(renders.count).toBe(4);
      expect(renders.suspenseCount).toBe(2);
      expect(renders.frames).toMatchObject([
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
    }
  );

  it.each<SuspenseQueryHookFetchPolicy>([
    "cache-first",
    "network-only",
    "no-cache",
    "cache-and-network",
  ])(
    'ensures data is fetched the correct amount of times when changing variables and using a "%s" fetch policy',
    async (fetchPolicy) => {
      const { query, mocks } = useVariablesQueryCase();

      let fetchCount = 0;

      const link = new ApolloLink((operation) => {
        return new Observable((observer) => {
          fetchCount++;

          const mock = mocks.find(({ request }) =>
            equal(request.variables, operation.variables)
          );

          if (!mock) {
            throw new Error("Could not find mock for operation");
          }

          observer.next(mock.result);
          observer.complete();
        });
      });

      const { result, rerender } = renderSuspenseHook(
        ({ id }) => useSuspenseQuery(query, { fetchPolicy, variables: { id } }),
        { link, initialProps: { id: "1" } }
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mocks[0].result.data);
      });

      expect(fetchCount).toBe(1);

      rerender({ id: "2" });

      await waitFor(() => {
        expect(result.current.data).toEqual(mocks[1].result.data);
      });

      expect(fetchCount).toBe(2);
    }
  );

  it.each<SuspenseQueryHookFetchPolicy>([
    "cache-first",
    "network-only",
    "no-cache",
    "cache-and-network",
  ])(
    'ensures data is fetched and suspended the correct amount of times in strict mode while using a "%s" fetch policy',
    async (fetchPolicy) => {
      const { query, mocks } = useVariablesQueryCase();

      let fetchCount = 0;

      const link = new ApolloLink((operation) => {
        return new Observable((observer) => {
          fetchCount++;

          const mock = mocks.find(({ request }) =>
            equal(request.variables, operation.variables)
          );

          if (!mock) {
            throw new Error("Could not find mock for operation");
          }

          observer.next(mock.result);
          observer.complete();
        });
      });

      const { result, renders } = renderSuspenseHook(
        ({ id }) => useSuspenseQuery(query, { fetchPolicy, variables: { id } }),
        { strictMode: true, link, initialProps: { id: "1" } }
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mocks[0].result.data);
      });

      expect(fetchCount).toBe(1);

      // React double invokes the render function in strict mode so the suspense
      // fallback is rendered twice before the promise is resolved
      // https://reactjs.org/docs/strict-mode.html#detecting-unexpected-side-effects
      expect(renders.suspenseCount).toBe(2);
    }
  );

  it.each<SuspenseQueryHookFetchPolicy>([
    "cache-first",
    "network-only",
    "cache-and-network",
  ])(
    'responds to cache updates in strict mode while using a "%s" fetch policy',
    async (fetchPolicy) => {
      const { query, mocks } = useSimpleQueryCase();

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new MockLink(mocks),
      });

      const { result } = renderSuspenseHook(
        () => useSuspenseQuery(query, { fetchPolicy }),
        { strictMode: true, client }
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mocks[0].result.data);
      });

      client.writeQuery({
        query,
        data: { greeting: "Updated hello" },
      });

      await waitFor(() => {
        expect(result.current).toMatchObject({
          data: { greeting: "Updated hello" },
          networkStatus: NetworkStatus.ready,
          error: undefined,
        });
      });
    }
  );

  // https://github.com/apollographql/apollo-client/issues/10478
  it("responds to cache updates when data is already in the cache while using a cache-first fetch policy", async () => {
    const { query, mocks } = useSimpleQueryCase();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    client.writeQuery({
      query,
      data: { greeting: "Hello from cache" },
    });

    const { result } = renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: "cache-first" }),
      { client }
    );

    expect(result.current.data).toEqual({ greeting: "Hello from cache" });

    // Allow time for the subscription in the hook to set itself up since it is
    // wrapped in a setTimeout (to handle Strict mode bugs). Without this
    // `wait`, `subscribe` isn't called until after our test updates the cache
    // via `writeQuery`, which then emits the most recent result, which is the
    // updated value.
    await wait(0);

    client.writeQuery({
      query,
      data: { greeting: "Updated hello" },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { greeting: "Updated hello" },
        error: undefined,
      });
    });
  });

  it("uses the default fetch policy from the client when none provided in options", async () => {
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    const client = new ApolloClient({
      cache,
      link: new MockLink(mocks),
      defaultOptions: {
        watchQuery: {
          fetchPolicy: "network-only",
        },
      },
    });

    client.writeQuery({ query, data: { greeting: "hello from cache" } });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query),
      { client }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mocks[0].result.data);
    });

    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("uses default variables from the client when none provided in options", async () => {
    const { query, mocks } = useVariablesQueryCase();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
      defaultOptions: {
        watchQuery: {
          variables: { id: "2" },
        },
      },
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query),
      { client }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.frames).toMatchObject([
      {
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("uses default variables from the client when none provided in options in strict mode", async () => {
    const { query, mocks } = useVariablesQueryCase();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
      defaultOptions: {
        watchQuery: {
          variables: { id: "2" },
        },
      },
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query),
      { strictMode: true, client }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    // React double invokes the render function in strict mode so we expect 2
    // frames to be rendered here.
    expect(renders.frames).toMatchObject([
      {
        ...mocks[1].result,
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

  it("merges global default variables with local variables", async () => {
    const query = gql`
      query MergedVariablesQuery {
        vars
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new ApolloLink((operation) => {
        return new Observable((observer) => {
          observer.next({ data: { vars: operation.variables } });
          observer.complete();
        });
      }),
      defaultOptions: {
        watchQuery: {
          variables: { source: "global", globalOnlyVar: true },
        },
      },
    });

    const { result, rerender, renders } = renderSuspenseHook(
      ({ source }) =>
        useSuspenseQuery(query, {
          fetchPolicy: "network-only",
          variables: { source, localOnlyVar: true },
        }),
      { client, initialProps: { source: "local" } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          vars: { source: "local", globalOnlyVar: true, localOnlyVar: true },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ source: "rerender" });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          vars: { source: "rerender", globalOnlyVar: true, localOnlyVar: true },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.frames).toMatchObject([
      {
        data: {
          vars: { source: "local", globalOnlyVar: true, localOnlyVar: true },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: {
          vars: { source: "rerender", globalOnlyVar: true, localOnlyVar: true },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("can unset a globally defined variable", async () => {
    const query: TypedDocumentNode<{ vars: Record<string, any> }> = gql`
      query MergedVariablesQuery {
        vars
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new ApolloLink((operation) => {
        return new Observable((observer) => {
          observer.next({ data: { vars: operation.variables } });
          observer.complete();
        });
      }),
      defaultOptions: {
        watchQuery: {
          variables: { source: "global", globalOnlyVar: true },
        },
      },
    });

    const { result, renders } = renderSuspenseHook(
      () =>
        useSuspenseQuery(query, {
          variables: { source: "local", globalOnlyVar: undefined },
        }),
      { client }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { vars: { source: "local" } },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    // Check to make sure the property itself is not defined, not just set to
    // undefined. Unfortunately this is not caught by toMatchObject as
    // toMatchObject only checks a if the subset of options are equal, not if
    // they have strictly the same keys and values.
    expect(result.current.data.vars).not.toHaveProperty("globalOnlyVar");

    expect(renders.frames).toMatchObject([
      {
        data: { vars: { source: "local" } },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("passes context to the link", async () => {
    const query = gql`
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

    const { result } = renderSuspenseHook(
      () =>
        useSuspenseQuery(query, {
          context: { valueA: "A", valueB: "B" },
        }),
      { client }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { context: { valueA: "A", valueB: "B" } },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });
  });

  it("throws network errors by default", async () => {
    using _consoleSpy = spyOnConsole("error");

    const { query, mocks } = useErrorCase({
      networkError: new Error("Could not fetch"),
    });

    const { renders } = renderSuspenseHook(() => useSuspenseQuery(query), {
      mocks,
    });

    await waitFor(() => expect(renders.errorCount).toBe(1));

    expect(renders.errors.length).toBe(1);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([]);

    const [error] = renders.errors as ApolloError[];

    expect(error).toBeInstanceOf(ApolloError);
    expect(error.networkError).toEqual(new Error("Could not fetch"));
    expect(error.graphQLErrors).toEqual([]);
  });

  it("throws graphql errors by default", async () => {
    using _consoleSpy = spyOnConsole("error");

    const { query, mocks } = useErrorCase({
      graphQLErrors: [new GraphQLError("`id` should not be null")],
    });

    const { renders } = renderSuspenseHook(() => useSuspenseQuery(query), {
      mocks,
    });

    await waitFor(() => expect(renders.errorCount).toBe(1));

    expect(renders.errors.length).toBe(1);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([]);

    const [error] = renders.errors as ApolloError[];

    expect(error).toBeInstanceOf(ApolloError);
    expect(error.networkError).toBeNull();
    expect(error.graphQLErrors).toEqual([
      new GraphQLError("`id` should not be null"),
    ]);
  });

  it("tears down subscription when throwing an error", async () => {
    jest.useFakeTimers();
    using _consoleSpy = spyOnConsole("error");

    const { query, mocks } = useErrorCase({
      networkError: new Error("Could not fetch"),
    });

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { renders } = renderSuspenseHook(() => useSuspenseQuery(query), {
      client,
    });

    await waitFor(() => expect(renders.errorCount).toBe(1));

    // The query was never retained since the error was thrown before the
    // useEffect coud run. We need to wait for the auto dispose timeout to kick
    // in before we check whether the observable was cleaned up
    jest.advanceTimersByTime(30_000);

    expect(client.getObservableQueries().size).toBe(0);

    jest.useRealTimers();
  });

  it("tears down subscription when throwing an error on refetch", async () => {
    using _consoleSpy = spyOnConsole("error");

    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: { user: { id: "1", name: "Captain Marvel" } },
        },
      },
      {
        request: { query, variables: { id: "1" } },
        result: {
          errors: [new GraphQLError("Something went wrong")],
        },
      },
    ];

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { id: "1" } }),
      { client }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(renders.errorCount).toBe(1));
    await waitFor(() => expect(client.getObservableQueries().size).toBe(0));
  });

  it('throws network errors when errorPolicy is set to "none"', async () => {
    using _consoleSpy = spyOnConsole("error");

    const { query, mocks } = useErrorCase({
      networkError: new Error("Could not fetch"),
    });

    const { renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: "none" }),
      { mocks }
    );

    await waitFor(() => expect(renders.errorCount).toBe(1));

    expect(renders.errors.length).toBe(1);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([]);

    const [error] = renders.errors as ApolloError[];

    expect(error).toBeInstanceOf(ApolloError);
    expect(error.networkError).toEqual(new Error("Could not fetch"));
    expect(error.graphQLErrors).toEqual([]);
  });

  it('throws graphql errors when errorPolicy is set to "none"', async () => {
    using _consoleSpy = spyOnConsole("error");

    const { query, mocks } = useErrorCase({
      graphQLErrors: [new GraphQLError("`id` should not be null")],
    });

    const { renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: "none" }),
      { mocks }
    );

    await waitFor(() => expect(renders.errorCount).toBe(1));

    expect(renders.errors.length).toBe(1);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([]);

    const [error] = renders.errors as ApolloError[];

    expect(error).toBeInstanceOf(ApolloError);
    expect(error.networkError).toBeNull();
    expect(error.graphQLErrors).toEqual([
      new GraphQLError("`id` should not be null"),
    ]);
  });

  it('handles multiple graphql errors when errorPolicy is set to "none"', async () => {
    using _consoleSpy = spyOnConsole("error");

    const graphQLErrors = [
      new GraphQLError("Fool me once"),
      new GraphQLError("Fool me twice"),
    ];

    const { query, mocks } = useErrorCase({ graphQLErrors });

    const { renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: "none" }),
      { mocks }
    );

    await waitFor(() => expect(renders.errorCount).toBe(1));

    expect(renders.errors.length).toBe(1);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([]);

    const [error] = renders.errors as ApolloError[];

    expect(error).toBeInstanceOf(ApolloError);
    expect(error!.networkError).toBeNull();
    expect(error!.graphQLErrors).toEqual(graphQLErrors);
  });

  it('throws network errors when errorPolicy is set to "ignore"', async () => {
    using _consoleSpy = spyOnConsole("error");
    const networkError = new Error("Could not fetch");

    const { query, mocks } = useErrorCase({ networkError });

    const { renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: "ignore" }),
      { mocks }
    );

    await waitFor(() => {
      expect(renders.errorCount).toBe(1);
    });

    expect(renders.errors.length).toBe(1);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([]);

    const [error] = renders.errors as ApolloError[];

    expect(error).toBeInstanceOf(ApolloError);
    expect(error!.networkError).toEqual(networkError);
    expect(error!.graphQLErrors).toEqual([]);
  });

  it('does not throw or return graphql errors when errorPolicy is set to "ignore"', async () => {
    const { query, mocks } = useErrorCase({
      graphQLErrors: [new GraphQLError("`id` should not be null")],
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: "ignore" }),
      { mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: undefined,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      { data: undefined, networkStatus: NetworkStatus.ready, error: undefined },
    ]);
  });

  it('returns partial data results and discards GraphQL errors when errorPolicy is set to "ignore"', async () => {
    const { query, mocks } = useErrorCase({
      data: { currentUser: { id: "1", name: null } },
      graphQLErrors: [new GraphQLError("`name` could not be found")],
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: "ignore" }),
      { mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { currentUser: { id: "1", name: null } },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.frames).toMatchObject([
      {
        data: { currentUser: { id: "1", name: null } },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it('discards multiple graphql errors when errorPolicy is set to "ignore"', async () => {
    const { query, mocks } = useErrorCase({
      graphQLErrors: [
        new GraphQLError("Fool me once"),
        new GraphQLError("Fool me twice"),
      ],
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: "ignore" }),
      { mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: undefined,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.frames).toMatchObject([
      { data: undefined, networkStatus: NetworkStatus.ready, error: undefined },
    ]);
  });

  it('responds to cache updates and clears errors after an error returns when errorPolicy is set to "ignore"', async () => {
    const graphQLError = new GraphQLError("`id` should not be null");

    const { query, mocks } = useErrorCase({ graphQLErrors: [graphQLError] });

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache: new InMemoryCache(),
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: "ignore" }),
      { client }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: undefined,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    client.writeQuery({
      query,
      data: {
        currentUser: {
          id: "1",
          name: "Cache User",
        },
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          currentUser: {
            id: "1",
            name: "Cache User",
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(3);
    expect(renders.frames).toMatchObject([
      {
        data: undefined,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: { currentUser: { id: "1", name: "Cache User" } },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it('throws network errors when errorPolicy is set to "all"', async () => {
    using _consoleSpy = spyOnConsole("error");

    const networkError = new Error("Could not fetch");

    const { query, mocks } = useErrorCase({ networkError });

    const { renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: "all" }),
      { mocks }
    );

    await waitFor(() => {
      expect(renders.errorCount).toBe(1);
    });

    expect(renders.errors.length).toBe(1);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([]);

    const [error] = renders.errors as ApolloError[];

    expect(error).toBeInstanceOf(ApolloError);
    expect(error!.networkError).toEqual(networkError);
    expect(error!.graphQLErrors).toEqual([]);
  });

  it('does not throw and returns graphql errors when errorPolicy is set to "all"', async () => {
    const graphQLError = new GraphQLError("`id` should not be null");

    const { query, mocks } = useErrorCase({ graphQLErrors: [graphQLError] });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: "all" }),
      { mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: undefined,
        error: new ApolloError({ graphQLErrors: [graphQLError] }),
      });
    });

    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        data: undefined,
        networkStatus: NetworkStatus.error,
        error: new ApolloError({ graphQLErrors: [graphQLError] }),
      },
    ]);

    const { error } = result.current;

    expect(error).toBeInstanceOf(ApolloError);
    expect(error!.networkError).toBeNull();
    expect(error!.graphQLErrors).toEqual([graphQLError]);
  });

  it('responds to cache updates and clears errors after an error returns when errorPolicy is set to "all"', async () => {
    const graphQLError = new GraphQLError("`id` should not be null");

    const { query, mocks } = useErrorCase({ graphQLErrors: [graphQLError] });

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache: new InMemoryCache(),
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: "all" }),
      { client }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: undefined,
        networkStatus: NetworkStatus.error,
        error: new ApolloError({ graphQLErrors: [graphQLError] }),
      });
    });

    client.writeQuery({
      query,
      data: {
        currentUser: {
          id: "1",
          name: "Cache User",
        },
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          currentUser: {
            id: "1",
            name: "Cache User",
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(3);
    expect(renders.frames).toMatchObject([
      {
        data: undefined,
        networkStatus: NetworkStatus.error,
        error: new ApolloError({ graphQLErrors: [graphQLError] }),
      },
      {
        data: { currentUser: { id: "1", name: "Cache User" } },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it('handles multiple graphql errors when errorPolicy is set to "all"', async () => {
    const graphQLErrors = [
      new GraphQLError("Fool me once"),
      new GraphQLError("Fool me twice"),
    ];

    const { query, mocks } = useErrorCase({ graphQLErrors });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: "all" }),
      { mocks }
    );

    const expectedError = new ApolloError({ graphQLErrors });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: undefined,
        error: expectedError,
      });
    });

    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
    expect(renders.count).toBe(2);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        data: undefined,
        networkStatus: NetworkStatus.error,
        error: expectedError,
      },
    ]);

    const { error } = result.current;

    expect(error).toBeInstanceOf(ApolloError);
    expect(error!.networkError).toBeNull();
    expect(error!.graphQLErrors).toEqual(graphQLErrors);
  });

  it('returns partial data and keeps errors when errorPolicy is set to "all"', async () => {
    const graphQLError = new GraphQLError("`name` could not be found");

    const { query, mocks } = useErrorCase({
      data: { currentUser: { id: "1", name: null } },
      graphQLErrors: [graphQLError],
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: "all" }),
      { mocks }
    );

    const expectedError = new ApolloError({ graphQLErrors: [graphQLError] });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { currentUser: { id: "1", name: null } },
        networkStatus: NetworkStatus.error,
        error: expectedError,
      });
    });

    expect(renders.frames).toMatchObject([
      {
        data: { currentUser: { id: "1", name: null } },
        networkStatus: NetworkStatus.error,
        error: expectedError,
      },
    ]);
  });

  it('persists errors between rerenders when errorPolicy is set to "all"', async () => {
    const graphQLError = new GraphQLError("`name` could not be found");

    const { query, mocks } = useErrorCase({
      graphQLErrors: [graphQLError],
    });

    const { result, rerender } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: "all" }),
      { mocks }
    );

    const expectedError = new ApolloError({ graphQLErrors: [graphQLError] });

    await waitFor(() => {
      expect(result.current.error).toEqual(expectedError);
    });

    rerender();

    expect(result.current.error).toEqual(expectedError);
  });

  it('clears errors when changing variables and errorPolicy is set to "all"', async () => {
    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const graphQLErrors = [new GraphQLError("Could not fetch user 1")];

    const mocks = [
      {
        request: { query, variables: { id: "1" } },
        result: {
          errors: graphQLErrors,
        },
      },
      {
        request: { query, variables: { id: "2" } },
        result: {
          data: { user: { id: "2", name: "Captain Marvel" } },
        },
      },
    ];

    const { result, renders, rerender } = renderSuspenseHook(
      ({ id }) =>
        useSuspenseQuery(query, { errorPolicy: "all", variables: { id } }),
      { mocks, initialProps: { id: "1" } }
    );

    const expectedError = new ApolloError({ graphQLErrors });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: undefined,
        networkStatus: NetworkStatus.error,
        error: expectedError,
      });
    });

    rerender({ id: "2" });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(4);
    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toMatchObject([
      {
        data: undefined,
        networkStatus: NetworkStatus.error,
        error: expectedError,
      },
      {
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("re-suspends when calling `refetch`", async () => {
    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: { user: { id: "1", name: "Captain Marvel" } },
        },
      },
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: { user: { id: "1", name: "Captain Marvel (updated)" } },
        },
      },
    ];

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { id: "1" } }),
      { mocks, initialProps: { id: "1" } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(4);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toMatchObject([
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

  it("properly resolves `refetch` when returning a result that is deeply equal to data in the cache", async () => {
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
          data: { todo: { id: "1", name: "Clean room", completed: false } },
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
            <Todo id="1" />
          </Suspense>
        </ApolloProvider>
      );
    }

    function SuspenseFallback() {
      return <p>Loading</p>;
    }

    function Todo({ id }: { id: string }) {
      const { data, refetch } = useSuspenseQuery(query, {
        variables: { id },
      });

      const { todo } = data;

      return (
        <div>
          <button onClick={() => refetch()}>Refetch</button>
          <div data-testid="todo">
            {todo.name}
            {todo.completed && " (completed)"}
          </div>
        </div>
      );
    }

    render(<App />);

    expect(await screen.findByText("Loading")).toBeInTheDocument();

    const todo = await screen.findByTestId("todo");

    expect(todo).toHaveTextContent("Clean room");

    await act(() => user.click(screen.getByText("Refetch")));

    expect(screen.getByText("Loading")).toBeInTheDocument();

    await waitFor(() => {
      // Suspense will hide the component until the suspense boundary has
      // finished loading so it is still in the DOM.
      expect(todo).toBeVisible();
    });

    expect(todo).toHaveTextContent("Clean room");
  });

  it("re-suspends when calling `refetch` with new variables", async () => {
    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: { user: { id: "1", name: "Captain Marvel" } },
        },
      },
      {
        request: { query, variables: { id: "2" } },
        result: {
          data: { user: { id: "2", name: "Captain America" } },
        },
      },
    ];

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { id: "1" } }),
      { mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch({ id: "2" });
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });
    expect(renders.count).toBe(4);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toMatchObject([
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
    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: { user: { id: "1", name: "Captain Marvel" } },
        },
      },
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: { user: { id: "1", name: "Captain Marvel (updated)" } },
        },
      },
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: { user: { id: "1", name: "Captain Marvel (updated again)" } },
        },
      },
    ];

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { id: "1" } }),
      { mocks, initialProps: { id: "1" } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[2].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(6);
    expect(renders.suspenseCount).toBe(3);
    expect(renders.frames).toMatchObject([
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
      {
        ...mocks[2].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("throws errors when errors are returned after calling `refetch`", async () => {
    using _consoleSpy = spyOnConsole("error");

    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: { user: { id: "1", name: "Captain Marvel" } },
        },
      },
      {
        request: { query, variables: { id: "1" } },
        result: {
          errors: [new GraphQLError("Something went wrong")],
        },
      },
    ];

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { id: "1" } }),
      { mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(renders.errorCount).toBe(1);
    });

    expect(renders.errors).toEqual([
      new ApolloError({
        graphQLErrors: [new GraphQLError("Something went wrong")],
      }),
    ]);
    expect(renders.frames).toMatchObject([
      {
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it('ignores errors returned after calling `refetch` when errorPolicy is set to "ignore"', async () => {
    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: { user: { id: "1", name: "Captain Marvel" } },
        },
      },
      {
        request: { query, variables: { id: "1" } },
        result: {
          errors: [new GraphQLError("Something went wrong")],
        },
      },
    ];

    const { result, renders } = renderSuspenseHook(
      () =>
        useSuspenseQuery(query, {
          errorPolicy: "ignore",
          variables: { id: "1" },
        }),
      { mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
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
    ]);
  });

  it('returns errors after calling `refetch` when errorPolicy is set to "all"', async () => {
    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: { user: { id: "1", name: "Captain Marvel" } },
        },
      },
      {
        request: { query, variables: { id: "1" } },
        result: {
          errors: [new GraphQLError("Something went wrong")],
        },
      },
    ];

    const { result, renders } = renderSuspenseHook(
      () =>
        useSuspenseQuery(query, {
          errorPolicy: "all",
          variables: { id: "1" },
        }),
      { mocks }
    );

    const expectedError = new ApolloError({
      graphQLErrors: [new GraphQLError("Something went wrong")],
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.error,
        error: expectedError,
      });
    });

    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
    expect(renders.frames).toMatchObject([
      {
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        ...mocks[0].result,
        networkStatus: NetworkStatus.error,
        error: expectedError,
      },
    ]);
  });

  it('handles partial data results after calling `refetch` when errorPolicy is set to "all"', async () => {
    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: { user: { id: "1", name: "Captain Marvel" } },
        },
      },
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: { user: { id: "1", name: null } },
          errors: [new GraphQLError("Something went wrong")],
        },
      },
    ];

    const { result, renders } = renderSuspenseHook(
      () =>
        useSuspenseQuery(query, {
          errorPolicy: "all",
          variables: { id: "1" },
        }),
      { mocks }
    );

    const expectedError = new ApolloError({
      graphQLErrors: [new GraphQLError("Something went wrong")],
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: mocks[1].result.data,
        networkStatus: NetworkStatus.error,
        error: expectedError,
      });
    });

    expect(renders.errorCount).toBe(0);
    expect(renders.errors).toEqual([]);
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

  it("re-suspends when calling `fetchMore` with different variables", async () => {
    const { data, query, link } = usePaginatedCase();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { limit: 2 } }),
      { link }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { letters: data.slice(0, 2) },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    act(() => {
      result.current.fetchMore({ variables: { offset: 2 } });
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { letters: data.slice(2, 4) },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(4);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toMatchObject([
      {
        data: { letters: data.slice(0, 2) },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: { letters: data.slice(2, 4) },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("properly resolves `fetchMore` when returning a result that is deeply equal to data in the cache", async () => {
    const { query, link } = usePaginatedCase();

    const user = userEvent.setup();

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    function App() {
      return (
        <ApolloProvider client={client}>
          <Suspense fallback={<SuspenseFallback />}>
            <Letters offset={0} />
          </Suspense>
        </ApolloProvider>
      );
    }

    function SuspenseFallback() {
      return <p>Loading</p>;
    }

    function Letters({ offset }: { offset: number }) {
      const { data, fetchMore } = useSuspenseQuery(query, {
        variables: { offset },
      });

      return (
        <div>
          <button onClick={() => fetchMore({ variables: { offset } })}>
            Fetch more
          </button>
          <div data-testid="letters">
            {data.letters.map(({ letter }) => letter).join("")}
          </div>
        </div>
      );
    }

    render(<App />);

    expect(await screen.findByText("Loading")).toBeInTheDocument();

    const letters = await screen.findByTestId("letters");

    expect(letters).toHaveTextContent("AB");

    await act(() => user.click(screen.getByText("Fetch more")));

    expect(screen.getByText("Loading")).toBeInTheDocument();

    await waitFor(() => {
      // Suspense will hide the component until the suspense boundary has
      // finished loading so it is still in the DOM.
      expect(letters).toBeVisible();
    });

    expect(letters).toHaveTextContent("AB");
  });

  it("suspends when refetching after returning cached data for the initial fetch", async () => {
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    cache.writeQuery({
      query,
      data: { greeting: "hello from cache" },
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query),
      { cache, mocks }
    );

    expect(result.current).toMatchObject({
      data: { greeting: "hello from cache" },
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { greeting: "Hello" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        data: { greeting: "hello from cache" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: { greeting: "Hello" },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("properly uses `updateQuery` when calling `fetchMore`", async () => {
    const { data, query, link } = usePaginatedCase();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { limit: 2 } }),
      { link }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { letters: data.slice(0, 2) },
        error: undefined,
      });
    });

    act(() => {
      result.current.fetchMore({
        variables: { offset: 2 },
        updateQuery: (prev, { fetchMoreResult }) => ({
          letters: prev.letters.concat(fetchMoreResult.letters),
        }),
      });
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { letters: data.slice(0, 4) },
        error: undefined,
      });
    });

    expect(renders.frames).toMatchObject([
      {
        data: { letters: data.slice(0, 2) },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: { letters: data.slice(0, 4) },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("properly uses cache field policies when calling `fetchMore` without `updateQuery`", async () => {
    const { data, query, link } = usePaginatedCase();

    const cache = new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            letters: concatPagination(),
          },
        },
      },
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { limit: 2 } }),
      { cache, link }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { letters: data.slice(0, 2) },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    act(() => {
      result.current.fetchMore({ variables: { offset: 2 } });
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { letters: data.slice(0, 4) },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.frames).toMatchObject([
      {
        data: { letters: data.slice(0, 2) },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: { letters: data.slice(0, 4) },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it('honors refetchWritePolicy set to "overwrite"', async () => {
    const query: TypedDocumentNode<
      { primes: number[] },
      { min: number; max: number }
    > = gql`
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

    const { result } = renderSuspenseHook(
      () =>
        useSuspenseQuery(query, {
          variables: { min: 0, max: 12 },
          refetchWritePolicy: "overwrite",
        }),
      { cache, mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);

    act(() => {
      result.current.refetch({ min: 12, max: 30 });
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(mergeParams).toEqual([
      [undefined, [2, 3, 5, 7, 11]],
      [undefined, [13, 17, 19, 23, 29]],
    ]);
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

    const { result } = renderSuspenseHook(
      () =>
        useSuspenseQuery(query, {
          variables: { min: 0, max: 12 },
          refetchWritePolicy: "merge",
        }),
      { cache, mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);

    act(() => {
      result.current.refetch({ min: 12, max: 30 });
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { primes: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29] },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(mergeParams).toEqual([
      [undefined, [2, 3, 5, 7, 11]],
      [
        [2, 3, 5, 7, 11],
        [13, 17, 19, 23, 29],
      ],
    ]);
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

    const { result } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { min: 0, max: 12 } }),
      { cache, mocks }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);

    act(() => {
      result.current.refetch({ min: 12, max: 30 });
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(mergeParams).toEqual([
      [undefined, [2, 3, 5, 7, 11]],
      [undefined, [13, 17, 19, 23, 29]],
    ]);
  });

  it("does not suspend when `skip` is true", async () => {
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { skip: true }),
      { cache, mocks }
    );

    expect(renders.suspenseCount).toBe(0);
    expect(result.current).toMatchObject({
      data: undefined,
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  });

  it("does not suspend when using `skipToken` token as options", async () => {
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, skipToken),
      { cache, mocks }
    );

    expect(renders.suspenseCount).toBe(0);
    expect(result.current).toMatchObject({
      data: undefined,
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  });

  it("suspends when `skip` becomes `false` after it was `true`", async () => {
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    const { result, renders, rerender } = renderSuspenseHook(
      ({ skip }) => useSuspenseQuery(query, { skip }),
      { cache, mocks, initialProps: { skip: true } }
    );

    expect(renders.suspenseCount).toBe(0);
    expect(result.current).toMatchObject({
      data: undefined,
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });

    rerender({ skip: false });

    expect(renders.suspenseCount).toBe(1);

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      { data: undefined, networkStatus: NetworkStatus.ready, error: undefined },
      {
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("suspends when switching away from `skipToken` in options", async () => {
    const { query, mocks } = useSimpleQueryCase();

    const { result, renders, rerender } = renderSuspenseHook(
      ({ skip }) => useSuspenseQuery(query, skip ? skipToken : void 0),
      { mocks, initialProps: { skip: true } }
    );

    expect(renders.suspenseCount).toBe(0);
    expect(result.current).toMatchObject({
      data: undefined,
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });

    rerender({ skip: false });

    expect(renders.suspenseCount).toBe(1);

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      { data: undefined, networkStatus: NetworkStatus.ready, error: undefined },
      {
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("renders skip result, does not suspend, and maintains `data` when `skip` becomes `true` after it was `false`", async () => {
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    const { result, renders, rerender } = renderSuspenseHook(
      ({ skip }) => useSuspenseQuery(query, { skip }),
      { cache, mocks, initialProps: { skip: false } }
    );

    expect(renders.suspenseCount).toBe(1);

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ skip: true });

    expect(renders.suspenseCount).toBe(1);

    expect(result.current).toMatchObject({
      ...mocks[0].result,
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });

    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
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
    ]);
  });

  it("renders skip result, does not suspend, and maintains `data` when skipping a query with `skipToken` as options after it was enabled", async () => {
    const { query, mocks } = useSimpleQueryCase();

    const cache = new InMemoryCache();

    const { result, renders, rerender } = renderSuspenseHook(
      ({ skip }) => useSuspenseQuery(query, skip ? skipToken : void 0),
      { cache, mocks, initialProps: { skip: false } }
    );

    expect(renders.suspenseCount).toBe(1);

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ skip: true });

    expect(renders.suspenseCount).toBe(1);

    expect(result.current).toMatchObject({
      ...mocks[0].result,
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });

    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
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
    ]);
  });

  it("does not make network requests when `skip` is `true`", async () => {
    const { query, mocks } = useVariablesQueryCase();

    let fetchCount = 0;

    const link = new ApolloLink((operation) => {
      return new Observable((observer) => {
        fetchCount++;

        const mock = mocks.find(({ request }) =>
          equal(request.variables, operation.variables)
        );

        if (!mock) {
          throw new Error("Could not find mock for operation");
        }

        observer.next(mock.result);
        observer.complete();
      });
    });

    const { result, rerender } = renderSuspenseHook(
      ({ skip, id }) => useSuspenseQuery(query, { skip, variables: { id } }),
      { mocks, link, initialProps: { skip: true, id: "1" } }
    );

    expect(fetchCount).toBe(0);

    rerender({ skip: false, id: "1" });

    expect(fetchCount).toBe(1);

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ skip: true, id: "2" });

    expect(fetchCount).toBe(1);
  });

  it("does not make network requests when using `skipToken` for options", async () => {
    const { query, mocks } = useVariablesQueryCase();

    let fetchCount = 0;

    const link = new ApolloLink((operation) => {
      return new Observable((observer) => {
        fetchCount++;

        const mock = mocks.find(({ request }) =>
          equal(request.variables, operation.variables)
        );

        if (!mock) {
          throw new Error("Could not find mock for operation");
        }

        observer.next(mock.result);
        observer.complete();
      });
    });

    const { result, rerender } = renderSuspenseHook(
      ({ skip, id }) =>
        useSuspenseQuery(query, skip ? skipToken : { variables: { id } }),
      { mocks, link, initialProps: { skip: true, id: "1" } }
    );

    expect(fetchCount).toBe(0);

    rerender({ skip: false, id: "1" });

    expect(fetchCount).toBe(1);

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ skip: true, id: "2" });

    expect(fetchCount).toBe(1);
  });

  // https://github.com/apollographql/apollo-client/issues/11768
  it("does not make network requests when using `skipToken` with strict mode", async () => {
    const { query, mocks } = useVariablesQueryCase();

    let fetchCount = 0;

    const link = new ApolloLink((operation) => {
      return new Observable((observer) => {
        fetchCount++;

        const mock = mocks.find(({ request }) =>
          equal(request.variables, operation.variables)
        );

        if (!mock) {
          throw new Error("Could not find mock for operation");
        }

        observer.next(mock.result);
        observer.complete();
      });
    });

    const { result, rerender } = renderSuspenseHook(
      ({ skip, id }) =>
        useSuspenseQuery(query, skip ? skipToken : { variables: { id } }),
      { mocks, link, strictMode: true, initialProps: { skip: true, id: "1" } }
    );

    expect(fetchCount).toBe(0);

    rerender({ skip: false, id: "1" });

    expect(fetchCount).toBe(1);

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ skip: true, id: "2" });

    expect(fetchCount).toBe(1);
  });

  it("does not make network requests when using `skip` with strict mode", async () => {
    const { query, mocks } = useVariablesQueryCase();

    let fetchCount = 0;

    const link = new ApolloLink((operation) => {
      return new Observable((observer) => {
        fetchCount++;

        const mock = mocks.find(({ request }) =>
          equal(request.variables, operation.variables)
        );

        if (!mock) {
          throw new Error("Could not find mock for operation");
        }

        observer.next(mock.result);
        observer.complete();
      });
    });

    const { result, rerender } = renderSuspenseHook(
      ({ skip, id }) => useSuspenseQuery(query, { skip, variables: { id } }),
      { mocks, link, strictMode: true, initialProps: { skip: true, id: "1" } }
    );

    expect(fetchCount).toBe(0);

    rerender({ skip: false, id: "1" });

    expect(fetchCount).toBe(1);

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ skip: true, id: "2" });

    expect(fetchCount).toBe(1);
  });

  it("`skip` result is referentially stable", async () => {
    const { query, mocks } = useSimpleQueryCase();

    const { result, rerender } = renderSuspenseHook(
      ({ skip }) => useSuspenseQuery(query, { skip }),
      { mocks, initialProps: { skip: true } }
    );

    const skipResult = result.current;

    rerender({ skip: true });

    expect(result.current).toBe(skipResult);

    rerender({ skip: false });

    await waitFor(() => {
      expect(result.current.data).toEqual(mocks[0].result.data);
    });

    const fetchedSkipResult = result.current;

    rerender({ skip: false });

    expect(fetchedSkipResult).toBe(fetchedSkipResult);
  });

  it("`skip` result is referentially stable when using `skipToken` as options", async () => {
    const { query, mocks } = useSimpleQueryCase();

    const { result, rerender } = renderSuspenseHook(
      ({ skip }) => useSuspenseQuery(query, skip ? skipToken : void 0),
      { mocks, initialProps: { skip: true } }
    );

    const skipResult = result.current;

    rerender({ skip: true });

    expect(result.current).toBe(skipResult);

    rerender({ skip: false });

    await waitFor(() => {
      expect(result.current.data).toEqual(mocks[0].result.data);
    });

    const fetchedSkipResult = result.current;

    rerender({ skip: false });

    expect(fetchedSkipResult).toBe(fetchedSkipResult);
  });

  it("properly resolves when `skip` becomes false when returning a result that is deeply equal to data in the cache", async () => {
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
          data: { todo: { id: "1", name: "Clean room", completed: false } },
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
            <Todo id="1" />
          </Suspense>
        </ApolloProvider>
      );
    }

    function SuspenseFallback() {
      return <p>Loading</p>;
    }

    function Todo({ id }: { id: string }) {
      const [skip, setSkip] = React.useState(false);
      const { data } = useSuspenseQuery(query, {
        // Force a network request that returns the same data from the cache
        fetchPolicy: "network-only",
        skip,
        variables: { id },
      });

      const todo = data?.todo;

      return (
        <>
          <button onClick={() => setSkip((skip) => !skip)}>Toggle skip</button>
          {todo && (
            <div data-testid="todo">
              {todo.name}
              {todo.completed && " (completed)"}
            </div>
          )}
        </>
      );
    }

    render(<App />);

    expect(screen.getByText("Loading")).toBeInTheDocument();

    const todo = await screen.findByTestId("todo");
    expect(todo).toHaveTextContent("Clean room");

    // skip false -> true
    await act(() => user.click(screen.getByText("Toggle skip")));
    expect(todo).toHaveTextContent("Clean room");

    // skip true -> false
    await act(() => user.click(screen.getByText("Toggle skip")));

    expect(screen.getByText("Loading")).toBeInTheDocument();

    await waitFor(() => {
      expect(todo).toBeVisible();
    });

    expect(todo).toHaveTextContent("Clean room");
  });

  it("`skip` option works with `startTransition`", async () => {
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
    ];

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache: new InMemoryCache(),
    });

    function App() {
      const [id, setId] = React.useState<string | null>(null);
      const [isPending, startTransition] = React.useTransition();

      return (
        <ApolloProvider client={client}>
          <button
            disabled={isPending}
            onClick={() => {
              startTransition(() => {
                setId("1");
              });
            }}
          >
            Fetch to-do 1
          </button>
          <Suspense fallback={<SuspenseFallback />}>
            <Todo id={id} />
          </Suspense>
        </ApolloProvider>
      );
    }

    function SuspenseFallback() {
      return <p>Loading</p>;
    }

    function Todo({ id }: { id: string | null }) {
      const { data } = useSuspenseQuery(query, {
        skip: !id,
        variables: { id: id ?? "0" },
      });

      const todo = data?.todo;

      return todo ?
          <div data-testid="todo">
            {todo.name}
            {todo.completed && " (completed)"}
          </div>
        : null;
    }

    render(<App />);

    expect(screen.queryByTestId("todo")).not.toBeInTheDocument();

    const button = screen.getByText("Fetch to-do 1");
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
    expect(button).toBeDisabled();
    // Eventually we should see the updated todo content once its done
    // suspending.
    expect(await screen.findByTestId("todo")).toHaveTextContent("Clean room");
  });

  it("`skipToken` works with `startTransition` when used for options", async () => {
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
    ];

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache: new InMemoryCache(),
    });

    function App() {
      const [id, setId] = React.useState<string | null>(null);
      const [isPending, startTransition] = React.useTransition();

      return (
        <ApolloProvider client={client}>
          <button
            disabled={isPending}
            onClick={() => {
              startTransition(() => {
                setId("1");
              });
            }}
          >
            Fetch to-do 1
          </button>
          <Suspense fallback={<SuspenseFallback />}>
            <Todo id={id} />
          </Suspense>
        </ApolloProvider>
      );
    }

    function SuspenseFallback() {
      return <p>Loading</p>;
    }

    function Todo({ id }: { id: string | null }) {
      const { data } = useSuspenseQuery(
        query,
        id ? { variables: { id } } : skipToken
      );

      const todo = data?.todo;

      return todo ?
          <div data-testid="todo">
            {todo.name}
            {todo.completed && " (completed)"}
          </div>
        : null;
    }

    render(<App />);

    expect(screen.queryByTestId("todo")).not.toBeInTheDocument();

    const button = screen.getByText("Fetch to-do 1");
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
    expect(button).toBeDisabled();
    // Eventually we should see the updated todo content once its done
    // suspending.
    expect(await screen.findByTestId("todo")).toHaveTextContent("Clean room");
  });

  it("applies `errorPolicy` on next fetch when it changes between renders", async () => {
    const { query, mocks: simpleMocks } = useSimpleQueryCase();

    const successMock = simpleMocks[0];

    const mocks = [
      successMock,
      {
        request: { query },
        result: {
          errors: [new GraphQLError("oops")],
        },
      },
    ];

    const { result, rerender, renders } = renderSuspenseHook(
      ({ errorPolicy }) => useSuspenseQuery(query, { errorPolicy }),
      { mocks, initialProps: { errorPolicy: "none" as ErrorPolicy } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...successMock.result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ errorPolicy: "all" });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...successMock.result,
        networkStatus: NetworkStatus.error,
        error: new ApolloError({ graphQLErrors: [new GraphQLError("oops")] }),
      });
    });

    expect(renders.errorCount).toBe(0);
    expect(
      renders.frames.map((f) => ({
        data: f.data,
        error: f.error,
        networkStatus: f.networkStatus,
      }))
    ).toMatchObject([
      {
        ...successMock.result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        ...successMock.result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        ...successMock.result,
        networkStatus: NetworkStatus.error,
        error: new ApolloError({ graphQLErrors: [new GraphQLError("oops")] }),
      },
    ]);
  });

  it("applies `context` on next fetch when it changes between renders", async () => {
    const query = gql`
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

    const { result, rerender, renders } = renderSuspenseHook(
      ({ context }) => useSuspenseQuery(query, { context }),
      { client, initialProps: { context: { phase: "initialValue" } } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { context: { phase: "initialValue" } },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ context: { phase: "rerender" } });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          context: { phase: "rerender" },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.frames).toMatchObject([
      {
        data: { context: { phase: "initialValue" } },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: { context: { phase: "initialValue" } },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: { context: { phase: "rerender" } },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
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

    const { result, rerender, renders } = renderSuspenseHook(
      ({ canonizeResults }) => useSuspenseQuery(query, { canonizeResults }),
      { cache, initialProps: { canonizeResults: false } }
    );

    verifyCanonicalResults(result.current.data, false);

    rerender({ canonizeResults: true });

    verifyCanonicalResults(result.current.data, true);
    expect(renders.count).toBe(2);
  });

  it("applies changed `refetchWritePolicy` to next fetch when changing between renders", async () => {
    const query: TypedDocumentNode<
      { primes: number[] },
      { min: number; max: number }
    > = gql`
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

    const { result, rerender } = renderSuspenseHook(
      ({ refetchWritePolicy }) =>
        useSuspenseQuery(query, {
          variables: { min: 0, max: 12 },
          refetchWritePolicy,
        }),
      {
        cache,
        mocks,
        initialProps: { refetchWritePolicy: "merge" as RefetchWritePolicy },
      }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(mergeParams).toEqual([[undefined, [2, 3, 5, 7, 11]]]);

    act(() => {
      result.current.refetch({ min: 12, max: 30 });
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { primes: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29] },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(mergeParams).toEqual([
      [undefined, [2, 3, 5, 7, 11]],
      [
        [2, 3, 5, 7, 11],
        [13, 17, 19, 23, 29],
      ],
    ]);

    rerender({ refetchWritePolicy: "overwrite" });

    act(() => {
      result.current.refetch({ min: 30, max: 50 });
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[2].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[2].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
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
    const fullQuery = gql`
      query {
        character {
          __typename
          id
          name
        }
      }
    `;

    const partialQuery = gql`
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

    const { result, renders, rerender } = renderSuspenseHook(
      ({ returnPartialData }) =>
        useSuspenseQuery(fullQuery, { returnPartialData }),
      { cache, mocks, initialProps: { returnPartialData: false } }
    );

    expect(renders.suspenseCount).toBe(1);

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ returnPartialData: true });

    cache.modify({
      id: cache.identify({ __typename: "Character", id: "1" }),
      fields: {
        name: (_, { DELETE }) => DELETE,
      },
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({
        character: { __typename: "Character", id: "1" },
      });
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(5);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        data: { character: { __typename: "Character", id: "1" } },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: { character: { __typename: "Character", id: "1" } },
        networkStatus: NetworkStatus.loading,
        error: undefined,
      },
      {
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("applies updated `fetchPolicy` on next fetch when it changes between renders", async () => {
    const query = gql`
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

    const { result, /* renders, */ rerender } = renderSuspenseHook(
      ({ fetchPolicy }) => useSuspenseQuery(query, { fetchPolicy }),
      {
        cache,
        mocks,
        initialProps: {
          fetchPolicy: "cache-first" as SuspenseQueryHookFetchPolicy,
        },
      }
    );

    expect(result.current).toMatchObject({
      data: {
        character: {
          __typename: "Character",
          id: "1",
          name: "Doctor Strangecache",
        },
      },
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });

    rerender({ fetchPolicy: "no-cache" });

    const cacheKey = cache.identify({ __typename: "Character", id: "1" })!;

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({
        character: {
          __typename: "Character",
          id: "1",
          name: "Doctor Strange",
        },
      });
    });

    // Because we switched to a `no-cache` fetch policy, we should not see the
    // newly fetched data in the cache after the fetch occurred.
    expect(cache.extract()[cacheKey]).toEqual({
      __typename: "Character",
      id: "1",
      name: "Doctor Strangecache",
    });

    // TODO: Determine why there is an extra render. Unfortunately this is hard
    // to track down because the test passes if I run only this test or add a
    // `console.log` statement to the `handleNext` function in `QueryReference`.
    // expect(renders.count).toBe(4);
    // expect(renders.suspenseCount).toBe(1);
    // expect(renders.frames).toMatchObject([
    //   {
    //     data: {
    //       character: {
    //         __typename: 'Character',
    //         id: '1',
    //         name: 'Doctor Strangecache',
    //       },
    //     },
    //     networkStatus: NetworkStatus.ready,
    //     error: undefined,
    //   },
    //   {
    //     data: {
    //       character: {
    //         __typename: 'Character',
    //         id: '1',
    //         name: 'Doctor Strangecache',
    //       },
    //     },
    //     networkStatus: NetworkStatus.ready,
    //     error: undefined,
    //   },
    //   {
    //     ...mocks[0].result,
    //     networkStatus: NetworkStatus.ready,
    //     error: undefined,
    //   },
    // ]);
  });

  it("properly handles changing options along with changing `variables`", async () => {
    const query = gql`
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

    const { result, renders, rerender } = renderSuspenseHook(
      ({ errorPolicy, variables }) =>
        useSuspenseQuery(query, { errorPolicy, variables }),
      {
        cache,
        mocks,
        initialProps: {
          errorPolicy: "none" as ErrorPolicy,
          variables: { id: "1" },
        },
      }
    );

    expect(result.current).toMatchObject({
      data: {
        character: {
          __typename: "Character",
          id: "1",
          name: "Doctor Strangecache",
        },
      },
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });

    rerender({ errorPolicy: "none", variables: { id: "2" } });

    expect(renders.suspenseCount).toBe(1);

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          character: {
            __typename: "Character",
            id: "2",
            name: "Hulk",
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    rerender({ errorPolicy: "all", variables: { id: "1" } });

    act(() => {
      result.current.refetch();
    });

    const expectedError = new ApolloError({
      graphQLErrors: [new GraphQLError("oops")],
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          character: {
            __typename: "Character",
            id: "1",
            name: "Doctor Strangecache",
          },
        },
        networkStatus: NetworkStatus.error,
        error: expectedError,
      });
    });

    expect(renders.errorCount).toBe(0);
  });

  it("does not oversubscribe when suspending multiple times", async () => {
    const query = gql`
      query UserQuery($id: String!) {
        user(id: $id) {
          id
          name
        }
      }
    `;

    const mocks = [
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: { user: { id: "1", name: "Captain Marvel" } },
        },
      },
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: { user: { id: "1", name: "Captain Marvel (updated)" } },
        },
      },
      {
        request: { query, variables: { id: "1" } },
        result: {
          data: { user: { id: "1", name: "Captain Marvel (updated again)" } },
        },
      },
    ];

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    const { result } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { id: "1" } }),
      { client, initialProps: { id: "1" } }
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[0].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[1].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        ...mocks[2].result,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(client.getObservableQueries().size).toBe(1);
  });

  it("suspends deferred queries until initial chunk loads then streams in data as it loads", async () => {
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

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query),
      { link }
    );

    expect(renders.suspenseCount).toBe(1);

    link.simulateResult({
      result: {
        data: { greeting: { message: "Hello world", __typename: "Greeting" } },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { greeting: { message: "Hello world", __typename: "Greeting" } },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

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
      expect(result.current).toMatchObject({
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            recipient: { __typename: "Person", name: "Alice" },
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        data: { greeting: { message: "Hello world", __typename: "Greeting" } },
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

  it.each<SuspenseQueryHookFetchPolicy>([
    "cache-first",
    "network-only",
    "no-cache",
    "cache-and-network",
  ])(
    'suspends deferred queries until initial chunk loads then streams in data as it loads when using a "%s" fetch policy',
    async (fetchPolicy) => {
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

      const { result, renders } = renderSuspenseHook(
        () => useSuspenseQuery(query, { fetchPolicy }),
        { link }
      );

      expect(renders.suspenseCount).toBe(1);

      link.simulateResult({
        result: {
          data: {
            greeting: { message: "Hello world", __typename: "Greeting" },
          },
          hasNext: true,
        },
      });

      await waitFor(() => {
        expect(result.current).toMatchObject({
          data: {
            greeting: { message: "Hello world", __typename: "Greeting" },
          },
          networkStatus: NetworkStatus.ready,
          error: undefined,
        });
      });

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
        expect(result.current).toMatchObject({
          data: {
            greeting: {
              __typename: "Greeting",
              message: "Hello world",
              recipient: { __typename: "Person", name: "Alice" },
            },
          },
          networkStatus: NetworkStatus.ready,
          error: undefined,
        });
      });

      expect(renders.count).toBe(3);
      expect(renders.suspenseCount).toBe(1);
      expect(renders.frames).toMatchObject([
        {
          data: {
            greeting: { message: "Hello world", __typename: "Greeting" },
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
    }
  );

  it('does not suspend deferred queries with data in the cache and using a "cache-first" fetch policy', async () => {
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

    const cache = new InMemoryCache();

    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: { __typename: "Person", name: "Alice" },
        },
      },
    });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: "cache-first" }),
      { cache }
    );

    expect(result.current).toMatchObject({
      data: {
        greeting: {
          message: "Hello world",
          __typename: "Greeting",
          recipient: { __typename: "Person", name: "Alice" },
        },
      },
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });

    expect(renders.suspenseCount).toBe(0);
    expect(renders.frames).toMatchObject([
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

  it('does not suspend deferred queries with partial data in the cache and using a "cache-first" fetch policy with `returnPartialData`', async () => {
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

    const { result, renders } = renderSuspenseHook(
      () =>
        useSuspenseQuery(query, {
          fetchPolicy: "cache-first",
          returnPartialData: true,
        }),
      { cache, link }
    );

    expect(result.current).toMatchObject({
      data: {
        greeting: {
          __typename: "Greeting",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
      },
      networkStatus: NetworkStatus.loading,
      error: undefined,
    });

    link.simulateResult({
      result: {
        data: { greeting: { message: "Hello world", __typename: "Greeting" } },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            recipient: { __typename: "Person", name: "Cached Alice" },
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

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
      expect(result.current).toMatchObject({
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            recipient: { __typename: "Person", name: "Alice" },
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

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

  it('does not suspend deferred queries with data in the cache and using a "cache-and-network" fetch policy', async () => {
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
    const cache = new InMemoryCache();
    const client = new ApolloClient({ cache, link });

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

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { fetchPolicy: "cache-and-network" }),
      { client }
    );

    expect(result.current).toMatchObject({
      data: {
        greeting: {
          message: "Hello cached",
          __typename: "Greeting",
          recipient: { __typename: "Person", name: "Cached Alice" },
        },
      },
      networkStatus: NetworkStatus.loading,
      error: undefined,
    });

    link.simulateResult({
      result: {
        data: { greeting: { __typename: "Greeting", message: "Hello world" } },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            recipient: { __typename: "Person", name: "Cached Alice" },
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

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
      expect(result.current).toMatchObject({
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            recipient: { __typename: "Person", name: "Alice" },
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(0);
    expect(renders.frames).toMatchObject([
      {
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Hello cached",
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

  it("suspends deferred queries with lists and properly patches results", async () => {
    const query = gql`
      query {
        greetings {
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

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query),
      { link }
    );

    expect(renders.suspenseCount).toBe(1);

    link.simulateResult({
      result: {
        data: {
          greetings: [
            { __typename: "Greeting", message: "Hello world" },
            { __typename: "Greeting", message: "Hello again" },
          ],
        },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          greetings: [
            { __typename: "Greeting", message: "Hello world" },
            { __typename: "Greeting", message: "Hello again" },
          ],
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    link.simulateResult({
      result: {
        incremental: [
          {
            data: {
              __typename: "Greeting",
              recipient: { __typename: "Person", name: "Alice" },
            },
            path: ["greetings", 0],
          },
        ],
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          greetings: [
            {
              __typename: "Greeting",
              message: "Hello world",
              recipient: { __typename: "Person", name: "Alice" },
            },
            {
              __typename: "Greeting",
              message: "Hello again",
            },
          ],
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    link.simulateResult({
      result: {
        incremental: [
          {
            data: {
              __typename: "Greeting",
              recipient: { __typename: "Person", name: "Bob" },
            },
            path: ["greetings", 1],
          },
        ],
        hasNext: false,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          greetings: [
            {
              __typename: "Greeting",
              message: "Hello world",
              recipient: { __typename: "Person", name: "Alice" },
            },
            {
              __typename: "Greeting",
              message: "Hello again",
              recipient: { __typename: "Person", name: "Bob" },
            },
          ],
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(4);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        data: {
          greetings: [
            { __typename: "Greeting", message: "Hello world" },
            { __typename: "Greeting", message: "Hello again" },
          ],
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: {
          greetings: [
            {
              __typename: "Greeting",
              message: "Hello world",
              recipient: { __typename: "Person", name: "Alice" },
            },
            {
              __typename: "Greeting",
              message: "Hello again",
            },
          ],
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: {
          greetings: [
            {
              __typename: "Greeting",
              message: "Hello world",
              recipient: { __typename: "Person", name: "Alice" },
            },
            {
              __typename: "Greeting",
              message: "Hello again",
              recipient: { __typename: "Person", name: "Bob" },
            },
          ],
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("suspends queries with deferred fragments in lists and properly merges arrays", async () => {
    const query = gql`
      query DeferVariation {
        allProducts {
          delivery {
            ...MyFragment @defer
          }
          sku
          id
        }
      }

      fragment MyFragment on DeliveryEstimates {
        estimatedDelivery
        fastestDelivery
      }
    `;

    const link = new MockSubscriptionLink();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query),
      { link }
    );

    expect(renders.suspenseCount).toBe(1);

    link.simulateResult({
      result: {
        data: {
          allProducts: [
            {
              __typename: "Product",
              delivery: {
                __typename: "DeliveryEstimates",
              },
              id: "apollo-federation",
              sku: "federation",
            },
            {
              __typename: "Product",
              delivery: {
                __typename: "DeliveryEstimates",
              },
              id: "apollo-studio",
              sku: "studio",
            },
          ],
        },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          allProducts: [
            {
              __typename: "Product",
              delivery: {
                __typename: "DeliveryEstimates",
              },
              id: "apollo-federation",
              sku: "federation",
            },
            {
              __typename: "Product",
              delivery: {
                __typename: "DeliveryEstimates",
              },
              id: "apollo-studio",
              sku: "studio",
            },
          ],
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    link.simulateResult({
      result: {
        hasNext: true,
        incremental: [
          {
            data: {
              __typename: "DeliveryEstimates",
              estimatedDelivery: "6/25/2021",
              fastestDelivery: "6/24/2021",
            },
            path: ["allProducts", 0, "delivery"],
          },
          {
            data: {
              __typename: "DeliveryEstimates",
              estimatedDelivery: "6/25/2021",
              fastestDelivery: "6/24/2021",
            },
            path: ["allProducts", 1, "delivery"],
          },
        ],
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          allProducts: [
            {
              __typename: "Product",
              delivery: {
                __typename: "DeliveryEstimates",
                estimatedDelivery: "6/25/2021",
                fastestDelivery: "6/24/2021",
              },
              id: "apollo-federation",
              sku: "federation",
            },
            {
              __typename: "Product",
              delivery: {
                __typename: "DeliveryEstimates",
                estimatedDelivery: "6/25/2021",
                fastestDelivery: "6/24/2021",
              },
              id: "apollo-studio",
              sku: "studio",
            },
          ],
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });
  });

  it("incrementally rerenders data returned by a `refetch` for a deferred query", async () => {
    const query = gql`
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

    const cache = new InMemoryCache();
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({ link, cache });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query),
      { client }
    );

    link.simulateResult({
      result: {
        data: { greeting: { __typename: "Greeting", message: "Hello world" } },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    link.simulateResult(
      {
        result: {
          incremental: [
            {
              data: {
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

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            recipient: {
              __typename: "Person",
              name: "Alice",
            },
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    let refetchPromise: Promise<ApolloQueryResult<unknown>>;
    act(() => {
      refetchPromise = result.current.refetch();
    });

    link.simulateResult({
      result: {
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Goodbye",
          },
        },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Goodbye",
            recipient: {
              __typename: "Person",
              name: "Alice",
            },
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    link.simulateResult(
      {
        result: {
          incremental: [
            {
              data: {
                recipient: { name: "Bob", __typename: "Person" },
              },
              path: ["greeting"],
            },
          ],
          hasNext: false,
        },
      },
      true
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Goodbye",
            recipient: {
              __typename: "Person",
              name: "Bob",
            },
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    await expect(refetchPromise!).resolves.toEqual({
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Goodbye",
          recipient: {
            __typename: "Person",
            name: "Bob",
          },
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });

    expect(renders.count).toBe(6);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toMatchObject([
      {
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
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
            recipient: {
              __typename: "Person",
              name: "Alice",
            },
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Goodbye",
            recipient: {
              __typename: "Person",
              name: "Alice",
            },
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Goodbye",
            recipient: {
              __typename: "Person",
              name: "Bob",
            },
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("incrementally renders data returned after skipping a deferred query", async () => {
    const query = gql`
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

    const cache = new InMemoryCache();
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({ link, cache });

    const { result, rerender, renders } = renderSuspenseHook(
      ({ skip }) => useSuspenseQuery(query, { skip }),
      { client, initialProps: { skip: true } }
    );

    expect(result.current).toMatchObject({
      data: undefined,
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });

    rerender({ skip: false });

    expect(renders.suspenseCount).toBe(1);

    link.simulateResult({
      result: {
        data: { greeting: { __typename: "Greeting", message: "Hello world" } },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    link.simulateResult(
      {
        result: {
          incremental: [
            {
              data: {
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

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            recipient: {
              __typename: "Person",
              name: "Alice",
            },
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(4);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      { data: undefined, networkStatus: NetworkStatus.ready, error: undefined },
      {
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
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
            recipient: {
              __typename: "Person",
              name: "Alice",
            },
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  // TODO: This test is a bit of a lie. `fetchMore` should incrementally
  // rerender when using `@defer` but there is currently a bug in the core
  // implementation that prevents updates until the final result is returned.
  // This test reflects the behavior as it exists today, but will need
  // to be updated once the core bug is fixed.
  //
  // NOTE: A duplicate it.failng test has been added right below this one with
  // the expected behavior added in (i.e. the commented code in this test). Once
  // the core bug is fixed, this test can be removed in favor of the other test.
  //
  // https://github.com/apollographql/apollo-client/issues/11034
  it("rerenders data returned by `fetchMore` for a deferred query", async () => {
    const query = gql`
      query ($offset: Int) {
        greetings(offset: $offset) {
          message
          ... @defer {
            recipient {
              name
            }
          }
        }
      }
    `;

    const cache = new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            greetings: offsetLimitPagination(),
          },
        },
      },
    });
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({ link, cache });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { variables: { offset: 0 } }),
      { client }
    );

    link.simulateResult({
      result: {
        data: {
          greetings: [{ __typename: "Greeting", message: "Hello world" }],
        },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          greetings: [
            {
              __typename: "Greeting",
              message: "Hello world",
            },
          ],
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    link.simulateResult(
      {
        result: {
          incremental: [
            {
              data: {
                recipient: { name: "Alice", __typename: "Person" },
              },
              path: ["greetings", 0],
            },
          ],
          hasNext: false,
        },
      },
      true
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          greetings: [
            {
              __typename: "Greeting",
              message: "Hello world",
              recipient: {
                __typename: "Person",
                name: "Alice",
              },
            },
          ],
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    let fetchMorePromise: Promise<ApolloQueryResult<unknown>>;
    act(() => {
      fetchMorePromise = result.current.fetchMore({ variables: { offset: 1 } });
    });

    link.simulateResult({
      result: {
        data: {
          greetings: [
            {
              __typename: "Greeting",
              message: "Goodbye",
            },
          ],
        },
        hasNext: true,
      },
    });

    // TODO: Re-enable once the core bug is fixed
    // await waitFor(() => {
    //   expect(result.current).toMatchObject({
    //     data: {
    //       greetings: [
    //         {
    //           __typename: 'Greeting',
    //           message: 'Hello world',
    //           recipient: {
    //             __typename: 'Person',
    //             name: 'Alice',
    //           },
    //         },
    //         {
    //           __typename: 'Greeting',
    //           message: 'Goodbye',
    //         },
    //       ],
    //     },
    //     networkStatus: NetworkStatus.ready,
    //     error: undefined,
    //   });
    // });

    link.simulateResult(
      {
        result: {
          incremental: [
            {
              data: {
                recipient: { name: "Bob", __typename: "Person" },
              },
              path: ["greetings", 0],
            },
          ],
          hasNext: false,
        },
      },
      true
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          greetings: [
            {
              __typename: "Greeting",
              message: "Hello world",
              recipient: {
                __typename: "Person",
                name: "Alice",
              },
            },
            {
              __typename: "Greeting",
              message: "Goodbye",
              recipient: {
                __typename: "Person",
                name: "Bob",
              },
            },
          ],
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    await expect(fetchMorePromise!).resolves.toEqual({
      data: {
        greetings: [
          {
            __typename: "Greeting",
            message: "Goodbye",
            recipient: {
              __typename: "Person",
              name: "Bob",
            },
          },
        ],
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });

    expect(renders.count).toBe(5);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toMatchObject([
      {
        data: {
          greetings: [
            {
              __typename: "Greeting",
              message: "Hello world",
            },
          ],
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: {
          greetings: [
            {
              __typename: "Greeting",
              message: "Hello world",
              recipient: {
                __typename: "Person",
                name: "Alice",
              },
            },
          ],
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      // TODO: Re-enable when the core `fetchMore` bug is fixed
      // {
      //   data: {
      //     greetings: [
      //       {
      //         __typename: 'Greeting',
      //         message: 'Hello world',
      //         recipient: {
      //           __typename: 'Person',
      //           name: 'Alice',
      //         },
      //       },
      //       {
      //         __typename: 'Greeting',
      //         message: 'Goodbye',
      //       },
      //     ],
      //   },
      //   networkStatus: NetworkStatus.ready,
      //   error: undefined,
      // },
      {
        data: {
          greetings: [
            {
              __typename: "Greeting",
              message: "Hello world",
              recipient: {
                __typename: "Person",
                name: "Alice",
              },
            },
            {
              __typename: "Greeting",
              message: "Goodbye",
              recipient: {
                __typename: "Person",
                name: "Bob",
              },
            },
          ],
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  // TODO: This is a duplicate of the test above, but with the expected behavior
  // added (hence the `it.failing`). Remove the previous test once issue #11034
  // is fixed.
  //
  // https://github.com/apollographql/apollo-client/issues/11034
  it.failing(
    "incrementally rerenders data returned by a `fetchMore` for a deferred query",
    async () => {
      const query = gql`
        query ($offset: Int) {
          greetings(offset: $offset) {
            message
            ... @defer {
              recipient {
                name
              }
            }
          }
        }
      `;

      const cache = new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              greetings: offsetLimitPagination(),
            },
          },
        },
      });
      const link = new MockSubscriptionLink();
      const client = new ApolloClient({ link, cache });

      const { result, renders } = renderSuspenseHook(
        () => useSuspenseQuery(query, { variables: { offset: 0 } }),
        { client }
      );

      link.simulateResult({
        result: {
          data: {
            greetings: [{ __typename: "Greeting", message: "Hello world" }],
          },
          hasNext: true,
        },
      });

      await waitFor(() => {
        expect(result.current).toMatchObject({
          data: {
            greetings: [
              {
                __typename: "Greeting",
                message: "Hello world",
              },
            ],
          },
          networkStatus: NetworkStatus.ready,
          error: undefined,
        });
      });

      link.simulateResult(
        {
          result: {
            incremental: [
              {
                data: {
                  recipient: { name: "Alice", __typename: "Person" },
                },
                path: ["greetings", 0],
              },
            ],
            hasNext: false,
          },
        },
        true
      );

      await waitFor(() => {
        expect(result.current).toMatchObject({
          data: {
            greetings: [
              {
                __typename: "Greeting",
                message: "Hello world",
                recipient: {
                  __typename: "Person",
                  name: "Alice",
                },
              },
            ],
          },
          networkStatus: NetworkStatus.ready,
          error: undefined,
        });
      });

      let fetchMorePromise: Promise<ApolloQueryResult<unknown>>;
      act(() => {
        fetchMorePromise = result.current.fetchMore({
          variables: { offset: 1 },
        });
      });

      link.simulateResult({
        result: {
          data: {
            greetings: [
              {
                __typename: "Greeting",
                message: "Goodbye",
              },
            ],
          },
          hasNext: true,
        },
      });

      await waitFor(() => {
        expect(result.current).toMatchObject({
          data: {
            greetings: [
              {
                __typename: "Greeting",
                message: "Hello world",
                recipient: {
                  __typename: "Person",
                  name: "Alice",
                },
              },
              {
                __typename: "Greeting",
                message: "Goodbye",
              },
            ],
          },
          networkStatus: NetworkStatus.ready,
          error: undefined,
        });
      });

      link.simulateResult(
        {
          result: {
            incremental: [
              {
                data: {
                  recipient: { name: "Bob", __typename: "Person" },
                },
                path: ["greetings", 0],
              },
            ],
            hasNext: false,
          },
        },
        true
      );

      await waitFor(() => {
        expect(result.current).toMatchObject({
          data: {
            greetings: [
              {
                __typename: "Greeting",
                message: "Hello world",
                recipient: {
                  __typename: "Person",
                  name: "Alice",
                },
              },
              {
                __typename: "Greeting",
                message: "Goodbye",
                recipient: {
                  __typename: "Person",
                  name: "Bob",
                },
              },
            ],
          },
          networkStatus: NetworkStatus.ready,
          error: undefined,
        });
      });

      await expect(fetchMorePromise!).resolves.toEqual({
        data: {
          greetings: [
            {
              __typename: "Greeting",
              message: "Goodbye",
              recipient: {
                __typename: "Person",
                name: "Bob",
              },
            },
          ],
        },
        loading: false,
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });

      expect(renders.count).toBe(5);
      expect(renders.suspenseCount).toBe(2);
      expect(renders.frames).toMatchObject([
        {
          data: {
            greetings: [
              {
                __typename: "Greeting",
                message: "Hello world",
              },
            ],
          },
          networkStatus: NetworkStatus.ready,
          error: undefined,
        },
        {
          data: {
            greetings: [
              {
                __typename: "Greeting",
                message: "Hello world",
                recipient: {
                  __typename: "Person",
                  name: "Alice",
                },
              },
            ],
          },
          networkStatus: NetworkStatus.ready,
          error: undefined,
        },
        {
          data: {
            greetings: [
              {
                __typename: "Greeting",
                message: "Hello world",
                recipient: {
                  __typename: "Person",
                  name: "Alice",
                },
              },
              {
                __typename: "Greeting",
                message: "Goodbye",
              },
            ],
          },
          networkStatus: NetworkStatus.ready,
          error: undefined,
        },
        {
          data: {
            greetings: [
              {
                __typename: "Greeting",
                message: "Hello world",
                recipient: {
                  __typename: "Person",
                  name: "Alice",
                },
              },
              {
                __typename: "Greeting",
                message: "Goodbye",
                recipient: {
                  __typename: "Person",
                  name: "Bob",
                },
              },
            ],
          },
          networkStatus: NetworkStatus.ready,
          error: undefined,
        },
      ]);
    }
  );

  it("throws network errors returned by deferred queries", async () => {
    using _consoleSpy = spyOnConsole("error");

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

    const { renders } = renderSuspenseHook(() => useSuspenseQuery(query), {
      link,
    });

    link.simulateResult({
      error: new Error("Could not fetch"),
    });

    await waitFor(() => expect(renders.errorCount).toBe(1));

    expect(renders.errors.length).toBe(1);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([]);

    const [error] = renders.errors as ApolloError[];

    expect(error).toBeInstanceOf(ApolloError);
    expect(error.networkError).toEqual(new Error("Could not fetch"));
    expect(error.graphQLErrors).toEqual([]);
  });

  it("throws graphql errors returned by deferred queries", async () => {
    using _consoleSpy = spyOnConsole("error");

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

    const { renders } = renderSuspenseHook(() => useSuspenseQuery(query), {
      link,
    });

    link.simulateResult({
      result: {
        errors: [new GraphQLError("Could not fetch greeting")],
      },
    });

    await waitFor(() => expect(renders.errorCount).toBe(1));

    expect(renders.errors.length).toBe(1);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([]);

    const [error] = renders.errors as ApolloError[];

    expect(error).toBeInstanceOf(ApolloError);
    expect(error.networkError).toBeNull();
    expect(error.graphQLErrors).toEqual([
      new GraphQLError("Could not fetch greeting"),
    ]);
  });

  it("throws errors returned by deferred queries that include partial data", async () => {
    using _consoleSpy = spyOnConsole("error");

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

    const { renders } = renderSuspenseHook(() => useSuspenseQuery(query), {
      link,
    });

    link.simulateResult({
      result: {
        data: { greeting: null },
        errors: [new GraphQLError("Could not fetch greeting")],
      },
    });

    await waitFor(() => expect(renders.errorCount).toBe(1));

    expect(renders.errors.length).toBe(1);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toEqual([]);

    const [error] = renders.errors as ApolloError[];

    expect(error).toBeInstanceOf(ApolloError);
    expect(error.networkError).toBeNull();
    expect(error.graphQLErrors).toEqual([
      new GraphQLError("Could not fetch greeting"),
    ]);
  });

  it("discards partial data and throws errors returned in incremental chunks", async () => {
    using _consoleSpy = spyOnConsole("error");

    const query = gql`
      query {
        hero {
          name
          heroFriends {
            id
            name
            ... @defer {
              homeWorld
            }
          }
        }
      }
    `;

    const link = new MockSubscriptionLink();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query),
      { link }
    );

    link.simulateResult({
      result: {
        data: {
          hero: {
            name: "R2-D2",
            heroFriends: [
              {
                id: "1000",
                name: "Luke Skywalker",
              },
              {
                id: "1003",
                name: "Leia Organa",
              },
            ],
          },
        },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          hero: {
            heroFriends: [
              {
                id: "1000",
                name: "Luke Skywalker",
              },
              {
                id: "1003",
                name: "Leia Organa",
              },
            ],
            name: "R2-D2",
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    link.simulateResult({
      result: {
        incremental: [
          {
            path: ["hero", "heroFriends", 0],
            errors: [
              new GraphQLError(
                "homeWorld for character with ID 1000 could not be fetched.",
                { path: ["hero", "heroFriends", 0, "homeWorld"] }
              ),
            ],
            data: {
              homeWorld: null,
            },
          },
          // This chunk is ignored since errorPolicy `none` throws away partial
          // data
          {
            path: ["hero", "heroFriends", 1],
            data: {
              homeWorld: "Alderaan",
            },
          },
        ],
        hasNext: false,
      },
    });

    await waitFor(() => {
      expect(renders.errorCount).toBe(1);
    });

    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        data: {
          hero: {
            heroFriends: [
              {
                id: "1000",
                name: "Luke Skywalker",
              },
              {
                id: "1003",
                name: "Leia Organa",
              },
            ],
            name: "R2-D2",
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);

    const [error] = renders.errors as ApolloError[];

    expect(error).toBeInstanceOf(ApolloError);
    expect(error.networkError).toBeNull();
    expect(error.graphQLErrors).toEqual([
      new GraphQLError(
        "homeWorld for character with ID 1000 could not be fetched.",
        { path: ["hero", "heroFriends", 0, "homeWorld"] }
      ),
    ]);
  });

  it("adds partial data and does not throw errors returned in incremental chunks but returns them in `error` property with errorPolicy set to `all`", async () => {
    const query = gql`
      query {
        hero {
          name
          heroFriends {
            id
            name
            ... @defer {
              homeWorld
            }
          }
        }
      }
    `;

    const link = new MockSubscriptionLink();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: "all" }),
      { link }
    );

    link.simulateResult({
      result: {
        data: {
          hero: {
            name: "R2-D2",
            heroFriends: [
              {
                id: "1000",
                name: "Luke Skywalker",
              },
              {
                id: "1003",
                name: "Leia Organa",
              },
            ],
          },
        },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          hero: {
            heroFriends: [
              {
                id: "1000",
                name: "Luke Skywalker",
              },
              {
                id: "1003",
                name: "Leia Organa",
              },
            ],
            name: "R2-D2",
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    link.simulateResult({
      result: {
        incremental: [
          {
            path: ["hero", "heroFriends", 0],
            errors: [
              new GraphQLError(
                "homeWorld for character with ID 1000 could not be fetched.",
                { path: ["hero", "heroFriends", 0, "homeWorld"] }
              ),
            ],
            data: {
              homeWorld: null,
            },
          },
          // Unlike the default (errorPolicy = `none`), this data will be
          // added to the final result
          {
            path: ["hero", "heroFriends", 1],
            data: {
              homeWorld: "Alderaan",
            },
          },
        ],
        hasNext: false,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          hero: {
            heroFriends: [
              {
                id: "1000",
                name: "Luke Skywalker",
                homeWorld: null,
              },
              {
                id: "1003",
                name: "Leia Organa",
                homeWorld: "Alderaan",
              },
            ],
            name: "R2-D2",
          },
        },
        networkStatus: NetworkStatus.error,
        error: new ApolloError({
          graphQLErrors: [
            new GraphQLError(
              "homeWorld for character with ID 1000 could not be fetched.",
              { path: ["hero", "heroFriends", 0, "homeWorld"] }
            ),
          ],
        }),
      });
    });

    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        data: {
          hero: {
            heroFriends: [
              {
                id: "1000",
                name: "Luke Skywalker",
              },
              {
                id: "1003",
                name: "Leia Organa",
              },
            ],
            name: "R2-D2",
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: {
          hero: {
            heroFriends: [
              {
                id: "1000",
                name: "Luke Skywalker",
                homeWorld: null,
              },
              {
                id: "1003",
                name: "Leia Organa",
                homeWorld: "Alderaan",
              },
            ],
            name: "R2-D2",
          },
        },
        networkStatus: NetworkStatus.error,
        error: new ApolloError({
          graphQLErrors: [
            new GraphQLError(
              "homeWorld for character with ID 1000 could not be fetched.",
              { path: ["hero", "heroFriends", 0, "homeWorld"] }
            ),
          ],
        }),
      },
    ]);
  });

  it("adds partial data and discards errors returned in incremental chunks with errorPolicy set to `ignore`", async () => {
    const query = gql`
      query {
        hero {
          name
          heroFriends {
            id
            name
            ... @defer {
              homeWorld
            }
          }
        }
      }
    `;

    const link = new MockSubscriptionLink();

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: "ignore" }),
      { link }
    );

    link.simulateResult({
      result: {
        data: {
          hero: {
            name: "R2-D2",
            heroFriends: [
              {
                id: "1000",
                name: "Luke Skywalker",
              },
              {
                id: "1003",
                name: "Leia Organa",
              },
            ],
          },
        },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          hero: {
            heroFriends: [
              {
                id: "1000",
                name: "Luke Skywalker",
              },
              {
                id: "1003",
                name: "Leia Organa",
              },
            ],
            name: "R2-D2",
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    link.simulateResult({
      result: {
        incremental: [
          {
            path: ["hero", "heroFriends", 0],
            errors: [
              new GraphQLError(
                "homeWorld for character with ID 1000 could not be fetched.",
                { path: ["hero", "heroFriends", 0, "homeWorld"] }
              ),
            ],
            data: {
              homeWorld: null,
            },
          },
          {
            path: ["hero", "heroFriends", 1],
            data: {
              homeWorld: "Alderaan",
            },
          },
        ],
        hasNext: false,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          hero: {
            heroFriends: [
              {
                id: "1000",
                name: "Luke Skywalker",
                homeWorld: null,
              },
              {
                id: "1003",
                name: "Leia Organa",
                homeWorld: "Alderaan",
              },
            ],
            name: "R2-D2",
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(3);
    expect(renders.suspenseCount).toBe(1);
    expect(renders.frames).toMatchObject([
      {
        data: {
          hero: {
            heroFriends: [
              {
                id: "1000",
                name: "Luke Skywalker",
              },
              {
                id: "1003",
                name: "Leia Organa",
              },
            ],
            name: "R2-D2",
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: {
          hero: {
            heroFriends: [
              {
                id: "1000",
                name: "Luke Skywalker",
                homeWorld: null,
              },
              {
                id: "1003",
                name: "Leia Organa",
                homeWorld: "Alderaan",
              },
            ],
            name: "R2-D2",
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("can refetch and respond to cache updates after encountering an error in an incremental chunk for a deferred query when `errorPolicy` is `all`", async () => {
    const query = gql`
      query {
        hero {
          name
          heroFriends {
            id
            name
            ... @defer {
              homeWorld
            }
          }
        }
      }
    `;

    const cache = new InMemoryCache();
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({ link, cache });

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: "all" }),
      { client }
    );

    link.simulateResult({
      result: {
        data: {
          hero: {
            name: "R2-D2",
            heroFriends: [
              { id: "1000", name: "Luke Skywalker" },
              { id: "1003", name: "Leia Organa" },
            ],
          },
        },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          hero: {
            heroFriends: [
              { id: "1000", name: "Luke Skywalker" },
              { id: "1003", name: "Leia Organa" },
            ],
            name: "R2-D2",
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    link.simulateResult(
      {
        result: {
          incremental: [
            {
              path: ["hero", "heroFriends", 0],
              errors: [
                new GraphQLError(
                  "homeWorld for character with ID 1000 could not be fetched.",
                  { path: ["hero", "heroFriends", 0, "homeWorld"] }
                ),
              ],
              data: {
                homeWorld: null,
              },
            },
            {
              path: ["hero", "heroFriends", 1],
              data: {
                homeWorld: "Alderaan",
              },
            },
          ],
          hasNext: false,
        },
      },
      true
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          hero: {
            heroFriends: [
              { id: "1000", name: "Luke Skywalker" },
              { id: "1003", name: "Leia Organa" },
            ],
            name: "R2-D2",
          },
        },
        networkStatus: NetworkStatus.error,
        error: new ApolloError({
          graphQLErrors: [
            new GraphQLError(
              "homeWorld for character with ID 1000 could not be fetched.",
              { path: ["hero", "heroFriends", 0, "homeWorld"] }
            ),
          ],
        }),
      });
    });

    let refetchPromise: Promise<ApolloQueryResult<unknown>>;
    act(() => {
      refetchPromise = result.current.refetch();
    });

    link.simulateResult({
      result: {
        data: {
          hero: {
            name: "R2-D2",
            heroFriends: [
              { id: "1000", name: "Luke Skywalker" },
              { id: "1003", name: "Leia Organa" },
            ],
          },
        },
        hasNext: true,
      },
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          hero: {
            heroFriends: [
              { id: "1000", name: "Luke Skywalker" },
              { id: "1003", name: "Leia Organa" },
            ],
            name: "R2-D2",
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    link.simulateResult(
      {
        result: {
          incremental: [
            {
              path: ["hero", "heroFriends", 0],
              data: {
                homeWorld: "Alderaan",
              },
            },
            {
              path: ["hero", "heroFriends", 1],
              data: {
                homeWorld: "Alderaan",
              },
            },
          ],
          hasNext: false,
        },
      },
      true
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          hero: {
            heroFriends: [
              { id: "1000", name: "Luke Skywalker", homeWorld: "Alderaan" },
              { id: "1003", name: "Leia Organa", homeWorld: "Alderaan" },
            ],
            name: "R2-D2",
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    await expect(refetchPromise!).resolves.toEqual({
      data: {
        hero: {
          heroFriends: [
            { id: "1000", name: "Luke Skywalker", homeWorld: "Alderaan" },
            { id: "1003", name: "Leia Organa", homeWorld: "Alderaan" },
          ],
          name: "R2-D2",
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });

    cache.updateQuery({ query }, (data) => ({
      hero: {
        ...data.hero,
        name: "C3PO",
      },
    }));

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          hero: {
            heroFriends: [
              { id: "1000", name: "Luke Skywalker", homeWorld: "Alderaan" },
              { id: "1003", name: "Leia Organa", homeWorld: "Alderaan" },
            ],
            name: "C3PO",
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      });
    });

    expect(renders.count).toBe(7);
    expect(renders.suspenseCount).toBe(2);
    expect(renders.frames).toMatchObject([
      {
        data: {
          hero: {
            heroFriends: [
              { id: "1000", name: "Luke Skywalker" },
              { id: "1003", name: "Leia Organa" },
            ],
            name: "R2-D2",
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: {
          hero: {
            heroFriends: [
              { id: "1000", name: "Luke Skywalker" },
              { id: "1003", name: "Leia Organa" },
            ],
            name: "R2-D2",
          },
        },
        networkStatus: NetworkStatus.error,
        error: new ApolloError({
          graphQLErrors: [
            new GraphQLError(
              "homeWorld for character with ID 1000 could not be fetched.",
              { path: ["hero", "heroFriends", 0, "homeWorld"] }
            ),
          ],
        }),
      },
      {
        data: {
          hero: {
            heroFriends: [
              { id: "1000", name: "Luke Skywalker" },
              { id: "1003", name: "Leia Organa" },
            ],
            name: "R2-D2",
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: {
          hero: {
            heroFriends: [
              { id: "1000", name: "Luke Skywalker", homeWorld: "Alderaan" },
              { id: "1003", name: "Leia Organa", homeWorld: "Alderaan" },
            ],
            name: "R2-D2",
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
      {
        data: {
          hero: {
            heroFriends: [
              { id: "1000", name: "Luke Skywalker", homeWorld: "Alderaan" },
              { id: "1003", name: "Leia Organa", homeWorld: "Alderaan" },
            ],
            name: "C3PO",
          },
        },
        networkStatus: NetworkStatus.ready,
        error: undefined,
      },
    ]);
  });

  it("can subscribe to subscriptions and react to cache updates via `subscribeToMore`", async () => {
    interface SubscriptionData {
      greetingUpdated: string;
    }

    interface QueryData {
      greeting: string;
    }

    type UpdateQueryFn = NonNullable<
      SubscribeToMoreOptions<
        QueryData | undefined,
        OperationVariables,
        SubscriptionData
      >["updateQuery"]
    >;

    const { mocks, query } = useSimpleQueryCase();

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

    const { result, renders } = renderSuspenseHook(
      () => useSuspenseQuery(query, { errorPolicy: "ignore" }),
      { link }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual({ greeting: "Hello" });
    });

    const updateQuery = jest.fn<
      ReturnType<UpdateQueryFn>,
      Parameters<UpdateQueryFn>
    >((_, { subscriptionData: { data } }) => {
      return { greeting: data.greetingUpdated };
    });

    result.current.subscribeToMore<SubscriptionData>({
      document: gql`
        subscription {
          greetingUpdated
        }
      `,
      updateQuery,
    });

    wsLink.simulateResult({
      result: {
        data: {
          greetingUpdated: "Subscription hello",
        },
      },
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({
        greeting: "Subscription hello",
      });
    });

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

    expect(renders.count).toBe(3);
    expect(renders.frames).toMatchObject([
      { data: { greeting: "Hello" }, networkStatus: NetworkStatus.ready },
      {
        data: { greeting: "Subscription hello" },
        networkStatus: NetworkStatus.ready,
      },
    ]);
  });

  it("works with useDeferredValue", async () => {
    const user = userEvent.setup();

    interface Variables {
      query: string;
    }

    interface Data {
      search: { query: string };
    }

    const QUERY: TypedDocumentNode<Data, Variables> = gql`
      query SearchQuery($query: String!) {
        search(query: $query) {
          query
        }
      }
    `;

    const link = new ApolloLink(({ variables }) => {
      return new Observable((observer) => {
        setTimeout(() => {
          observer.next({
            data: { search: { query: variables.query } },
          });
          observer.complete();
        }, 10);
      });
    });

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    function App() {
      const [query, setValue] = React.useState("");
      const deferredQuery = React.useDeferredValue(query);

      return (
        <ApolloProvider client={client}>
          <label htmlFor="searchInput">Search</label>
          <input
            id="searchInput"
            type="text"
            value={query}
            onChange={(e) => setValue(e.target.value)}
          />
          <Suspense fallback={<SuspenseFallback />}>
            <Results query={deferredQuery} />
          </Suspense>
        </ApolloProvider>
      );
    }

    function SuspenseFallback() {
      return <p>Loading</p>;
    }

    function Results({ query }: { query: string }) {
      const { data } = useSuspenseQuery(QUERY, { variables: { query } });

      return <div data-testid="result">{data.search.query}</div>;
    }

    render(<App />);

    const input = screen.getByLabelText("Search");

    expect(screen.getByText("Loading")).toBeInTheDocument();

    expect(await screen.findByTestId("result")).toBeInTheDocument();

    await act(() => user.type(input, "ab"));

    await waitFor(
      () => {
        expect(screen.getByTestId("result")).toHaveTextContent("ab");
      },
      {
        timeout: 10000,
      }
    );

    await act(() => user.type(input, "c"));

    // useDeferredValue will try rerendering the component with the new value
    // in the background. If it suspends with the new value, React will show the
    // stale UI until the component is done suspending.
    //
    // Here we should not see the suspense fallback while the component suspends
    // until the search finishes loading. Seeing the suspense fallback is an
    // indication that we are suspending the component too late in the process.
    expect(screen.queryByText("Loading")).not.toBeInTheDocument();
    expect(screen.getByTestId("result")).toHaveTextContent("ab");

    // Eventually we should see the updated text content once its done
    // suspending.
    await waitFor(() => {
      expect(screen.getByTestId("result")).toHaveTextContent("abc");
    });
  }, 10000);

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
          data: { todo: { id: "2", name: "Take out trash", completed: true } },
        },
        delay: 10,
      },
    ];

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache: new InMemoryCache(),
    });

    function App() {
      const [id, setId] = React.useState("1");

      return (
        <ApolloProvider client={client}>
          <Suspense fallback={<SuspenseFallback />}>
            <Todo id={id} onChange={setId} />
          </Suspense>
        </ApolloProvider>
      );
    }

    function SuspenseFallback() {
      return <p>Loading</p>;
    }

    function Todo({
      id,
      onChange,
    }: {
      id: string;
      onChange: (id: string) => void;
    }) {
      const { data } = useSuspenseQuery(query, { variables: { id } });
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

    const { takeRender } = renderToRenderStream(<App />, {
      snapshotDOM: true,
    });

    {
      const { withinDOM } = await takeRender();
      expect(withinDOM().getByText("Loading")).toBeInTheDocument();
    }

    {
      const { withinDOM } = await takeRender();

      const todo = withinDOM().getByTestId("todo");
      expect(todo).toBeInTheDocument();
      expect(todo).toHaveTextContent("Clean room");
    }

    await act(() => user.click(screen.getByText("Refresh")));

    // startTransition will avoid rendering the suspense fallback for already
    // revealed content if the state update inside the transition causes the
    // component to suspend.
    //
    // Here we should not see the suspense fallback while the component suspends
    // until the todo is finished loading. Seeing the suspense fallback is an
    // indication that we are suspending the component too late in the process.
    {
      const { withinDOM } = await takeRender();
      const todo = withinDOM().getByTestId("todo");

      expect(withinDOM().queryByText("Loading")).not.toBeInTheDocument();

      // We can ensure this works with isPending from useTransition in the process
      expect(todo).toHaveAttribute("aria-busy", "true");

      // Ensure we are showing the stale UI until the new todo has loaded
      expect(todo).toHaveTextContent("Clean room");
    }

    // Eventually we should see the updated todo content once its done
    // suspending.
    {
      const { withinDOM } = await takeRender();
      const todo = withinDOM().getByTestId("todo");
      expect(todo).toHaveTextContent("Take out trash (completed)");
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

    const client = new ApolloClient({
      link: new MockLink(mocks),
      cache: new InMemoryCache(),
    });

    function App() {
      return (
        <ApolloProvider client={client}>
          <Suspense fallback={<SuspenseFallback />}>
            <Todo id="1" />
          </Suspense>
        </ApolloProvider>
      );
    }

    function SuspenseFallback() {
      return <p>Loading</p>;
    }

    function Todo({ id }: { id: string }) {
      const { data, refetch } = useSuspenseQuery(query, { variables: { id } });
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
            <Todos />
          </Suspense>
        </ApolloProvider>
      );
    }

    function SuspenseFallback() {
      return <p>Loading</p>;
    }

    function Todos() {
      const { data, fetchMore } = useSuspenseQuery(query, {
        variables: { offset: 0 },
      });
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

  it("updates networkStatus when a network request returns the same cached data with 'cache-and-network' fetchPolicy", async () => {
    const { query } = useSimpleQueryCase();

    const link = new ApolloLink(() => {
      return new Observable((observer) => {
        setTimeout(() => {
          observer.next({ data: { greeting: "Hello" } });
          observer.complete();
        }, 10);
      });
    });

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    // preloaded cache
    await client.writeQuery({ query, data: { greeting: "Hello" } });

    const { result } = renderSuspenseHook(
      () =>
        useSuspenseQuery(query, {
          fetchPolicy: "cache-and-network",
        }),
      { client }
    );

    await waitFor(() => {
      // We should see the cached greeting while the network request is in flight
      // and the network status should be set to `loading`.
      expect(result.current).toMatchObject({
        data: { greeting: "Hello" },
        networkStatus: NetworkStatus.loading,
      });
    });

    await waitFor(() => {
      // We should see the updated greeting once the network request finishes
      // and the network status should be set to `ready`.
      expect(result.current).toMatchObject({
        data: { greeting: "Hello" },
        networkStatus: NetworkStatus.ready,
      });
    });
  });

  // https://github.com/apollographql/apollo-client/issues/11315
  it("fetchMore does not cause extra render", async () => {
    const { query, link } = setupPaginatedCase();

    const user = userEvent.setup();
    const client = new ApolloClient({
      cache: new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              letters: offsetLimitPagination(),
            },
          },
        },
      }),
      link,
    });

    const renderStream = createRenderStream({
      initialSnapshot: {
        result: null as UseSuspenseQueryResult<
          PaginatedCaseData,
          PaginatedCaseVariables
        > | null,
      },
    });

    function SuspenseFallback() {
      useTrackRenders();

      return <div>Loading...</div>;
    }

    function App() {
      useTrackRenders();
      const [isPending, startTransition] = useTransition();
      const result = useSuspenseQuery(query, {
        variables: { offset: 0, limit: 2 },
      });
      const { data, fetchMore } = result;

      renderStream.mergeSnapshot({ result });

      return (
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(() => {
              fetchMore({
                variables: {
                  offset: data.letters.length,
                  limit: data.letters.length + 1,
                },
              });
            })
          }
        >
          Fetch next
        </button>
      );
    }

    renderStream.render(
      <Suspense fallback={<SuspenseFallback />}>
        <App />
      </Suspense>,
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([SuspenseFallback]);
    }

    {
      const { snapshot, renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App]);
      expect(snapshot.result?.data).toEqual({
        letters: [
          { __typename: "Letter", letter: "A", position: 1 },
          { __typename: "Letter", letter: "B", position: 2 },
        ],
      });
    }

    await act(() => user.click(screen.getByText("Fetch next")));

    {
      const { snapshot, renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App]);
      expect(screen.getByText("Fetch next")).toBeDisabled();
      expect(snapshot.result?.data).toEqual({
        letters: [
          { __typename: "Letter", letter: "A", position: 1 },
          { __typename: "Letter", letter: "B", position: 2 },
        ],
      });
    }

    {
      const { snapshot, renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App]);
      expect(snapshot.result?.data).toEqual({
        letters: [
          { __typename: "Letter", letter: "A", position: 1 },
          { __typename: "Letter", letter: "B", position: 2 },
          { __typename: "Letter", letter: "C", position: 3 },
          { __typename: "Letter", letter: "D", position: 4 },
          { __typename: "Letter", letter: "E", position: 5 },
        ],
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

    const renderStream = createRenderStream({
      initialSnapshot: {
        isPending: false,
        result: null as Pick<
          UseSuspenseQueryResult<Data>,
          "data" | "error" | "networkStatus"
        > | null,
      },
    });

    function SuspenseFallback() {
      useTrackRenders();

      return <div>Loading...</div>;
    }

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
      const { data, error, networkStatus, fetchMore } = useSuspenseQuery(
        query,
        {
          variables: { offset: 0 },
        }
      );

      renderStream.mergeSnapshot({
        isPending,
        result: { data, error, networkStatus },
      });

      return (
        <button
          onClick={() => {
            startTransition(() => {
              fetchMore({ variables: { offset: 1 } });
            });
          }}
        >
          Load more
        </button>
      );
    }

    renderStream.render(
      <Suspense fallback={<SuspenseFallback />}>
        <App />
      </Suspense>,
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    {
      const { renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([SuspenseFallback]);
    }

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot).toEqual({
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
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }

    await act(() => user.click(screen.getByText("Load more")));

    {
      const { snapshot, renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App]);
      expect(snapshot).toEqual({
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
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }

    {
      const { snapshot, renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App]);
      expect(snapshot).toEqual({
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
          error: undefined,
          networkStatus: NetworkStatus.ready,
        },
      });
    }

    await expect(renderStream).not.toRerender();
  });

  // https://github.com/apollographql/apollo-client/issues/11642
  it("returns merged array when `fetchMore` returns empty array of results", async () => {
    const query: TypedDocumentNode<PaginatedCaseData, PaginatedCaseVariables> =
      gql`
        query LettersQuery($limit: Int, $offset: Int) {
          letters(limit: $limit, offset: $offset) {
            letter
            position
          }
        }
      `;

    const data = "ABCD".split("").map((letter, index) => ({
      __typename: "Letter",
      letter,
      position: index + 1,
    }));

    const link = new MockLink([
      {
        request: { query, variables: { offset: 0, limit: 2 } },
        result: { data: { letters: data.slice(0, 2) } },
        delay: 20,
      },
      {
        request: { query, variables: { offset: 2, limit: 2 } },
        result: { data: { letters: data.slice(2, 4) } },
        delay: 20,
      },
      {
        request: { query, variables: { offset: 4, limit: 2 } },
        result: { data: { letters: [] } },
        delay: 20,
      },
    ]);

    const user = userEvent.setup();
    const client = new ApolloClient({
      cache: new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              letters: offsetLimitPagination(),
            },
          },
        },
      }),
      link,
    });

    const renderStream = createRenderStream({
      initialSnapshot: {
        result: null as UseSuspenseQueryResult<
          PaginatedCaseData,
          PaginatedCaseVariables
        > | null,
      },
    });

    function App() {
      useTrackRenders();
      const result = useSuspenseQuery(query, {
        variables: { offset: 0, limit: 2 },
      });
      const { data, fetchMore } = result;

      renderStream.mergeSnapshot({ result });

      return (
        <button
          onClick={() =>
            fetchMore({
              variables: {
                offset: data.letters.length,
                limit: 2,
              },
            })
          }
        >
          Fetch next
        </button>
      );
    }

    renderStream.render(
      <Suspense fallback={<div>Loading...</div>}>
        <App />
      </Suspense>,
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    // initial suspended render
    await renderStream.takeRender();

    {
      const { snapshot, renderedComponents } = await renderStream.takeRender();

      expect(renderedComponents).toStrictEqual([App]);
      expect(snapshot.result?.data).toEqual({
        letters: [
          { __typename: "Letter", letter: "A", position: 1 },
          { __typename: "Letter", letter: "B", position: 2 },
        ],
      });
    }

    await act(() => user.click(screen.getByText("Fetch next")));
    await renderStream.takeRender();

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result?.data).toEqual({
        letters: [
          { __typename: "Letter", letter: "A", position: 1 },
          { __typename: "Letter", letter: "B", position: 2 },
          { __typename: "Letter", letter: "C", position: 3 },
          { __typename: "Letter", letter: "D", position: 4 },
        ],
      });
    }

    await act(() => user.click(screen.getByText("Fetch next")));
    await renderStream.takeRender();

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result?.data).toEqual({
        letters: [
          { __typename: "Letter", letter: "A", position: 1 },
          { __typename: "Letter", letter: "B", position: 2 },
          { __typename: "Letter", letter: "C", position: 3 },
          { __typename: "Letter", letter: "D", position: 4 },
        ],
      });
    }

    await expect(renderStream).not.toRerender();
  });

  describe.skip("type tests", () => {
    it("returns unknown when TData cannot be inferred", () => {
      const query = gql`
        query {
          hello
        }
      `;

      const { data } = useSuspenseQuery(query);

      expectTypeOf(data).toEqualTypeOf<unknown>();
    });

    it("disallows wider variables type than specified", () => {
      const { query } = useVariablesQueryCase();

      // @ts-expect-error should not allow wider TVariables type
      useSuspenseQuery(query, { variables: { id: "1", foo: "bar" } });
    });

    it("returns TData in default case", () => {
      const { query } = useVariablesQueryCase();

      const { data: inferred } = useSuspenseQuery(query);

      expectTypeOf(inferred).toEqualTypeOf<VariablesCaseData>();
      expectTypeOf(inferred).not.toEqualTypeOf<VariablesCaseData | undefined>();

      const { data: explicit } = useSuspenseQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query);

      expectTypeOf(explicit).toEqualTypeOf<VariablesCaseData>();
      expectTypeOf(explicit).not.toEqualTypeOf<VariablesCaseData | undefined>();
    });

    it('returns TData | undefined with errorPolicy: "ignore"', () => {
      const { query } = useVariablesQueryCase();

      const { data: inferred } = useSuspenseQuery(query, {
        errorPolicy: "ignore",
      });

      expectTypeOf(inferred).toEqualTypeOf<VariablesCaseData | undefined>();
      expectTypeOf(inferred).not.toEqualTypeOf<VariablesCaseData>();

      const { data: explicit } = useSuspenseQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, {
        errorPolicy: "ignore",
      });

      expectTypeOf(explicit).toEqualTypeOf<VariablesCaseData | undefined>();
      expectTypeOf(explicit).not.toEqualTypeOf<VariablesCaseData>();
    });

    it('returns TData | undefined with errorPolicy: "all"', () => {
      const { query } = useVariablesQueryCase();

      const { data: inferred } = useSuspenseQuery(query, {
        errorPolicy: "all",
      });

      expectTypeOf(inferred).toEqualTypeOf<VariablesCaseData | undefined>();
      expectTypeOf(inferred).not.toEqualTypeOf<VariablesCaseData>();

      const { data: explicit } = useSuspenseQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, {
        errorPolicy: "all",
      });

      expectTypeOf(explicit).toEqualTypeOf<VariablesCaseData | undefined>();
      expectTypeOf(explicit).not.toEqualTypeOf<VariablesCaseData>();
    });

    it('returns TData with errorPolicy: "none"', () => {
      const { query } = useVariablesQueryCase();

      const { data: inferred } = useSuspenseQuery(query, {
        errorPolicy: "none",
      });

      expectTypeOf(inferred).toEqualTypeOf<VariablesCaseData>();
      expectTypeOf(inferred).not.toEqualTypeOf<VariablesCaseData | undefined>();

      const { data: explicit } = useSuspenseQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, {
        errorPolicy: "none",
      });

      expectTypeOf(explicit).toEqualTypeOf<VariablesCaseData>();
      expectTypeOf(explicit).not.toEqualTypeOf<VariablesCaseData | undefined>();
    });

    it("returns DeepPartial<TData> with returnPartialData: true", () => {
      const { query } = useVariablesQueryCase();

      const { data: inferred } = useSuspenseQuery(query, {
        returnPartialData: true,
      });

      expectTypeOf(inferred).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
      expectTypeOf(inferred).not.toEqualTypeOf<VariablesCaseData>();

      const { data: explicit } = useSuspenseQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, {
        returnPartialData: true,
      });

      expectTypeOf(explicit).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
      expectTypeOf(explicit).not.toEqualTypeOf<VariablesCaseData>();
    });

    it("returns TData with returnPartialData: false", () => {
      const { query } = useVariablesQueryCase();

      const { data: inferred } = useSuspenseQuery(query, {
        returnPartialData: false,
      });

      expectTypeOf(inferred).toEqualTypeOf<VariablesCaseData>();
      expectTypeOf(inferred).not.toEqualTypeOf<
        DeepPartial<VariablesCaseData>
      >();

      const { data: explicit } = useSuspenseQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, {
        returnPartialData: false,
      });

      expectTypeOf(explicit).toEqualTypeOf<VariablesCaseData>();
      expectTypeOf(explicit).not.toEqualTypeOf<
        DeepPartial<VariablesCaseData>
      >();
    });

    it("returns TData | undefined when skip is present", () => {
      const { query } = useVariablesQueryCase();

      const { data: inferred } = useSuspenseQuery(query, {
        skip: true,
      });

      expectTypeOf(inferred).toEqualTypeOf<VariablesCaseData | undefined>();
      expectTypeOf(inferred).not.toEqualTypeOf<VariablesCaseData>();

      const { data: explicit } = useSuspenseQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, {
        skip: true,
      });

      expectTypeOf(explicit).toEqualTypeOf<VariablesCaseData | undefined>();
      expectTypeOf(explicit).not.toEqualTypeOf<VariablesCaseData>();

      // TypeScript is too smart and using a `const` or `let` boolean variable
      // for the `skip` option results in a false positive. Using an options
      // object allows us to properly check for a dynamic case.
      const options = {
        skip: true,
      };

      const { data: dynamic } = useSuspenseQuery(query, {
        skip: options.skip,
      });

      expectTypeOf(dynamic).toEqualTypeOf<VariablesCaseData | undefined>();
      expectTypeOf(dynamic).not.toEqualTypeOf<VariablesCaseData>();
    });

    it("returns TData | undefined when using `skipToken` as options", () => {
      const { query } = useVariablesQueryCase();
      const options = {
        skip: true,
      };

      const { data: inferred } = useSuspenseQuery(
        query,
        options.skip ? skipToken : { variables: { id: "1" } }
      );

      expectTypeOf(inferred).toEqualTypeOf<VariablesCaseData | undefined>();
      expectTypeOf(inferred).not.toEqualTypeOf<VariablesCaseData>();

      const { data: explicit } = useSuspenseQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, options.skip ? skipToken : { variables: { id: "1" } });

      expectTypeOf(explicit).toEqualTypeOf<VariablesCaseData | undefined>();
      expectTypeOf(explicit).not.toEqualTypeOf<VariablesCaseData>();
    });

    it("returns TData | undefined when using `skipToken` with undefined options", () => {
      const { query } = useVariablesQueryCase();
      const options = {
        skip: true,
      };

      const { data: inferred } = useSuspenseQuery(
        query,
        options.skip ? skipToken : undefined
      );

      expectTypeOf(inferred).toEqualTypeOf<VariablesCaseData | undefined>();
      expectTypeOf(inferred).not.toEqualTypeOf<VariablesCaseData>();

      const { data: explicit } = useSuspenseQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, options.skip ? skipToken : undefined);

      expectTypeOf(explicit).toEqualTypeOf<VariablesCaseData | undefined>();
      expectTypeOf(explicit).not.toEqualTypeOf<VariablesCaseData>();
    });

    it("returns DeepPartial<TData> | undefined when using `skipToken` as options with `returnPartialData`", () => {
      const { query } = useVariablesQueryCase();
      const options = {
        skip: true,
      };

      const { data: inferred } = useSuspenseQuery(
        query,
        options.skip ? skipToken : { returnPartialData: true }
      );

      expectTypeOf(inferred).toEqualTypeOf<
        DeepPartial<VariablesCaseData> | undefined
      >();
      expectTypeOf(inferred).not.toEqualTypeOf<VariablesCaseData>();

      const { data: explicit } = useSuspenseQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, options.skip ? skipToken : { returnPartialData: true });

      expectTypeOf(explicit).toEqualTypeOf<
        DeepPartial<VariablesCaseData> | undefined
      >();
      expectTypeOf(explicit).not.toEqualTypeOf<VariablesCaseData>();
    });

    it("returns TData when passing an option that does not affect TData", () => {
      const { query } = useVariablesQueryCase();

      const { data: inferred } = useSuspenseQuery(query, {
        fetchPolicy: "no-cache",
      });

      expectTypeOf(inferred).toEqualTypeOf<VariablesCaseData>();
      expectTypeOf(inferred).not.toEqualTypeOf<
        DeepPartial<VariablesCaseData>
      >();

      const { data: explicit } = useSuspenseQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, {
        fetchPolicy: "no-cache",
      });

      expectTypeOf(explicit).toEqualTypeOf<VariablesCaseData>();
      expectTypeOf(explicit).not.toEqualTypeOf<
        DeepPartial<VariablesCaseData>
      >();
    });

    it("handles combinations of options", () => {
      // TypeScript is too smart and using a `const` or `let` boolean variable
      // for the `skip` option results in a false positive. Using an options
      // object allows us to properly check for a dynamic case which is the
      // typical usage of this option.
      const options = {
        skip: true,
      };

      const { query } = useVariablesQueryCase();

      const { data: inferredPartialDataIgnore } = useSuspenseQuery(query, {
        returnPartialData: true,
        errorPolicy: "ignore",
      });

      expectTypeOf(inferredPartialDataIgnore).toEqualTypeOf<
        DeepPartial<VariablesCaseData> | undefined
      >();
      expectTypeOf(
        inferredPartialDataIgnore
      ).not.toEqualTypeOf<VariablesCaseData>();

      const { data: explicitPartialDataIgnore } = useSuspenseQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, {
        returnPartialData: true,
        errorPolicy: "ignore",
      });

      expectTypeOf(explicitPartialDataIgnore).toEqualTypeOf<
        DeepPartial<VariablesCaseData> | undefined
      >();
      expectTypeOf(
        explicitPartialDataIgnore
      ).not.toEqualTypeOf<VariablesCaseData>();

      const { data: inferredPartialDataNone } = useSuspenseQuery(query, {
        returnPartialData: true,
        errorPolicy: "none",
      });

      expectTypeOf(inferredPartialDataNone).toEqualTypeOf<
        DeepPartial<VariablesCaseData>
      >();
      expectTypeOf(
        inferredPartialDataNone
      ).not.toEqualTypeOf<VariablesCaseData>();

      const { data: explicitPartialDataNone } = useSuspenseQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, {
        returnPartialData: true,
        errorPolicy: "none",
      });

      expectTypeOf(explicitPartialDataNone).toEqualTypeOf<
        DeepPartial<VariablesCaseData>
      >();
      expectTypeOf(
        explicitPartialDataNone
      ).not.toEqualTypeOf<VariablesCaseData>();

      const { data: inferredSkipIgnore } = useSuspenseQuery(query, {
        skip: options.skip,
        errorPolicy: "ignore",
      });

      expectTypeOf(inferredSkipIgnore).toEqualTypeOf<
        VariablesCaseData | undefined
      >();
      expectTypeOf(
        inferredPartialDataIgnore
      ).not.toEqualTypeOf<VariablesCaseData>();

      const { data: explicitSkipIgnore } = useSuspenseQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, {
        skip: options.skip,
        errorPolicy: "ignore",
      });

      expectTypeOf(explicitSkipIgnore).toEqualTypeOf<
        VariablesCaseData | undefined
      >();
      expectTypeOf(explicitSkipIgnore).not.toEqualTypeOf<VariablesCaseData>();

      const { data: inferredSkipNone } = useSuspenseQuery(query, {
        skip: options.skip,
        errorPolicy: "none",
      });

      expectTypeOf(inferredSkipNone).toEqualTypeOf<
        VariablesCaseData | undefined
      >();
      expectTypeOf(inferredSkipNone).not.toEqualTypeOf<VariablesCaseData>();

      const { data: explicitSkipNone } = useSuspenseQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, {
        skip: options.skip,
        errorPolicy: "none",
      });

      expectTypeOf(explicitSkipNone).toEqualTypeOf<
        VariablesCaseData | undefined
      >();
      expectTypeOf(explicitSkipNone).not.toEqualTypeOf<VariablesCaseData>();

      const { data: inferredPartialDataNoneSkip } = useSuspenseQuery(query, {
        skip: options.skip,
        returnPartialData: true,
        errorPolicy: "none",
      });

      expectTypeOf(inferredPartialDataNoneSkip).toEqualTypeOf<
        DeepPartial<VariablesCaseData> | undefined
      >();
      expectTypeOf(
        inferredPartialDataNoneSkip
      ).not.toEqualTypeOf<VariablesCaseData>();

      const { data: explicitPartialDataNoneSkip } = useSuspenseQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, {
        skip: options.skip,
        returnPartialData: true,
        errorPolicy: "none",
      });

      expectTypeOf(explicitPartialDataNoneSkip).toEqualTypeOf<
        DeepPartial<VariablesCaseData> | undefined
      >();
      expectTypeOf(
        explicitPartialDataNoneSkip
      ).not.toEqualTypeOf<VariablesCaseData>();
    });

    it("returns correct TData type when combined options that do not affect TData", () => {
      const { query } = useVariablesQueryCase();

      const { data: inferred } = useSuspenseQuery(query, {
        fetchPolicy: "no-cache",
        returnPartialData: true,
        errorPolicy: "none",
      });

      expectTypeOf(inferred).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
      expectTypeOf(inferred).not.toEqualTypeOf<VariablesCaseData>();

      const { data: explicit } = useSuspenseQuery<
        VariablesCaseData,
        VariablesCaseVariables
      >(query, {
        fetchPolicy: "no-cache",
        returnPartialData: true,
        errorPolicy: "none",
      });

      expectTypeOf(explicit).toEqualTypeOf<DeepPartial<VariablesCaseData>>();
      expectTypeOf(explicit).not.toEqualTypeOf<VariablesCaseData>();
    });
  });
});
