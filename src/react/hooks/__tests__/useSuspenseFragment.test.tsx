import {
  useSuspenseFragment,
  UseSuspenseFragmentResult,
} from "../useSuspenseFragment.js";
import {
  ApolloClient,
  FragmentType,
  gql,
  InMemoryCache,
  Masked,
  MaskedDocumentNode,
  MaybeMasked,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client/core";
import React, { Suspense } from "react";
import { ApolloProvider } from "@apollo/client/react/context";
import {
  createRenderStream,
  disableActEnvironment,
  renderHookToSnapshotStream,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import { renderAsync, spyOnConsole } from "../../../testing/internal/index.js";
import { act, renderHook, screen, waitFor } from "@testing-library/react";
import { InvariantError } from "@apollo/client/utilities/invariant";
import { MockSubscriptionLink, wait } from "@apollo/client/testing";
import { MockedProvider } from "@apollo/client/testing/react";
import { expectTypeOf } from "expect-type";
import { userEvent } from "@testing-library/user-event";

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

// TODO: Update when https://github.com/apollographql/apollo-client/issues/12003 is fixed
it.failing(
  "warns and suspends when passing parent object to `from` when key fields are missing",
  async () => {
    using _ = spyOnConsole("warn");

    interface Fragment {
      age: number;
    }

    const fragment: TypedDocumentNode<Fragment, never> = gql`
      fragment UserFields on User {
        age
      }
    `;

    const client = new ApolloClient({ cache: new InMemoryCache() });

    const { replaceSnapshot, render, takeRender } =
      createDefaultRenderStream<Fragment>();
    const { SuspenseFallback } = createDefaultTrackedComponents();

    function App() {
      const result = useSuspenseFragment({
        fragment,
        from: { __typename: "User" },
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

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "Could not identify object passed to `from` for '%s' fragment, either because the object is non-normalized or the key fields are missing. If you are masking this object, please ensure the key fields are requested by the parent object.",
      "UserFields"
    );

    {
      const { renderedComponents } = await takeRender();

      expect(renderedComponents).toStrictEqual([SuspenseFallback]);
    }
  }
);

test("returns null if `from` is `null`", async () => {
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

  const client = new ApolloClient({ cache: new InMemoryCache() });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useSuspenseFragment({ fragment, from: null }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const { data } = await takeSnapshot();

  expect(data).toBeNull();
});

test("returns cached value when `from` changes from `null` to non-null value", async () => {
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

  const client = new ApolloClient({ cache: new InMemoryCache() });

  client.writeFragment({
    fragment,
    data: {
      __typename: "Item",
      id: 1,
      text: "Item #1",
    },
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
    ({ id }) =>
      useSuspenseFragment({
        fragment,
        from: id === null ? null : { __typename: "Item", id },
      }),
    {
      initialProps: { id: null as null | number },
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { data } = await takeSnapshot();

    expect(data).toBeNull();
  }

  await rerender({ id: 1 });

  {
    const { data } = await takeSnapshot();

    expect(data).toEqual({
      __typename: "Item",
      id: 1,
      text: "Item #1",
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("returns null value when `from` changes from non-null value to `null`", async () => {
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

  const client = new ApolloClient({ cache: new InMemoryCache() });

  client.writeFragment({
    fragment,
    data: {
      __typename: "Item",
      id: 1,
      text: "Item #1",
    },
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
    ({ id }) =>
      useSuspenseFragment({
        fragment,
        from: id === null ? null : { __typename: "Item", id },
      }),
    {
      initialProps: { id: 1 as null | number },
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

  await rerender({ id: null });

  {
    const { data } = await takeSnapshot();

    expect(data).toBeNull();
  }

  await expect(takeSnapshot).not.toRerender();
});

test("suspends until cached value is available when `from` changes from `null` to non-null value", async () => {
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

  const client = new ApolloClient({ cache: new InMemoryCache() });

  const { takeRender, render, replaceSnapshot } =
    createDefaultRenderStream<ItemFragment | null>();
  const { SuspenseFallback } = createDefaultTrackedComponents();

  function App({ id }: { id: number | null }) {
    useTrackRenders();
    const result = useSuspenseFragment({
      fragment,
      from: id === null ? null : { __typename: "Item", id },
    });

    replaceSnapshot({ result });

    return null;
  }

  using _disabledAct = disableActEnvironment();
  const { rerender } = await render(
    <Suspense fallback={<SuspenseFallback />}>
      <App id={null} />
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
    expect(snapshot.result).toEqual({ data: null });
  }

  await rerender(
    <Suspense fallback={<SuspenseFallback />}>
      <App id={1} />
    </Suspense>
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

test("returns masked fragment when data masking is enabled", async () => {
  type Post = {
    __typename: "Post";
    id: number;
    title: string;
  } & { " $fragmentRefs"?: { PostFields: PostFields } };

  type PostFields = {
    __typename: "Post";
    updatedAt: string;
  } & { " $fragmentName"?: "PostFields" };

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
  });

  const fragment: TypedDocumentNode<Post> = gql`
    fragment PostFragment on Post {
      id
      title
      ...PostFields
    }

    fragment PostFields on Post {
      updatedAt
    }
  `;

  client.writeFragment({
    fragment,
    fragmentName: "PostFragment",
    data: {
      __typename: "Post",
      id: 1,
      title: "Blog post",
      updatedAt: "2024-01-01",
    },
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useSuspenseFragment({
        fragment,
        fragmentName: "PostFragment",
        from: { __typename: "Post", id: 1 },
      }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const snapshot = await takeSnapshot();

    expect(snapshot).toEqual({
      data: {
        __typename: "Post",
        id: 1,
        title: "Blog post",
      },
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("does not rerender for cache writes to masked fields", async () => {
  type Post = {
    __typename: "Post";
    id: number;
    title: string;
  } & { " $fragmentRefs"?: { PostFields: PostFields } };

  type PostFields = {
    __typename: "Post";
    updatedAt: string;
  } & { " $fragmentName"?: "PostFields" };

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
  });

  const fragment: TypedDocumentNode<Post> = gql`
    fragment PostFragment on Post {
      id
      title
      ...PostFields
    }

    fragment PostFields on Post {
      updatedAt
    }
  `;

  client.writeFragment({
    fragment,
    fragmentName: "PostFragment",
    data: {
      __typename: "Post",
      id: 1,
      title: "Blog post",
      updatedAt: "2024-01-01",
    },
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useSuspenseFragment({
        fragment,
        fragmentName: "PostFragment",
        from: { __typename: "Post", id: 1 },
      }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const snapshot = await takeSnapshot();

    expect(snapshot).toEqual({
      data: {
        __typename: "Post",
        id: 1,
        title: "Blog post",
      },
    });
  }

  client.writeFragment({
    fragment,
    fragmentName: "PostFragment",
    data: {
      __typename: "Post",
      id: 1,
      title: "Blog post",
      updatedAt: "2024-02-01",
    },
  });

  await expect(takeSnapshot).not.toRerender();
});

test("updates child fragments for cache updates to masked fields", async () => {
  type Post = {
    __typename: "Post";
    id: number;
    title: string;
  } & { " $fragmentRefs"?: { PostFields: PostFields } };

  type PostFields = {
    __typename: "Post";
    updatedAt: string;
  } & { " $fragmentName"?: "PostFields" };

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
  });

  const postFieldsFragment: MaskedDocumentNode<PostFields> = gql`
    fragment PostFields on Post {
      updatedAt
    }
  `;

  const postFragment: MaskedDocumentNode<Post> = gql`
    fragment PostFragment on Post {
      id
      title
      ...PostFields
    }

    ${postFieldsFragment}
  `;

  client.writeFragment({
    fragment: postFragment,
    fragmentName: "PostFragment",
    data: {
      __typename: "Post",
      id: 1,
      title: "Blog post",
      updatedAt: "2024-01-01",
    },
  });

  const { render, mergeSnapshot, takeRender } = createRenderStream({
    initialSnapshot: {
      parent: null as UseSuspenseFragmentResult<Masked<Post>> | null,
      child: null as UseSuspenseFragmentResult<Masked<PostFields>> | null,
    },
  });

  function Parent() {
    useTrackRenders();
    const parent = useSuspenseFragment({
      fragment: postFragment,
      fragmentName: "PostFragment",
      from: { __typename: "Post", id: 1 },
    });

    mergeSnapshot({ parent });

    return <Child post={parent.data} />;
  }

  function Child({ post }: { post: FragmentType<PostFields> }) {
    useTrackRenders();
    const child = useSuspenseFragment({
      fragment: postFieldsFragment,
      from: post,
    });

    mergeSnapshot({ child });
    return null;
  }

  using _disabledAct = disableActEnvironment();
  await render(<Parent />, {
    wrapper: ({ children }) => (
      <ApolloProvider client={client}>{children}</ApolloProvider>
    ),
  });

  {
    const { snapshot } = await takeRender();

    expect(snapshot).toEqual({
      parent: {
        data: {
          __typename: "Post",
          id: 1,
          title: "Blog post",
        },
      },
      child: {
        data: {
          __typename: "Post",
          updatedAt: "2024-01-01",
        },
      },
    });
  }

  client.writeFragment({
    fragment: postFragment,
    fragmentName: "PostFragment",
    data: {
      __typename: "Post",
      id: 1,
      title: "Blog post",
      updatedAt: "2024-02-01",
    },
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([Child]);
    expect(snapshot).toEqual({
      parent: {
        data: {
          __typename: "Post",
          id: 1,
          title: "Blog post",
        },
      },
      child: {
        data: {
          __typename: "Post",
          updatedAt: "2024-02-01",
        },
      },
    });
  }

  await expect(takeRender).not.toRerender();
});

test("tears down the subscription on unmount", async () => {
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

  const cache = new InMemoryCache();
  const client = new ApolloClient({ cache });

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });

  using _disabledAct = disableActEnvironment();
  const { unmount, takeSnapshot } = await renderHookToSnapshotStream(
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

    expect(data).toEqual({ __typename: "Item", id: 1, text: "Item #1" });
  }

  expect(cache["watches"].size).toBe(1);

  unmount();
  // We need to wait a tick since the cleanup is run in a setTimeout to
  // prevent strict mode bugs.
  await wait(0);

  expect(cache["watches"].size).toBe(0);
});

test("tears down all watches when rendering multiple records", async () => {
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

  const cache = new InMemoryCache();
  const client = new ApolloClient({ cache });

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 2, text: "Item #2" },
  });

  using _disabledAct = disableActEnvironment();
  const { unmount, rerender, takeSnapshot } = await renderHookToSnapshotStream(
    ({ id }) =>
      useSuspenseFragment({ fragment, from: { __typename: "Item", id } }),
    {
      initialProps: { id: 1 },
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const { data } = await takeSnapshot();

    expect(data).toEqual({ __typename: "Item", id: 1, text: "Item #1" });
  }

  await rerender({ id: 2 });

  {
    const { data } = await takeSnapshot();

    expect(data).toEqual({ __typename: "Item", id: 2, text: "Item #2" });
  }

  unmount();
  // We need to wait a tick since the cleanup is run in a setTimeout to
  // prevent strict mode bugs.
  await wait(0);

  expect(cache["watches"].size).toBe(0);
});

test("tears down watches after default autoDisposeTimeoutMs if component never renders again after suspending", async () => {
  jest.useFakeTimers();
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

  const cache = new InMemoryCache();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const link = new MockSubscriptionLink();
  const client = new ApolloClient({ link, cache });

  function App() {
    const [showItem, setShowItem] = React.useState(true);

    return (
      <ApolloProvider client={client}>
        <button onClick={() => setShowItem(false)}>Hide item</button>
        {showItem && (
          <Suspense fallback="Loading item...">
            <Item />
          </Suspense>
        )}
      </ApolloProvider>
    );
  }

  function Item() {
    const { data } = useSuspenseFragment({
      fragment,
      from: { __typename: "Item", id: 1 },
    });

    return <span>{data.text}</span>;
  }

  await renderAsync(<App />);

  // Ensure <Greeting /> suspends immediately
  expect(screen.getByText("Loading item...")).toBeInTheDocument();

  // Hide the greeting before it finishes loading data
  await act(() => user.click(screen.getByText("Hide item")));

  expect(screen.queryByText("Loading item...")).not.toBeInTheDocument();

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });

  // clear the microtask queue
  await act(() => Promise.resolve());

  expect(cache["watches"].size).toBe(1);

  jest.advanceTimersByTime(30_000);

  expect(cache["watches"].size).toBe(0);

  jest.useRealTimers();
});

test("tears down watches after configured autoDisposeTimeoutMs if component never renders again after suspending", async () => {
  jest.useFakeTimers();
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

  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const link = new MockSubscriptionLink();
  const cache = new InMemoryCache();
  const client = new ApolloClient({
    link,
    cache,
    defaultOptions: {
      react: {
        suspense: {
          autoDisposeTimeoutMs: 5000,
        },
      },
    },
  });

  function App() {
    const [showItem, setShowItem] = React.useState(true);

    return (
      <ApolloProvider client={client}>
        <button onClick={() => setShowItem(false)}>Hide item</button>
        {showItem && (
          <Suspense fallback="Loading item...">
            <Item />
          </Suspense>
        )}
      </ApolloProvider>
    );
  }

  function Item() {
    const { data } = useSuspenseFragment({
      fragment,
      from: { __typename: "Item", id: 1 },
    });

    return <span>{data.text}</span>;
  }

  await renderAsync(<App />);

  // Ensure <Greeting /> suspends immediately
  expect(screen.getByText("Loading item...")).toBeInTheDocument();

  // Hide the greeting before it finishes loading data
  await act(() => user.click(screen.getByText("Hide item")));

  expect(screen.queryByText("Loading item...")).not.toBeInTheDocument();

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });

  // clear the microtask queue
  await act(() => Promise.resolve());

  expect(cache["watches"].size).toBe(1);

  jest.advanceTimersByTime(5000);

  expect(cache["watches"].size).toBe(0);

  jest.useRealTimers();
});

test("cancels autoDisposeTimeoutMs if the component renders before timer finishes", async () => {
  jest.useFakeTimers();
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

  const link = new MockSubscriptionLink();
  const cache = new InMemoryCache();
  const client = new ApolloClient({ link, cache });

  function App() {
    return (
      <ApolloProvider client={client}>
        <Suspense fallback="Loading item...">
          <Item />
        </Suspense>
      </ApolloProvider>
    );
  }

  function Item() {
    const { data } = useSuspenseFragment({
      fragment,
      from: { __typename: "Item", id: 1 },
    });

    return <span>{data.text}</span>;
  }

  await renderAsync(<App />);

  // Ensure <Greeting /> suspends immediately
  expect(screen.getByText("Loading item...")).toBeInTheDocument();

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });

  // clear the microtask queue
  await act(() => Promise.resolve());

  await waitFor(() => {
    expect(screen.getByText("Item #1")).toBeInTheDocument();
  });

  jest.advanceTimersByTime(30_000);

  expect(cache["watches"].size).toBe(1);

  jest.useRealTimers();
});

describe.skip("type tests", () => {
  test("returns TData when from is a non-null value", () => {
    type Data = { foo: string };
    const fragment: TypedDocumentNode<Data> = gql``;

    {
      const { data } = useSuspenseFragment({
        fragment,
        from: { __typename: "Query" },
      });

      expectTypeOf(data).branded.toEqualTypeOf<Data>();
    }

    {
      const { data } = useSuspenseFragment<Data>({
        fragment: gql``,
        from: { __typename: "Query" },
      });

      expectTypeOf(data).branded.toEqualTypeOf<Data>();
    }
  });

  test("returns null when from is null", () => {
    type Data = { foo: string };
    type Vars = Record<string, never>;
    const fragment: TypedDocumentNode<Data, Vars> = gql``;

    {
      const { data } = useSuspenseFragment({ fragment, from: null });

      expectTypeOf(data).branded.toEqualTypeOf<null>();
    }

    {
      const { data } = useSuspenseFragment<Data>({
        fragment: gql``,
        from: null,
      });

      expectTypeOf(data).branded.toEqualTypeOf<null>();
    }
  });

  test("returns TData | null when from is nullable", () => {
    type Post = { __typename: "Post"; id: number };
    type Vars = Record<string, never>;
    const fragment: TypedDocumentNode<Post, Vars> = gql``;
    const author = {} as { post: Post | null };

    {
      const { data } = useSuspenseFragment({ fragment, from: author.post });

      expectTypeOf(data).branded.toEqualTypeOf<Post | null>();
    }

    {
      const { data } = useSuspenseFragment<Post>({
        fragment: gql``,
        from: author.post,
      });

      expectTypeOf(data).branded.toEqualTypeOf<Post | null>();
    }
  });

  test("variables are optional and can be anything with an untyped DocumentNode", () => {
    const fragment = gql``;

    useSuspenseFragment({ fragment, from: null });
    useSuspenseFragment({ fragment, from: null, variables: {} });
    useSuspenseFragment({ fragment, from: null, variables: { foo: "bar" } });
    useSuspenseFragment({ fragment, from: null, variables: { bar: "baz" } });
  });

  it("variables are optional and can be anything with unspecified TVariables on a TypedDocumentNode", () => {
    const fragment: TypedDocumentNode<{ greeting: string }> = gql``;

    useSuspenseFragment({ fragment, from: null });
    useSuspenseFragment({ fragment, from: null, variables: {} });
    useSuspenseFragment({ fragment, from: null, variables: { foo: "bar" } });
    useSuspenseFragment({ fragment, from: null, variables: { bar: "baz" } });
  });

  it("variables are optional and can be anything with OperationVariables on a TypedDocumentNode", () => {
    const fragment: TypedDocumentNode<
      { greeting: string },
      OperationVariables
    > = gql``;

    useSuspenseFragment({ fragment, from: null });
    useSuspenseFragment({ fragment, from: null, variables: {} });
    useSuspenseFragment({ fragment, from: null, variables: { foo: "bar" } });
    useSuspenseFragment({ fragment, from: null, variables: { bar: "baz" } });
  });

  it("variables are optional when TVariables are empty", () => {
    const fragment: TypedDocumentNode<
      { greeting: string },
      Record<string, never>
    > = gql``;

    useSuspenseFragment({ fragment, from: null });
    useSuspenseFragment({ fragment, from: null, variables: {} });
    // @ts-expect-error unknown variable
    useSuspenseFragment({ fragment, from: null, variables: { foo: "bar" } });
  });

  it("does not allow variables when TVariables is `never`", () => {
    const fragment: TypedDocumentNode<{ greeting: string }, never> = gql``;

    useSuspenseFragment({ fragment, from: null });
    useSuspenseFragment({ fragment, from: null, variables: {} });
    // @ts-expect-error no variables argument allowed
    useSuspenseFragment({ fragment, from: null, variables: { foo: "bar" } });
  });

  it("optional variables are optional to useSuspenseFragment", () => {
    const fragment: TypedDocumentNode<{ posts: string[] }, { limit?: number }> =
      gql``;

    useSuspenseFragment({ fragment, from: null });
    useSuspenseFragment({ fragment, from: null, variables: {} });
    useSuspenseFragment({ fragment, from: null, variables: { limit: 10 } });
    useSuspenseFragment({
      fragment,
      from: null,
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    useSuspenseFragment({
      fragment,
      from: null,
      variables: {
        limit: 10,
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  });

  it("enforces required variables when TVariables includes required variables", () => {
    const fragment: TypedDocumentNode<{ character: string }, { id: string }> =
      gql``;

    // @ts-expect-error missing variables argument
    useSuspenseFragment({ fragment, from: null });
    // @ts-expect-error empty variables
    useSuspenseFragment({ fragment, from: null, variables: {} });
    useSuspenseFragment({ fragment, from: null, variables: { id: "1" } });
    useSuspenseFragment({
      fragment,
      from: null,
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    useSuspenseFragment({
      fragment,
      from: null,
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  });

  it("requires variables with mixed TVariables", () => {
    const fragment: TypedDocumentNode<
      { character: string },
      { id: string; language?: string }
    > = gql``;

    // @ts-expect-error missing variables argument
    useSuspenseFragment({ fragment, from: null });
    // @ts-expect-error empty variables
    useSuspenseFragment({ fragment, from: null, variables: {} });
    useSuspenseFragment({ fragment, from: null, variables: { id: "1" } });
    useSuspenseFragment({
      fragment,
      from: null,
      // @ts-expect-error missing required variable
      variables: { language: "en" },
    });
    useSuspenseFragment({
      fragment,
      from: null,
      variables: { id: "1", language: "en" },
    });
    useSuspenseFragment({
      fragment,
      from: null,
      variables: {
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    useSuspenseFragment({
      fragment,
      from: null,
      variables: {
        id: "1",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
    useSuspenseFragment({
      fragment,
      from: null,
      variables: {
        id: "1",
        language: "en",
        // @ts-expect-error unknown variable
        foo: "bar",
      },
    });
  });
});
