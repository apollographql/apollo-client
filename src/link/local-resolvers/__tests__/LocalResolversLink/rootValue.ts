import { LocalResolversLink } from "@apollo/client/link/local-resolvers";
import {
  executeWithDefaultContext as execute,
  ObservableStream,
} from "@apollo/client/testing/internal";

import { gql } from "./testUtils.js";

test("can pass `rootValue` as object that will be used with root client resolvers", async () => {
  const query = gql`
    query Test {
      foo @client {
        bar
      }
    }
  `;

  const link = new LocalResolversLink({
    rootValue: {
      isBarEnabled: true,
    },
    resolvers: {
      Query: {
        foo: (rootValue) => ({
          __typename: "Foo",
          bar: rootValue.isBarEnabled,
        }),
      },
    },
  });

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: { foo: { __typename: "Foo", bar: true } },
  });

  await expect(stream).toComplete();
});
