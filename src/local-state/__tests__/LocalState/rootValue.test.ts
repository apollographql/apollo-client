import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { LocalState } from "@apollo/client/local-state";

import { gql } from "./testUtils.js";

test("can pass `rootValue` as object that will be used with root client resolvers", async () => {
  const document = gql`
    query Test {
      foo @client {
        bar
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
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

  await expect(
    localState.execute({ document, client, context: {} })
  ).resolves.toStrictEqualTyped({
    data: { foo: { __typename: "Foo", bar: true } },
  });
});

test("can pass `rootValue` as function that will be used with root client resolvers", async () => {
  const document = gql`
    query Test {
      foo @client {
        bar
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const rootValue = jest.fn(() => ({ isBarEnabled: true }));
  const localState = new LocalState({
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

  await expect(
    localState.execute({ document, client, context: {} })
  ).resolves.toStrictEqualTyped({
    data: { foo: { __typename: "Foo", bar: true } },
  });

  expect(rootValue).toHaveBeenCalledTimes(1);
  expect(rootValue).toHaveBeenCalledWith({
    document,
    client,
    context: {},
    phase: "resolve",
    variables: {},
  });
});

test.each([
  ["string", "enabled"],
  ["number", 1],
  ["boolean", false],
  ["null", null],
  ["array", [1, 2, 3]],
])("can pass `rootValue` as %s", async (_type, rootValue) => {
  const document = gql`
    query Test {
      rootValue @client
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
    rootValue,
    resolvers: {
      Query: {
        rootValue: (rootValue) => rootValue,
      },
    },
  });

  await expect(
    localState.execute({ document, client, context: {} })
  ).resolves.toStrictEqualTyped({
    data: { rootValue },
  });
});
