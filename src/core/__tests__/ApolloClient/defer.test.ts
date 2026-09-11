import gql from "graphql-tag";

import { InMemoryCache } from "../../../cache";
import { MockSubscriptionLink } from "../../../testing/core";
import { ObservableStream, spyOnConsole } from "../../../testing/internal";
import { ApolloClient } from "../../ApolloClient";
import { NetworkStatus } from "../../networkStatus";

const query = gql`
  query Q {
    post {
      id
      __typename
      comments {
        id
        __typename
        text
        author {
          id
          __typename
          name
        }
      }
      ...CommentDetails @defer
    }
  }
  fragment CommentDetails on Post {
    id
    __typename
    comments {
      id
      __typename
      likes
      author {
        id
        __typename
        badge {
          id
          __typename
        }
      }
    }
  }
`;

describe("@defer", () => {
  test("userland cache writes warn about missing fields in deferred fragments", () => {
    using spy = spyOnConsole("error");

    const cache = new InMemoryCache();

    cache.writeQuery({
      query,
      data: {
        post: {
          __typename: "Post",
          id: "p1",
          comments: [
            {
              __typename: "Comment",
              id: "c1",
              text: "first!",
              author: {
                __typename: "Author",
                id: "a1",
                name: "x",
              },
            },
          ],
        },
      },
    });

    expect(spy.error).toHaveBeenCalledTimes(2);
    expect(spy.error).toHaveBeenCalledWith(
      expect.stringContaining("Missing field"),
      "likes",
      expect.anything()
    );
    expect(spy.error).toHaveBeenCalledWith(
      expect.stringContaining("Missing field"),
      "badge",
      expect.anything()
    );
  });

  test("deeply nested defer doesn't cause cache to log errors about missing fields", async () => {
    using spy = spyOnConsole("error");

    const link = new MockSubscriptionLink();

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });
    const stream = new ObservableStream(client.watchQuery({ query }));

    const initialData = {
      post: {
        __typename: "Post",
        id: "p1",
        comments: [
          {
            __typename: "Comment",
            id: "c1",
            text: "first!",
            author: {
              __typename: "Author",
              id: "a1",
              name: "x",
            },
          },
        ],
      },
    };

    link.simulateResult({
      result: {
        data: initialData,
        hasNext: true,
      },
    });

    await expect(stream).toEmitApolloQueryResult({
      data: initialData,
      loading: false,
      networkStatus: NetworkStatus.ready,
    });

    link.simulateResult(
      {
        result: {
          hasNext: false,
          incremental: [
            {
              path: ["post"],
              data: {
                __typename: "Post",
                id: "p1",
                comments: [
                  {
                    __typename: "Comment",
                    id: "c1",
                    likes: 42,
                    author: {
                      __typename: "Author",
                      id: "a1",
                      badge: { __typename: "Badge", id: "b1" },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      true
    );

    await expect(stream).toEmitApolloQueryResult({
      data: {
        post: {
          __typename: "Post",
          id: "p1",
          comments: [
            {
              __typename: "Comment",
              id: "c1",
              text: "first!",
              likes: 42,
              author: {
                __typename: "Author",
                id: "a1",
                name: "x",
                badge: { __typename: "Badge", id: "b1" },
              },
            },
          ],
        },
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
    });

    expect(spy.error).not.toHaveBeenCalled();
  });

  test("deeply nested defer still logs errors about missing non-deferred fields under shared parents", async () => {
    using spy = spyOnConsole("error");

    const link = new MockSubscriptionLink();

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });
    const stream = new ObservableStream(client.watchQuery({ query }));

    const initialData = {
      post: {
        __typename: "Post",
        id: "p1",
        comments: [
          {
            __typename: "Comment",
            id: "c1",
            author: {
              __typename: "Author",
              id: "a1",
            },
          },
        ],
      },
    };

    link.simulateResult({
      result: {
        data: initialData,
        hasNext: true,
      },
    });

    await expect(stream).toEmitApolloQueryResult({
      data: initialData,
      loading: false,
      networkStatus: NetworkStatus.ready,
    });

    expect(spy.error).toHaveBeenCalledTimes(2);
    expect(spy.error).toHaveBeenCalledWith(
      expect.stringContaining("Missing field"),
      "text",
      expect.anything()
    );
    expect(spy.error).toHaveBeenCalledWith(
      expect.stringContaining("Missing field"),
      "name",
      expect.anything()
    );

    link.simulateResult(
      {
        result: {
          hasNext: false,
          incremental: [
            {
              path: ["post"],
              data: {
                __typename: "Post",
                id: "p1",
                comments: [
                  {
                    __typename: "Comment",
                    id: "c1",
                    likes: 42,
                    author: {
                      __typename: "Author",
                      id: "a1",
                      badge: { __typename: "Badge", id: "b1" },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      true
    );

    await stream.takeNext();

    expect(spy.error).not.toHaveBeenCalledWith(
      expect.anything(),
      "likes",
      expect.anything()
    );
    expect(spy.error).not.toHaveBeenCalledWith(
      expect.anything(),
      "badge",
      expect.anything()
    );
  });
});
