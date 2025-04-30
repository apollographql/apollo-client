import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { LocalResolversLink } from "@apollo/client/link/local-resolvers";
import {
  executeWithDefaultContext as execute,
  ObservableStream,
} from "@apollo/client/testing/internal";

import { gql } from "./testUtils.js";

test("passes operation in context to resolvers", async () => {
  const query = gql`
    query WithContext {
      foo @client {
        bar
      }
    }
  `;

  const barResolver = jest.fn(() => 1);
  const link = new LocalResolversLink({
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
  const stream = new ObservableStream(execute(link, { query }, { client }));

  await expect(stream).toEmitTypedValue({
    data: { foo: { __typename: "Foo", bar: 1 } },
  });

  await expect(stream).toComplete();

  expect(barResolver).toHaveBeenCalledWith(
    { __typename: "Foo" },
    {},
    {
      operation: expect.objectContaining({
        query,
        client,
        variables: {},
        operationName: "WithContext",
      }),
    },
    {
      field: expect.objectContaining({
        name: { kind: "Name", value: "bar" },
      }),
      fragmentMap: expect.any(Object),
      path: ["foo", "bar"],
    }
  );
});

test("can access request context through operation.getContext in resolvers", async () => {
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
        bar: (_data: any, _args: any, { operation }) =>
          operation.getContext().id,
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
