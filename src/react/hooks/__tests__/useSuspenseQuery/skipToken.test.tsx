import { disableActEnvironment } from "@testing-library/react-render-stream";
import { delay, of } from "rxjs";

import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  NetworkStatus,
} from "@apollo/client";
import { skipToken, useSuspenseQuery } from "@apollo/client/react";
import { MockLink } from "@apollo/client/testing";
import {
  createClientWrapper,
  createMockWrapper,
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
