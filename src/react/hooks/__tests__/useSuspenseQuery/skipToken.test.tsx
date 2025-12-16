import { disableActEnvironment } from "@testing-library/react-render-stream";
import { gql } from "graphql-tag";
import { delay, of, Subject } from "rxjs";

import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  NetworkStatus,
} from "@apollo/client";
import { skipToken, useSuspenseQuery } from "@apollo/client/react";
import { MockLink, MockSubscriptionLink } from "@apollo/client/testing";
import {
  createClientWrapper,
  createMockWrapper,
  ObservableStream,
  setupVariablesCase,
} from "@apollo/client/testing/internal";

import { renderUseSuspenseQuery } from "./testUtils.js";

// https://github.com/apollographql/apollo-client/issues/12989
test("maintains variables when switching to `skipToken` and calling `refetchQueries` while skipped after initial request", async () => {
  const { query } = setupVariablesCase();

  const client = new ApolloClient({
    link: new ApolloLink((operation) => {
      return of(
        operation.variables.id === "1" ?
          {
            data: {
              character: {
                __typename: "Character",
                id: "1",
                name: "Spider-Man",
              },
            },
          }
        : {
            data: null,
            errors: [
              { message: `Fetched wrong id: ${operation.variables.id}` },
            ],
          }
      ).pipe(delay(10));
    }),
    cache: new InMemoryCache(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender, rerender } = await renderUseSuspenseQuery(
    ({ id }) =>
      useSuspenseQuery(
        query,
        id === undefined ? skipToken : { variables: { id } }
      ),
    {
      initialProps: { id: "1" as string | undefined },
      wrapper: createClientWrapper(client),
    }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["<Suspense />"]);
  }

  {
    const { snapshot } = await takeRender();

    expect(snapshot).toStrictEqualTyped({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await rerender({ id: undefined });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(takeRender).not.toRerender();

  await expect(
    client.refetchQueries({ include: [query] })
  ).resolves.toStrictEqualTyped([
    {
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
    },
  ]);

  await expect(takeRender).not.toRerender();
});

test("suspends and fetches when changing variables when no longer using skipToken", async () => {
  const { query, mocks } = setupVariablesCase({ delay: 200 });

  using _disabledAct = disableActEnvironment();
  const { takeRender, rerender } = await renderUseSuspenseQuery(
    ({ id }) =>
      useSuspenseQuery(
        query,
        id === undefined ? skipToken : { variables: { id } }
      ),
    {
      initialProps: { id: "1" as string | undefined },
      wrapper: createMockWrapper({ mocks }),
    }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["<Suspense />"]);
  }

  {
    const { snapshot } = await takeRender();

    expect(snapshot).toStrictEqualTyped({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await rerender({ id: undefined });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(takeRender).not.toRerender();

  await rerender({ id: "2" });

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["<Suspense />"]);
  }

  {
    const { snapshot } = await takeRender();

    expect(snapshot).toStrictEqualTyped({
      data: {
        character: { __typename: "Character", id: "2", name: "Black Widow" },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(takeRender).not.toRerender();
});

test("does not suspend for data in the cache when changing variables when no longer using skipToken", async () => {
  const { query, mocks } = setupVariablesCase();

  const client = new ApolloClient({
    link: new MockLink(mocks),
    cache: new InMemoryCache(),
  });

  client.writeQuery({
    query,
    data: {
      character: { __typename: "Character", id: "2", name: "Cached Widow" },
    },
    variables: { id: "2" },
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender, rerender } = await renderUseSuspenseQuery(
    ({ id }) =>
      useSuspenseQuery(
        query,
        id === undefined ? skipToken : { variables: { id } }
      ),
    {
      initialProps: { id: "1" as string | undefined },
      wrapper: createClientWrapper(client),
    }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["<Suspense />"]);
  }

  {
    const { snapshot } = await takeRender();

    expect(snapshot).toStrictEqualTyped({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await rerender({ id: undefined });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        character: { __typename: "Character", id: "1", name: "Spider-Man" },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await rerender({ id: "2" });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: {
        character: { __typename: "Character", id: "2", name: "Cached Widow" },
      },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(takeRender).not.toRerender();
});

test("client.refetchQueries should not refetch queries that start with skipToken until they have been executed", async () => {
  const query = gql`
    query getAuthor($id: ID!) {
      author(id: $id) {
        firstName
        lastName
      }
    }
  `;
  const data = {
    author: {
      firstName: "John",
      lastName: "Smith",
    },
  };
  const secondReqData = {
    author: {
      firstName: "Jane",
      lastName: "Johnson",
    },
  };

  const operationSubject = new Subject<ApolloLink.Operation>();
  const link = new MockSubscriptionLink();
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink((operation, forward) => {
      operationSubject.next(operation);
      return forward(operation);
    }).concat(link),
  });

  const operationStream = new ObservableStream(operationSubject);

  using _disabledAct = disableActEnvironment();
  const { takeRender, rerender } = await renderUseSuspenseQuery(
    (options) => useSuspenseQuery(query, options),
    {
      initialProps: skipToken as
        | typeof skipToken
        | useSuspenseQuery.Options<{ id: string }>,
      wrapper: createClientWrapper(client),
    }
  );

  await expect(operationStream).not.toEmitAnything();
  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseQuery"]);
    expect(snapshot).toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  void client.refetchQueries({ include: [query] });
  await expect(operationStream).not.toEmitAnything();
  await expect(takeRender).not.toRerender();

  await rerender({ variables: { id: "1234" } });
  await expect(operationStream).toEmitNext();
  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["<Suspense />"]);
  }

  link.simulateResult({ result: { data } }, true);
  {
    const { snapshot } = await takeRender();

    expect(snapshot).toStrictEqualTyped({
      data,
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  void client.refetchQueries({ include: [query] });
  await expect(operationStream).toEmitNext();
  link.simulateResult({ result: { data: secondReqData } }, true);
  {
    const { snapshot } = await takeRender();

    expect(snapshot).toStrictEqualTyped({
      data: secondReqData,
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }
});
