import { gql } from "graphql-tag";

import { Observable } from "../../utilities/index.js";
import { ApolloLink } from "../../link/core/index.js";
import { ApolloClient } from "../../core/index.js";
import { InMemoryCache } from "../../cache/index.js";
import { ObservableStream } from "../../testing/internal/index.js";

describe("Basic functionality", () => {
  it("should not break subscriptions", async () => {
    const query = gql`
      subscription {
        field
      }
    `;

    const link = new ApolloLink(() =>
      Observable.of({ data: { field: 1 } }, { data: { field: 2 } })
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

    await expect(stream).toEmitValue({ data: { field: 1 } });
    await expect(stream).toEmitValue({ data: { field: 2 } });
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
      Observable.of({ data: { field: 1 } }, { data: { field: 2 } })
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

    await expect(stream).toEmitValue({ data: { field: 1, count: 1 } });
    await expect(stream).toEmitValue({ data: { field: 2, count: 2 } });
    await expect(stream).toComplete();
  });
});
