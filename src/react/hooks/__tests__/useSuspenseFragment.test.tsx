import {
  useSuspenseFragment,
  UseSuspenseFragmentResult,
} from "../useSuspenseFragment";
import {
  ApolloClient,
  gql,
  InMemoryCache,
  MaybeMasked,
  TypedDocumentNode,
} from "../../../core";
import React, { Suspense } from "react";
import { ApolloProvider } from "../../context";
import {
  createRenderStream,
  disableActEnvironment,
  renderHookToSnapshotStream,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import { spyOnConsole } from "../../../testing/internal";
import { renderHook } from "@testing-library/react";
import { InvariantError } from "ts-invariant";
import { MockedProvider } from "../../../testing";

function createDefaultRenderStream<TData = unknown>() {
  return createRenderStream({
    initialSnapshot: {
      result: null as UseSuspenseFragmentResult<MaybeMasked<TData>> | null,
    },
  });
}

function createDefaultTrackedComponents() {
  function SuspenseFallback() {
    useTrackRenders();
    return <div>Loading</div>;
  }

  return { SuspenseFallback };
}

test("validates the GraphQL document is a fragment", () => {
  using _ = spyOnConsole("error");

  const fragment = gql`
    query ShouldThrow {
      createException
    }
  `;

  expect(() => {
    renderHook(
      () => useSuspenseFragment({ fragment, from: { __typename: "Nope" } }),
      { wrapper: ({ children }) => <MockedProvider>{children}</MockedProvider> }
    );
  }).toThrow(
    new InvariantError(
      "Found a query operation named 'ShouldThrow'. No operations are allowed when using a fragment as a query. Only fragments are allowed."
    )
  );
});

test("throws if no client is provided", () => {
  using _spy = spyOnConsole("error");
  expect(() =>
    renderHook(() =>
      useSuspenseFragment({
        fragment: gql`
          fragment ShouldThrow on Error {
            shouldThrow
          }
        `,
        from: {},
      })
    )
  ).toThrow(/pass an ApolloClient/);
});

test("suspends until cache value is complete", async () => {
  interface ItemFragment {
    __typename: "Item";
    id: number;
    text: string;
  }

  const { render, takeRender, replaceSnapshot } =
    createDefaultRenderStream<ItemFragment>();
  const { SuspenseFallback } = createDefaultTrackedComponents();

  const client = new ApolloClient({ cache: new InMemoryCache() });

  const fragment: TypedDocumentNode<ItemFragment> = gql`
    fragment ItemFragment on Item {
      id
      text
    }
  `;

  function App() {
    useTrackRenders();

    const result = useSuspenseFragment({
      fragment,
      from: { __typename: "Item", id: 1 },
    });

    replaceSnapshot({ result });

    return null;
  }

  using _disabledAct = disableActEnvironment();
  await render(
    <Suspense fallback={<SuspenseFallback />}>
      <App />
    </Suspense>,
    {
      wrapper: ({ children }) => {
        return <ApolloProvider client={client}>{children}</ApolloProvider>;
      },
    }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([SuspenseFallback]);
  }

  client.writeFragment({
    fragment,
    data: {
      __typename: "Item",
      id: 1,
      text: "Item #1",
    },
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([App]);
    expect(snapshot.result).toEqual({
      data: {
        __typename: "Item",
        id: 1,
        text: "Item #1",
      },
    });
  }

  await expect(takeRender).not.toRerender();
});

test("updates when the cache updates", async () => {
  interface ItemFragment {
    __typename: "Item";
    id: number;
    text: string;
  }

  const { takeRender, render, replaceSnapshot } =
    createDefaultRenderStream<ItemFragment>();
  const { SuspenseFallback } = createDefaultTrackedComponents();

  const client = new ApolloClient({ cache: new InMemoryCache() });

  const fragment: TypedDocumentNode<ItemFragment> = gql`
    fragment ItemFragment on Item {
      id
      text
    }
  `;

  function App() {
    useTrackRenders();

    const result = useSuspenseFragment({
      fragment,
      from: { __typename: "Item", id: 1 },
    });

    replaceSnapshot({ result });

    return null;
  }

  using _disabledAct = disableActEnvironment();
  await render(
    <Suspense fallback={<SuspenseFallback />}>
      <App />
    </Suspense>,
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([SuspenseFallback]);
  }

  client.writeFragment({
    fragment,
    data: {
      __typename: "Item",
      id: 1,
      text: "Item #1",
    },
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([App]);
    expect(snapshot.result).toEqual({
      data: {
        __typename: "Item",
        id: 1,
        text: "Item #1",
      },
    });
  }

  client.writeFragment({
    fragment,
    data: {
      __typename: "Item",
      id: 1,
      text: "Item #1 (updated)",
    },
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([App]);
    expect(snapshot.result).toEqual({
      data: {
        __typename: "Item",
        id: 1,
        text: "Item #1 (updated)",
      },
    });
  }

  await expect(takeRender).not.toRerender();
});

test("resuspends when data goes missing until complete again", async () => {
  interface ItemFragment {
    __typename: "Item";
    id: number;
    text: string;
  }

  const { takeRender, render, replaceSnapshot } =
    createDefaultRenderStream<ItemFragment>();
  const { SuspenseFallback } = createDefaultTrackedComponents();

  const client = new ApolloClient({ cache: new InMemoryCache() });

  const fragment: TypedDocumentNode<ItemFragment> = gql`
    fragment ItemFragment on Item {
      id
      text
    }
  `;

  function App() {
    useTrackRenders();

    const result = useSuspenseFragment({
      fragment,
      from: { __typename: "Item", id: 1 },
    });

    replaceSnapshot({ result });

    return null;
  }

  using _disabledAct = disableActEnvironment();
  await render(
    <Suspense fallback={<SuspenseFallback />}>
      <App />
    </Suspense>,
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([SuspenseFallback]);
  }

  client.writeFragment({
    fragment,
    data: {
      __typename: "Item",
      id: 1,
      text: "Item #1",
    },
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([App]);
    expect(snapshot.result).toEqual({
      data: {
        __typename: "Item",
        id: 1,
        text: "Item #1",
      },
    });
  }

  client.cache.modify({
    id: "Item:1",
    fields: {
      text: (_, { DELETE }) => DELETE,
    },
  });

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([SuspenseFallback]);
  }

  client.writeFragment({
    fragment,
    data: {
      __typename: "Item",
      id: 1,
      text: "Item #1 (updated)",
    },
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([App]);
    expect(snapshot.result).toEqual({
      data: {
        __typename: "Item",
        id: 1,
        text: "Item #1 (updated)",
      },
    });
  }

  await expect(takeRender).not.toRerender();
});

test("does not suspend and returns cache data when data is already in the cache", async () => {
  interface ItemFragment {
    __typename: "Item";
    id: number;
    text: string;
  }

  const { takeRender, render, replaceSnapshot } =
    createDefaultRenderStream<ItemFragment>();
  const { SuspenseFallback } = createDefaultTrackedComponents();

  const client = new ApolloClient({ cache: new InMemoryCache() });

  const fragment: TypedDocumentNode<ItemFragment> = gql`
    fragment ItemFragment on Item {
      id
      text
    }
  `;

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "Cached" },
  });

  function App() {
    useTrackRenders();

    const result = useSuspenseFragment({
      fragment,
      from: { __typename: "Item", id: 1 },
    });

    replaceSnapshot({ result });

    return null;
  }

  using _disabledAct = disableActEnvironment();
  await render(
    <Suspense fallback={<SuspenseFallback />}>
      <App />
    </Suspense>,
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([App]);
    expect(snapshot.result).toEqual({
      data: {
        __typename: "Item",
        id: 1,
        text: "Cached",
      },
    });
  }

  await expect(takeRender).not.toRerender();
});

test("receives cache updates after initial result when data is written to the cache before mounted", async () => {
  interface ItemFragment {
    __typename: "Item";
    id: number;
    text: string;
  }

  const { takeRender, render, replaceSnapshot } =
    createDefaultRenderStream<ItemFragment>();
  const { SuspenseFallback } = createDefaultTrackedComponents();

  const client = new ApolloClient({ cache: new InMemoryCache() });

  const fragment: TypedDocumentNode<ItemFragment> = gql`
    fragment ItemFragment on Item {
      id
      text
    }
  `;

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "Cached" },
  });

  function App() {
    useTrackRenders();

    const result = useSuspenseFragment({
      fragment,
      from: { __typename: "Item", id: 1 },
    });

    replaceSnapshot({ result });

    return null;
  }

  using _disabledAct = disableActEnvironment();
  await render(
    <Suspense fallback={<SuspenseFallback />}>
      <App />
    </Suspense>,
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([App]);
    expect(snapshot.result).toEqual({
      data: {
        __typename: "Item",
        id: 1,
        text: "Cached",
      },
    });
  }

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "Updated" },
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([App]);
    expect(snapshot.result).toEqual({
      data: {
        __typename: "Item",
        id: 1,
        text: "Updated",
      },
    });
  }

  await expect(takeRender).not.toRerender();
});

test("allows the client to be overridden", async () => {
  interface ItemFragment {
    __typename: "Item";
    id: number;
    text: string;
  }

  const fragment: TypedDocumentNode<ItemFragment> = gql`
    fragment ItemFragment on Item {
      id
      text
    }
  `;

  const defaultClient = new ApolloClient({ cache: new InMemoryCache() });
  const client = new ApolloClient({ cache: new InMemoryCache() });

  defaultClient.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "Should not be used" },
  });

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useSuspenseFragment({
        fragment,
        client,
        from: { __typename: "Item", id: 1 },
      }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={defaultClient}>{children}</ApolloProvider>
      ),
    }
  );

  const { data } = await takeSnapshot();

  expect(data).toEqual({ __typename: "Item", id: 1, text: "Item #1" });
});

test("suspends until data is complete when changing `from` with no data written to cache", async () => {
  interface ItemFragment {
    __typename: "Item";
    id: number;
    text: string;
  }

  const fragment: TypedDocumentNode<ItemFragment> = gql`
    fragment ItemFragment on Item {
      id
      text
    }
  `;

  const { takeRender, replaceSnapshot, render } =
    createDefaultRenderStream<ItemFragment>();
  const { SuspenseFallback } = createDefaultTrackedComponents();

  const client = new ApolloClient({ cache: new InMemoryCache() });

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });

  using _disabledAct = disableActEnvironment();
  function App({ id }: { id: number }) {
    useTrackRenders();

    const result = useSuspenseFragment({
      fragment,
      from: { __typename: "Item", id },
    });

    replaceSnapshot({ result });

    return null;
  }

  const { rerender } = await render(
    <Suspense fallback={<SuspenseFallback />}>
      <App id={1} />
    </Suspense>,
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([App]);
    expect(snapshot.result).toEqual({
      data: {
        __typename: "Item",
        id: 1,
        text: "Item #1",
      },
    });
  }

  await rerender(
    <Suspense fallback={<SuspenseFallback />}>
      <App id={2} />
    </Suspense>
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([SuspenseFallback]);
  }

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 2, text: "Item #2" },
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([App]);
    expect(snapshot.result).toEqual({
      data: {
        __typename: "Item",
        id: 2,
        text: "Item #2",
      },
    });
  }

  await expect(takeRender).not.toRerender();
});

test("does not suspend when changing `from` with data already written to cache", async () => {
  interface ItemFragment {
    __typename: "Item";
    id: number;
    text: string;
  }

  const fragment: TypedDocumentNode<ItemFragment> = gql`
    fragment ItemFragment on Item {
      id
      text
    }
  `;

  const { takeRender, replaceSnapshot, render } =
    createDefaultRenderStream<ItemFragment>();
  const { SuspenseFallback } = createDefaultTrackedComponents();

  const client = new ApolloClient({ cache: new InMemoryCache() });

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 2, text: "Item #2" },
  });

  using _disabledAct = disableActEnvironment();
  function App({ id }: { id: number }) {
    useTrackRenders();

    const result = useSuspenseFragment({
      fragment,
      from: { __typename: "Item", id },
    });

    replaceSnapshot({ result });

    return null;
  }

  const { rerender } = await render(
    <Suspense fallback={<SuspenseFallback />}>
      <App id={1} />
    </Suspense>,
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([App]);
    expect(snapshot.result).toEqual({
      data: {
        __typename: "Item",
        id: 1,
        text: "Item #1",
      },
    });
  }

  await rerender(
    <Suspense fallback={<SuspenseFallback />}>
      <App id={2} />
    </Suspense>
  );

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([App]);
    expect(snapshot.result).toEqual({
      data: {
        __typename: "Item",
        id: 2,
        text: "Item #2",
      },
    });
  }

  await expect(takeRender).not.toRerender();
});

it("does not rerender when fields with @nonreactive change", async () => {
  interface ItemFragment {
    __typename: "Item";
    id: number;
    text: string;
  }

  const fragment: TypedDocumentNode<ItemFragment> = gql`
    fragment ItemFragment on Item {
      id
      text @nonreactive
    }
  `;

  const client = new ApolloClient({ cache: new InMemoryCache() });

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });

  using _disabledAct = disableActEnvironment();

  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useSuspenseFragment({ fragment, from: { __typename: "Item", id: 1 } }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { data } = await takeSnapshot();

    expect(data).toEqual({
      __typename: "Item",
      id: 1,
      text: "Item #1",
    });
  }

  client.writeFragment({
    fragment,
    data: {
      __typename: "Item",
      id: 1,
      text: "Item #1 (updated)",
    },
  });

  await expect(takeSnapshot).not.toRerender();
});

it("does not rerender when fields with @nonreactive on nested fragment change", async () => {
  interface ItemFragment {
    __typename: "Item";
    id: number;
    text: string;
  }

  const fragment: TypedDocumentNode<ItemFragment> = gql`
    fragment ItemFragment on Item {
      id
      ...ItemFields @nonreactive
    }

    fragment ItemFields on Item {
      text
    }
  `;

  const client = new ApolloClient({ cache: new InMemoryCache() });

  client.writeFragment({
    fragment,
    fragmentName: "ItemFragment",
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });

  using _disabledAct = disableActEnvironment();

  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useSuspenseFragment({
        fragment,
        fragmentName: "ItemFragment",
        from: { __typename: "Item", id: 1 },
      }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { data } = await takeSnapshot();

    expect(data).toEqual({
      __typename: "Item",
      id: 1,
      text: "Item #1",
    });
  }

  client.writeFragment({
    fragment,
    fragmentName: "ItemFragment",
    data: {
      __typename: "Item",
      id: 1,
      text: "Item #1 (updated)",
    },
  });

  await expect(takeSnapshot).not.toRerender();
});
