import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { LocalState } from "@apollo/client/local-state";

import { gql } from "./testUtils.js";

test("passes client in context to resolvers", async () => {
  const document = gql`
    query WithContext {
      foo @client {
        bar
      }
    }
  `;

  const barResolver = jest.fn(() => 1);
  const localState = new LocalState({
    resolvers: {
      Query: {
        foo: () => ({ __typename: "Foo" }),
      },
      Foo: { bar: barResolver },
    },
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: undefined,
    })
  ).resolves.toStrictEqualTyped({
    data: { foo: { __typename: "Foo", bar: 1 } },
  });

  expect(barResolver).toHaveBeenCalledWith(
    { __typename: "Foo" },
    {},
    { context: {}, client, phase: "resolve" },
    {
      field: expect.objectContaining({
        name: { kind: "Name", value: "bar" },
      }),
      fragmentMap: expect.any(Object),
      path: ["foo", "bar"],
    }
  );
});

test("can access request context in resolvers", async () => {
  const document = gql`
    query WithContext {
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
    resolvers: {
      Query: {
        foo: () => ({ __typename: "Foo" }),
      },
      Foo: {
        bar: (_data, _args, { context: { id } }) => id,
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: { id: 1 },
      variables: {},
      remoteResult: undefined,
    })
  ).resolves.toStrictEqualTyped({
    data: { foo: { __typename: "Foo", bar: 1 } },
  });
});

test("can access phase in resolver context", async () => {
  const document = gql`
    query WithContext($phase: String!) {
      foo @client {
        bar @export(as: "phase")
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
    resolvers: {
      Query: {
        foo: () => ({ __typename: "Foo" }),
      },
      Foo: {
        bar: (_data, _args, { phase }) => phase,
      },
    },
  });

  await expect(
    localState.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).resolves.toStrictEqualTyped({
    phase: "exports",
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: undefined,
    })
  ).resolves.toStrictEqualTyped({
    data: { foo: { __typename: "Foo", bar: "resolve" } },
  });
});
