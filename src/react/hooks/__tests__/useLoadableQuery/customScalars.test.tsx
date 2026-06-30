import { screen } from "@testing-library/react";
import {
  createRenderStream,
  disableActEnvironment,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import { userEvent } from "@testing-library/user-event";
import React, { Suspense } from "react";
import { delay, of } from "rxjs";

import type { OperationVariables } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import type { QueryRef } from "@apollo/client/react";
import { useLoadableQuery, useReadQuery } from "@apollo/client/react";
import {
  createClientWrapper,
  dateScalar,
} from "@apollo/client/testing/internal";

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
