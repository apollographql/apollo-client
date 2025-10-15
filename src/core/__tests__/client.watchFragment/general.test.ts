import type { TypedDocumentNode } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, InMemoryCache } from "@apollo/client";
import { ObservableStream } from "@apollo/client/testing/internal";

test("can subscribe multiple times to watchFragment", async () => {
  type Item = {
    __typename: string;
    id: number;
    text?: string;
  };

  const ItemFragment: TypedDocumentNode<Item> = gql`
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
    fragment: ItemFragment,
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });

  const observable = client.watchFragment({
    fragment: ItemFragment,
    from: { __typename: "Item", id: 1 },
  });

  using stream1 = new ObservableStream(observable);
  using stream2 = new ObservableStream(observable);

  await expect(stream1).toEmitTypedValue({
    data: { __typename: "Item", id: 1, text: "Item #1" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream2).toEmitTypedValue({
    data: { __typename: "Item", id: 1, text: "Item #1" },
    dataState: "complete",
    complete: true,
  });

  client.writeFragment({
    fragment: ItemFragment,
    data: { __typename: "Item", id: 1, text: "Item #1 updated" },
  });

  await expect(stream1).toEmitTypedValue({
    data: { __typename: "Item", id: 1, text: "Item #1 updated" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream2).toEmitTypedValue({
    data: { __typename: "Item", id: 1, text: "Item #1 updated" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream1).not.toEmitAnything();
  await expect(stream2).not.toEmitAnything();
});

test("dedupes watches when subscribing multiple times", async () => {
  type Item = {
    __typename: string;
    id: number;
    text?: string;
  };

  const ItemFragment: TypedDocumentNode<Item> = gql`
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
  jest.spyOn(cache, "watch");

  client.writeFragment({
    fragment: ItemFragment,
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });

  const observable = client.watchFragment({
    fragment: ItemFragment,
    from: { __typename: "Item", id: 1 },
  });

  const sub1 = observable.subscribe(() => {});
  const sub2 = observable.subscribe(() => {});
  expect(client.cache.watch).toHaveBeenCalledTimes(1);

  const sub3 = observable.subscribe(() => {});
  expect(client.cache.watch).toHaveBeenCalledTimes(1);
  expect(cache["watches"].size).toBe(1);

  [sub1, sub2, sub3].forEach((sub) => sub.unsubscribe());

  const sub4 = observable.subscribe(() => {});
  expect(cache.watch).toHaveBeenCalledTimes(2);
  expect(cache["watches"].size).toBe(1);

  sub4.unsubscribe();
  expect(cache["watches"].size).toBe(0);
});
