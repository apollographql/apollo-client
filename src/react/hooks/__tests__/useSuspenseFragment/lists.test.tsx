import type { RenderOptions } from "@testing-library/react";
import {
  createRenderStream,
  disableActEnvironment,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import React, { Suspense } from "react";

import type { TypedDocumentNode } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, InMemoryCache } from "@apollo/client";
import { useSuspenseFragment } from "@apollo/client/react";
import { createClientWrapper } from "@apollo/client/testing/internal";

async function renderUseSuspenseFragment<TData, Props = never>(
  renderHook: (props: Props) => useSuspenseFragment.Result<TData>,
  options: Pick<RenderOptions, "wrapper"> & { initialProps?: Props }
) {
  function UseSuspenseFragment({ props }: { props: Props | undefined }) {
    useTrackRenders({ name: "useSuspenseFragment" });
    replaceSnapshot(renderHook(props as any));

    return null;
  }

  function SuspenseFallback() {
    useTrackRenders({ name: "SuspenseFallback" });

    return null;
  }

  function App({ props }: { props: Props | undefined }) {
    return (
      <Suspense fallback={<SuspenseFallback />}>
        <UseSuspenseFragment props={props} />
      </Suspense>
    );
  }

  const { render, takeRender, replaceSnapshot } =
    createRenderStream<useSuspenseFragment.Result<TData>>();

  const utils = await render(<App props={options.initialProps} />, options);

  function rerender(props: Props) {
    return utils.rerender(<App props={props} />);
  }

  return { takeRender, rerender };
}

test("renders list and does not suspend list for `from` array when written to cache", async () => {
  type Item = {
    __typename: string;
    id: number;
    text?: string;
  };

  const fragment: TypedDocumentNode<Item> = gql`
    fragment ItemFragment on Item {
      id
      text
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  for (let i = 1; i <= 5; i++) {
    client.writeFragment({
      fragment,
      data: { __typename: "Item", id: i, text: `Item #${i}` },
    });
  }

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderUseSuspenseFragment(
    () =>
      useSuspenseFragment({
        fragment,
        from: [
          { __typename: "Item", id: 1 },
          { __typename: "Item", id: 2 },
          { __typename: "Item", id: 5 },
        ],
      }),
    { wrapper: createClientWrapper(client) }
  );

  const { renderedComponents, snapshot } = await takeRender();

  expect(renderedComponents).toStrictEqual(["useSuspenseFragment"]);
  expect(snapshot).toStrictEqualTyped({
    data: [
      { __typename: "Item", id: 1, text: "Item #1" },
      { __typename: "Item", id: 2, text: "Item #2" },
      { __typename: "Item", id: 5, text: "Item #5" },
    ],
  });

  await expect(takeRender).not.toRerender();
});

test("updates items in the list with cache writes", async () => {
  type Item = {
    __typename: string;
    id: number;
    text?: string;
  };

  const fragment: TypedDocumentNode<Item> = gql`
    fragment ItemFragment on Item {
      id
      text
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });
  const { cache } = client;

  for (let i = 1; i <= 5; i++) {
    client.writeFragment({
      fragment,
      data: { __typename: "Item", id: i, text: `Item #${i}` },
    });
  }

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderUseSuspenseFragment(
    () =>
      useSuspenseFragment({
        fragment,
        from: [
          { __typename: "Item", id: 1 },
          { __typename: "Item", id: 2 },
          { __typename: "Item", id: 5 },
        ],
      }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents, snapshot } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseFragment"]);
    expect(snapshot).toStrictEqualTyped({
      data: [
        { __typename: "Item", id: 1, text: "Item #1" },
        { __typename: "Item", id: 2, text: "Item #2" },
        { __typename: "Item", id: 5, text: "Item #5" },
      ],
    });
  }

  client.writeFragment({
    fragment,
    data: {
      __typename: "Item",
      id: 2,
      text: "Item #2 updated",
    },
  });

  {
    const { renderedComponents, snapshot } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseFragment"]);
    expect(snapshot).toStrictEqualTyped({
      data: [
        { __typename: "Item", id: 1, text: "Item #1" },
        { __typename: "Item", id: 2, text: "Item #2 updated" },
        { __typename: "Item", id: 5, text: "Item #5" },
      ],
    });
  }

  client.cache.batch({
    update: (cache) => {
      cache.writeFragment({
        fragment,
        data: {
          __typename: "Item",
          id: 1,
          text: "Item #1 from batch",
        },
      });

      cache.writeFragment({
        fragment,
        data: {
          __typename: "Item",
          id: 5,
          text: "Item #5 from batch",
        },
      });
    },
  });

  {
    const { renderedComponents, snapshot } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseFragment"]);
    expect(snapshot).toStrictEqualTyped({
      data: [
        { __typename: "Item", id: 1, text: "Item #1 from batch" },
        { __typename: "Item", id: 2, text: "Item #2 updated" },
        { __typename: "Item", id: 5, text: "Item #5 from batch" },
      ],
    });
  }

  // should not cause rerender since its an item not watched
  client.writeFragment({
    fragment,
    data: {
      __typename: "Item",
      id: 6,
      text: "Item #6 ignored",
    },
  });

  await expect(takeRender).not.toRerender();
});

test("does not suspend and returns null array for null `from` array", async () => {
  type Item = {
    __typename: string;
    id: number;
    text?: string;
  };

  const fragment: TypedDocumentNode<Item> = gql`
    fragment ItemFragment on Item {
      id
      text
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderUseSuspenseFragment(
    () => useSuspenseFragment({ fragment, from: [null, null, null] }),
    { wrapper: createClientWrapper(client) }
  );

  const { renderedComponents, snapshot } = await takeRender();

  expect(renderedComponents).toStrictEqual(["useSuspenseFragment"]);
  expect(snapshot).toStrictEqualTyped({
    data: [null, null, null],
  });

  await expect(takeRender).not.toRerender();
});

test("handles mixed array of identifiers in `from`", async () => {
  type Item = {
    __typename: string;
    id: number;
    text?: string;
  };

  const fragment: TypedDocumentNode<Item> = gql`
    fragment ItemFragment on Item {
      id
      text
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  for (let i = 1; i <= 5; i++) {
    client.writeFragment({
      fragment,
      data: { __typename: "Item", id: i, text: `Item #${i}` },
    });
  }

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderUseSuspenseFragment(
    () =>
      useSuspenseFragment({
        fragment,
        from: [{ __typename: "Item", id: 1 }, "Item:2", null],
      }),
    { wrapper: createClientWrapper(client) }
  );

  const { renderedComponents, snapshot } = await takeRender();

  expect(renderedComponents).toStrictEqual(["useSuspenseFragment"]);
  expect(snapshot).toStrictEqualTyped({
    data: [
      { __typename: "Item", id: 1, text: "Item #1" },
      { __typename: "Item", id: 2, text: "Item #2" },
      null,
    ],
  });

  await expect(takeRender).not.toRerender();
});

test("does not suspend and returns empty array for empty `from` array", async () => {
  type Item = {
    __typename: string;
    id: number;
    text?: string;
  };

  const fragment: TypedDocumentNode<Item> = gql`
    fragment ItemFragment on Item {
      id
      text
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  for (let i = 1; i <= 5; i++) {
    client.writeFragment({
      fragment,
      data: { __typename: "Item", id: i, text: `Item #${i}` },
    });
  }

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderUseSuspenseFragment(
    () => useSuspenseFragment({ fragment, from: [] }),
    { wrapper: createClientWrapper(client) }
  );

  const { renderedComponents, snapshot } = await takeRender();

  expect(renderedComponents).toStrictEqual(["useSuspenseFragment"]);
  expect(snapshot).toStrictEqualTyped({
    data: [],
  });

  await expect(takeRender).not.toRerender();
});

test("suspends until all items are complete", async () => {
  type Item = {
    __typename: string;
    id: number;
    text?: string;
  };

  const fragment: TypedDocumentNode<Item> = gql`
    fragment ItemFragment on Item {
      id
      text
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderUseSuspenseFragment(
    () =>
      useSuspenseFragment({
        fragment,
        from: [
          { __typename: "Item", id: 1 },
          { __typename: "Item", id: 2 },
          { __typename: "Item", id: 5 },
        ],
      }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });

  await expect(takeRender).not.toRerender({ timeout: 20 });

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 2, text: "Item #2" },
  });

  await expect(takeRender).not.toRerender({ timeout: 20 });

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 5, text: "Item #5" },
  });

  {
    const { renderedComponents, snapshot } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseFragment"]);
    expect(snapshot).toStrictEqualTyped({
      data: [
        { __typename: "Item", id: 1, text: "Item #1" },
        { __typename: "Item", id: 2, text: "Item #2" },
        { __typename: "Item", id: 5, text: "Item #5" },
      ],
    });
  }

  await expect(takeRender).not.toRerender();
});

test("suspends until all items are complete with partially complete results on initial render", async () => {
  type Item = {
    __typename: string;
    id: number;
    text?: string;
  };

  const fragment: TypedDocumentNode<Item> = gql`
    fragment ItemFragment on Item {
      id
      text
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  for (let i = 1; i <= 2; i++) {
    client.writeFragment({
      fragment,
      data: { __typename: "Item", id: i, text: `Item #${i}` },
    });
  }

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderUseSuspenseFragment(
    () =>
      useSuspenseFragment({
        fragment,
        from: [
          { __typename: "Item", id: 1 },
          { __typename: "Item", id: 2 },
          { __typename: "Item", id: 5 },
        ],
      }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 5, text: "Item #5" },
  });

  {
    const { renderedComponents, snapshot } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseFragment"]);
    expect(snapshot).toStrictEqualTyped({
      data: [
        { __typename: "Item", id: 1, text: "Item #1" },
        { __typename: "Item", id: 2, text: "Item #2" },
        { __typename: "Item", id: 5, text: "Item #5" },
      ],
    });
  }

  await expect(takeRender).not.toRerender();
});

test("suspends when an item changes from complete to partial", async () => {
  type Item = {
    __typename: string;
    id: number;
    text?: string;
  };

  const fragment: TypedDocumentNode<Item> = gql`
    fragment ItemFragment on Item {
      id
      text
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  for (let i = 1; i <= 5; i++) {
    client.writeFragment({
      fragment,
      data: { __typename: "Item", id: i, text: `Item #${i}` },
    });
  }

  using _disabledAct = disableActEnvironment();
  const { takeRender } = await renderUseSuspenseFragment(
    () =>
      useSuspenseFragment({
        fragment,
        from: [
          { __typename: "Item", id: 1 },
          { __typename: "Item", id: 2 },
          { __typename: "Item", id: 5 },
        ],
      }),
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents, snapshot } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseFragment"]);
    expect(snapshot).toStrictEqualTyped({
      data: [
        { __typename: "Item", id: 1, text: "Item #1" },
        { __typename: "Item", id: 2, text: "Item #2" },
        { __typename: "Item", id: 5, text: "Item #5" },
      ],
    });
  }

  client.cache.modify({
    id: client.cache.identify({ __typename: "Item", id: 1 }),
    fields: {
      text: (_, { DELETE }) => DELETE,
    },
  });

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  client.cache.modify({
    id: client.cache.identify({ __typename: "Item", id: 1 }),
    fields: {
      text: () => "Item #1 is back",
    },
  });

  {
    const { renderedComponents, snapshot } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseFragment"]);
    expect(snapshot).toStrictEqualTyped({
      data: [
        { __typename: "Item", id: 1, text: "Item #1 is back" },
        { __typename: "Item", id: 2, text: "Item #2" },
        { __typename: "Item", id: 5, text: "Item #5" },
      ],
    });
  }

  await expect(takeRender).not.toRerender();
});

test("handles changing list size", async () => {
  type Item = {
    __typename: string;
    id: number;
    text?: string;
  };

  const fragment: TypedDocumentNode<Item> = gql`
    fragment ItemFragment on Item {
      id
      text
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  for (let i = 1; i <= 5; i++) {
    client.writeFragment({
      fragment,
      data: { __typename: "Item", id: i, text: `Item #${i}` },
    });
  }

  using _disabledAct = disableActEnvironment();
  const { takeRender, rerender } = await renderUseSuspenseFragment(
    ({ from }) => useSuspenseFragment({ fragment, from }),
    {
      initialProps: {
        from: [
          { __typename: "Item", id: 1 },
          { __typename: "Item", id: 2 },
        ],
      },
      wrapper: createClientWrapper(client),
    }
  );

  {
    const { renderedComponents, snapshot } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseFragment"]);
    expect(snapshot).toStrictEqualTyped({
      data: [
        { __typename: "Item", id: 1, text: "Item #1" },
        { __typename: "Item", id: 2, text: "Item #2" },
      ],
    });
  }

  await rerender({
    from: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 2 },
      { __typename: "Item", id: 5 },
    ],
  });

  {
    const { renderedComponents, snapshot } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseFragment"]);
    expect(snapshot).toStrictEqualTyped({
      data: [
        { __typename: "Item", id: 1, text: "Item #1" },
        { __typename: "Item", id: 2, text: "Item #2" },
        { __typename: "Item", id: 5, text: "Item #5" },
      ],
    });
  }

  await rerender({
    from: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 5 },
    ],
  });

  {
    const { renderedComponents, snapshot } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseFragment"]);
    expect(snapshot).toStrictEqualTyped({
      data: [
        { __typename: "Item", id: 1, text: "Item #1" },
        { __typename: "Item", id: 5, text: "Item #5" },
      ],
    });
  }

  await rerender({
    from: [],
  });

  {
    const { renderedComponents, snapshot } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseFragment"]);
    expect(snapshot).toStrictEqualTyped({
      data: [],
    });
  }

  await rerender({
    from: [{ __typename: "Item", id: 6 }],
  });

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual(["SuspenseFallback"]);
  }

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 6, text: "Item #6" },
  });

  {
    const { renderedComponents, snapshot } = await takeRender();

    expect(renderedComponents).toStrictEqual(["useSuspenseFragment"]);
    expect(snapshot).toStrictEqualTyped({
      data: [{ __typename: "Item", id: 6, text: "Item #6" }],
    });
  }

  await expect(takeRender).not.toRerender();
});
