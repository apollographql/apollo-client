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
      "Cannot export a variable from a field that is a child of a remote field. Exported variables must either originate from a root-level client field or a child of a root-level client field.",
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

test("warns and sets exported variable to null for client-only query when resolver throws error", async () => {
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
          return id === null ? null : testAuthor;
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
          },
        },
      },
    ],
  });
  await expect(stream).toComplete();

  expect(console.error).toHaveBeenCalledTimes(1);
  expect(console.error).toHaveBeenCalledWith(
    "An error was thrown from resolver '%s' while resolving exported variables. Because this was an optional variable, the value has been set to `null`.",
    "Query.currentAuthorId"
  );
});

test.skip("Does ??? when a resolver throws an error for an exported variable", async () => {
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

  const mockLink = new ApolloLink(() => {
    return of({ data: { author: testAuthor } });
  });

  const localResolversLink = new LocalResolversLink({
    resolvers: {
      Query: {
        currentAuthorId: () => {
          throw new Error("Something went wrong");
        },
      },
    },
  });
  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      currentAuthorId: testAuthor,
      author: testAuthor,
    },
  });
  await expect(stream).toComplete();
});

test.todo(
  "errors when resolver returns null or undefined for a required variable"
);

test.todo("overwrites variables passed to link chain");
test.todo("allows user-provided variables");
