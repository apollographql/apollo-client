import React from "react";
import { act, render, screen } from "@testing-library/react";
import { ApolloClient, InMemoryCache, NetworkStatus } from "../../../core";
import { MockLink } from "../../../testing";
import {
  SimpleCaseData,
  createProfiler,
  useSimpleCase,
  useTrackRenders,
} from "../../../testing/internal";
import { usePreloadedQueryHandlers } from "../usePreloadedQueryHandlers";
import { UseReadQueryResult, useReadQuery } from "../useReadQuery";
import { Suspense } from "react";
import { createQueryPreloader } from "../../query-preloader/createQueryPreloader";
import { ApolloProvider } from "../../context";
import userEvent from "@testing-library/user-event";

test("refetches and resuspends when calling refetch", async () => {
  const { query, mocks: defaultMocks } = useSimpleCase();

  const user = userEvent.setup();

  const mocks = [
    defaultMocks[0],
    {
      request: { query },
      result: { data: { greeting: "Hello again" } },
      delay: 20,
    },
  ];

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });

  const Profiler = createProfiler({
    initialSnapshot: {
      result: null as UseReadQueryResult<SimpleCaseData> | null,
    },
  });

  const preloadQuery = createQueryPreloader(client);
  const [queryRef, dispose] = preloadQuery(query);

  function SuspenseFallback() {
    useTrackRenders();
    return <p>Loading</p>;
  }

  function ReadQueryHook() {
    Profiler.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  function App() {
    useTrackRenders();
    const { refetch } = usePreloadedQueryHandlers(queryRef);

    return (
      <>
        <button onClick={() => refetch()}>Refetch</button>
        <Suspense fallback={<SuspenseFallback />}>
          <ReadQueryHook />
        </Suspense>
      </>
    );
  }

  render(<App />, {
    wrapper: ({ children }) => {
      return (
        <ApolloProvider client={client}>
          <Profiler>{children}</Profiler>
        </ApolloProvider>
      );
    },
  });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  await act(() => user.click(screen.getByText("Refetch")));

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([App, SuspenseFallback]);
  }

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello again" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  dispose();
});
