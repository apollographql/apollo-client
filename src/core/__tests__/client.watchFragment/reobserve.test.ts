import { waitFor } from "@testing-library/react";

import type { TypedDocumentNode } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, InMemoryCache } from "@apollo/client";
import { ObservableStream } from "@apollo/client/testing/internal";

test("throws when changing `from` option from array to non-array", async () => {
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

  const observableArray = client.watchFragment({
    fragment,
    from: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 2 },
    ],
  });

  expect(() =>
    observableArray.reobserve({
      // @ts-expect-error
      from: { __typename: "Item", id: 2 },
    })
  ).toThrow(
    "Cannot change `from` option from array to non-array. Please provide `from` as an array."
  );
});

test("throws when changing `from` option from non-array to array", async () => {
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

  const observableArray = client.watchFragment({
    fragment,
    from: { __typename: "Item", id: 1 },
  });

  expect(() =>
    observableArray.reobserve({
      // @ts-expect-error
      from: [{ __typename: "Item", id: 2 }],
    })
  ).toThrow(
    "Cannot change `from` option from non-array to array. Please provide `from` as an accepted non-array value."
  );
});

test("can change size of lists with reobserve", async () => {
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

  const cache = new InMemoryCache();
  const client = new ApolloClient({
    cache,
    link: ApolloLink.empty(),
  });

  for (let i = 1; i <= 5; i++) {
    client.writeFragment({
      fragment,
      data: { __typename: "Item", id: i, text: `Item #${i}` },
    });
  }

  const observable = client.watchFragment({
    fragment,
    from: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 2 },
    ] as Array<Item | null>,
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1, text: "Item #1" },
      { __typename: "Item", id: 2, text: "Item #2" },
    ],
    dataState: "complete",
    complete: true,
  });

  observable.reobserve({
    from: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 2 },
      { __typename: "Item", id: 5 },
    ],
  });

  await expect(stream).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1, text: "Item #1" },
      { __typename: "Item", id: 2, text: "Item #2" },
      { __typename: "Item", id: 5, text: "Item #5" },
    ],
    dataState: "complete",
    complete: true,
  });

  observable.reobserve({
    from: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 5 },
    ],
  });

  await expect(stream).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1, text: "Item #1" },
      { __typename: "Item", id: 5, text: "Item #5" },
    ],
    dataState: "complete",
    complete: true,
  });

  observable.reobserve({ from: [] });

  await expect(stream).toEmitTypedValue({
    data: [],
    dataState: "complete",
    complete: true,
  });

  // watches are unsubscribed in a setTimeout. Wait for them all to
  // unsubcribe to ensure the change is picked up when reobserved
  await waitFor(() => expect(cache).toHaveNumWatches(0));
  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "Item #1 updated" },
  });

  observable.reobserve({
    from: [{ __typename: "Item", id: 1 }],
  });

  await expect(stream).toEmitTypedValue({
    data: [{ __typename: "Item", id: 1, text: "Item #1 updated" }],
    dataState: "complete",
    complete: true,
  });

  observable.reobserve({
    from: [{ __typename: "Item", id: 6 }],
  });

  await expect(stream).toEmitTypedValue({
    data: [null],
    dataState: "partial",
    complete: false,
    missing: {
      0: "Dangling reference to missing Item:6 object",
    },
  });

  observable.reobserve({
    from: [null],
  });

  await expect(stream).toEmitTypedValue({
    data: [null],
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("can reorder same array list", async () => {
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

  const observable = client.watchFragment({
    fragment,
    from: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 2 },
    ],
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1, text: "Item #1" },
      { __typename: "Item", id: 2, text: "Item #2" },
    ],
    dataState: "complete",
    complete: true,
  });

  observable.reobserve({
    from: [
      { __typename: "Item", id: 2 },
      { __typename: "Item", id: 1 },
    ],
  });

  await expect(stream).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 2, text: "Item #2" },
      { __typename: "Item", id: 1, text: "Item #1" },
    ],
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("can change observed non-array entity with reobserve", async () => {
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

  const observable = client.watchFragment({
    fragment,
    from: { __typename: "Item", id: 1 },
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: { __typename: "Item", id: 1, text: "Item #1" },
    dataState: "complete",
    complete: true,
  });

  observable.reobserve({
    from: { __typename: "Item", id: 2 },
  });

  await expect(stream).toEmitTypedValue({
    data: { __typename: "Item", id: 2, text: "Item #2" },
    dataState: "complete",
    complete: true,
  });

  observable.reobserve({
    from: { __typename: "Item", id: 5 },
  });

  await expect(stream).toEmitTypedValue({
    data: { __typename: "Item", id: 5, text: "Item #5" },
    dataState: "complete",
    complete: true,
  });

  observable.reobserve({
    from: { __typename: "Item", id: 6 },
  });

  await expect(stream).toEmitTypedValue({
    data: {},
    dataState: "partial",
    complete: false,
    missing: "Dangling reference to missing Item:6 object",
  });

  await expect(stream).not.toEmitAnything();
});
