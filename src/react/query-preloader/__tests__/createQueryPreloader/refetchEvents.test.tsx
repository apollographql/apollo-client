import {
  createRenderStream,
  disableActEnvironment,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import { gql } from "graphql-tag";
import React, { Suspense } from "react";
import { Observable } from "rxjs";

import type { TypedDocumentNode } from "@apollo/client";
import {
  ApolloClient,
  InMemoryCache,
  NetworkStatus,
  RefetchEventManager,
} from "@apollo/client";
import type { PreloadedQueryRef } from "@apollo/client/react";
import { createQueryPreloader, useReadQuery } from "@apollo/client/react";
import { MockLink } from "@apollo/client/testing";
import { createClientWrapper } from "@apollo/client/testing/internal";

declare module "@apollo/client" {
  interface RefetchEvents {
    test: void;
  }
}

interface CountData {
  count: number;
}

const query: TypedDocumentNode<CountData> = gql`
  query Count {
    count
  }
`;

function setupClient(options?: Partial<ApolloClient.Options>) {
  let count = 0;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: () => ({ data: { count: ++count } }),
        maxUsageCount: Number.POSITIVE_INFINITY,
      },
    ]),
    refetchEventManager: new RefetchEventManager({
      sources: {
        test: () => new Observable(),
      },
    }),
    ...options,
  });

  return client;
}

async function renderApp(
  client: ApolloClient,
  queryRef: PreloadedQueryRef<CountData>
) {
  const renderStream = createRenderStream({
    initialSnapshot: {
      result: null as useReadQuery.Result<CountData> | null,
    },
  });

  function SuspenseFallback() {
    useTrackRenders({ name: "SuspenseFallback" });
    return <div>Loading</div>;
  }

  function ReadQueryHook() {
    useTrackRenders({ name: "useReadQuery" });
    renderStream.mergeSnapshot({ result: useReadQuery(queryRef) });
    return null;
  }

  function App() {
    useTrackRenders({ name: "App" });
    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook />
      </Suspense>
    );
  }

  await renderStream.render(<App />, { wrapper: createClientWrapper(client) });

  return { renderStream };
}

test("refetches the preloaded query when a source emits", async () => {
  const client = setupClient();
  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query);

  using _disabledAct = disableActEnvironment();
  const { renderStream } = await renderApp(client, queryRef);

  // initial suspended render
  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();

    expect(snapshot.result).toStrictEqualTyped({
      data: { count: 1 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.refetchEventManager?.emit("test");

  {
    const { snapshot } = await renderStream.takeRender();
    expect(snapshot.result).toStrictEqualTyped({
      data: { count: 2 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender();
});

test("does not refetch when refetchOn is false", async () => {
  const client = setupClient();
  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, { refetchOn: false });

  using _disabledAct = disableActEnvironment();
  const { renderStream } = await renderApp(client, queryRef);

  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();
    expect(snapshot.result).toStrictEqualTyped({
      data: { count: 1 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.refetchEventManager?.emit("test");

  await expect(renderStream).not.toRerender();
});

test("does not refetch when defaultOptions.watchQuery.refetchOn is false", async () => {
  const client = setupClient({
    defaultOptions: {
      watchQuery: {
        refetchOn: false,
      },
    },
  });
  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query);

  using _disabledAct = disableActEnvironment();
  const { renderStream } = await renderApp(client, queryRef);

  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();
    expect(snapshot.result).toStrictEqualTyped({
      data: { count: 1 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.refetchEventManager?.emit("test");

  await expect(renderStream).not.toRerender();
});

test("per-query refetchOn: true overrides defaultOptions disabling refetches", async () => {
  const client = setupClient({
    defaultOptions: {
      watchQuery: {
        refetchOn: false,
      },
    },
  });
  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, { refetchOn: true });

  using _disabledAct = disableActEnvironment();
  const { renderStream } = await renderApp(client, queryRef);

  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();
    expect(snapshot.result).toStrictEqualTyped({
      data: { count: 1 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.refetchEventManager?.emit("test");

  {
    const { snapshot } = await renderStream.takeRender();
    expect(snapshot.result).toStrictEqualTyped({
      data: { count: 2 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender();
});

test("refetchOn callback decides whether to refetch based on its return value", async () => {
  const client = setupClient();
  const refetchOn = jest.fn(() => false);
  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, { refetchOn });

  using _disabledAct = disableActEnvironment();
  const { renderStream } = await renderApp(client, queryRef);

  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();
    expect(snapshot.result).toStrictEqualTyped({
      data: { count: 1 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.refetchEventManager?.emit("test");

  expect(refetchOn).toHaveBeenCalledTimes(1);
  expect(refetchOn).toHaveBeenLastCalledWith({
    source: "test",
    payload: undefined,
  });

  await expect(renderStream).not.toRerender();

  refetchOn.mockReturnValue(true);
  client.refetchEventManager?.emit("test");

  expect(refetchOn).toHaveBeenCalledTimes(2);

  {
    const { snapshot } = await renderStream.takeRender();
    expect(snapshot.result).toStrictEqualTyped({
      data: { count: 2 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await expect(renderStream).not.toRerender();
});

test("refetchOn: { eventName: false } opts out of specific events", async () => {
  const client = setupClient();
  const preloadQuery = createQueryPreloader(client);
  const queryRef = preloadQuery(query, { refetchOn: { test: false } });

  using _disabledAct = disableActEnvironment();
  const { renderStream } = await renderApp(client, queryRef);

  await renderStream.takeRender();

  {
    const { snapshot } = await renderStream.takeRender();
    expect(snapshot.result).toStrictEqualTyped({
      data: { count: 1 },
      dataState: "complete",
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  client.refetchEventManager?.emit("test");

  await expect(renderStream).not.toRerender();
});
