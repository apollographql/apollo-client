import { disableActEnvironment } from "@testing-library/react-render-stream";
import { of } from "rxjs";

import type { OperationVariables } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { createQueryPreloader } from "@apollo/client/react";
import { dateScalar } from "@apollo/client/testing/internal";

import { renderDefaultTestApp } from "./testUtils.js";

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

  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, {
    variables: { filter: { date: new Date(2026, 0, 1) } },
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

  expect(requestVariables).toStrictEqualTyped({
    filter: { date: "2026-01-01" },
  });
});
