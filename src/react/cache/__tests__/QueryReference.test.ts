import { ApolloClient, InMemoryCache } from "../../../core";
import { MockLink, MockedResponse, wait } from "../../../testing";
import {
  SimpleCaseData,
  spyOnConsole,
  useSimpleCase,
} from "../../../testing/internal";
import { InternalQueryReference } from "../QueryReference";

function createDefaultClient(mocks: MockedResponse[]) {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink(mocks),
  });
}

test("warns when calling `retain` on a disposed query ref", async () => {
  using _consoleSpy = spyOnConsole("warn");
  const { query, mocks } = useSimpleCase();
  const client = createDefaultClient(mocks);
  const observable = client.watchQuery<SimpleCaseData, Record<string, never>>({
    query,
  });

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
