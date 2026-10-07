import { waitFor } from "@testing-library/react";
import { gql } from "graphql-tag";

import { ApolloClient } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { Defer20220824Handler } from "@apollo/client/incremental";
import {
  mockDefer20220824,
  spyOnConsole,
} from "@apollo/client/testing/internal";

test("merges nested deferred mutation fields without missing-field errors", async () => {
  const mutation = gql`
    mutation {
      createPost {
        id
        comments {
          id
          text
          author {
            id
            name
          }
        }
        ...CommentDetails @defer
      }
    }
    fragment CommentDetails on Post {
      comments {
        id
        likes
        author {
          id
          badge {
            id
          }
        }
      }
    }
  `;
  using consoleSpy = spyOnConsole("error");
  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDefer20220824();
  const cache = new InMemoryCache();
  const writeSpy = jest.spyOn(cache, "write");
  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new Defer20220824Handler(),
  });
  const promise = client.mutate({ mutation });

  const initialData = {
    createPost: {
      __typename: "Post",
      id: "p1",
      comments: [
        {
          __typename: "Comment",
          id: "c1",
          text: "first!",
          author: { __typename: "Author", id: "a1", name: "Alice" },
        },
      ],
    },
  };
  enqueueInitialChunk({
    data: initialData,
    hasNext: true,
  });

  // Check the initial cache write before delivering the deferred fields.
  await waitFor(() => expect(writeSpy).toHaveBeenCalledTimes(1));
  expect(cache.extract()["Comment:c1"]).not.toHaveProperty("likes");
  expect(consoleSpy.error).not.toHaveBeenCalled();

  const deferredData = {
    __typename: "Post",
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
  };

  enqueueSubsequentChunk({
    incremental: [{ path: ["createPost"], data: deferredData }],
    hasNext: false,
  });

  await expect(promise).resolves.toStrictEqual({
    data: {
      createPost: {
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
              name: "Alice",
              badge: { __typename: "Badge", id: "b1" },
            },
          },
        ],
      },
    },
  });
  expect(writeSpy).toHaveBeenCalledTimes(2);
  expect(cache.extract()["Comment:c1"]).toHaveProperty("likes", 42);
  expect(cache.extract()["Author:a1"]).toHaveProperty("badge", {
    __ref: "Badge:b1",
  });
  expect(consoleSpy.error).not.toHaveBeenCalled();
});

test("still suppresses warnings for missing deferred mutation fields after completion", async () => {
  const mutation = gql`
    mutation {
      createPost {
        id
        comments {
          id
          text
          author {
            id
            name
          }
        }
        ...CommentDetails @defer
      }
    }
    fragment CommentDetails on Post {
      comments {
        id
        likes
        author {
          id
          badge {
            id
          }
        }
      }
    }
  `;
  using consoleSpy = spyOnConsole("error");
  const { httpLink, enqueueInitialChunk, enqueueSubsequentChunk } =
    mockDefer20220824();
  const cache = new InMemoryCache();
  const writeSpy = jest.spyOn(cache, "write");
  const client = new ApolloClient({
    cache,
    link: httpLink,
    incrementalHandler: new Defer20220824Handler(),
  });
  const promise = client.mutate({ mutation });

  const initialData = {
    createPost: {
      __typename: "Post",
      id: "p1",
      comments: [
        {
          __typename: "Comment",
          id: "c1",
          text: "first!",
          author: { __typename: "Author", id: "a1", name: "Alice" },
        },
      ],
    },
  };
  enqueueInitialChunk({
    data: initialData,
    hasNext: true,
  });

  // Check the initial cache write before delivering the deferred fields.
  await waitFor(() => expect(writeSpy).toHaveBeenCalledTimes(1));
  expect(cache.extract()["Comment:c1"]).not.toHaveProperty("likes");
  expect(consoleSpy.error).not.toHaveBeenCalled();

  const deferredData = {
    __typename: "Post",
    comments: [
      {
        __typename: "Comment",
        id: "c1",
        likes: 42,
        author: {
          __typename: "Author",
          id: "a1",
        },
      },
    ],
  };

  // Deliberately omit the selected badge from the completed response.
  // Mutation writes do not pass isDeferPending, so the cache still
  // suppresses missing-field errors for this completed boundary.
  enqueueSubsequentChunk({
    incremental: [{ path: ["createPost"], data: deferredData }],
    hasNext: false,
  });

  await expect(promise).resolves.toStrictEqual({
    data: {
      createPost: {
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
              name: "Alice",
            },
          },
        ],
      },
    },
  });
  expect(writeSpy).toHaveBeenCalledTimes(2);
  expect(cache.extract()["Comment:c1"]).toHaveProperty("likes", 42);
  expect(cache.extract()["Author:a1"]).not.toHaveProperty("badge");
  expect(consoleSpy.error).not.toHaveBeenCalled();
});
