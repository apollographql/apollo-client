import { ApolloLink } from "@apollo/client/link/core";
import { LocalResolversLink } from "@apollo/client/link/local-resolvers";
import { MockLink } from "@apollo/client/testing";
import {
  executeWithDefaultContext as execute,
  ObservableStream,
} from "@apollo/client/testing/internal";

import { gql } from "./testUtils.js";

test("handles @client fields inside fragments", async () => {
  const query = gql`
    fragment Foo on Foo {
      bar
      ...Foo2
    }
    fragment Foo2 on Foo {
      __typename
      baz @client
    }
    query Mixed {
      foo {
        ...Foo
      }
      bar {
        baz
      }
    }
  `;

  const serverQuery = gql`
    fragment Foo on Foo {
      bar
    }
    query Mixed {
      foo {
        ...Foo
      }
      bar {
        baz
      }
    }
  `;

  const mockLink = new MockLink([
    {
      request: { query: serverQuery },
      result: {
        data: { foo: { bar: true, __typename: `Foo` }, bar: { baz: true } },
      },
    },
  ]);

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Foo: {
        baz: () => false,
      },
    },
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      foo: { bar: true, baz: false, __typename: "Foo" },
      bar: { baz: true },
    },
  });

  await expect(stream).toComplete();
});

test("handles a mix of @client fields with fragments and server fields", async () => {
  const query = gql`
    fragment client on ClientData {
      bar
      __typename
    }

    query Mixed {
      foo @client {
        ...client
      }
      bar {
        baz
      }
    }
  `;

  const serverQuery = gql`
    query Mixed {
      bar {
        baz
      }
    }
  `;

  const mockLink = new MockLink([
    {
      request: { query: serverQuery },
      result: { data: { bar: { baz: true, __typename: "Bar" } } },
    },
  ]);

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        foo: () => ({ bar: true, __typename: "ClientData" }),
      },
    },
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      foo: { bar: true, __typename: "ClientData" },
      bar: { baz: true, __typename: "Bar" },
    },
  });

  await expect(stream).toComplete();
});
