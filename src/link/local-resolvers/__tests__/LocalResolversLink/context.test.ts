import { LocalResolversLink } from "@apollo/client/link/local-resolvers";
import {
  executeWithDefaultContext as execute,
  ObservableStream,
} from "@apollo/client/testing/internal";

import { gql } from "./testUtils.js";

test("passes context to @client resolvers", async () => {
  const query = gql`
    query WithContext {
      foo @client {
        bar
      }
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ __typename: "Foo" }),
      },
      Foo: {
        // @ts-expect-error FIXME before this is merged
        bar: (_data: any, _args: any, { id }: { id: number }) => id,
      },
    },
  });

  const stream = new ObservableStream(
    execute(link, { query, context: { id: 1 } })
  );

  await expect(stream).toEmitTypedValue({
    data: { foo: { __typename: "Foo", bar: 1 } },
  });

  await expect(stream).toComplete();
});
