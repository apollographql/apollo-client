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

test("can pass `rootValue` as function that will be used with root client resolvers", async () => {
  const query = gql`
    query Test {
      foo @client {
        bar
      }
    }
  `;

  const rootValue = jest.fn(() => ({ isBarEnabled: true }));
  const link = new LocalResolversLink({
    rootValue,
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

  expect(rootValue).toHaveBeenCalledTimes(1);
  expect(rootValue).toHaveBeenCalledWith({
    operation: expect.objectContaining({ query, operationName: "Test" }),
  });
});

test.each([
  ["string", "enabled"],
  ["number", 1],
  ["boolean", false],
  ["null", null],
  ["array", [1, 2, 3]],
])("can pass `rootValue` as %s", async (_type, rootValue) => {
  const query = gql`
    query Test {
      rootValue @client
    }
  `;

  const link = new LocalResolversLink({
    rootValue,
    resolvers: {
      Query: {
        rootValue: (rootValue) => rootValue,
      },
    },
  });

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: { rootValue },
  });

  await expect(stream).toComplete();
});
