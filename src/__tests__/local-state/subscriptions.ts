import { gql } from "graphql-tag";
import { of } from "rxjs";

import { InMemoryCache } from "@apollo/client/cache";
import { ApolloClient } from "@apollo/client/core";
import { ApolloLink } from "@apollo/client/link/core";
import { ObservableStream } from "@apollo/client/testing/internal";

describe("Basic functionality", () => {
  it("should not break subscriptions", async () => {
    const query = gql`
      subscription {
        field
      }
    `;

    const link = new ApolloLink(() =>
      of({ data: { field: 1 } }, { data: { field: 2 } })
    );

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      resolvers: {
        Query: {
          count: () => 0,
        },
      },
    });

    const stream = new ObservableStream(client.subscribe({ query }));

    await expect(stream).toEmitStrictTyped({ data: { field: 1 } });
    await expect(stream).toEmitStrictTyped({ data: { field: 2 } });
    await expect(stream).toComplete();
  });

  it("should be able to mix @client fields with subscription results", async () => {
    const query = gql`
      subscription {
        field
        count @client
      }
    `;

    const link = new ApolloLink(() =>
      of({ data: { field: 1 } }, { data: { field: 2 } })
    );

    let subCounter = 0;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      resolvers: {
        Subscription: {
          count: () => {
            subCounter += 1;
            return subCounter;
          },
        },
      },
    });

    const stream = new ObservableStream(client.subscribe({ query }));

    await expect(stream).toEmitStrictTyped({ data: { field: 1, count: 1 } });
    await expect(stream).toEmitStrictTyped({ data: { field: 2, count: 2 } });
    await expect(stream).toComplete();
  });
});
