import type { TypedDocumentNode } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, InMemoryCache } from "@apollo/client";
import { ObservableStream } from "@apollo/client/testing/internal";

interface Item {
  __typename: "Item";
  id: number;
  text: string;
}

test("getCurrentResult returns initial result before subscribing", async () => {
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
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });

  const observable = client.watchFragment({
    fragment,
    from: { __typename: "Item", id: 1 },
  });

  expect(observable.getCurrentResult()).toStrictEqualTyped({
    data: { __typename: "Item", id: 1, text: "Item #1" },
    dataState: "complete",
    complete: true,
  });
});

test("getCurrentResult returns initial emitted value after subscribing", async () => {
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
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });

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

  expect(observable.getCurrentResult()).toStrictEqualTyped({
    data: { __typename: "Item", id: 1, text: "Item #1" },
    dataState: "complete",
    complete: true,
  });
});

test("getCurrentResult returns most recently emitted value", async () => {
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
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });

  const observable = client.watchFragment({
    fragment,
    from: { __typename: "Item", id: 1 },
  });
  const stream = new ObservableStream(observable);

  let lastResult = observable.getCurrentResult();
  expect(lastResult).toStrictEqualTyped({
    data: { __typename: "Item", id: 1, text: "Item #1" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { __typename: "Item", id: 1, text: "Item #1" },
    dataState: "complete",
    complete: true,
  });

  expect(observable.getCurrentResult()).toBe(lastResult);

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "Item #1 updated" },
  });

  await expect(stream).toEmitTypedValue({
    data: { __typename: "Item", id: 1, text: "Item #1 updated" },
    dataState: "complete",
    complete: true,
  });

  expect(observable.getCurrentResult()).toStrictEqualTyped({
    data: { __typename: "Item", id: 1, text: "Item #1 updated" },
    dataState: "complete",
    complete: true,
  });
});

test("getCurrentResult returns most recently emitted value", async () => {
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
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });

  const observable = client.watchFragment({
    fragment,
    from: { __typename: "Item", id: 1 },
  });
  const stream = new ObservableStream(observable);

  let lastResult = observable.getCurrentResult();
  expect(lastResult).toStrictEqualTyped({
    data: { __typename: "Item", id: 1, text: "Item #1" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { __typename: "Item", id: 1, text: "Item #1" },
    dataState: "complete",
    complete: true,
  });

  expect(observable.getCurrentResult()).toBe(lastResult);

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "Item #1 updated" },
  });

  await expect(stream).toEmitTypedValue({
    data: { __typename: "Item", id: 1, text: "Item #1 updated" },
    dataState: "complete",
    complete: true,
  });

  expect(observable.getCurrentResult()).toStrictEqualTyped({
    data: { __typename: "Item", id: 1, text: "Item #1 updated" },
    dataState: "complete",
    complete: true,
  });
});

test("getCurrentResult returns most recently emitted value", async () => {
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
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });

  const observable = client.watchFragment({
    fragment,
    from: { __typename: "Item", id: 1 },
  });
  const stream = new ObservableStream(observable);

  let lastResult = observable.getCurrentResult();
  expect(lastResult).toStrictEqualTyped({
    data: { __typename: "Item", id: 1, text: "Item #1" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).toEmitTypedValue({
    data: { __typename: "Item", id: 1, text: "Item #1" },
    dataState: "complete",
    complete: true,
  });

  expect(observable.getCurrentResult()).toBe(lastResult);

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "Item #1 updated" },
  });

  await expect(stream).toEmitTypedValue({
    data: { __typename: "Item", id: 1, text: "Item #1 updated" },
    dataState: "complete",
    complete: true,
  });

  expect(observable.getCurrentResult()).toStrictEqualTyped({
    data: { __typename: "Item", id: 1, text: "Item #1 updated" },
    dataState: "complete",
    complete: true,
  });
});

test("getCurrentResult returns updated value if changed before subscribing", async () => {
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
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });

  const observable = client.watchFragment({
    fragment,
    from: { __typename: "Item", id: 1 },
  });

  expect(observable.getCurrentResult()).toStrictEqualTyped({
    data: { __typename: "Item", id: 1, text: "Item #1" },
    dataState: "complete",
    complete: true,
  });

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 1, text: "Item #1 updated" },
  });

  expect(observable.getCurrentResult()).toStrictEqualTyped({
    data: { __typename: "Item", id: 1, text: "Item #1 updated" },
    dataState: "complete",
    complete: true,
  });
});

test("getCurrentResult returns referentially stable value when called multiple times", async () => {
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
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });

  const observable = client.watchFragment({
    fragment,
    from: { __typename: "Item", id: 1 },
  });

  const lastResult = observable.getCurrentResult();
  expect(lastResult).toStrictEqualTyped({
    data: { __typename: "Item", id: 1, text: "Item #1" },
    dataState: "complete",
    complete: true,
  });

  expect(observable.getCurrentResult()).toBe(lastResult);
  expect(observable.getCurrentResult()).toBe(lastResult);
  expect(observable.getCurrentResult()).toBe(lastResult);
});

test("getCurrentResult returns empty result with no cache data", async () => {
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
    from: { __typename: "Item", id: 1 },
  });

  expect(observable.getCurrentResult()).toStrictEqualTyped({
    data: {},
    dataState: "partial",
    complete: false,
    missing: "Dangling reference to missing Item:1 object",
  });
});

test("getCurrentResult is lazy computed", async () => {
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

  jest.spyOn(cache, "diff");

  const observable = client.watchFragment({
    fragment,
    from: { __typename: "Item", id: 1 },
  });

  expect(cache.diff).not.toHaveBeenCalled();

  expect(observable.getCurrentResult()).toStrictEqualTyped({
    data: {},
    dataState: "partial",
    complete: false,
    missing: "Dangling reference to missing Item:1 object",
  });

  expect(cache.diff).toHaveBeenCalledTimes(1);
});

test("getCurrentResult handles arrays", async () => {
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

  expect(observable.getCurrentResult()).toStrictEqualTyped([
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
});
