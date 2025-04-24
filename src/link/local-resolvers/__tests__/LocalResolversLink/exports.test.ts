import { of } from "rxjs";

import type { TypedDocumentNode } from "@apollo/client";
import { ApolloClient, InMemoryCache } from "@apollo/client";
import { LocalResolversError } from "@apollo/client/errors";
import { ApolloLink } from "@apollo/client/link/core";
import { LocalResolversLink } from "@apollo/client/link/local-resolvers";
import {
  executeWithDefaultContext as execute,
  ObservableStream,
  spyOnConsole,
} from "@apollo/client/testing/internal";

import { gql } from "./testUtils.js";

test("stores the @client field value in the specified @export variable, and make it available to a subsequent resolver", async () => {
  const query = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthorId @client @export(as: "authorId")
      postCount(authorId: $authorId) @client
    }
  `;

  const testAuthorId = 100;
  const testPostCount = 200;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        currentAuthorId: () => testAuthorId,
        postCount(_, { authorId }) {
          return authorId === testAuthorId ? testPostCount : 0;
        },
      },
    },
  });

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      currentAuthorId: testAuthorId,
      postCount: testPostCount,
    },
  });
  await expect(stream).toComplete();
});

test("stores the @client nested field value in the specified @export variable, and make it avilable to a subsequent resolver", async () => {
  const query = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthor @client {
        name
        authorId @export(as: "authorId")
      }
      postCount(authorId: $authorId) @client
    }
  `;

  const testAuthor = {
    name: "John Smith",
    authorId: 100,
    __typename: "Author",
  };

  const testPostCount = 200;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        currentAuthor: () => testAuthor,
        postCount(_, { authorId }) {
          return authorId === testAuthor.authorId ? testPostCount : 0;
        },
      },
    },
  });
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      currentAuthor: testAuthor,
      postCount: testPostCount,
    },
  });
  await expect(stream).toComplete();
});

test("allows @client @export variables to be used with remote queries", async () => {
  const query = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthor @client {
        name
        authorId @export(as: "authorId")
      }
      postCount(authorId: $authorId)
    }
  `;

  const testAuthor = {
    name: "John Smith",
    authorId: 100,
    __typename: "Author",
  };

  const testPostCount = 200;

  const mockLink = new ApolloLink((operation) =>
    of({
      data: {
        postCount:
          operation.variables.authorId === testAuthor.authorId ?
            testPostCount
          : 0,
      },
    })
  );
  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        currentAuthor: () => testAuthor,
      },
    },
  });
  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      currentAuthor: testAuthor,
      postCount: testPostCount,
    },
  });
  await expect(stream).toComplete();
});

test("supports @client @export variables that are nested multiple levels deep", async () => {
  const query = gql`
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

  const testPostCount = 200;

  const mockLink = new ApolloLink(({ variables }) =>
    of({
      data: {
        postCount:
          (
            variables.authorId ===
            appContainer.systemDetails.currentAuthor.authorId
          ) ?
            testPostCount
          : 0,
      },
    })
  );

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        appContainer: () => appContainer,
      },
    },
  });
  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      appContainer,
      postCount: testPostCount,
    },
  });
});

test("ignores @export directives if not used with @client", async () => {
  const query = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthor {
        name
        authorId @export(as: "authorId")
      }
      postCount(authorId: $authorId)
    }
  `;

  const testAuthor = {
    name: "John Smith",
    authorId: 100,
    __typename: "Author",
  };
  const testPostCount = 200;

  const mockLink = new ApolloLink((operation) =>
    of({
      data: {
        currentAuthor: testAuthor,
        postCount:
          operation.variables.authorId === testAuthor.authorId ?
            testPostCount
          : 0,
      },
    })
  );
  const localResolversLink = new LocalResolversLink();
  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(
    execute(link, { query, variables: { authorId: 100 } })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      currentAuthor: testAuthor,
      postCount: testPostCount,
    },
  });
  await expect(stream).toComplete();
});

test("ignores @export directive if it is not a descendant of a client field", async () => {
  const query = gql`
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

  const testAuthor = {
    name: "John Smith",
    authorId: 100,
    __typename: "Author",
  };
  const testPostCount = 200;

  const mockLink = new ApolloLink((operation) => {
    return of({
      data: {
        authorId: "from server",
        postCount:
          operation.variables.authorId === testAuthor.authorId ?
            testPostCount
          : 0,
      },
    });
  });

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        authorId: () => 1000,
        currentAuthor: () => testAuthor,
      },
    },
  });
  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      authorId: "from server",
      currentAuthor: testAuthor,
      postCount: testPostCount,
    },
  });
  await expect(stream).toComplete();
});

test("emits error when using an exported variable as a child of a remote field", async () => {
  const query = gql`
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

  const postRequiringReview = {
    id: 10,
    title: "The Local State Conundrum",
    __typename: "Post",
  };
  const reviewerDetails = {
    name: "John Smith",
    __typename: "Reviewer",
  };
  const currentReviewer = {
    id: 100,
    __typename: "CurrentReviewer",
  };

  const mockLink = new ApolloLink(({ variables }) => {
    return of({
      data:
        variables.reviewerId === currentReviewer.id ?
          { postRequiringReview, reviewerDetails }
        : { postRequiringReview: null, reviewerDetails: null },
    });
  });

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Post: {
        currentReviewer: () => currentReviewer,
      },
    },
  });
  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitError(
    new LocalResolversError(
      "Cannot export a variable from a field that is a child of a remote field. Exported variables must originate either from a root-level client field or a child of a root-level client field.",
      { path: ["postRequiringReview", "currentReviewer", "id"] }
    )
  );
});

test("emits error if `@export` does not include an `as` argument", async () => {
  const query = gql`
    query currentAuthorPostCount($authorId: Int!) {
      authorId @client @export
      author(id: $authorId) {
        id
        name
      }
    }
  `;

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const mockLink = ApolloLink.empty();
  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        author: () => testAuthor,
        authorId: () => testAuthor.id,
      },
    },
  });
  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitError(
    new LocalResolversError(
      "Cannot determine the variable name from the `@export` directive used on field 'authorId'. Perhaps you forgot the `as` argument?",
      { path: ["authorId"] }
    )
  );
});

test("emits error on @client only queries when the @export directive is used on root field with no associated variable definition", async () => {
  const query = gql`
    {
      field @client @export(as: "someVar")
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        field: () => true,
      },
    },
  });
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitError(
    new LocalResolversError(
      "`@export` directive on field 'field' does not have an associated variable definition for the 'someVar' variable.",
      { path: ["field"] }
    )
  );
});

test("emits error on @client only queries when the @export directive is used on nested fields with no associated variable definition", async () => {
  const query = gql`
    {
      car @client {
        engine {
          torque @export(as: "torque")
        }
      }
    }
  `;

  const link = new LocalResolversLink({
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
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitError(
    new LocalResolversError(
      "`@export` directive on field 'torque' does not have an associated variable definition for the 'torque' variable.",
      { path: ["car", "engine", "torque"] }
    )
  );
});

test("emits error if `@export` variable does not exist in a variable definition when used with server field", async () => {
  const query = gql`
    query currentAuthorPostCount {
      authorId @client @export(as: "authorId")
      author(id: $authorId) {
        id
        name
      }
    }
  `;

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const mockLink = ApolloLink.empty();
  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        author: () => testAuthor,
        authorId: () => testAuthor.id,
      },
    },
  });
  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitError(
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

  const testPostId = 100;
  const testPost = {
    title: "The Day of the Jackal",
    votes: 10,
    __typename: "post",
  };

  const mockLink = new ApolloLink(({ variables }) => {
    return of({
      data: {
        upvotePost: variables.postId === testPostId ? testPost : null,
      },
    });
  });

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Mutation: {
        topPost: () => testPostId,
      },
    },
  });
  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query: mutation }));

  await expect(stream).toEmitTypedValue({
    data: {
      topPost: 100,
      upvotePost: testPost,
    },
  });
  await expect(stream).toComplete();
});

test("removes __typename from @export-ed objects", async () => {
  const query = gql`
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

  const currentFilter = {
    title_contains: "full",
    enabled: true,
  };

  const data = {
    lessonCollection: {
      __typename: "LessonCollection",
      items: [
        {
          __typename: "ListItem",
          title: "full title",
          slug: "slug-title",
        },
      ],
    },
  };
  const mockLink = new ApolloLink((operation) => {
    expect(operation.variables.where).toEqual(currentFilter);
    expect(operation.query).toMatchDocument(gql`
      query GetListItems($where: LessonFilter) {
        lessonCollection(where: $where) {
          items {
            title
            slug
            __typename
          }
          __typename
        }
      }
    `);

    return of({ data });
  });

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        currentFilter: () => ({ ...currentFilter, __typename: "LessonFilter" }),
      },
    },
  });
  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      currentFilter,
      ...data,
    },
  });
  await expect(stream).toComplete();
});

test("uses the value of the last @export variable defined, if multiple variables are defined with the same name", async () => {
  const query = gql`
    query reviewerPost($reviewerId: Int!) {
      primaryReviewerId @client @export(as: "reviewerId")
      secondaryReviewerId @client @export(as: "reviewerId")
      post(reviewerId: $reviewerId) {
        title
      }
    }
  `;

  const post = {
    title: "The One Post to Rule Them All",
    __typename: "Post",
  };
  const primaryReviewerId = 100;
  const secondaryReviewerId = 200;

  const mockLink = new ApolloLink(({ variables }) => {
    return of({
      data: {
        post: variables.reviewerId === secondaryReviewerId ? post : null,
      },
    });
  });
  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        primaryReviewerId: () => primaryReviewerId,
        secondaryReviewerId: () => secondaryReviewerId,
      },
    },
  });
  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      primaryReviewerId,
      secondaryReviewerId,
      post,
    },
  });
  await expect(stream).toComplete();
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
  const query = gql`
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

  const postRequiringReview = {
    id: 10,
    title: "The Local State Conundrum",
    __typename: "Post",
  };
  const reviewerDetails = {
    name: "John Smith",
    __typename: "Reviewer",
  };
  const loggedInReviewerId = 100;

  const mockLink = new ApolloLink(({ variables }) => {
    expect(variables).toMatchObject({ reviewerId: loggedInReviewerId });

    return of({
      data: {
        postRequiringReview,
        reviewerDetails,
      },
    });
  });
  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        loggedInReviewerId: (_, __, { operation }) => {
          const data = operation.client.readQuery({
            query: cacheQuery,
          });

          return data?.loggedInReviewerId;
        },
      },
    },
  });
  const client = new ApolloClient({ cache: new InMemoryCache() });
  client.writeQuery({
    query: cacheQuery,
    data: {
      loggedInReviewerId,
    },
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }, { client }));

  await expect(stream).toEmitTypedValue({
    data: {
      loggedInReviewerId,
      postRequiringReview,
      reviewerDetails,
    },
  });
  await expect(stream).toComplete();
});

test("does not execute client resolvers for client subtrees without an export directive", async () => {
  const query = gql`
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
  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        author,
        currentAuthor,
      },
    },
  });
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      currentAuthor: { __typename: "Author", id: testAuthor.id },
      author: testAuthor,
    },
  });
  await expect(stream).toComplete();

  expect(currentAuthor).toHaveBeenCalledTimes(2);
  expect(author).toHaveBeenCalledTimes(1);
});

test("warns and does not set optional exported variable for client-only query when resolver throws error", async () => {
  using _ = spyOnConsole("error");
  const query = gql`
    query currentAuthorPostCount($authorId: Int) {
      currentAuthorId @client @export(as: "authorId")
      author(id: $authorId) @client {
        id
        name
      }
    }
  `;

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const link = new LocalResolversLink({
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
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      currentAuthorId: null,
      author: null,
    },
    errors: [
      {
        message: "Something went wrong",
        path: ["currentAuthorId"],
        extensions: {
          apollo: {
            phase: "exports",
            resolver: "Query.currentAuthorId",
            source: "LocalResolversLink",
            cause: new Error("Something went wrong"),
          },
        },
      },
      {
        message: "Something went wrong",
        path: ["currentAuthorId"],
        extensions: {
          apollo: {
            phase: "resolve",
            resolver: "Query.currentAuthorId",
            source: "LocalResolversLink",
            cause: new Error("Something went wrong"),
          },
        },
      },
    ],
  });
  await expect(stream).toComplete();

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
  const query = gql`
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

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const link = new LocalResolversLink({
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
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      currentAuthor: null,
      author: null,
    },
    errors: [
      {
        message: "Something went wrong",
        path: ["currentAuthor"],
        extensions: {
          apollo: {
            phase: "exports",
            resolver: "Query.currentAuthor",
            source: "LocalResolversLink",
            cause: new Error("Something went wrong"),
          },
        },
      },
      {
        message: "Something went wrong",
        path: ["currentAuthor"],
        extensions: {
          apollo: {
            phase: "resolve",
            resolver: "Query.currentAuthor",
            source: "LocalResolversLink",
            cause: new Error("Something went wrong"),
          },
        },
      },
    ],
  });
  await expect(stream).toComplete();

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
  const query = gql`
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

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const link = new LocalResolversLink({
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
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      currentAuthor: null,
      author: null,
    },
    errors: [
      {
        message: "Something went wrong",
        path: ["currentAuthor"],
        extensions: {
          apollo: {
            phase: "exports",
            resolver: "Query.currentAuthor",
            source: "LocalResolversLink",
            cause: new Error("Something went wrong"),
          },
        },
      },
      {
        message: "Something went wrong",
        path: ["currentAuthor"],
        extensions: {
          apollo: {
            phase: "resolve",
            resolver: "Query.currentAuthor",
            source: "LocalResolversLink",
            cause: new Error("Something went wrong"),
          },
        },
      },
    ],
  });
  await expect(stream).toComplete();

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
  const query = gql`
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

  const link = new LocalResolversLink({
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
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      currentUser: null,
      favoriteTeam: null,
      user: null,
      team: null,
    },
    errors: [
      {
        message: "Could not get current user",
        path: ["currentUser"],
        extensions: {
          apollo: {
            phase: "exports",
            resolver: "Query.currentUser",
            source: "LocalResolversLink",
            cause: new Error("Could not get current user"),
          },
        },
      },
      {
        message: "Could not get favorite team",
        path: ["favoriteTeam"],
        extensions: {
          apollo: {
            phase: "exports",
            resolver: "Query.favoriteTeam",
            source: "LocalResolversLink",
            cause: new Error("Could not get favorite team"),
          },
        },
      },
      {
        message: "Could not get current user",
        path: ["currentUser"],
        extensions: {
          apollo: {
            phase: "resolve",
            resolver: "Query.currentUser",
            source: "LocalResolversLink",
            cause: new Error("Could not get current user"),
          },
        },
      },
      {
        message: "Could not get favorite team",
        path: ["favoriteTeam"],
        extensions: {
          apollo: {
            phase: "resolve",
            resolver: "Query.favoriteTeam",
            source: "LocalResolversLink",
            cause: new Error("Could not get favorite team"),
          },
        },
      },
    ],
  });
  await expect(stream).toComplete();

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
  const query = gql`
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

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const link = new LocalResolversLink({
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
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      currentAuthor: { __typename: "Author", id: null },
      author: null,
    },
    errors: [
      {
        message: "Something went wrong",
        path: ["currentAuthor", "id"],
        extensions: {
          apollo: {
            phase: "exports",
            resolver: "Author.id",
            source: "LocalResolversLink",
            cause: new Error("Something went wrong"),
          },
        },
      },
      {
        message: "Something went wrong",
        path: ["currentAuthor", "id"],
        extensions: {
          apollo: {
            phase: "resolve",
            resolver: "Author.id",
            source: "LocalResolversLink",
            cause: new Error("Something went wrong"),
          },
        },
      },
    ],
  });

  expect(console.error).toHaveBeenCalledTimes(1);
  expect(console.error).toHaveBeenCalledWith(
    "An error was thrown when resolving the optional exported variable '%s' from resolver '%s':\n[%s]: %s",
    "authorId",
    "Author.id",
    "Error",
    "Something went wrong"
  );
});

test("emits error when a resolver throws while gathering exported variables for a required variable in client-only query", async () => {
  const query = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthorId @client @export(as: "authorId")
      author(id: $authorId) @client {
        id
        name
      }
    }
  `;

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const link = new LocalResolversLink({
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
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitError(
    new LocalResolversError(
      "An error was thrown from resolver 'Query.currentAuthorId' while resolving required variable 'authorId'.",
      {
        path: ["currentAuthorId"],
        sourceError: new Error("Something went wrong"),
      }
    )
  );
});

test("emits error when a parent resolver throws while gathering exported variables from child field for a required variable in client-only query", async () => {
  const query = gql`
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

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const link = new LocalResolversLink({
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
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitError(
    new LocalResolversError(
      "An error was thrown from resolver 'Query.currentAuthor' while resolving required variable 'authorId'.",
      {
        path: ["currentAuthor"],
        sourceError: new Error("Something went wrong"),
      }
    )
  );
});

test("emits error when a child resolver throws while gathering exported variables from child field for a required variable in client-only query", async () => {
  const query = gql`
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

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const link = new LocalResolversLink({
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
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitError(
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
  const query = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthorId @client @export(as: "authorId")
      author(id: $authorId) @client {
        id
        name
      }
    }
  `;

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        currentAuthorId: () => null,
        author: (_, { id }) => {
          return id === null ? null : testAuthor;
        },
      },
    },
  });
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitError(
    new LocalResolversError(
      "Resolver 'Query.currentAuthorId' returned `null` for required variable 'authorId'.",
      { path: ["currentAuthorId"] }
    )
  );
});

test("errors when nested field is null for a required variable on client-only query", async () => {
  const query = gql`
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

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        currentAuthor: () => ({ __typename: "Author", id: null }),
        author: (_, { id }) => {
          return id === null ? null : testAuthor;
        },
      },
    },
  });
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitError(
    new LocalResolversError(
      "Field 'Author.id' returned `null` for required variable 'authorId'.",
      { path: ["currentAuthor", "id"] }
    )
  );
});

test("errors when nested field is null for a required variable on client-only query", async () => {
  const query = gql`
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

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const link = new LocalResolversLink({
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
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitError(
    new LocalResolversError(
      "Resolver 'Author.id' returned `null` for required variable 'authorId'.",
      { path: ["currentAuthor", "id"] }
    )
  );
});

test("emits error when top-level resolver returns null with nested export for required variable", async () => {
  const query = gql`
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

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        currentAuthor: () => null,
        author: (_, { id }) => {
          return id === null ? null : testAuthor;
        },
      },
    },
  });
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitError(
    new LocalResolversError(
      "Resolver 'Query.currentAuthor' returned `null` which contains exported required variable 'authorId'.",
      { path: ["currentAuthor"] }
    )
  );
});

test("emits error when top-level resolver returns undefined with nested export for required variable", async () => {
  const query = gql`
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

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        currentAuthor: () => {},
        author: (_, { id }) => {
          return id === null ? null : testAuthor;
        },
      },
    },
  });
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitError(
    new LocalResolversError(
      "Resolver 'Query.currentAuthor' returned `undefined` which contains exported required variable 'authorId'.",
      { path: ["currentAuthor"] }
    )
  );
});

test("errors when resolver returns undefined for a required variable on client-only query", async () => {
  const query = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthorId @client @export(as: "authorId")
      author(id: $authorId) @client {
        id
        name
      }
    }
  `;

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        currentAuthorId: () => {},
        author: (_, { id }) => {
          return id === null ? null : testAuthor;
        },
      },
    },
  });
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitError(
    new LocalResolversError(
      "Resolver 'Query.currentAuthorId' returned `undefined` for required variable 'authorId'.",
      { path: ["currentAuthorId"] }
    )
  );
});

test("errors when resolver returns null for a required variable on non-client query", async () => {
  const query = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthorId @client @export(as: "authorId")
      author(id: $authorId) {
        id
        name
      }
    }
  `;

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const mockLink = new ApolloLink(() => of({ data: { author: testAuthor } }));
  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        currentAuthorId: () => null,
      },
    },
  });
  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitError(
    new LocalResolversError(
      "Resolver 'Query.currentAuthorId' returned `null` for required variable 'authorId'.",
      { path: ["currentAuthorId"] }
    )
  );
});

test("errors when resolver returns undefined for a required variable on non-client query", async () => {
  const query = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthorId @client @export(as: "authorId")
      author(id: $authorId) {
        id
        name
      }
    }
  `;

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const mockLink = new ApolloLink(() => of({ data: { author: testAuthor } }));
  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        currentAuthorId: () => {},
      },
    },
  });
  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitError(
    new LocalResolversError(
      "Resolver 'Query.currentAuthorId' returned `undefined` for required variable 'authorId'.",
      { path: ["currentAuthorId"] }
    )
  );
});

test("errors when resolver returns object with null field for a required variable", async () => {
  const query = gql`
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

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const mockLink = new ApolloLink(() => of({ data: { author: testAuthor } }));
  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        currentAuthor: () => ({ __typename: "Author", profile: null }),
      },
    },
  });
  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitError(
    new LocalResolversError(
      "Field 'Author.profile' returned `null` which contains exported required variable 'authorId'.",
      { path: ["currentAuthor", "profile"] }
    )
  );
});

test("does not warn when gathering variable exports for optional variables", async () => {
  using _ = spyOnConsole("warn");
  const query = gql`
    query currentAuthorPostCount($authorId: Int) {
      currentAuthorId @client @export(as: "authorId")
      author(id: $authorId) {
        id
        name
      }
    }
  `;

  const testAuthor = {
    __typename: "Author",
    id: 100,
    name: "John Smith",
  };

  const mockLink = new ApolloLink(({ variables }) =>
    of({ data: { author: variables.id === undefined ? null : testAuthor } })
  );
  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        currentAuthorId: () => {},
      },
    },
  });
  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: { currentAuthorId: null, author: null },
  });

  // If the warning was emitted during the exports phase, we'd see the console
  // called twice (the 2nd time is for resolving the value for the end result.)
  expect(console.warn).toHaveBeenCalledTimes(1);
});

test("exported variables overwrite variables passed to link chain", async () => {
  const query = gql`
    query currentAuthorPostCount($authorId: Int!) {
      currentAuthorId @client @export(as: "authorId")
      postCount(authorId: $authorId) @client
    }
  `;

  const testAuthorId = 100;
  const testPostCount = 200;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        currentAuthorId: () => testAuthorId,
        postCount(_, { authorId }) {
          return authorId === testAuthorId ? testPostCount : 0;
        },
      },
    },
  });

  const stream = new ObservableStream(
    execute(link, { query, variables: { authorId: 200 } })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      currentAuthorId: testAuthorId,
      postCount: testPostCount,
    },
  });
  await expect(stream).toComplete();
});

test("combines exported variables with user-defined variables", async () => {
  const query = gql`
    query currentAuthorPostCount($authorId: Int!, $limit: Int!) {
      currentAuthorId @client @export(as: "authorId")
      posts(authorId: $authorId, limit: $limit) {
        id
      }
    }
  `;

  const testAuthorId = 100;

  function times<T>(num: number, fn: (num: number) => T) {
    const values: T[] = [];

    for (let i = 0; i < num; i++) {
      values.push(fn(i));
    }

    return values;
  }
  const mockLink = new ApolloLink(({ variables }) => {
    return of({
      data: {
        posts:
          variables.authorId === testAuthorId ?
            times(variables.limit, (num) => ({
              __typename: "Post",
              id: num,
            }))
          : [],
      },
    });
  });

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        currentAuthorId: () => testAuthorId,
      },
    },
  });

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(
    execute(link, { query, variables: { limit: 10 } })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      currentAuthorId: testAuthorId,
      posts: times(10, (num) => ({ __typename: "Post", id: num })),
    },
  });
  await expect(stream).toComplete();
});
