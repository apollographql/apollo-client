import type { TypedDocumentNode } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, InMemoryCache } from "@apollo/client";
import { ObservableStream } from "@apollo/client/testing/internal";

test("can use list for `from` to get list of items", async () => {
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

  await expect(stream).toEmitTypedValue([
    {
      data: { __typename: "Item", id: 1, text: "Item #1" },
      dataState: "complete",
      complete: true,
    },
    {
      data: { __typename: "Item", id: 2, text: "Item #2" },
      dataState: "complete",
      complete: true,
    },
    {
      data: { __typename: "Item", id: 5, text: "Item #5" },
      dataState: "complete",
      complete: true,
    },
  ]);

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

  await expect(stream).toEmitTypedValue([
    {
      data: { __typename: "Item", id: 1, text: "Item #1" },
      dataState: "complete",
      complete: true,
    },
    {
      data: { __typename: "Item", id: 2, text: "Item #2" },
      dataState: "complete",
      complete: true,
    },
    {
      data: { __typename: "Item", id: 3, text: "Item #3" },
      dataState: "complete",
      complete: true,
    },
  ]);

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

  for (let i = 1; i <= 5; i++) {
    client.writeFragment({
      fragment,
      data: { __typename: "Item", id: i, text: `Item #${i}` },
    });
  }

  const observable = client.watchFragment({ fragment, from: [] });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue([]);
  await expect(stream).not.toEmitAnything();
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

  const observable = client.watchFragment({
    fragment,
    from: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 2 },
      { __typename: "Item", id: 5 },
    ],
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue([
    {
      data: {},
      dataState: "partial",
      complete: false,
      missing: "Dangling reference to missing Item:1 object",
    },
    {
      data: {},
      dataState: "partial",
      complete: false,
      missing: "Dangling reference to missing Item:2 object",
    },
    {
      data: {},
      dataState: "partial",
      complete: false,
      missing: "Dangling reference to missing Item:5 object",
    },
  ]);

  await expect(stream).not.toEmitAnything();
});

test("can use static lists with useFragment with partially fulfilled items", async () => {
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

  await expect(stream).toEmitTypedValue([
    {
      data: { __typename: "Item", id: 1, text: "Item #1" },
      dataState: "complete",
      complete: true,
    },
    {
      data: { __typename: "Item", id: 2, text: "Item #2" },
      dataState: "complete",
      complete: true,
    },
    {
      data: {},
      dataState: "partial",
      complete: false,
      missing: "Dangling reference to missing Item:5 object",
    },
  ]);

  await expect(stream).not.toEmitAnything();
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

  const observable = client.watchFragment({
    fragment,
    from: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 2 },
    ],
  });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue([
    {
      data: { __typename: "Item", id: 1, text: "Item #1" },
      dataState: "complete",
      complete: true,
    },
    {
      data: { __typename: "Item", id: 2, text: "Item #2" },
      dataState: "complete",
      complete: true,
    },
  ]);

  observable.reobserve({
    from: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 2 },
      { __typename: "Item", id: 5 },
    ],
  });

  await expect(stream).toEmitTypedValue([
    {
      data: { __typename: "Item", id: 1, text: "Item #1" },
      dataState: "complete",
      complete: true,
    },
    {
      data: { __typename: "Item", id: 2, text: "Item #2" },
      dataState: "complete",
      complete: true,
    },
    {
      data: { __typename: "Item", id: 5, text: "Item #5" },
      dataState: "complete",
      complete: true,
    },
  ]);

  observable.reobserve({
    from: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 5 },
    ],
  });

  await expect(stream).toEmitTypedValue([
    {
      data: { __typename: "Item", id: 1, text: "Item #1" },
      dataState: "complete",
      complete: true,
    },
    {
      data: { __typename: "Item", id: 5, text: "Item #5" },
      dataState: "complete",
      complete: true,
    },
  ]);

  observable.reobserve({
    from: [],
  });

  await expect(stream).toEmitTypedValue([]);

  observable.reobserve({
    from: [{ __typename: "Item", id: 6 }],
  });

  await expect(stream).toEmitTypedValue([
    {
      data: {},
      dataState: "partial",
      complete: false,
      missing: "Dangling reference to missing Item:6 object",
    },
  ]);

  await expect(stream).not.toEmitAnything();
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

  await expect(stream).toEmitTypedValue([
    {
      data: { __typename: "Item", id: 1, text: "Item #1" },
      dataState: "complete",
      complete: true,
    },
    {
      data: { __typename: "Item", id: 2, text: "Item #2" },
      dataState: "complete",
      complete: true,
    },
    {
      data: {},
      dataState: "partial",
      complete: false,
      missing: "Dangling reference to missing Item:5 object",
    },
  ]);

  client.writeFragment({
    fragment,
    data: {
      __typename: "Item",
      id: 2,
      text: "Item #2 updated",
    },
  });

  await expect(stream).toEmitTypedValue([
    {
      data: { __typename: "Item", id: 1, text: "Item #1" },
      dataState: "complete",
      complete: true,
    },
    {
      data: { __typename: "Item", id: 2, text: "Item #2 updated" },
      dataState: "complete",
      complete: true,
    },
    {
      data: {},
      dataState: "partial",
      complete: false,
      missing: "Dangling reference to missing Item:5 object",
    },
  ]);

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

  await expect(stream).toEmitTypedValue([
    {
      data: { __typename: "Item", id: 1, text: "Item #1 from batch" },
      dataState: "complete",
      complete: true,
    },
    {
      data: { __typename: "Item", id: 2, text: "Item #2 updated" },
      dataState: "complete",
      complete: true,
    },
    {
      data: {},
      dataState: "partial",
      complete: false,
      missing: "Dangling reference to missing Item:5 object",
    },
  ]);

  await expect(stream).toEmitTypedValue([
    {
      data: { __typename: "Item", id: 1, text: "Item #1 from batch" },
      dataState: "complete",
      complete: true,
    },
    {
      data: { __typename: "Item", id: 2, text: "Item #2 updated" },
      dataState: "complete",
      complete: true,
    },
    {
      data: { __typename: "Item", id: 5, text: "Item #5 from batch" },
      dataState: "complete",
      complete: true,
    },
  ]);

  cache.modify({
    id: cache.identify({ __typename: "Item", id: 1 }),
    fields: {
      text: (_, { DELETE }) => DELETE,
    },
  });

  await expect(stream).toEmitTypedValue([
    {
      data: { __typename: "Item", id: 1 },
      dataState: "partial",
      complete: false,
      missing: {
        text: "Can't find field 'text' on Item:1 object",
      },
    },
    {
      data: { __typename: "Item", id: 2, text: "Item #2 updated" },
      dataState: "complete",
      complete: true,
    },
    {
      data: { __typename: "Item", id: 5, text: "Item #5 from batch" },
      dataState: "complete",
      complete: true,
    },
  ]);

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
