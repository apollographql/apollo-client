import { disableActEnvironment } from "@testing-library/react-render-stream";
import { of } from "rxjs";

import type { OperationVariables } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { useBackgroundQuery } from "@apollo/client/react";
import {
  createClientWrapper,
  dateScalar,
} from "@apollo/client/testing/internal";

import { renderUseBackgroundQuery } from "./testUtils.js";

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
      });
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
  const { takeRender } = await renderUseBackgroundQuery(
    () =>
      useBackgroundQuery(query, { variables: { date: new Date(2026, 0, 1) } }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeRender()).resolves.toMatchObject({
    renderedComponents: ["useBackgroundQuery", "<Suspense />"],
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
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
      });
    }),
  });

  const query = gql`
    query Event($date: Date!) {
      event @on(date: $date) {
        name
      }
    }
  `;

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderUseBackgroundQuery(
    () =>
      useBackgroundQuery(query, { variables: { date: new Date(2026, 0, 1) } }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeRender()).resolves.toMatchObject({
    renderedComponents: ["useBackgroundQuery", "<Suspense />"],
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
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
      });
    }),
  });

  const query = gql`
    query Event($filter: EventFilter!) {
      event(filter: $filter) {
        name
      }
    }
  `;

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderUseBackgroundQuery(
    () =>
      useBackgroundQuery(query, {
        variables: { filter: { date: new Date(2026, 0, 1) } },
      }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeRender()).resolves.toMatchObject({
    renderedComponents: ["useBackgroundQuery", "<Suspense />"],
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useReadQuery"]);
    expect(snapshot).toStrictEqualTyped({
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
  expect(requestVariables).toStrictEqualTyped({
    filter: { date: "2026-01-01" },
  });
});
