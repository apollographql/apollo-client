import { equal } from "@wry/equality";

import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { LocalState } from "@apollo/client/local-state";

import { gql } from "./testUtils.js";

test("passes parent value as empty object to root resolver for client-only query", async () => {
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
    resolvers: {
      Query: {
        foo: (rootValue) => ({
          __typename: "Foo",
          bar: equal(rootValue, {}),
        }),
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

test("passes rootValue as remote result to root resolver when server fields are present", async () => {
  const document = gql`
    query Test {
      foo @client {
        bar
      }
      bar {
        baz
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const fooResolver = jest.fn(() => ({
    __typename: "Foo",
    bar: true,
  }));
  const localState = new LocalState({
    resolvers: {
      Query: {
        foo: fooResolver,
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: { data: { bar: { __typename: "Bar", baz: true } } },
    })
  ).resolves.toStrictEqualTyped({
    data: {
      foo: { __typename: "Foo", bar: true },
      bar: { __typename: "Bar", baz: true },
    },
  });

  expect(fooResolver).toHaveBeenCalledWith(
    {
      bar: { __typename: "Bar", baz: true },
    },
    expect.anything(),
    expect.anything(),
    expect.anything()
  );
});

test("passes rootValue as empty object when getting exported variables with no cache data", async () => {
  const document = gql`
    query Test($foo: FooInput) {
      foo @client @export(as: "foo") {
        bar
      }
      bar {
        baz
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const fooResolver = jest.fn(() => ({
    __typename: "Foo",
    bar: true,
  }));
  const localState = new LocalState({
    resolvers: {
      Query: {
        foo: fooResolver,
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
  ).resolves.toStrictEqualTyped({ foo: { bar: true } });

  expect(fooResolver).toHaveBeenCalledWith(
    {},
    expect.anything(),
    expect.anything(),
    expect.anything()
  );
});
