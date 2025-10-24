import type { TypedDocumentNode } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, InMemoryCache } from "@apollo/client";
import { ObservableStream, wait } from "@apollo/client/testing/internal";

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

  const observable = client.watchFragment({
    fragment,
    from: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 2 },
      { __typename: "Item", id: 5 },
    ],
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1, text: "Item #1" },
      { __typename: "Item", id: 2, text: "Item #2" },
      { __typename: "Item", id: 5, text: "Item #5" },
    ],
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
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

  const observable = client.watchFragment({
    fragment,
    from: [{ __typename: "Item", id: 1 }, "Item:2", { __ref: "Item:3" }],
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1, text: "Item #1" },
      { __typename: "Item", id: 2, text: "Item #2" },
      { __typename: "Item", id: 3, text: "Item #3" },
    ],
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
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

  const observable = client.watchFragment({ fragment, from: [] });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: [],
    dataState: "complete",
    complete: true,
  });
  await expect(stream).not.toEmitAnything();
});

test("returns result as partial when cache is empty", async () => {
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

  const observable = client.watchFragment({
    fragment,
    from: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 2 },
      { __typename: "Item", id: 5 },
    ],
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: [null, null, null],
    dataState: "partial",
    complete: false,
    missing: {
      0: "Dangling reference to missing Item:1 object",
      1: "Dangling reference to missing Item:2 object",
      2: "Dangling reference to missing Item:5 object",
    },
  });

  await expect(stream).not.toEmitAnything();
});

test("returns as complete if all `from` items are null", async () => {
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

  const observable = client.watchFragment({
    fragment,
    from: [null, null, null],
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: [null, null, null],
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("returns as complete if all `from` items are complete or null", async () => {
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

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 5, text: "Item #5" },
  });

  const observable = client.watchFragment({
    fragment,
    from: [null, null, { __typename: "Item", id: 5 }],
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: [null, null, { __typename: "Item", id: 5, text: "Item #5" }],
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
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

  const observable = client.watchFragment({
    fragment,
    from: [null, null, { __typename: "Item", id: 5 }],
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: [null, null, null],
    dataState: "partial",
    complete: false,
    missing: {
      2: "Dangling reference to missing Item:5 object",
    },
  });

  await expect(stream).not.toEmitAnything();
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

  const observable = client.watchFragment({
    fragment,
    from: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 2 },
      { __typename: "Item", id: 5 },
    ],
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1, text: "Item #1" },
      { __typename: "Item", id: 2, text: "Item #2" },
      null,
    ],
    dataState: "partial",
    complete: false,
    missing: { 2: "Dangling reference to missing Item:5 object" },
  });

  await expect(stream).not.toEmitAnything();
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

  const observable = client.watchFragment({
    fragment,
    from: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 2 },
      { __typename: "Item", id: 5 },
    ],
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
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

  await expect(stream).toEmitTypedValue({
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

  await expect(stream).toEmitTypedValue({
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

  await expect(stream).toEmitTypedValue({
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

  await expect(stream).not.toEmitAnything();
});

test("works with data masking", async () => {
  type ItemDetails = {
    __typename: string;
    text: string;
  } & { " $fragmentName"?: "ItemDetailsFragment" };

  type Item = {
    __typename: string;
    id: number;
  } & {
    " $fragmentRefs"?: { ItemDetailsFragment: ItemDetails };
  };

  const detailsFragment: TypedDocumentNode<ItemDetails> = gql`
    fragment ItemDetailsFragment on Item {
      text
    }
  `;

  const fragment: TypedDocumentNode<Item> = gql`
    fragment ItemFragment on Item {
      id
      ...ItemDetailsFragment
    }

    ${detailsFragment}
  `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });
  const { cache } = client;

  for (let i = 1; i <= 5; i++) {
    client.writeFragment({
      fragment,
      fragmentName: "ItemFragment",
      data: { __typename: "Item", id: i, text: `Item #${i}` },
    });
  }

  const parentObservable = client.watchFragment({
    fragment,
    fragmentName: "ItemFragment",
    from: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 2 },
      { __typename: "Item", id: 5 },
    ],
  });
  const childObservable = client.watchFragment({
    fragment: detailsFragment,
    from: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 2 },
      { __typename: "Item", id: 5 },
    ],
  });
  const parentStream = new ObservableStream(parentObservable);
  const childStream = new ObservableStream(childObservable);

  await expect(parentStream).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 2 },
      { __typename: "Item", id: 5 },
    ],
    dataState: "complete",
    complete: true,
  });
  await expect(childStream).toEmitTypedValue({
    data: [
      { __typename: "Item", text: "Item #1" },
      { __typename: "Item", text: "Item #2" },
      { __typename: "Item", text: "Item #5" },
    ],
    dataState: "complete",
    complete: true,
  });

  client.writeFragment({
    fragment,
    fragmentName: "ItemFragment",
    data: {
      __typename: "Item",
      id: 2,
      text: "Item #2 updated",
    },
  });

  await expect(childStream).toEmitTypedValue({
    data: [
      { __typename: "Item", text: "Item #1" },
      { __typename: "Item", text: "Item #2 updated" },
      { __typename: "Item", text: "Item #5" },
    ],
    dataState: "complete",
    complete: true,
  });
  await expect(parentStream).not.toEmitAnything();

  client.cache.batch({
    update: (cache) => {
      cache.writeFragment({
        fragment,
        fragmentName: "ItemFragment",
        data: {
          __typename: "Item",
          id: 1,
          text: "Item #1 from batch",
        },
      });

      cache.writeFragment({
        fragment,
        fragmentName: "ItemFragment",
        data: {
          __typename: "Item",
          id: 5,
          text: "Item #5 from batch",
        },
      });
    },
  });

  await expect(childStream).toEmitTypedValue({
    data: [
      { __typename: "Item", text: "Item #1 from batch" },
      { __typename: "Item", text: "Item #2 updated" },
      { __typename: "Item", text: "Item #5 from batch" },
    ],
    dataState: "complete",
    complete: true,
  });

  await expect(parentStream).not.toEmitAnything();

  cache.modify({
    id: cache.identify({ __typename: "Item", id: 1 }),
    fields: {
      text: (_, { DELETE }) => DELETE,
    },
  });

  await expect(childStream).toEmitTypedValue({
    data: [
      { __typename: "Item" },
      { __typename: "Item", text: "Item #2 updated" },
      { __typename: "Item", text: "Item #5 from batch" },
    ],
    dataState: "partial",
    complete: false,
    missing: {
      0: {
        text: "Can't find field 'text' on Item:1 object",
      },
    },
  });
  await expect(parentStream).not.toEmitAnything();

  // should not cause rerender since its an item not watched
  client.writeFragment({
    fragment,
    fragmentName: "ItemFragment",
    data: {
      __typename: "Item",
      id: 6,
      text: "Item #6 ignored",
    },
  });

  await expect(parentStream).not.toEmitAnything();
  await expect(childStream).not.toEmitAnything();
});

test("can subscribe to the same object multiple times", async () => {
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

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });
  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 2, text: "Item #2" },
  });

  const stream1 = new ObservableStream(
    client.watchFragment({
      fragment,
      from: [
        { __typename: "Item", id: 1 },
        { __typename: "Item", id: 1 },
      ],
    })
  );
  // ensure we only watch the item once
  expect(cache).toHaveNumWatches(1);

  await expect(stream1).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1, text: "Item #1" },
      { __typename: "Item", id: 1, text: "Item #1" },
    ],
    dataState: "complete",
    complete: true,
  });

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: `Item #1 updated` },
  });

  await expect(stream1).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1, text: "Item #1 updated" },
      { __typename: "Item", id: 1, text: "Item #1 updated" },
    ],
    dataState: "complete",
    complete: true,
  });

  const stream2 = new ObservableStream(
    client.watchFragment({
      fragment,
      from: [
        { __typename: "Item", id: 1 },
        { __typename: "Item", id: 1 },
        { __typename: "Item", id: 1 },
      ],
    })
  );
  expect(cache).toHaveNumWatches(1);

  await expect(stream2).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1, text: "Item #1 updated" },
      { __typename: "Item", id: 1, text: "Item #1 updated" },
      { __typename: "Item", id: 1, text: "Item #1 updated" },
    ],
    dataState: "complete",
    complete: true,
  });

  const stream3 = new ObservableStream(
    client.watchFragment({
      fragment,
      from: [
        { __typename: "Item", id: 1 },
        { __typename: "Item", id: 2 },
        { __typename: "Item", id: 1 },
      ],
    })
  );
  expect(cache).toHaveNumWatches(2);

  await expect(stream3).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1, text: "Item #1 updated" },
      { __typename: "Item", id: 2, text: "Item #2" },
      { __typename: "Item", id: 1, text: "Item #1 updated" },
    ],
    dataState: "complete",
    complete: true,
  });

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: `Item #1 updated again` },
  });

  await expect(stream3).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1, text: "Item #1 updated again" },
      { __typename: "Item", id: 2, text: "Item #2" },
      { __typename: "Item", id: 1, text: "Item #1 updated again" },
    ],
    dataState: "complete",
    complete: true,
  });
  await expect(stream2).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1, text: "Item #1 updated again" },
      { __typename: "Item", id: 1, text: "Item #1 updated again" },
      { __typename: "Item", id: 1, text: "Item #1 updated again" },
    ],
    dataState: "complete",
    complete: true,
  });
  await expect(stream1).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1, text: "Item #1 updated again" },
      { __typename: "Item", id: 1, text: "Item #1 updated again" },
    ],
    dataState: "complete",
    complete: true,
  });

  await Promise.all([
    expect(stream1).not.toEmitAnything(),
    expect(stream2).not.toEmitAnything(),
    expect(stream3).not.toEmitAnything(),
  ]);

  expect(client).toHaveFragmentWatchesOn(fragment, [
    { id: "Item:1", optimistic: true },
    { id: "Item:2", optimistic: true },
  ]);

  stream3.unsubscribe();
  await wait(2);

  expect(cache).toHaveNumWatches(1);
  expect(client).toHaveFragmentWatchesOn(fragment, [
    { id: "Item:1", optimistic: true },
  ]);

  stream1.unsubscribe();
  await wait(2);

  expect(cache).toHaveNumWatches(1);
  expect(client).toHaveFragmentWatchesOn(fragment, [
    { id: "Item:1", optimistic: true },
  ]);

  stream2.unsubscribe();
  await wait(2);

  expect(cache).toHaveNumWatches(0);
});

test("differentiates watches between optimistic and variables", async () => {
  type Item = {
    __typename: string;
    id: number;
    text?: string;
  };

  const fragment: TypedDocumentNode<Item> = gql`
    fragment ItemFragment on Item {
      id
      text(casing: $casing)
    }
  `;

  const cache = new InMemoryCache();
  const client = new ApolloClient({
    cache,
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "ITEM #1" },
    variables: { casing: "UPPER" },
  });
  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "item #1" },
    variables: { casing: "LOWER" },
  });
  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 2, text: "item #2" },
    variables: { casing: "LOWER" },
  });

  const stream1 = new ObservableStream(
    client.watchFragment({
      fragment,
      from: [
        { __typename: "Item", id: 1 },
        { __typename: "Item", id: 1 },
      ],
      variables: { casing: "UPPER" },
    })
  );
  // ensure we only watch the item once
  expect(cache).toHaveNumWatches(1);

  await expect(stream1).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1, text: "ITEM #1" },
      { __typename: "Item", id: 1, text: "ITEM #1" },
    ],
    dataState: "complete",
    complete: true,
  });

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "ITEM #1 UPDATED" },
    variables: { casing: "UPPER" },
  });

  await expect(stream1).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1, text: "ITEM #1 UPDATED" },
      { __typename: "Item", id: 1, text: "ITEM #1 UPDATED" },
    ],
    dataState: "complete",
    complete: true,
  });

  const stream2 = new ObservableStream(
    client.watchFragment({
      fragment,
      from: [
        { __typename: "Item", id: 1 },
        { __typename: "Item", id: 1 },
        { __typename: "Item", id: 1 },
      ],
      variables: { casing: "LOWER" },
    })
  );
  expect(cache).toHaveNumWatches(2);

  await expect(stream2).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1, text: "item #1" },
      { __typename: "Item", id: 1, text: "item #1" },
      { __typename: "Item", id: 1, text: "item #1" },
    ],
    dataState: "complete",
    complete: true,
  });

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "item #1 updated" },
    variables: { casing: "LOWER" },
  });

  await expect(stream2).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1, text: "item #1 updated" },
      { __typename: "Item", id: 1, text: "item #1 updated" },
      { __typename: "Item", id: 1, text: "item #1 updated" },
    ],
    dataState: "complete",
    complete: true,
  });
  await expect(stream1).not.toEmitAnything();

  const stream3 = new ObservableStream(
    client.watchFragment({
      fragment,
      from: [
        { __typename: "Item", id: 1 },
        { __typename: "Item", id: 2 },
        { __typename: "Item", id: 1 },
      ],
      variables: { casing: "LOWER" },
      optimistic: false,
    })
  );
  expect(cache).toHaveNumWatches(4);

  await expect(stream3).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1, text: "item #1 updated" },
      { __typename: "Item", id: 2, text: "item #2" },
      { __typename: "Item", id: 1, text: "item #1 updated" },
    ],
    dataState: "complete",
    complete: true,
  });

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "item #1 updated again" },
    variables: { casing: "LOWER" },
  });

  await expect(stream3).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1, text: "item #1 updated again" },
      { __typename: "Item", id: 2, text: "item #2" },
      { __typename: "Item", id: 1, text: "item #1 updated again" },
    ],
    dataState: "complete",
    complete: true,
  });
  await expect(stream2).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1, text: "item #1 updated again" },
      { __typename: "Item", id: 1, text: "item #1 updated again" },
      { __typename: "Item", id: 1, text: "item #1 updated again" },
    ],
    dataState: "complete",
    complete: true,
  });
  await expect(stream1).not.toEmitAnything();

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "FULL REPLACEMENT" },
    variables: { casing: "UPPER" },
  });

  await expect(stream1).toEmitTypedValue({
    data: [
      { __typename: "Item", id: 1, text: "FULL REPLACEMENT" },
      { __typename: "Item", id: 1, text: "FULL REPLACEMENT" },
    ],
    dataState: "complete",
    complete: true,
  });
  await expect(stream2).not.toEmitAnything();
  await expect(stream3).not.toEmitAnything();

  expect(cache).toHaveNumWatches(4);
  expect(client).toHaveFragmentWatchesOn(fragment, [
    { id: "Item:1", optimistic: true, variables: { casing: "UPPER" } },
    { id: "Item:1", optimistic: true, variables: { casing: "LOWER" } },
    { id: "Item:1", optimistic: false, variables: { casing: "LOWER" } },
    { id: "Item:2", optimistic: false, variables: { casing: "LOWER" } },
  ]);

  stream3.unsubscribe();
  await wait(2);

  expect(cache).toHaveNumWatches(2);
  expect(client).toHaveFragmentWatchesOn(fragment, [
    { id: "Item:1", optimistic: true, variables: { casing: "UPPER" } },
    { id: "Item:1", optimistic: true, variables: { casing: "LOWER" } },
  ]);

  stream1.unsubscribe();
  await wait(2);

  expect(cache).toHaveNumWatches(1);
  expect(client).toHaveFragmentWatchesOn(fragment, [
    { id: "Item:1", optimistic: true, variables: { casing: "LOWER" } },
  ]);

  stream2.unsubscribe();
  await wait(2);

  expect(cache).toHaveNumWatches(0);
});
