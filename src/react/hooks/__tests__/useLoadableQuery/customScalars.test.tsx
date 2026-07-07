import type { RenderOptions } from "@testing-library/react";
import { screen } from "@testing-library/react";
import {
  createRenderStream,
  disableActEnvironment,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import { userEvent } from "@testing-library/user-event";
import React, { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { delay, of } from "rxjs";

import type { DataState, ErrorLike, OperationVariables } from "@apollo/client";
import {
  ApolloClient,
  ApolloLink,
  CombinedGraphQLErrors,
  gql,
  NetworkStatus,
} from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import {
  Defer20220824Handler,
  GraphQL17Alpha9Handler,
} from "@apollo/client/incremental";
import type { QueryRef } from "@apollo/client/react";
import { useLoadableQuery, useReadQuery } from "@apollo/client/react";
import {
  createClientWrapper,
  dateScalar,
  markAsStreaming,
  mockDefer20220824,
  mockDeferStreamGraphQL17Alpha9,
  spyOnConsole,
} from "@apollo/client/testing/internal";
import { invariant } from "@apollo/client/utilities/invariant";

async function renderHook<
  TData,
  TVariables extends OperationVariables,
  TStates extends DataState<TData>["dataState"] = DataState<TData>["dataState"],
  Props = never,
>(
  renderHookImpl: (
    props: Props extends never ? undefined : Props
  ) => useLoadableQuery.Result<TData, TVariables, TStates>,
  options: Pick<RenderOptions, "wrapper"> & { initialProps?: Props }
) {
  function UseReadQuery({
    queryRef,
  }: {
    queryRef: QueryRef<TData, TVariables, TStates>;
  }) {
    useTrackRenders({ name: "useReadQuery" });
    mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function SuspenseFallback() {
    useTrackRenders({ name: "<Suspense />" });

    return null;
  }

  function ErrorFallback() {
    useTrackRenders({ name: "<ErrorBoundary />" });

    return null;
  }

  function App({ props }: { props: Props | undefined }) {
    useTrackRenders({ name: "useLoadableQuery" });
    const [loadQuery, queryRef] = renderHookImpl(props as any);

    mergeSnapshot({ loadQuery });

    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onError={(error) => replaceSnapshot({ error })}
        >
          {queryRef && <UseReadQuery queryRef={queryRef} />}
        </ErrorBoundary>
      </Suspense>
    );
  }

  const {
    render,
    getCurrentRender,
    takeRender,
    mergeSnapshot,
    replaceSnapshot,
  } = createRenderStream<
    | {
        loadQuery: useLoadableQuery.LoadQueryFunction<TVariables>;
        result?: useReadQuery.Result<TData, TStates>;
      }
    | { error: ErrorLike }
  >({ initialSnapshot: { loadQuery: null as any } });

  const utils = await render(<App props={options.initialProps} />, options);

  function rerender(props: Props) {
    return utils.rerender(<App props={props} />);
  }

  function getCurrentSnapshot() {
    const { snapshot } = getCurrentRender();
    invariant(
      "loadQuery" in snapshot,
      "Expected rendered hook instead of error boundary"
    );

    return snapshot;
  }

  return { takeRender, rerender, getCurrentSnapshot };
}

test("serializes scalar variables used in field arguments", async () => {
  let requestVariables!: OperationVariables;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
    }),
    link: new ApolloLink((operation) => {
      requestVariables = operation.variables;

      return of({
        data: { event: { __typename: "Event", name: "GraphQL Summit" } },
      }).pipe(delay(20));
    }),
  });

  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as useReadQuery.Result<any> | null,
    },
    skipNonTrackingRenders: true,
  });

  const query = gql`
    query Event($date: Date!) {
      event(date: $date) {
        name
      }
    }
  `;

  function ReadQuery({ queryRef }: { queryRef: QueryRef }) {
    useTrackRenders({ name: "useReadQuery" });
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function Fallback() {
    useTrackRenders({ name: "<Suspense />" });
    return null;
  }

  function App() {
    useTrackRenders({ name: "useLoadableQuery" });
    const [loadQuery, queryRef] = useLoadableQuery(query);

    return (
      <>
        <button onClick={() => loadQuery({ date: new Date(2026, 0, 1) })}>
          Load query
        </button>
        <Suspense fallback={<Fallback />}>
          {queryRef && <ReadQuery queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  const user = userEvent.setup();
  await renderStream.render(<App />, {
    wrapper: createClientWrapper(client),
  });

  await expect(renderStream.takeRender()).resolves.toMatchObject({
    renderedComponents: ["useLoadableQuery"],
  });

  await user.click(screen.getByText("Load query"));

  await expect(renderStream.takeRender()).resolves.toMatchObject({
    renderedComponents: ["useLoadableQuery", "<Suspense />"],
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          name: "GraphQL Summit",
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(renderStream).not.toRerender();
  expect(requestVariables).toStrictEqualTyped({ date: "2026-01-01" });
});

test("serializes scalar variables used in directive arguments", async () => {
  let requestVariables!: OperationVariables;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
    }),
    link: new ApolloLink((operation) => {
      requestVariables = operation.variables;

      return of({
        data: { event: { __typename: "Event", name: "GraphQL Summit" } },
      }).pipe(delay(20));
    }),
  });

  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as useReadQuery.Result<any> | null,
    },
    skipNonTrackingRenders: true,
  });

  const query = gql`
    query Event($date: Date!) {
      event @on(date: $date) {
        name
      }
    }
  `;

  function ReadQuery({ queryRef }: { queryRef: QueryRef }) {
    useTrackRenders({ name: "useReadQuery" });
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function Fallback() {
    useTrackRenders({ name: "<Suspense />" });
    return null;
  }

  function App() {
    useTrackRenders({ name: "useLoadableQuery" });
    const [loadQuery, queryRef] = useLoadableQuery(query);

    return (
      <>
        <button onClick={() => loadQuery({ date: new Date(2026, 0, 1) })}>
          Load query
        </button>
        <Suspense fallback={<Fallback />}>
          {queryRef && <ReadQuery queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  const user = userEvent.setup();
  await renderStream.render(<App />, {
    wrapper: createClientWrapper(client),
  });

  await expect(renderStream.takeRender()).resolves.toMatchObject({
    renderedComponents: ["useLoadableQuery"],
  });

  await user.click(screen.getByText("Load query"));

  await expect(renderStream.takeRender()).resolves.toMatchObject({
    renderedComponents: ["useLoadableQuery", "<Suspense />"],
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          name: "GraphQL Summit",
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(renderStream).not.toRerender();
  expect(requestVariables).toStrictEqualTyped({ date: "2026-01-01" });
});

test("serializes scalar fields in input object variables", async () => {
  let requestVariables!: OperationVariables;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      inputObjects: {
        EventFilter: {
          fields: {
            date: "Date",
          },
        },
      },
    }),
    link: new ApolloLink((operation) => {
      requestVariables = operation.variables;

      return of({
        data: { event: { __typename: "Event", name: "GraphQL Summit" } },
      }).pipe(delay(20));
    }),
  });

  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as useReadQuery.Result<any> | null,
    },
    skipNonTrackingRenders: true,
  });

  const query = gql`
    query Event($filter: EventFilter!) {
      event(filter: $filter) {
        name
      }
    }
  `;

  function ReadQuery({ queryRef }: { queryRef: QueryRef }) {
    useTrackRenders({ name: "useReadQuery" });
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function Fallback() {
    useTrackRenders({ name: "<Suspense />" });
    return null;
  }

  function App() {
    useTrackRenders({ name: "useLoadableQuery" });
    const [loadQuery, queryRef] = useLoadableQuery(query);

    return (
      <>
        <button
          onClick={() => loadQuery({ filter: { date: new Date(2026, 0, 1) } })}
        >
          Load query
        </button>
        <Suspense fallback={<Fallback />}>
          {queryRef && <ReadQuery queryRef={queryRef} />}
        </Suspense>
      </>
    );
  }

  using _disabledAct = disableActEnvironment();
  const user = userEvent.setup();
  await renderStream.render(<App />, {
    wrapper: createClientWrapper(client),
  });

  await expect(renderStream.takeRender()).resolves.toMatchObject({
    renderedComponents: ["useLoadableQuery"],
  });

  await user.click(screen.getByText("Load query"));

  await expect(renderStream.takeRender()).resolves.toMatchObject({
    renderedComponents: ["useLoadableQuery", "<Suspense />"],
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          name: "GraphQL Summit",
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(renderStream).not.toRerender();
  expect(requestVariables).toStrictEqualTyped({
    filter: { date: "2026-01-01" },
  });
});

test("preserves referential identity when refetching identical serialized scalar values", async () => {
  const query = gql`
    query Event {
      event {
        id
        startDate
      }
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
          },
        },
      },
    }),
    link: new ApolloLink(() =>
      of({
        data: {
          event: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
          },
        },
      }).pipe(delay(20))
    ),
  });

  let refetch!: useLoadableQuery.Result["2"]["refetch"];

  using _disabledAct = disableActEnvironment();
  const { takeRender, getCurrentSnapshot } = await renderHook(
    () => {
      const result = useLoadableQuery(query);
      refetch = result[2].refetch;
      return result;
    },
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useLoadableQuery"]);
  }

  getCurrentSnapshot().loadQuery();

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([
      "useLoadableQuery",
      "<Suspense />",
    ]);
  }

  let previousData: unknown;
  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });

    previousData = snapshot.result!.data;
  }

  await expect(refetch()).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
  });

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([
      "useLoadableQuery",
      "<Suspense />",
    ]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });

    expect(snapshot.result!.data).toBe(previousData);
  }

  await expect(takeRender).not.toRerender();
});

test("serializes scalar fields in the error with a `none` error policy", async () => {
  using _consoleSpy = spyOnConsole("error");
  const query = gql`
    query Event {
      event {
        id
        startDate
        endDate
      }
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
            endDate: { scalar: "Date" },
          },
        },
      },
    }),
    link: new ApolloLink(() =>
      of({
        data: {
          event: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
            endDate: null,
          },
        },
        errors: [
          {
            message: "Could not resolve endDate",
            path: ["event", "endDate"],
          },
        ],
      }).pipe(delay(20))
    ),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender, getCurrentSnapshot } = await renderHook(
    () => useLoadableQuery(query, { errorPolicy: "none" }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useLoadableQuery"]);
  }

  getCurrentSnapshot().loadQuery();

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([
      "useLoadableQuery",
      "<Suspense />",
    ]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["<ErrorBoundary />"]);
    expect(snapshot).toStrictEqualTyped({
      error: new CombinedGraphQLErrors({
        data: {
          event: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
            endDate: null,
          },
        },
        errors: [
          {
            message: "Could not resolve endDate",
            path: ["event", "endDate"],
          },
        ],
      }),
    });
  }

  await expect(takeRender).not.toRerender();
});

test("parses scalar fields in the result and serializes them in the error with an `all` error policy", async () => {
  const query = gql`
    query Event {
      event {
        id
        startDate
        endDate
      }
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
            endDate: { scalar: "Date" },
          },
        },
      },
    }),
    link: new ApolloLink(() =>
      of({
        data: {
          event: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
            endDate: null,
          },
        },
        errors: [
          {
            message: "Could not resolve endDate",
            path: ["event", "endDate"],
          },
        ],
      }).pipe(delay(20))
    ),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender, getCurrentSnapshot } = await renderHook(
    () => useLoadableQuery(query, { errorPolicy: "all" }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useLoadableQuery"]);
  }

  getCurrentSnapshot().loadQuery();

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([
      "useLoadableQuery",
      "<Suspense />",
    ]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
          endDate: null,
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.error,
      error: new CombinedGraphQLErrors({
        data: {
          event: {
            __typename: "Event",
            id: "1",
            // TODO: Determine if this is correct
            startDate: new Date(2026, 0, 1),
            endDate: null,
          },
        },
        errors: [
          {
            message: "Could not resolve endDate",
            path: ["event", "endDate"],
          },
        ],
      }),
    });
  }

  await expect(takeRender).not.toRerender();
});

test("parses custom scalar fields with an `ignore` error policy", async () => {
  const query = gql`
    query Event {
      event {
        id
        startDate
        endDate
      }
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
            endDate: { scalar: "Date" },
          },
        },
      },
    }),
    link: new ApolloLink(() =>
      of({
        data: {
          event: {
            __typename: "Event",
            id: "1",
            startDate: "2026-01-01",
            endDate: null,
          },
        },
        errors: [
          {
            message: "Could not resolve endDate",
            path: ["event", "endDate"],
          },
        ],
      }).pipe(delay(20))
    ),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender, getCurrentSnapshot } = await renderHook(
    () => useLoadableQuery(query, { errorPolicy: "ignore" }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useLoadableQuery"]);
  }

  getCurrentSnapshot().loadQuery();

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([
      "useLoadableQuery",
      "<Suspense />",
    ]);
  }

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
          endDate: null,
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(takeRender).not.toRerender();
});

test("parses custom scalar fields across `@defer` payloads (defer20220824)", async () => {
  const link = mockDefer20220824();
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
            endDate: { scalar: "Date" },
          },
        },
      },
    }),
    link: link.httpLink,
    incrementalHandler: new Defer20220824Handler(),
  });
  const query = gql`
    query Event {
      event {
        id
        startDate
        ... @defer {
          endDate
        }
      }
    }
  `;

  using _disabledAct = disableActEnvironment();
  const { takeRender, getCurrentSnapshot } = await renderHook(
    () => useLoadableQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useLoadableQuery"]);
  }

  getCurrentSnapshot().loadQuery();

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([
      "useLoadableQuery",
      "<Suspense />",
    ]);
  }

  link.enqueueInitialChunk({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: "2026-01-01",
      },
    },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: markAsStreaming({
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  link.enqueueSubsequentChunk({
    incremental: [{ data: { endDate: "2026-02-02" }, path: ["event"] }],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
          endDate: new Date(2026, 1, 2),
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(takeRender).not.toRerender();
});

test("parses custom scalar fields across `@defer` payloads (graphql17Alpha9)", async () => {
  const link = mockDeferStreamGraphQL17Alpha9();
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
            endDate: { scalar: "Date" },
          },
        },
      },
    }),
    link: link.httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });
  const query = gql`
    query Event {
      event {
        id
        startDate
        ... @defer {
          endDate
        }
      }
    }
  `;

  using _disabledAct = disableActEnvironment();
  const { takeRender, getCurrentSnapshot } = await renderHook(
    () => useLoadableQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useLoadableQuery"]);
  }

  getCurrentSnapshot().loadQuery();

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([
      "useLoadableQuery",
      "<Suspense />",
    ]);
  }

  link.enqueueInitialChunk({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: "2026-01-01",
      },
    },
    pending: [{ id: "0", path: ["event"] }],
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: markAsStreaming({
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
        },
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  link.enqueueSubsequentChunk({
    incremental: [{ data: { endDate: "2026-02-02" }, id: "0" }],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          id: "1",
          startDate: new Date(2026, 0, 1),
          endDate: new Date(2026, 1, 2),
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(takeRender).not.toRerender();
});

test("parses custom scalar fields across `@stream` payloads (defer20220824)", async () => {
  const link = mockDefer20220824();
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
          },
        },
      },
    }),
    link: link.httpLink,
    incrementalHandler: new Defer20220824Handler(),
  });
  const query = gql`
    query Events {
      events @stream(initialCount: 1) {
        id
        startDate
      }
    }
  `;

  using _disabledAct = disableActEnvironment();
  const { takeRender, getCurrentSnapshot } = await renderHook(
    () => useLoadableQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useLoadableQuery"]);
  }

  getCurrentSnapshot().loadQuery();

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([
      "useLoadableQuery",
      "<Suspense />",
    ]);
  }

  link.enqueueInitialChunk({
    data: {
      events: [
        {
          __typename: "Event",
          id: "1",
          startDate: "2026-01-01",
        },
      ],
    },
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: markAsStreaming({
        events: [
          {
            __typename: "Event",
            id: "1",
            startDate: new Date(2026, 0, 1),
          },
        ],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  link.enqueueSubsequentChunk({
    incremental: [
      {
        items: [
          {
            __typename: "Event",
            id: "2",
            startDate: "2026-02-02",
          },
        ] as any,
        path: ["events", 1],
      },
    ],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        events: [
          {
            __typename: "Event",
            id: "1",
            startDate: new Date(2026, 0, 1),
          },
          {
            __typename: "Event",
            id: "2",
            startDate: new Date(2026, 1, 2),
          },
        ],
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(takeRender).not.toRerender();
});

test("parses custom scalar fields across `@stream` payloads (graphql17Alpha9)", async () => {
  const link = mockDeferStreamGraphQL17Alpha9();
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
          },
        },
      },
    }),
    link: link.httpLink,
    incrementalHandler: new GraphQL17Alpha9Handler(),
  });
  const query = gql`
    query Events {
      events @stream(initialCount: 1) {
        id
        startDate
      }
    }
  `;

  using _disabledAct = disableActEnvironment();
  const { takeRender, getCurrentSnapshot } = await renderHook(
    () => useLoadableQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useLoadableQuery"]);
  }

  getCurrentSnapshot().loadQuery();

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([
      "useLoadableQuery",
      "<Suspense />",
    ]);
  }

  link.enqueueInitialChunk({
    data: {
      events: [
        {
          __typename: "Event",
          id: "1",
          startDate: "2026-01-01",
        },
      ],
    },
    pending: [{ id: "0", path: ["events"] }],
    hasNext: true,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: markAsStreaming({
        events: [
          {
            __typename: "Event",
            id: "1",
            startDate: new Date(2026, 0, 1),
          },
        ],
      }),
      dataState: "streaming",
      networkStatus: NetworkStatus.streaming,
      error: undefined,
    });
  }

  link.enqueueSubsequentChunk({
    incremental: [
      {
        items: [
          {
            __typename: "Event",
            id: "2",
            startDate: "2026-02-02",
          },
        ] as any,
        id: "0",
      },
    ],
    completed: [{ id: "0" }],
    hasNext: false,
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    invariant("result" in snapshot);
    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        events: [
          {
            __typename: "Event",
            id: "1",
            startDate: new Date(2026, 0, 1),
          },
          {
            __typename: "Event",
            id: "2",
            startDate: new Date(2026, 1, 2),
          },
        ],
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(takeRender).not.toRerender();
});
