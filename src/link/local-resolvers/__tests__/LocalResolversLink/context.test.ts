import { ApolloClient, InMemoryCache } from "@apollo/client";
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

test("passes apollo context to @client resolvers", async () => {
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

  const client = new ApolloClient({ cache: new InMemoryCache() });
  const stream = new ObservableStream(execute(link, { query }, { client }));

  await expect(stream).toEmitTypedValue({
    data: { foo: { __typename: "Foo", bar: 1 } },
  });

  await expect(stream).toComplete();

  expect(barResolver).toHaveBeenCalledWith(
    { __typename: "Foo" },
    null,
    {
      client,
      cache: client.cache,
    },
    {
      field: expect.objectContaining({
        name: { kind: "Name", value: "bar" },
      }),
      fragmentMap: expect.any(Object),
    }
  );
});

test("mixes apollo context and passed context to @client resolvers", async () => {
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

  const client = new ApolloClient({ cache: new InMemoryCache() });
  const stream = new ObservableStream(
    execute(link, { query, context: { id: 1 } }, { client })
  );

  await expect(stream).toEmitTypedValue({
    data: { foo: { __typename: "Foo", bar: 1 } },
  });

  await expect(stream).toComplete();

  expect(barResolver).toHaveBeenCalledWith(
    { __typename: "Foo" },
    null,
    {
      id: 1,
      client,
      cache: client.cache,
    },
    {
      field: expect.objectContaining({
        name: { kind: "Name", value: "bar" },
      }),
      fragmentMap: expect.any(Object),
    }
  );
});

test("overwrites client and cache fields if provided in context", async () => {
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

  const client = new ApolloClient({ cache: new InMemoryCache() });
  const stream = new ObservableStream(
    execute(
      link,
      { query, context: { client: "client", cache: "cache" } },
      { client }
    )
  );

  await expect(stream).toEmitTypedValue({
    data: { foo: { __typename: "Foo", bar: 1 } },
  });

  await expect(stream).toComplete();

  expect(barResolver).toHaveBeenCalledWith(
    { __typename: "Foo" },
    null,
    {
      client,
      cache: client.cache,
    },
    {
      field: expect.objectContaining({
        name: { kind: "Name", value: "bar" },
      }),
      fragmentMap: expect.any(Object),
    }
  );
});
