import { disableActEnvironment } from "@testing-library/react-render-stream";
import { delay, of } from "rxjs";

import type { OperationVariables } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { createQueryPreloader } from "@apollo/client/react";
import { dateScalar } from "@apollo/client/testing/internal";

import { renderDefaultTestApp } from "./testUtils.js";

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

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, {
    variables: { date: new Date(2026, 0, 1) },
  });

  using _disabledAct = disableActEnvironment();
  const { renderStream } = await renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents, snapshot } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "useReadQuery"]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { event: { __typename: "Event", name: "GraphQL Summit" } },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

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

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query);

  using _disabledAct = disableActEnvironment();
  const { renderStream } = await renderDefaultTestApp({ client, queryRef });

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "<Suspense />"]);
  }

  {
    const { renderedComponents, snapshot } = await renderStream.takeRender();

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
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream.takeRender).not.toRerender();
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

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query);

  using _disabledAct = disableActEnvironment();
  const { renderStream } = await renderDefaultTestApp({ client, queryRef });

  let previousData: unknown;

  {
    const { renderedComponents } = await renderStream.takeRender();

    expect(renderedComponents).toStrictEqual(["App", "<Suspense />"]);
  }

  {
    const { renderedComponents, snapshot } = await renderStream.takeRender();

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
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });

    previousData = snapshot.result!.data;
  }

  await expect(
    client.query({ query, fetchPolicy: "network-only" })
  ).resolves.toStrictEqualTyped({
    data: {
      event: {
        __typename: "Event",
        id: "1",
        startDate: new Date(2026, 0, 1),
      },
    },
  });

  await expect(renderStream.takeRender).not.toRerender();

  expect(renderStream.getCurrentRender().snapshot.result!.data).toBe(
    previousData
  );
});
