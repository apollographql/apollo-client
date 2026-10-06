import { disableActEnvironment } from "@testing-library/react-render-stream";
import { delay, of } from "rxjs";

import type { OperationVariables } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { useLoadableQuery } from "@apollo/client/react";
import {
  createClientWrapper,
  dateScalar,
} from "@apollo/client/testing/internal";
import { invariant } from "@apollo/client/utilities/invariant";

import { renderUseLoadableQueryHook } from "./testUtils.js";

test("serializes parsed scalar values in variables", async () => {
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

  const query = gql`
    query Event($date: Date!) {
      event(date: $date) {
        name
      }
    }
  `;

  using _disabledAct = disableActEnvironment();
  const { takeRender, loadQuery } = await renderUseLoadableQueryHook(
    () => useLoadableQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useLoadableQuery"]);
  }

  loadQuery({ date: new Date(2026, 0, 1) });

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
          name: "GraphQL Summit",
        },
      },
      dataState: "complete",
      networkStatus: NetworkStatus.ready,
      error: undefined,
    });
  }

  await expect(takeRender).not.toRerender();
  expect(requestVariables).toStrictEqualTyped({ date: "2026-01-01" });
});

test("returns parsed scalar fields", async () => {
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

  using _disabledAct = disableActEnvironment();
  const { takeRender, loadQuery } = await renderUseLoadableQueryHook(
    () => useLoadableQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useLoadableQuery"]);
  }

  loadQuery();

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
  }

  await expect(takeRender).not.toRerender();
});

test("preserves referential identity when refetching identical scalar values", async () => {
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

  using _disabledAct = disableActEnvironment();
  const { takeRender, refetch, loadQuery } = await renderUseLoadableQueryHook(
    () => useLoadableQuery(query),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useLoadableQuery"]);
  }

  loadQuery();

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
