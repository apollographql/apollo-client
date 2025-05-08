import type { TypedDocumentNode } from "@apollo/client";
import { ApolloClient, InMemoryCache } from "@apollo/client";
import { LocalResolversError } from "@apollo/client/errors";
import { ApolloLink } from "@apollo/client/link";
import { LocalResolvers } from "@apollo/client/local-resolvers";
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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        currentAuthorId: () => testAuthorId,
      },
    },
  });

  await expect(
    localResolvers.getExportedVariables({
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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        currentAuthor: () => testAuthor,
      },
    },
  });

  await expect(
    localResolvers.getExportedVariables({
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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        appContainer: () => appContainer,
      },
    },
  });

  await expect(
    localResolvers.getExportedVariables({
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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Author: {
        authorId: () => 200,
      },
    },
  });

  await expect(
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: { authorId: 100 },
    })
  ).rejects.toThrow(
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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Author: {
        authorId: () => 200,
      },
    },
  });

  await expect(
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: { authorId: 100 },
    })
  ).rejects.toThrow(
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

  const localResolvers = new LocalResolvers({
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
    localResolvers.getExportedVariables({
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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        authorId: () => 1000,
        currentAuthor: () => testAuthor,
      },
    },
  });

  await expect(
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).resolves.toStrictEqualTyped({
    authorId: testAuthor.authorId,
  });
});

// TODO: Add a separate test that checks if cache is null and the variable is required
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

  client.writeQuery({
    query: document,
    data: { postRequiringReview },
  });

  const currentReviewer = {
    id: 100,
    __typename: "CurrentReviewer",
  };

  const localResolvers = new LocalResolvers({
    resolvers: {
      Post: {
        currentReviewer: () => currentReviewer,
      },
    },
  });

  await expect(
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).resolves.toStrictEqualTyped({
    reviewerId: currentReviewer.id,
  });
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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        author: () => testAuthor,
        authorId: () => testAuthor.id,
      },
    },
  });

  await expect(
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).rejects.toThrow(
    new LocalResolversError(
      "Cannot determine the variable name from the `@export` directive used on field 'authorId'. Perhaps you forgot the `as` argument?",
      { path: ["authorId"] }
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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        field: () => true,
      },
    },
  });

  await expect(
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).rejects.toThrow(
    new LocalResolversError(
      "`@export` directive on field 'field' does not have an associated variable definition for the 'someVar' variable.",
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

  const localResolvers = new LocalResolvers({
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
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).rejects.toThrow(
    new LocalResolversError(
      "`@export` directive on field 'torque' does not have an associated variable definition for the 'torque' variable.",
      { path: ["car", "engine", "torque"] }
    )
  );
});

test("emits error if `@export` variable does not exist in a variable definition when used with server field", async () => {
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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        author: () => testAuthor,
        authorId: () => testAuthor.id,
      },
    },
  });

  await expect(
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).rejects.toThrow(
    new LocalResolversError(
      "`@export` directive on field 'authorId' does not have an associated variable definition for the 'authorId' variable.",
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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Mutation: {
        topPost: () => testPostId,
      },
    },
  });

  await expect(
    localResolvers.getExportedVariables({
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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        currentFilter: () => ({ ...currentFilter, __typename: "LessonFilter" }),
      },
    },
  });

  await expect(
    localResolvers.getExportedVariables({
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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        primaryReviewerId: () => primaryReviewerId,
        secondaryReviewerId: () => secondaryReviewerId,
      },
    },
  });

  await expect(
    localResolvers.getExportedVariables({
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

  const localResolvers = new LocalResolvers({
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
    localResolvers.getExportedVariables({
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
  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        author,
        currentAuthor,
      },
    },
  });

  await expect(
    localResolvers.getExportedVariables({
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

test("warns and does not set optional exported variable for client-only query when resolver throws error", async () => {
  using _ = spyOnConsole("error");
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

  const localResolvers = new LocalResolvers({
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
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).resolves.toStrictEqualTyped({});

  expect(console.error).toHaveBeenCalledTimes(1);
  expect(console.error).toHaveBeenCalledWith(
    "An error was thrown when resolving the optional exported variable '%s' from resolver '%s':\n[%s]: %s",
    "authorId",
    "Query.currentAuthorId",
    "Error",
    "Something went wrong"
  );
});

test("warns and does not set variable for client-only query when parent resolver throws with nested export", async () => {
  using _ = spyOnConsole("error");
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

  const localResolvers = new LocalResolvers({
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
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).resolves.toStrictEqualTyped({});

  expect(console.error).toHaveBeenCalledTimes(1);
  expect(console.error).toHaveBeenCalledWith(
    "An error was thrown when resolving the optional exported variable '%s' from resolver '%s':\n[%s]: %s",
    "authorId",
    "Query.currentAuthor",
    "Error",
    "Something went wrong"
  );
});

test("warns and does not set variable for multiple nested exported variables on client-only query", async () => {
  using _ = spyOnConsole("error");
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

  const localResolvers = new LocalResolvers({
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
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).resolves.toStrictEqualTyped({});

  expect(console.error).toHaveBeenCalledTimes(2);
  expect(console.error).toHaveBeenNthCalledWith(
    1,
    "An error was thrown when resolving the optional exported variable '%s' from resolver '%s':\n[%s]: %s",
    "authorId",
    "Query.currentAuthor",
    "Error",
    "Something went wrong"
  );
  expect(console.error).toHaveBeenNthCalledWith(
    2,
    "An error was thrown when resolving the optional exported variable '%s' from resolver '%s':\n[%s]: %s",
    "authorName",
    "Query.currentAuthor",
    "Error",
    "Something went wrong"
  );
});

test("handles multiple exported fields across different client fields when resolvers throw", async () => {
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

  const localResolvers = new LocalResolvers({
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
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).resolves.toStrictEqualTyped({});

  expect(console.error).toHaveBeenCalledTimes(2);
  expect(console.error).toHaveBeenNthCalledWith(
    1,
    "An error was thrown when resolving the optional exported variable '%s' from resolver '%s':\n[%s]: %s",
    "userId",
    "Query.currentUser",
    "Error",
    "Could not get current user"
  );
  expect(console.error).toHaveBeenNthCalledWith(
    2,
    "An error was thrown when resolving the optional exported variable '%s' from resolver '%s':\n[%s]: %s",
    "teamId",
    "Query.favoriteTeam",
    "Error",
    "Could not get favorite team"
  );
});

test("warns and does not set optional variable for client-only query when child resolver throws", async () => {
  using _ = spyOnConsole("error");
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

  const localResolvers = new LocalResolvers({
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
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).resolves.toStrictEqualTyped({});

  expect(console.error).toHaveBeenCalledTimes(1);
  expect(console.error).toHaveBeenCalledWith(
    "An error was thrown when resolving the optional exported variable '%s' from resolver '%s':\n[%s]: %s",
    "authorId",
    "Author.id",
    "Error",
    "Something went wrong"
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

  const localResolvers = new LocalResolvers({
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
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).rejects.toThrow(
    new LocalResolversError(
      "An error was thrown from resolver 'Query.currentAuthorId' while resolving required variable 'authorId'.",
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

  const localResolvers = new LocalResolvers({
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
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).rejects.toThrow(
    new LocalResolversError(
      "An error was thrown from resolver 'Query.currentAuthor' while resolving required variable 'authorId'.",
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

  const localResolvers = new LocalResolvers({
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
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).rejects.toThrow(
    new LocalResolversError(
      "An error was thrown from resolver 'Author.id' while resolving required variable 'authorId'.",
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

  const localResolvers = new LocalResolvers({
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
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).rejects.toThrow(
    new LocalResolversError(
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

  const localResolvers = new LocalResolvers({
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
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).rejects.toThrow(
    new LocalResolversError(
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

  const localResolvers = new LocalResolvers({
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
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).rejects.toThrow(
    new LocalResolversError(
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

  const localResolvers = new LocalResolvers({
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
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).rejects.toThrow(
    new LocalResolversError(
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

  const localResolvers = new LocalResolvers({
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
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).rejects.toThrow(
    new LocalResolversError(
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

  const localResolvers = new LocalResolvers({
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
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).rejects.toThrow(
    new LocalResolversError(
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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        currentAuthorId: () => null,
      },
    },
  });

  await expect(
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).rejects.toThrow(
    new LocalResolversError(
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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        currentAuthorId: () => {},
      },
    },
  });

  await expect(
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).rejects.toThrow(
    new LocalResolversError(
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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        currentAuthor: () => ({ __typename: "Author", profile: null }),
      },
    },
  });

  await expect(
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).rejects.toThrow(
    new LocalResolversError(
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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        currentAuthorId: () => {},
      },
    },
  });

  await expect(
    localResolvers.getExportedVariables({
      document,
      client,
      context: {},
      variables: {},
    })
  ).resolves.toStrictEqualTyped({});

  expect(console.warn).not.toHaveBeenCalled();
});

test("exported variables overwrite variables passed to link chain", async () => {
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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        currentAuthorId: () => testAuthorId,
      },
    },
  });

  await expect(
    localResolvers.getExportedVariables({
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

  const localResolvers = new LocalResolvers({
    resolvers: {
      Query: {
        currentAuthorId: () => testAuthorId,
      },
    },
  });

  await expect(
    localResolvers.getExportedVariables({
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
