import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import {
  ApolloClient,
  InMemoryCache,
  NetworkStatus,
  TypedDocumentNode,
  gql,
} from "../../../core";
import { MockLink, MockedResponse } from "../../../testing";
import {
  SimpleCaseData,
  createProfiler,
  useSimpleCase,
  useTrackRenders,
} from "../../../testing/internal";
import { usePreloadedQueryHandlers } from "../usePreloadedQueryHandlers";
import { UseReadQueryResult, useReadQuery } from "../useReadQuery";
import { Suspense } from "react";
import { createQueryPreloader } from "../../query-preloader/createQueryPreloader";
import { ApolloProvider } from "../../context";
import userEvent from "@testing-library/user-event";

test("refetches and resuspends when calling refetch", async () => {
  const { query, mocks: defaultMocks } = useSimpleCase();

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

  const Profiler = createProfiler({
    initialSnapshot: {
      result: null as UseReadQueryResult<SimpleCaseData> | null,
    },
  });

  const preloadQuery = createQueryPreloader(client);
  const [queryRef, dispose] = preloadQuery(query);

  function SuspenseFallback() {
    useTrackRenders();
    return <p>Loading</p>;
  }

  function ReadQueryHook() {
    Profiler.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function App() {
    useTrackRenders();
    const { refetch } = usePreloadedQueryHandlers(queryRef);

    return (
      <>
        <button onClick={() => refetch()}>Refetch</button>
        <Suspense fallback={<SuspenseFallback />}>
          <ReadQueryHook />
        </Suspense>
      </>
    );
  }

  render(<App />, {
    wrapper: ({ children }) => {
      return (
        <ApolloProvider client={client}>
          <Profiler>{children}</Profiler>
        </ApolloProvider>
      );
    },
  });

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

  await act(() => user.click(screen.getByText("Refetch")));

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello again" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  dispose();
});

test("does not interfere with updates to the query from useReadQuery", async () => {
  const { query, mocks } = useSimpleCase();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  const Profiler = createProfiler({
    initialSnapshot: {
      result: null as UseReadQueryResult<SimpleCaseData> | null,
    },
  });

  const preloadQuery = createQueryPreloader(client);
  const [queryRef, dispose] = preloadQuery(query);

  function SuspenseFallback() {
    useTrackRenders();
    return <p>Loading</p>;
  }

  function ReadQueryHook() {
    useTrackRenders();
    Profiler.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function App() {
    useTrackRenders();
    // We can ignore the return result here since we are testing the mechanics
    // of this hook to ensure it doesn't interfere with the updates from
    // useReadQuery
    usePreloadedQueryHandlers(queryRef);

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook />
      </Suspense>
    );
  }

  const { rerender } = render(<App />, {
    wrapper: ({ children }) => {
      return (
        <ApolloProvider client={client}>
          <Profiler>{children}</Profiler>
        </ApolloProvider>
      );
    },
  });

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

  client.writeQuery({ query, data: { greeting: "Hello again" } });

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Hello again" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  rerender(<App />);

  {
    const { snapshot, renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, ReadQueryHook]);
    expect(snapshot.result).toEqual({
      data: { greeting: "Hello again" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  dispose();
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

  const preloadQuery = createQueryPreloader(client);
  const [queryRef, dispose] = preloadQuery(query, { variables: { id: "1" } });

  function App() {
    const { refetch } = usePreloadedQueryHandlers(queryRef);
    const [isPending, startTransition] = React.useTransition();

    return (
      <>
        <button
          disabled={isPending}
          onClick={() => {
            startTransition(() => {
              refetch();
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
    return <p>Loading</p>;
  }

  function Todo() {
    const { data } = useReadQuery(queryRef);
    const { todo } = data;

    return (
      <div data-testid="todo">
        {todo.name}
        {todo.completed && " (completed)"}
      </div>
    );
  }

  render(<App />);

  expect(screen.getByText("Loading")).toBeInTheDocument();

  const todo = await screen.findByTestId("todo");

  expect(todo).toBeInTheDocument();
  expect(todo).toHaveTextContent("Clean room");

  const button = screen.getByText("Refetch");
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

  // Ensure we are showing the stale UI until the new todo has loaded
  expect(todo).toHaveTextContent("Clean room");

  // Eventually we should see the updated todo content once its done
  // suspending.
  await waitFor(() => {
    expect(todo).toHaveTextContent("Clean room (completed)");
  });

  dispose();
});
