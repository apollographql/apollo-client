import React, { Suspense } from "react";
import type { ReactElement } from "react";
import { createQueryPreloader } from "../createQueryPreloader";
import {
  ApolloClient,
  InMemoryCache,
  NetworkStatus,
  TypedDocumentNode,
  gql,
} from "../../../core";
import { MockLink, MockedResponse, wait } from "../../../testing";
import { expectTypeOf } from "expect-type";
import { QueryReference } from "../../cache/QueryReference";
import { DeepPartial } from "../../../utilities";
import {
  SimpleCaseData,
  VariablesCaseData,
  createProfiler,
  useSimpleCase,
  useTrackRenders,
  useVariablesCase,
} from "../../../testing/internal";
import { ApolloProvider } from "../../context";
import { RenderOptions, render } from "@testing-library/react";
import { UseReadQueryResult, useReadQuery } from "../../hooks";

function createDefaultClient(mocks: MockedResponse[]) {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });
}

function renderWithClient(
  ui: ReactElement,
  {
    client,
    wrapper: Wrapper = React.Fragment,
  }: { client: ApolloClient<any>; wrapper?: RenderOptions["wrapper"] }
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <ApolloProvider client={client}>
        <Wrapper>{children}</Wrapper>
      </ApolloProvider>
    ),
  });
}

test("loads a query and suspends when passed to useReadQuery", async () => {
  const { query, mocks } = useSimpleCase();
  const client = createDefaultClient(mocks);
  const preloadQuery = createQueryPreloader(client);
  const Profiler = createProfiler({
    initialSnapshot: {
      result: null as UseReadQueryResult<SimpleCaseData> | null,
    },
  });

  const [queryRef, dispose] = preloadQuery(query);

  function SuspenseFallback() {
    useTrackRenders();
    return <div>Loading</div>;
  }

  function App() {
    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook />
      </Suspense>
    );
  }

  function ReadQueryHook() {
    useTrackRenders();
    Profiler.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  renderWithClient(<App />, { client, wrapper: Profiler });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([SuspenseFallback]);
  }

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { greeting: "Hello" },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  dispose();
});

test("loads a query with variables and suspends when passed to useReadQuery", async () => {
  const { query, mocks } = useVariablesCase();
  const client = createDefaultClient(mocks);
  const preloadQuery = createQueryPreloader(client);
  const Profiler = createProfiler({
    initialSnapshot: {
      result: null as UseReadQueryResult<VariablesCaseData> | null,
    },
  });

  const [queryRef, dispose] = preloadQuery(query, {
    variables: { id: "1" },
  });

  function SuspenseFallback() {
    useTrackRenders();
    return <div>Loading</div>;
  }

  function App() {
    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ReadQueryHook />
      </Suspense>
    );
  }

  function ReadQueryHook() {
    useTrackRenders();
    Profiler.mergeSnapshot({ result: useReadQuery(queryRef) });

    return null;
  }

  renderWithClient(<App />, { client, wrapper: Profiler });

  {
    const { renderedComponents } = await Profiler.takeRender();

    expect(renderedComponents).toStrictEqual([SuspenseFallback]);
  }

  {
    const { snapshot } = await Profiler.takeRender();

    expect(snapshot.result).toEqual({
      data: { character: { id: "1", name: "Spider-Man" } },
      error: undefined,
      networkStatus: NetworkStatus.ready,
    });
  }

  dispose();
});

test("tears down the query when calling dispose", async () => {
  const { query, mocks } = useSimpleCase();
  const client = createDefaultClient(mocks);
  const preloadQuery = createQueryPreloader(client);

  const [, dispose] = preloadQuery(query);

  expect(client.getObservableQueries().size).toBe(1);
  expect(client).toHaveSuspenseCacheEntryUsing(query);

  dispose();

  await wait(0);

  expect(client.getObservableQueries().size).toBe(0);
  expect(client).not.toHaveSuspenseCacheEntryUsing(query);
});

describe.skip("type tests", () => {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([]),
  });
  const preloadQuery = createQueryPreloader(client);

  test("variables are optional and can be anything with untyped DocumentNode", () => {
    const query = gql``;

    preloadQuery(query);
    preloadQuery(query, { variables: {} });
    preloadQuery(query, { variables: { foo: "bar" } });
    preloadQuery(query, { variables: { foo: "bar", bar: 2 } });
  });

  test("variables are optional and can be anything with unspecified TVariables on a TypedDocumentNode", () => {
    const query: TypedDocumentNode<{ greeting: string }> = gql``;

    preloadQuery(query);
    preloadQuery(query, { variables: {} });
    preloadQuery(query, { variables: { foo: "bar" } });
    preloadQuery(query, { variables: { foo: "bar", bar: 2 } });
  });

  test("variables are optional when TVariables are empty", () => {
    const query: TypedDocumentNode<
      { greeting: string },
      Record<string, never>
    > = gql``;

    preloadQuery(query);
    preloadQuery(query, { variables: {} });
    // @ts-expect-error unknown variables
    preloadQuery(query, { variables: { foo: "bar" } });
  });

  test("does not allow variables when TVariables is `never`", () => {
    const query: TypedDocumentNode<{ greeting: string }, never> = gql``;

    preloadQuery(query);
    // @ts-expect-error no variables option allowed
    preloadQuery(query, { variables: {} });
    // @ts-expect-error no variables option allowed
    preloadQuery(query, { variables: { foo: "bar" } });
  });

  test("optional variables are optional", () => {
    const query: TypedDocumentNode<{ posts: string[] }, { limit?: number }> =
      gql``;

    preloadQuery(query);
    preloadQuery(query, { variables: {} });
    preloadQuery(query, { variables: { limit: 10 } });
    preloadQuery(query, {
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery(query, {
      variables: {
        limit: 10,
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  });

  test("enforces required variables", () => {
    const query: TypedDocumentNode<{ character: string }, { id: string }> =
      gql``;

    // @ts-expect-error missing variables option
    preloadQuery(query);
    // @ts-expect-error empty variables
    preloadQuery(query, { variables: {} });
    preloadQuery(query, { variables: { id: "1" } });
    preloadQuery(query, {
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery(query, {
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  });

  test("requires variables with mixed TVariables", () => {
    const query: TypedDocumentNode<
      { character: string },
      { id: string; language?: string }
    > = gql``;

    // @ts-expect-error missing variables argument
    preloadQuery(query);
    // @ts-expect-error missing variables argument
    preloadQuery(query, { variables: {} });
    preloadQuery(query, { variables: { id: "1" } });
    // @ts-expect-error missing required variable
    preloadQuery(query, { variables: { language: "en" } });
    preloadQuery(query, { variables: { id: "1", language: "en" } });
    preloadQuery(query, {
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery(query, {
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    preloadQuery(query, {
      variables: {
        id: "1",
        language: "en",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  });

  test("returns QueryReference<unknown> when TData cannot be inferred", () => {
    const query = gql``;

    const [queryRef] = preloadQuery(query);

    expectTypeOf(queryRef).toEqualTypeOf<QueryReference<unknown>>();
  });

  test("returns QueryReference<TData> in default case", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData, never> = gql``;
      const [queryRef] = preloadQuery(query);

      expectTypeOf(queryRef).toEqualTypeOf<QueryReference<SimpleCaseData>>();
    }

    {
      const query = gql``;
      const [queryRef] = preloadQuery<SimpleCaseData>(query);

      expectTypeOf(queryRef).toEqualTypeOf<QueryReference<SimpleCaseData>>();
    }
  });

  test("returns QueryReference<TData | undefined> with errorPolicy: 'ignore'", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData, never> = gql``;
      const [queryRef] = preloadQuery(query, { errorPolicy: "ignore" });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<SimpleCaseData | undefined>
      >();
    }

    {
      const query = gql``;
      const [queryRef] = preloadQuery<SimpleCaseData>(query, {
        errorPolicy: "ignore",
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<SimpleCaseData | undefined>
      >();
    }
  });

  test("returns QueryReference<TData | undefined> with errorPolicy: 'all'", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData, never> = gql``;
      const [queryRef] = preloadQuery(query, { errorPolicy: "all" });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<SimpleCaseData | undefined>
      >();
    }

    {
      const query = gql``;
      const [queryRef] = preloadQuery<SimpleCaseData>(query, {
        errorPolicy: "all",
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<SimpleCaseData | undefined>
      >();
    }
  });

  test("returns QueryReference<TData> with errorPolicy: 'none'", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData, never> = gql``;
      const [queryRef] = preloadQuery(query, { errorPolicy: "none" });

      expectTypeOf(queryRef).toEqualTypeOf<QueryReference<SimpleCaseData>>();
    }

    {
      const query = gql``;
      const [queryRef] = preloadQuery<SimpleCaseData>(query, {
        errorPolicy: "none",
      });

      expectTypeOf(queryRef).toEqualTypeOf<QueryReference<SimpleCaseData>>();
    }
  });

  test("returns QueryReference<DeepPartial<TData>> with returnPartialData: true", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData, never> = gql``;
      const [queryRef] = preloadQuery(query, { returnPartialData: true });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<DeepPartial<SimpleCaseData>>
      >();
    }

    {
      const query = gql``;
      const [queryRef] = preloadQuery<SimpleCaseData>(query, {
        returnPartialData: true,
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<DeepPartial<SimpleCaseData>>
      >();
    }
  });

  test("returns QueryReference<DeepPartial<TData>> with returnPartialData: false", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData, never> = gql``;
      const [queryRef] = preloadQuery(query, { returnPartialData: false });

      expectTypeOf(queryRef).toEqualTypeOf<QueryReference<SimpleCaseData>>();
    }

    {
      const query = gql``;
      const [queryRef] = preloadQuery<SimpleCaseData>(query, {
        returnPartialData: false,
      });

      expectTypeOf(queryRef).toEqualTypeOf<QueryReference<SimpleCaseData>>();
    }
  });

  test("returns QueryReference<TData> when passing an option unrelated to TData", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData, never> = gql``;
      const [queryRef] = preloadQuery(query, { canonizeResults: true });

      expectTypeOf(queryRef).toEqualTypeOf<QueryReference<SimpleCaseData>>();
    }

    {
      const query = gql``;
      const [queryRef] = preloadQuery<SimpleCaseData>(query, {
        canonizeResults: true,
      });

      expectTypeOf(queryRef).toEqualTypeOf<QueryReference<SimpleCaseData>>();
    }
  });

  test("handles combinations of options", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData, never> = gql``;
      const [queryRef] = preloadQuery(query, {
        returnPartialData: true,
        errorPolicy: "ignore",
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<DeepPartial<SimpleCaseData> | undefined>
      >();
    }

    {
      const query = gql``;
      const [queryRef] = preloadQuery<SimpleCaseData>(query, {
        returnPartialData: true,
        errorPolicy: "ignore",
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<DeepPartial<SimpleCaseData> | undefined>
      >();
    }

    {
      const query: TypedDocumentNode<SimpleCaseData, never> = gql``;
      const [queryRef] = preloadQuery(query, {
        returnPartialData: true,
        errorPolicy: "none",
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<DeepPartial<SimpleCaseData>>
      >();
    }

    {
      const query = gql``;
      const [queryRef] = preloadQuery<SimpleCaseData>(query, {
        returnPartialData: true,
        errorPolicy: "none",
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<DeepPartial<SimpleCaseData>>
      >();
    }
  });

  test("returns correct TData type when combined with options unrelated to TData", () => {
    {
      const query: TypedDocumentNode<SimpleCaseData, never> = gql``;
      const [queryRef] = preloadQuery(query, {
        canonizeResults: true,
        returnPartialData: true,
        errorPolicy: "none",
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<DeepPartial<SimpleCaseData>>
      >();
    }

    {
      const query = gql``;
      const [queryRef] = preloadQuery<SimpleCaseData>(query, {
        canonizeResults: true,
        returnPartialData: true,
        errorPolicy: "none",
      });

      expectTypeOf(queryRef).toEqualTypeOf<
        QueryReference<DeepPartial<SimpleCaseData>>
      >();
    }
  });
});
