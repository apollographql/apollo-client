import { screen } from "@testing-library/react";
import {
  createRenderStream,
  disableActEnvironment,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import { userEvent } from "@testing-library/user-event";
import { OperationTypeNode } from "graphql";
import React, { Suspense } from "react";
import { delay, of } from "rxjs";

import type { OperationVariables } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import {
  createQueryPreloader,
  useQueryRefHandlers,
  useReadQuery,
} from "@apollo/client/react";
import { MockSubscriptionLink } from "@apollo/client/testing";
import {
  createClientWrapper,
  dateScalar,
} from "@apollo/client/testing/internal";

test("serializes scalar variables passed to refetch", async () => {
  let requestVariables!: OperationVariables;
  let refetchPromise!: ReturnType<
    ReturnType<typeof useQueryRefHandlers>["refetch"]
  >;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
    }),
    link: new ApolloLink((operation) => {
      requestVariables = operation.variables;

      return of({
        data: {
          event: {
            __typename: "Event",
            name: `Event on ${operation.variables.date}`,
          },
        },
      }).pipe(delay(20));
    }),
  });

  const query = gql`
    query Event($date: Date!) {
      event(date: $date) {
        name
      }
    }
  `;

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, {
    variables: { date: "2025-01-01" },
  });
  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as useReadQuery.Result<any> | null,
    },
  });

  function ReadQuery() {
    useTrackRenders({ name: "useReadQuery" });
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function Fallback() {
    useTrackRenders({ name: "<Suspense />" });
    return null;
  }

  function App() {
    useTrackRenders({ name: "useQueryRefHandlers" });
    const { refetch } = useQueryRefHandlers(queryRef);

    return (
      <>
        <button
          onClick={() => {
            refetchPromise = refetch({ date: new Date(2026, 0, 1) });
          }}
        >
          Refetch
        </button>
        <Suspense fallback={<Fallback />}>
          <ReadQuery />
        </Suspense>
      </>
    );
  }

  const user = userEvent.setup();
  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, {
    wrapper: createClientWrapper(client),
  });

  await expect(renderStream.takeRender()).resolves.toMatchObject({
    renderedComponents: ["useQueryRefHandlers", "<Suspense />"],
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          name: "Event on 2025-01-01",
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await user.click(screen.getByText("Refetch"));

  await expect(refetchPromise).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        name: "Event on 2026-01-01",
      },
    },
  });

  await expect(renderStream.takeRender()).resolves.toMatchObject({
    renderedComponents: ["useQueryRefHandlers", "<Suspense />"],
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          name: "Event on 2026-01-01",
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

test("serializes scalar variables passed to fetchMore", async () => {
  let requestVariables!: OperationVariables;
  let fetchMorePromise!: ReturnType<
    ReturnType<typeof useQueryRefHandlers>["fetchMore"]
  >;

  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
    }),
    link: new ApolloLink((operation) => {
      requestVariables = operation.variables;

      return of({
        data: {
          event: {
            __typename: "Event",
            name: `Event on ${operation.variables.date}`,
          },
        },
      }).pipe(delay(20));
    }),
  });

  const query = gql`
    query Event($date: Date!) {
      event(date: $date) {
        name
      }
    }
  `;

  const queryRef = createQueryPreloader(client)(query, {
    variables: { date: "2025-01-01" },
  });
  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as useReadQuery.Result<any> | null,
    },
  });

  function ReadQuery() {
    useTrackRenders({ name: "useReadQuery" });
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function Fallback() {
    useTrackRenders({ name: "<Suspense />" });
    return null;
  }

  function App() {
    useTrackRenders({ name: "useQueryRefHandlers" });
    const { fetchMore } = useQueryRefHandlers(queryRef);

    return (
      <>
        <button
          onClick={() => {
            fetchMorePromise = fetchMore({
              variables: { date: new Date(2026, 0, 1) },
              updateQuery: (_, { fetchMoreResult }) => fetchMoreResult,
            });
          }}
        >
          Fetch more
        </button>
        <Suspense fallback={<Fallback />}>
          <ReadQuery />
        </Suspense>
      </>
    );
  }

  const user = userEvent.setup();
  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, {
    wrapper: createClientWrapper(client),
  });

  await expect(renderStream.takeRender()).resolves.toMatchObject({
    renderedComponents: ["useQueryRefHandlers", "<Suspense />"],
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          name: "Event on 2025-01-01",
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await user.click(screen.getByText("Fetch more"));

  await expect(fetchMorePromise).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        name: "Event on 2026-01-01",
      },
    },
  });

  await expect(renderStream.takeRender()).resolves.toMatchObject({
    renderedComponents: ["useQueryRefHandlers", "<Suspense />"],
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          name: "Event on 2026-01-01",
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

test("serializes scalar variables passed to subscribeToMore", async () => {
  const subscriptionLink = new MockSubscriptionLink();
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
    }),
    link: ApolloLink.split(
      ({ operationType }) => operationType === OperationTypeNode.SUBSCRIPTION,
      subscriptionLink,
      new ApolloLink(() => {
        return of({
          data: {
            event: {
              __typename: "Event",
              name: "GraphQL Summit",
            },
          },
        }).pipe(delay(20));
      })
    ),
  });

  const query = gql`
    query Event {
      event {
        name
      }
    }
  `;
  const subscription = gql`
    subscription EventUpdated($date: Date!) {
      eventUpdated(date: $date) {
        name
      }
    }
  `;

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query);
  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as useReadQuery.Result<any> | null,
    },
  });

  function ReadQuery() {
    useTrackRenders({ name: "useReadQuery" });
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function Fallback() {
    useTrackRenders({ name: "<Suspense />" });
    return null;
  }

  function App() {
    useTrackRenders({ name: "useQueryRefHandlers" });
    const { subscribeToMore } = useQueryRefHandlers(queryRef);

    return (
      <>
        <button
          onClick={() =>
            subscribeToMore({
              document: subscription,
              variables: { date: new Date(2026, 0, 1) },
              updateQuery: (_, { subscriptionData }) => ({
                event: (subscriptionData.data as any).eventUpdated,
              }),
            })
          }
        >
          Subscribe
        </button>
        <Suspense fallback={<Fallback />}>
          <ReadQuery />
        </Suspense>
      </>
    );
  }

  const user = userEvent.setup();
  using _disabledAct = disableActEnvironment();
  await renderStream.render(<App />, {
    wrapper: createClientWrapper(client),
  });

  await expect(renderStream.takeRender()).resolves.toMatchObject({
    renderedComponents: ["useQueryRefHandlers", "<Suspense />"],
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

  await user.click(screen.getByText("Subscribe"));

  subscriptionLink.simulateResult({
    result: {
      data: {
        eventUpdated: {
          __typename: "Event",
          name: "Apollo Summit",
        },
      },
    },
  });

  {
    const { snapshot, renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: {
        event: {
          __typename: "Event",
          name: "Apollo Summit",
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(renderStream).not.toRerender();

  expect(subscriptionLink.operation?.variables).toStrictEqualTyped({
    date: "2026-01-01",
  });
});
