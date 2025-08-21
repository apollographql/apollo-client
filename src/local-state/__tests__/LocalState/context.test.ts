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
    { requestContext: {}, client, phase: "resolve" },
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
        bar: (_data, _args, { requestContext: { id } }) => id,
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

test("can use custom context function used as request context", async () => {
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
    context: () => ({ isBarEnabled: true }),
    resolvers: {
      Query: {
        foo: () => ({ __typename: "Foo" }),
      },
      Foo: {
        bar: (_data, _args, { requestContext: { isBarEnabled } }) =>
          isBarEnabled,
      },
    },
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
    data: { foo: { __typename: "Foo", bar: true } },
  });
});

test("context function can merge request context and custom context", async () => {
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
    context: ({ requestContext }) => ({
      ...requestContext,
      isBarEnabled: true,
    }),
    resolvers: {
      Query: {
        foo: () => ({ __typename: "Foo" }),
      },
      Foo: {
        bar: (
          _data,
          _args,
          { requestContext: { isRequestBarEnabled, isBarEnabled } }
        ) => isRequestBarEnabled && isBarEnabled,
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: { isRequestBarEnabled: true },
      variables: {},
      remoteResult: undefined,
    })
  ).resolves.toStrictEqualTyped({
    data: { foo: { __typename: "Foo", bar: true } },
  });
});
