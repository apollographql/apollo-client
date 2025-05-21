import type { TypedDocumentNode } from "@apollo/client";
import { ApolloClient, InMemoryCache } from "@apollo/client";
import { LocalStateError } from "@apollo/client/errors";
import { ApolloLink } from "@apollo/client/link";
import { LocalState } from "@apollo/client/local-state";
import { spyOnConsole } from "@apollo/client/testing/internal";
import { InvariantError } from "@apollo/client/utilities/invariant";

import { gql } from "./testUtils.js";

test("returns variables from @client fields with @export", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthorId @client @export(as: "authorId")
      postCount(authorId: $authorId) @client
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthorId = 100;

  const localState = new LocalState({
    resolvers: {
      Query: {
        currentAuthorId: () => testAuthorId,
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
    authorId: testAuthorId,
  });
});

test("stores the @client nested field value in the specified @export variable", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthor @client {
        name
        authorId @export(as: "authorId")
      }
      postCount(authorId: $authorId) @client
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthor = {
    name: "John Smith",
    authorId: 100,
    __typename: "Author",
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        currentAuthor: () => testAuthor,
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
    authorId: testAuthor.authorId,
  });
});

test("supports @client @export variables that are nested multiple levels deep", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      appContainer @client {
        systemDetails {
          currentAuthor {
            name
            authorId @export(as: "authorId")
          }
        }
      }
      postCount(authorId: $authorId)
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const appContainer = {
    systemDetails: {
      currentAuthor: {
        name: "John Smith",
        authorId: 100,
        __typename: "Author",
      },
      __typename: "SystemDetails",
    },
    __typename: "AppContainer",
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        appContainer: () => appContainer,
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
    authorId: appContainer.systemDetails.currentAuthor.authorId,
  });
});

test("throws when passing document with no `@client` fields", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthor {
        name
        authorId
      }
      postCount(authorId: $authorId)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
    resolvers: {
      Author: {
        authorId: () => 200,
      },
    },
  });

  await expect(
    localState.getExportedVariables({
      document,
      client,
      context: {},
      variables: { authorId: 100 },
    })
  ).rejects.toEqual(
    new InvariantError("Expected document to contain `@client` fields.")
  );
});

test("throws when passing document with `@export` but no `@client` field", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthor {
        name
        authorId @export(as: "authorId")
      }
      postCount(authorId: $authorId)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
    resolvers: {
      Author: {
        authorId: () => 200,
      },
    },
  });

  await expect(
    localState.getExportedVariables({
      document,
      client,
      context: {},
      variables: { authorId: 100 },
    })
  ).rejects.toEqual(
    new InvariantError("Expected document to contain `@client` fields.")
  );
});

test("ignores @export directives if not used with @client", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthor {
        name
        authorId @export(as: "authorId")
      }
      authorId @client
      postCount(authorId: $authorId)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
    resolvers: {
      Query: {
        authorId: () => 200,
      },
      Author: {
        authorId: () => 200,
      },
    },
  });

  await expect(
    localState.getExportedVariables({
      document,
      client,
      context: {},
      variables: { authorId: 100 },
    })
  ).resolves.toStrictEqualTyped({
    authorId: 100,
  });
});

test("ignores @export directive if it is not a descendant of a client field", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthor @client {
        name
        authorId @export(as: "authorId")
      }
      # This is intentionally after the client-field above since it runs after
      # currentAuthor. We should not see its value
      authorId @export(as: "authorId")
      postCount(authorId: $authorId)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthor = {
    name: "John Smith",
    authorId: 100,
    __typename: "Author",
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        authorId: () => 1000,
        currentAuthor: () => testAuthor,
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
    authorId: testAuthor.authorId,
  });
});

test("returns variable from nested field when data is written to the cache", async () => {
  const document = gql`
    query postRequiringReview($reviewerId: Int!) {
      postRequiringReview {
        id
        title
        currentReviewer @client {
          id @export(as: "reviewerId")
        }
      }
      reviewerDetails(reviewerId: $reviewerId) {
        name
      }
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const postRequiringReview = {
    id: 10,
    title: "The Local State Conundrum",
    __typename: "Post",
  };
  const currentReviewer = {
    id: 100,
    __typename: "CurrentReviewer",
  };
  const reviewerDetails = {
    name: "John Smith",
    __typename: "Reviewer",
  };

  client.writeQuery({
    query: document,
    data: { postRequiringReview, reviewerDetails },
  });

  const localState = new LocalState({
    resolvers: {
      Post: {
        currentReviewer: () => currentReviewer,
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
    reviewerId: currentReviewer.id,
  });
});

test("throws error when cache data is not available for parent when exporting required variable from nested field", async () => {
  const document = gql`
    query postRequiringReview($reviewerId: Int!) {
      postRequiringReview {
        id
        title
        currentReviewer @client {
          id @export(as: "reviewerId")
        }
      }
      reviewerDetails(reviewerId: $reviewerId) {
        name
      }
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const currentReviewer = {
    id: 100,
    __typename: "CurrentReviewer",
  };

  const localState = new LocalState({
    resolvers: {
      Post: {
        currentReviewer: () => currentReviewer,
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
  ).rejects.toEqual(
    new LocalStateError(
      "Field 'postRequiringReview' is `undefined` which contains exported required variable 'reviewerId'. Ensure this value is in the cache or make the variable optional.",
      { path: ["postRequiringReview"] }
    )
  );
});

test("allows optional variable when cache data is not available for parent when exporting variable from nested field", async () => {
  const document = gql`
    query postRequiringReview($reviewerId: Int) {
      postRequiringReview {
        id
        title
        currentReviewer @client {
          id @export(as: "reviewerId")
        }
      }
      reviewerDetails(reviewerId: $reviewerId) {
        name
      }
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const currentReviewer = {
    id: 100,
    __typename: "CurrentReviewer",
  };

  const localState = new LocalState({
    resolvers: {
      Post: {
        currentReviewer: () => currentReviewer,
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
  ).resolves.toStrictEqualTyped({});
});

test("throws error if `@export` does not include an `as` argument", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      authorId @client @export
      author(id: $authorId) {
        id
        name
      }
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        author: () => testAuthor,
        authorId: () => testAuthor.id,
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
  ).rejects.toEqual(
    new LocalStateError(
      "Cannot determine the variable name from the `@export` directive used on field 'authorId'. Perhaps you forgot the `as` argument?",
      { path: ["authorId"] }
    )
  );
});

test("does not throw error without `as` arg when `@export` is not a client field", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      authorId @client @export(as: "authorId")
      foo @export
      author(id: $authorId) @export {
        id
        name @export
      }
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        authorId: () => testAuthor.id,
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
  ).resolves.toStrictEqualTyped({ authorId: testAuthor.id });
});

test("throws error if `@export` is a client descendent field without an `as` argument", async () => {
  const document = gql`
    query ($authorId: Int!) {
      author(id: $authorId) @client {
        id @export
        name
      }
      posts(authorId: $authorId) {
        id
      }
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        author: () => testAuthor,
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
  ).rejects.toEqual(
    new LocalStateError(
      "Cannot determine the variable name from the `@export` directive used on field 'id'. Perhaps you forgot the `as` argument?",
      { path: ["author", "id"] }
    )
  );
});

test("throws error on @client only queries when the @export directive is used on root field with no associated variable definition", async () => {
  const document = gql`
    {
      field @client @export(as: "someVar")
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
    resolvers: {
      Query: {
        field: () => true,
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
  ).rejects.toEqual(
    new LocalStateError(
      "`@export` directive on field 'field' cannot export the '$someVar' variable as it is missing in the query definition.",
      { path: ["field"] }
    )
  );
});

test("throws error on @client only queries when the @export directive is used on nested fields with no associated variable definition", async () => {
  const document = gql`
    {
      car @client {
        engine {
          torque @export(as: "torque")
        }
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
        car: () => ({
          __typename: "Car",
          engine: {
            __typename: "Engine",
            torque: 7200,
          },
        }),
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
  ).rejects.toEqual(
    new LocalStateError(
      "`@export` directive on field 'torque' cannot export the '$torque' variable as it is missing in the query definition.",
      { path: ["car", "engine", "torque"] }
    )
  );
});

test("throws error if `@export` variable does not exist in a variable definition when used with server field", async () => {
  const document = gql`
    query currentAuthorPostCount {
      authorId @client @export(as: "authorId")
      author(id: $authorId) {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        author: () => testAuthor,
        authorId: () => testAuthor.id,
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
  ).rejects.toEqual(
    new LocalStateError(
      "`@export` directive on field 'authorId' cannot export the '$authorId' variable as it is missing in the query definition.",
      { path: ["authorId"] }
    )
  );
});

test("supports combining @client @export variables, calculated by a local resolver, with remote mutations", async () => {
  const mutation = gql`
    mutation upvotePost($postId: Int!) {
      topPost @client @export(as: "postId")
      upvotePost(postId: $postId) {
        title
        votes
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testPostId = 100;

  const localState = new LocalState({
    resolvers: {
      Mutation: {
        topPost: () => testPostId,
      },
    },
  });

  await expect(
    localState.getExportedVariables({
      document: mutation,
      client,
      context: {},
      variables: {},
    })
  ).resolves.toStrictEqualTyped({
    postId: testPostId,
  });
});

test("removes __typename from @export-ed objects", async () => {
  const document = gql`
    query GetListItems($where: LessonFilter) {
      currentFilter @client @export(as: "where") {
        title_contains
        enabled
      }
      lessonCollection(where: $where) {
        items {
          title
          slug
        }
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const currentFilter = {
    title_contains: "full",
    enabled: true,
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        currentFilter: () => ({ ...currentFilter, __typename: "LessonFilter" }),
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
    where: currentFilter,
  });
});

test("uses the value of the last @export variable defined, if multiple variables are defined with the same name", async () => {
  const document = gql`
    query reviewerPost($reviewerId: Int!) {
      primaryReviewerId @client @export(as: "reviewerId")
      secondaryReviewerId @client @export(as: "reviewerId")
      post(reviewerId: $reviewerId) {
        title
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const primaryReviewerId = 100;
  const secondaryReviewerId = 200;

  const localState = new LocalState({
    resolvers: {
      Query: {
        primaryReviewerId: () => primaryReviewerId,
        secondaryReviewerId: () => secondaryReviewerId,
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
    reviewerId: secondaryReviewerId,
  });
});

test("supports reading a value from the cache in a resolver for an @client @export variable, loaded from the cache", async () => {
  const cacheQuery: TypedDocumentNode<
    { loggedInReviewerId: number },
    Record<string, never>
  > = gql`
    query {
      loggedInReviewerId
    }
  `;
  const document = gql`
    query postRequiringReview($reviewerId: Int!) {
      loggedInReviewerId @client @export(as: "reviewerId")
      postRequiringReview {
        id
        title
      }
      reviewerDetails(reviewerId: $reviewerId) {
        name
      }
    }
  `;

  const loggedInReviewerId = 100;

  const localState = new LocalState({
    resolvers: {
      Query: {
        loggedInReviewerId: (_, __, { client }) => {
          const data = client.readQuery({
            query: cacheQuery,
          });

          return data?.loggedInReviewerId;
        },
      },
    },
  });
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });
  client.writeQuery({
    query: cacheQuery,
    data: {
      loggedInReviewerId,
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
    reviewerId: loggedInReviewerId,
  });
});

test("does not execute client resolvers for client subtrees without an export directive", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthor @client {
        id @export(as: "authorId")
      }
      author(id: $authorId) @client {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const currentAuthor = jest.fn(() => ({
    __typename: "Author",
    id: testAuthor.id,
  }));
  const author = jest.fn(() => testAuthor);
  const localState = new LocalState({
    resolvers: {
      Query: {
        author,
        currentAuthor,
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
    authorId: testAuthor.id,
  });

  expect(currentAuthor).toHaveBeenCalledTimes(1);
  expect(author).toHaveBeenCalledTimes(0);
});

test("throws error for client-only query when resolver throws error", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int) {
      currentAuthorId @client @export(as: "authorId")
      author(id: $authorId) @client {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        currentAuthorId: () => {
          throw new Error("Something went wrong");
        },
        author: (_, { id }) => {
          return id === undefined ? null : testAuthor;
        },
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
  ).rejects.toEqual(
    new LocalStateError(
      "An error was thrown from resolver 'Query.currentAuthorId' while resolving optional variable 'authorId'. Use a try/catch and return `undefined` to suppress this error and omit the variable from the request.",
      {
        path: ["currentAuthorId"],
        sourceError: new Error("Something went wrong"),
      }
    )
  );
});

test("throws error from client-only query when parent resolver throws with nested export", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int) {
      currentAuthor @client {
        id @client @export(as: "authorId")
      }
      author(id: $authorId) @client {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        currentAuthor: () => {
          throw new Error("Something went wrong");
        },
        author: (_, { id }) => {
          return id === undefined ? null : testAuthor;
        },
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
  ).rejects.toEqual(
    new LocalStateError(
      "An error was thrown from resolver 'Query.currentAuthor' while resolving optional variable 'authorId'. Use a try/catch and return `undefined` to suppress this error and omit the variable from the request.",
      {
        path: ["currentAuthor"],
        sourceError: new Error("Something went wrong"),
      }
    )
  );
});

test("throws error for first variable when parent resolver throws resolving multiple nested exported variables on client-only query", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int, $authorName: String) {
      currentAuthor @client {
        id @export(as: "authorId")
        name @export(as: "authorName")
      }
      author(id: $authorId, name: $authorName) @client {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        currentAuthor: () => {
          throw new Error("Something went wrong");
        },
        author: (_, { id }) => {
          return id === undefined ? null : testAuthor;
        },
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
  ).rejects.toStrictEqualTyped(
    new LocalStateError(
      "An error was thrown from resolver 'Query.currentAuthor' while resolving optional variable 'authorId'. Use a try/catch and return `undefined` to suppress this error and omit the variable from the request.",
      {
        path: ["currentAuthor"],
        sourceError: new Error("Something went wrong"),
      }
    )
  );
});

test("throws error from first resolver across different client fields when multiple resolvers throw", async () => {
  using _ = spyOnConsole("error");
  const document = gql`
    query currentAuthorPostCount($userId: ID, $teamId: ID) {
      currentUser @client {
        id @export(as: "userId")
      }
      favoriteTeam @client {
        id @export(as: "teamId")
      }
      user(id: $userId) @client {
        id
        name
      }
      team(id: $teamId) @client {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testUser = {
    __typename: "User",
    id: 1,
    name: "John Smith",
  };

  const testTeam = {
    __typename: "Team",
    id: 1,
    name: "Denver Broncos",
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        currentUser: () => {
          throw new Error("Could not get current user");
        },
        favoriteTeam: () => {
          throw new Error("Could not get favorite team");
        },
        user: (_, { id }) => {
          return id === undefined ? null : testUser;
        },
        team: (_, { id }) => {
          return id === undefined ? null : testTeam;
        },
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
  ).rejects.toStrictEqualTyped(
    new LocalStateError(
      "An error was thrown from resolver 'Query.currentUser' while resolving optional variable 'userId'. Use a try/catch and return `undefined` to suppress this error and omit the variable from the request.",
      {
        path: ["currentUser"],
        sourceError: new Error("Could not get current user"),
      }
    )
  );
});

test("throws error for client-only query when child resolver throws", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int) {
      currentAuthor @client {
        id @export(as: "authorId")
      }
      author(id: $authorId) @client {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        currentAuthor: () => ({ __typename: "Author" }),
        author: (_, { id }) => {
          return id === undefined ? null : testAuthor;
        },
      },
      Author: {
        id: () => {
          throw new Error("Something went wrong");
        },
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
  ).rejects.toEqual(
    new LocalStateError(
      "An error was thrown from resolver 'Author.id' while resolving optional variable 'authorId'. Use a try/catch and return `undefined` to suppress this error and omit the variable from the request.",
      {
        path: ["currentAuthor", "id"],
        sourceError: new Error("Something went wrong"),
      }
    )
  );
});

test("throws error when a resolver throws while gathering exported variables for a required variable in client-only query", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthorId @client @export(as: "authorId")
      author(id: $authorId) @client {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        currentAuthorId: () => {
          throw new Error("Something went wrong");
        },
        author: (_, { id }) => {
          return id === null ? null : testAuthor;
        },
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
  ).rejects.toEqual(
    new LocalStateError(
      "An error was thrown from resolver 'Query.currentAuthorId' while resolving required variable 'authorId'. Use a try/catch and return `undefined` to suppress this error and omit the variable from the request.",
      {
        path: ["currentAuthorId"],
        sourceError: new Error("Something went wrong"),
      }
    )
  );
});

test("throws error when a parent resolver throws while gathering exported variables from child field for a required variable in client-only query", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthor @client {
        id @export(as: "authorId")
      }
      author(id: $authorId) @client {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        currentAuthor: () => {
          throw new Error("Something went wrong");
        },
        author: (_, { id }) => {
          return id === null ? null : testAuthor;
        },
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
  ).rejects.toEqual(
    new LocalStateError(
      "An error was thrown from resolver 'Query.currentAuthor' while resolving required variable 'authorId'. Use a try/catch and return `undefined` to suppress this error and omit the variable from the request.",
      {
        path: ["currentAuthor"],
        sourceError: new Error("Something went wrong"),
      }
    )
  );
});

test("throws error when a child resolver throws while gathering exported variables from child field for a required variable in client-only query", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthor @client {
        id @export(as: "authorId")
      }
      author(id: $authorId) @client {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        currentAuthor: () => ({ __typename: "Author" }),
        author: (_, { id }) => {
          return id === null ? null : testAuthor;
        },
      },
      Author: {
        id: () => {
          throw new Error("Could not get id");
        },
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
  ).rejects.toEqual(
    new LocalStateError(
      "An error was thrown from resolver 'Author.id' while resolving required variable 'authorId'. Use a try/catch and return `undefined` to suppress this error and omit the variable from the request.",
      {
        path: ["currentAuthor", "id"],
        sourceError: new Error("Could not get id"),
      }
    )
  );
});

test("errors when resolver returns null for a required variable on client-only query", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthorId @client @export(as: "authorId")
      author(id: $authorId) @client {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        currentAuthorId: () => null,
        author: (_, { id }) => {
          return id === null ? null : testAuthor;
        },
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
  ).rejects.toEqual(
    new LocalStateError(
      "Resolver 'Query.currentAuthorId' returned `null` for required variable 'authorId'.",
      { path: ["currentAuthorId"] }
    )
  );
});

test("errors when nested field is null for a required variable on client-only query", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthor @client {
        id @export(as: "authorId")
      }
      author(id: $authorId) @client {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        currentAuthor: () => ({ __typename: "Author", id: null }),
        author: (_, { id }) => {
          return id === null ? null : testAuthor;
        },
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
  ).rejects.toEqual(
    new LocalStateError(
      "Field 'Author.id' returned `null` for required variable 'authorId'.",
      { path: ["currentAuthor", "id"] }
    )
  );
});

test("errors when nested field is null for a required variable on client-only query", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthor @client {
        id @export(as: "authorId")
      }
      author(id: $authorId) @client {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        currentAuthor: () => ({ __typename: "Author" }),
        author: (_, { id }) => {
          return id === null ? null : testAuthor;
        },
      },
      Author: {
        id: () => null,
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
  ).rejects.toEqual(
    new LocalStateError(
      "Resolver 'Author.id' returned `null` for required variable 'authorId'.",
      { path: ["currentAuthor", "id"] }
    )
  );
});

test("throws error when top-level resolver returns null with nested export for required variable", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthor @client {
        id @export(as: "authorId")
      }
      author(id: $authorId) @client {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        currentAuthor: () => null,
        author: (_, { id }) => {
          return id === null ? null : testAuthor;
        },
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
  ).rejects.toEqual(
    new LocalStateError(
      "Resolver 'Query.currentAuthor' returned `null` which contains exported required variable 'authorId'.",
      { path: ["currentAuthor"] }
    )
  );
});

test("throws error when top-level resolver returns undefined with nested export for required variable", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthor @client {
        id @export(as: "authorId")
      }
      author(id: $authorId) @client {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        currentAuthor: () => {},
        author: (_, { id }) => {
          return id === null ? null : testAuthor;
        },
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
  ).rejects.toEqual(
    new LocalStateError(
      "Resolver 'Query.currentAuthor' returned `undefined` which contains exported required variable 'authorId'.",
      { path: ["currentAuthor"] }
    )
  );
});

test("errors when resolver returns undefined for a required variable on client-only query", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthorId @client @export(as: "authorId")
      author(id: $authorId) @client {
        id
        name
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const localState = new LocalState({
    resolvers: {
      Query: {
        currentAuthorId: () => {},
        author: (_, { id }) => {
          return id === null ? null : testAuthor;
        },
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
  ).rejects.toEqual(
    new LocalStateError(
      "Resolver 'Query.currentAuthorId' returned `undefined` for required variable 'authorId'.",
      { path: ["currentAuthorId"] }
    )
  );
});

test("errors when resolver returns null for a required variable on non-client query", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthorId @client @export(as: "authorId")
      author(id: $authorId) {
        id
        name
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
        currentAuthorId: () => null,
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
  ).rejects.toEqual(
    new LocalStateError(
      "Resolver 'Query.currentAuthorId' returned `null` for required variable 'authorId'.",
      { path: ["currentAuthorId"] }
    )
  );
});

test("errors when resolver returns undefined for a required variable on non-client query", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthorId @client @export(as: "authorId")
      author(id: $authorId) {
        id
        name
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
        currentAuthorId: () => {},
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
  ).rejects.toEqual(
    new LocalStateError(
      "Resolver 'Query.currentAuthorId' returned `undefined` for required variable 'authorId'.",
      { path: ["currentAuthorId"] }
    )
  );
});

test("errors when resolver returns object with null field for a required variable", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthor @client {
        profile {
          id @export(as: "authorId")
        }
      }
      author(id: $authorId) {
        id
        name
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
        currentAuthor: () => ({ __typename: "Author", profile: null }),
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
  ).rejects.toEqual(
    new LocalStateError(
      "Field 'Author.profile' returned `null` which contains exported required variable 'authorId'.",
      { path: ["currentAuthor", "profile"] }
    )
  );
});

test("does not warn when gathering variable exports for optional variables", async () => {
  using _ = spyOnConsole("warn");
  const document = gql`
    query currentAuthorPostCount($authorId: Int) {
      currentAuthorId @client @export(as: "authorId")
      author(id: $authorId) {
        id
        name
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
        currentAuthorId: () => {},
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
  ).resolves.toStrictEqualTyped({});

  expect(console.warn).not.toHaveBeenCalled();
});

test("exported variables overwrite variables passed to LocalState", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthorId @client @export(as: "authorId")
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthorId = 100;

  const localState = new LocalState({
    resolvers: {
      Query: {
        currentAuthorId: () => testAuthorId,
      },
    },
  });

  await expect(
    localState.getExportedVariables({
      document,
      client,
      context: {},
      variables: { authorId: 200 },
    })
  ).resolves.toStrictEqualTyped({
    authorId: testAuthorId,
  });
});

test("combines exported variables with user-defined variables", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!, $limit: Int!) {
      currentAuthorId @client @export(as: "authorId")
      posts(authorId: $authorId, limit: $limit) {
        id
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthorId = 100;

  const localState = new LocalState({
    resolvers: {
      Query: {
        currentAuthorId: () => testAuthorId,
      },
    },
  });

  await expect(
    localState.getExportedVariables({
      document,
      client,
      context: {},
      variables: { limit: 10 },
    })
  ).resolves.toStrictEqualTyped({
    authorId: testAuthorId,
    limit: 10,
  });
});

test("can use context function with exported variables", async () => {
  const document = gql`
    query currentAuthorPostCount($authorId: Int!, $limit: Int!) {
      currentAuthorId @client @export(as: "authorId")
      posts(authorId: $authorId, limit: $limit) {
        id
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testAuthorId = 100;

  const localState = new LocalState({
    context: () => ({ useTestAuthor: true }),
    resolvers: {
      Query: {
        currentAuthorId: (_, __, { requestContext }) =>
          requestContext.useTestAuthor ? testAuthorId : 0,
      },
    },
  });

  await expect(
    localState.getExportedVariables({
      document,
      client,
      context: {},
      variables: { limit: 10 },
    })
  ).resolves.toStrictEqualTyped({
    authorId: testAuthorId,
    limit: 10,
  });
});
