import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";

import type { TypedDocumentNode } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, InMemoryCache } from "@apollo/client";
import { useFragment } from "@apollo/client/react";
import { createClientWrapper } from "@apollo/client/testing/internal";

test("can use array for `from` to get array of items", async () => {
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
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useFragment({
        fragment,
        from: [
          { __typename: "Item", id: 1 },
          { __typename: "Item", id: 2 },
          { __typename: "Item", id: 5 },
        ],
      }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: [
      { __typename: "Item", id: 1, text: "Item #1" },
      { __typename: "Item", id: 2, text: "Item #2" },
      { __typename: "Item", id: 5, text: "Item #5" },
    ],
    dataState: "complete",
    complete: true,
  });

  await expect(takeSnapshot).not.toRerender();
});

test("returns result as complete for null array item `from` value", async () => {
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
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useFragment({
        fragment,
        from: [null, null, null],
      }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: [null, null, null],
    dataState: "complete",
    complete: true,
  });

  await expect(takeSnapshot).not.toRerender();
});

test("returns as partial if some `from` items are incomplete mixed with null", async () => {
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
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useFragment({
        fragment,
        from: [null, null, { __typename: "Item", id: 5 }],
      }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: [null, null, null],
    dataState: "partial",
    complete: false,
    missing: {
      2: "Dangling reference to missing Item:5 object",
    },
  });

  await expect(takeSnapshot).not.toRerender();
});

test("allows mix of array identifiers", async () => {
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
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useFragment({
        fragment,
        from: [{ __typename: "Item", id: 1 }, "Item:2", null],
      }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: [
      { __typename: "Item", id: 1, text: "Item #1" },
      { __typename: "Item", id: 2, text: "Item #2" },
      null,
    ],
    dataState: "complete",
    complete: true,
  });

  await expect(takeSnapshot).not.toRerender();
});

test("returns empty array with empty from", async () => {
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
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useFragment({ fragment, from: [] }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: [],
    dataState: "complete",
    complete: true,
  });
  await expect(takeSnapshot).not.toRerender();
});

test("returns incomplete results when cache is empty", async () => {
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
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useFragment({
        fragment,
        from: [
          { __typename: "Item", id: 1 },
          { __typename: "Item", id: 2 },
          { __typename: "Item", id: 5 },
        ],
      }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: [null, null, null],
    dataState: "partial",
    complete: false,
    missing: {
      0: "Dangling reference to missing Item:1 object",
      1: "Dangling reference to missing Item:2 object",
      2: "Dangling reference to missing Item:5 object",
    },
  });

  await expect(takeSnapshot).not.toRerender();
});

test("can use static arrays with useFragment with partially fulfilled items", async () => {
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
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useFragment({
        fragment,
        from: [
          { __typename: "Item", id: 1 },
          { __typename: "Item", id: 2 },
          { __typename: "Item", id: 5 },
        ],
      }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: [
      { __typename: "Item", id: 1, text: "Item #1" },
      { __typename: "Item", id: 2, text: "Item #2" },
      null,
    ],
    dataState: "partial",
    complete: false,
    missing: {
      2: "Dangling reference to missing Item:5 object",
    },
  });

  await expect(takeSnapshot).not.toRerender();
});

test("handles changing array size", async () => {
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
  const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
    ({ from }) => useFragment({ fragment, from }),
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

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: [
      { __typename: "Item", id: 1, text: "Item #1" },
      { __typename: "Item", id: 2, text: "Item #2" },
    ],
    dataState: "complete",
    complete: true,
  });

  await rerender({
    from: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 2 },
      { __typename: "Item", id: 5 },
    ],
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: [
      { __typename: "Item", id: 1, text: "Item #1" },
      { __typename: "Item", id: 2, text: "Item #2" },
      { __typename: "Item", id: 5, text: "Item #5" },
    ],
    dataState: "complete",
    complete: true,
  });

  await rerender({
    from: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 5 },
    ],
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: [
      { __typename: "Item", id: 1, text: "Item #1" },
      { __typename: "Item", id: 5, text: "Item #5" },
    ],
    dataState: "complete",
    complete: true,
  });

  await rerender({
    from: [],
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: [],
    dataState: "complete",
    complete: true,
  });

  await rerender({
    from: [{ __typename: "Item", id: 6 }],
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: [null],
    dataState: "partial",
    complete: false,
    missing: {
      0: "Dangling reference to missing Item:6 object",
    },
  });

  await expect(takeSnapshot).not.toRerender();
});

test("updates items in the array with cache writes", async () => {
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

  for (let i = 1; i <= 2; i++) {
    client.writeFragment({
      fragment,
      data: { __typename: "Item", id: i, text: `Item #${i}` },
    });
  }

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useFragment({
        fragment,
        from: [
          { __typename: "Item", id: 1 },
          { __typename: "Item", id: 2 },
          { __typename: "Item", id: 5 },
        ],
      }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: [
      { __typename: "Item", id: 1, text: "Item #1" },
      { __typename: "Item", id: 2, text: "Item #2" },
      null,
    ],
    dataState: "partial",
    complete: false,
    missing: {
      2: "Dangling reference to missing Item:5 object",
    },
  });

  client.writeFragment({
    fragment,
    data: {
      __typename: "Item",
      id: 2,
      text: "Item #2 updated",
    },
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: [
      { __typename: "Item", id: 1, text: "Item #1" },
      { __typename: "Item", id: 2, text: "Item #2 updated" },
      null,
    ],
    dataState: "partial",
    complete: false,
    missing: {
      2: "Dangling reference to missing Item:5 object",
    },
  });

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

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: [
      { __typename: "Item", id: 1, text: "Item #1 from batch" },
      { __typename: "Item", id: 2, text: "Item #2 updated" },
      { __typename: "Item", id: 5, text: "Item #5 from batch" },
    ],
    dataState: "complete",
    complete: true,
  });

  cache.modify({
    id: cache.identify({ __typename: "Item", id: 1 }),
    fields: {
      text: (_, { DELETE }) => DELETE,
    },
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 2, text: "Item #2 updated" },
      { __typename: "Item", id: 5, text: "Item #5 from batch" },
    ],
    dataState: "partial",
    complete: false,
    missing: {
      0: {
        text: "Can't find field 'text' on Item:1 object",
      },
    },
  });

  // should not cause rerender since its an item not watched
  client.writeFragment({
    fragment,
    data: {
      __typename: "Item",
      id: 6,
      text: "Item #6 ignored",
    },
  });

  await expect(takeSnapshot).not.toRerender();
});
