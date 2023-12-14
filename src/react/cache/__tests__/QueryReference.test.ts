import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  Observable,
} from "../../../core";
import { MockLink, wait } from "../../../testing";
import { spyOnConsole, setupSimpleCase } from "../../../testing/internal";
import { InternalQueryReference } from "../QueryReference";

test("warns when calling `retain` on a disposed query ref", async () => {
  using _consoleSpy = spyOnConsole("warn");
  const { query, mocks } = setupSimpleCase();
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });
  const observable = client.watchQuery({ query });

  const queryRef = new InternalQueryReference(observable, {});
  const dispose = queryRef.retain();

  dispose();

  await wait(0);

  queryRef.retain();

  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    expect.stringContaining("'retain' was called on a disposed queryRef")
  );
});

test("kicks off request immediately when created", async () => {
  const { query } = setupSimpleCase();
  let fetchCount = 0;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink((operation) => {
      fetchCount++;
      return Observable.of({ data: { greeting: "Hello" } });
    }),
  });

  const observable = client.watchQuery({ query });

  expect(fetchCount).toBe(0);
  new InternalQueryReference(observable, {});
  expect(fetchCount).toBe(1);
});
