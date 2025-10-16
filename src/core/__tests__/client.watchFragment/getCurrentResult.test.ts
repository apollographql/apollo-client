import type { TypedDocumentNode } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, InMemoryCache } from "@apollo/client";
import {
  ObservableStream,
  spyOnConsole,
} from "@apollo/client/testing/internal";

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

  expect(observable.getCurrentResult()).toStrictEqualTyped({
    data: [
      { __typename: "Item", id: 1, text: "Item #1" },
      { __typename: "Item", id: 2, text: "Item #2" },
      { __typename: "Item", id: 5, text: "Item #5" },
    ],
    dataState: "complete",
    complete: true,
  });

  client.writeFragment({
    fragment,
    data: { __typename: "Item", id: 2, text: "Item #2 updated" },
  });

  expect(observable.getCurrentResult()).toStrictEqualTyped({
    data: [
      { __typename: "Item", id: 1, text: "Item #1" },
      { __typename: "Item", id: 2, text: "Item #2 updated" },
      { __typename: "Item", id: 5, text: "Item #5" },
    ],
    dataState: "complete",
    complete: true,
  });
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

  expect(parentObservable.getCurrentResult()).toStrictEqualTyped({
    data: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 2 },
      { __typename: "Item", id: 5 },
    ],
    dataState: "complete",
    complete: true,
  });
  expect(childObservable.getCurrentResult()).toStrictEqualTyped({
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
    data: { __typename: "Item", id: 2, text: "Item #2 updated" },
  });

  expect(parentObservable.getCurrentResult()).toStrictEqualTyped({
    data: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 2 },
      { __typename: "Item", id: 5 },
    ],
    dataState: "complete",
    complete: true,
  });
  expect(childObservable.getCurrentResult()).toStrictEqualTyped({
    data: [
      { __typename: "Item", text: "Item #1" },
      { __typename: "Item", text: "Item #2 updated" },
      { __typename: "Item", text: "Item #5" },
    ],
    dataState: "complete",
    complete: true,
  });
});

test("works with data masking @unmask migrate mode", async () => {
  using consoleSpy = spyOnConsole("warn");
  type ItemDetails = {
    __typename: string;
    text: string;
  } & { " $fragmentName"?: "ItemDetailsFragment" };

  type Item = {
    __typename: string;
    id: number;
    text: string;
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
      ...ItemDetailsFragment @unmask(mode: "migrate")
    }

    ${detailsFragment}
  `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  for (let i = 1; i <= 5; i++) {
    client.writeFragment({
      fragment,
      fragmentName: "ItemFragment",
      data: { __typename: "Item", id: i, text: `Item #${i}` },
    });
  }

  const observable = client.watchFragment({
    fragment,
    fragmentName: "ItemFragment",
    from: [
      { __typename: "Item", id: 1 },
      { __typename: "Item", id: 2 },
      { __typename: "Item", id: 5 },
    ],
  });

  expect(observable.getCurrentResult()).toStrictEqualTyped({
    data: [
      { __typename: "Item", id: 1, text: "Item #1" },
      { __typename: "Item", id: 2, text: "Item #2" },
      { __typename: "Item", id: 5, text: "Item #5" },
    ],
    dataState: "complete",
    complete: true,
  });

  expect(console.warn).toHaveBeenCalledTimes(3);
  for (let i = 0; i < 3; i++) {
    expect(console.warn).toHaveBeenNthCalledWith(
      i + 1,
      expect.stringContaining("Accessing unmasked field on %s at path '%s'."),
      "fragment 'ItemFragment'",
      `[${i}].text`
    );
  }
  consoleSpy.warn.mockClear();

  client.writeFragment({
    fragment,
    fragmentName: "ItemFragment",
    data: { __typename: "Item", id: 2, text: "Item #2 updated" },
  });

  expect(observable.getCurrentResult()).toStrictEqualTyped({
    data: [
      { __typename: "Item", id: 1, text: "Item #1" },
      { __typename: "Item", id: 2, text: "Item #2 updated" },
      { __typename: "Item", id: 5, text: "Item #5" },
    ],
    dataState: "complete",
    complete: true,
  });

  expect(console.warn).toHaveBeenCalledTimes(3);
  for (let i = 0; i < 3; i++) {
    expect(console.warn).toHaveBeenNthCalledWith(
      i + 1,
      expect.stringContaining("Accessing unmasked field on %s at path '%s'."),
      "fragment 'ItemFragment'",
      `[${i}].text`
    );
  }
});
