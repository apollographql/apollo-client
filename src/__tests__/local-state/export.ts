import { print } from "graphql";
import { gql } from "graphql-tag";
import { of } from "rxjs";

import { ApolloClient, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { ApolloLink } from "@apollo/client/link/core";
import {
  ObservableStream,
  spyOnConsole,
} from "@apollo/client/testing/internal";

describe("@client @export tests", () => {
  it("should not break @client only queries when the @export directive is used", async () => {
    const query = gql`
      {
        field @client @export(as: "someVar")
      }
    `;

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link: ApolloLink.empty(),
      resolvers: {},
    });

    cache.writeQuery({
      query,
      data: { field: 1 },
    });

    const { data } = await client.query({ query });

    expect(data).toEqual({ field: 1 });
  });

  it("should not break @client only queries when the @export directive is used on nested fields", async () => {
    const query = gql`
      {
        car @client {
          engine {
            torque @export(as: "torque")
          }
        }
      }
    `;

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link: ApolloLink.empty(),
      resolvers: {},
    });

    cache.writeQuery({
      query,
      data: {
        car: {
          engine: {
            cylinders: 8,
            torque: 7200,
            __typename: "Engine",
          },
          __typename: "Car",
        },
      },
    });

    const { data } = await client.query({ query });

    expect(data).toEqual({
      car: {
        __typename: "Car",
        engine: {
          __typename: "Engine",
          torque: 7200,
        },
      },
    });
  });

  it("should store the @client field value in the specified @export variable, and make it available to a subsequent resolver", async () => {
    const query = gql`
      query currentAuthorPostCount($authorId: Int!) {
        currentAuthorId @client @export(as: "authorId")
        postCount(authorId: $authorId) @client
      }
    `;

    const testAuthorId = 100;
    const testPostCount = 200;

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      resolvers: {
        Query: {
          postCount(_, { authorId }) {
            return authorId === testAuthorId ? testPostCount : 0;
          },
        },
      },
    });

    cache.writeQuery({
      query,
      data: {
        currentAuthorId: testAuthorId,
      },
    });

    const { data } = await client.query({ query });

    expect(data).toEqual({
      currentAuthorId: testAuthorId,
      postCount: testPostCount,
    });
  });

  it("should store the @client nested field value in the specified @export variable, and make it avilable to a subsequent resolver", async () => {
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

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      resolvers: {
        Query: {
          postCount(_, { authorId }) {
            return authorId === testAuthor.authorId ? testPostCount : 0;
          },
        },
      },
    });

    cache.writeQuery({
      query,
      data: {
        currentAuthor: testAuthor,
      },
    });

    const { data } = await client.query({ query });

    expect(data).toMatchObject({
      currentAuthor: testAuthor,
      postCount: testPostCount,
    });
  });

  it("should allow @client @export variables to be used with remote queries", async () => {
    using _consoleSpies = spyOnConsole.takeSnapshots("error");
    await new Promise<void>((resolve, reject) => {
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

      const link = new ApolloLink(() =>
        of({
          data: {
            postCount: testPostCount,
          },
        })
      );

      const cache = new InMemoryCache();
      const client = new ApolloClient({
        cache,
        link,
        resolvers: {},
      });

      cache.writeQuery({
        query,
        data: {
          currentAuthor: testAuthor,
        },
      });

      return client.query({ query }).then(({ data }: any) => {
        expect({ ...data }).toMatchObject({
          currentAuthor: testAuthor,
          postCount: testPostCount,
        });
        resolve();
      });
    });
  });

  it("should support @client @export variables that are nested multiple levels deep", async () => {
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

    const link = new ApolloLink(() =>
      of({
        data: {
          postCount: testPostCount,
        },
      })
    );

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link,
      resolvers: {},
    });

    {
      using _ = spyOnConsole("error");
      cache.writeQuery({
        query,
        data: {
          appContainer,
        },
      });
    }

    const { data } = await client.query({ query });

    expect(data).toEqual({
      appContainer,
      postCount: testPostCount,
    });
  });

  it("should ignore @export directives if not used with @client", async () => {
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

    const link = new ApolloLink(() =>
      of({
        data: {
          currentAuthor: testAuthor,
          postCount: testPostCount,
        },
      })
    );

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      resolvers: {},
    });

    const { data } = await client.query({ query });

    expect(data).toEqual({
      currentAuthor: testAuthor,
      postCount: testPostCount,
    });
  });

  it("should support setting an @client @export variable, loaded from the cache, on a virtual field that is combined into a remote query.", async () => {
    const query = gql`
      query postRequiringReview($reviewerId: Int!) {
        postRequiringReview {
          id
          title
          loggedInReviewerId @client @export(as: "reviewerId")
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

    const link = new ApolloLink(({ variables }) => {
      expect(variables).toMatchObject({ reviewerId: loggedInReviewerId });

      return of({
        data: {
          postRequiringReview,
          reviewerDetails,
        },
      });
    });

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link,
      resolvers: {},
    });

    {
      using _ = spyOnConsole("error");
      cache.writeQuery({
        query,
        data: {
          postRequiringReview: {
            loggedInReviewerId,
            __typename: "Post",
            id: 10,
          },
        },
      });
    }

    const { data } = await client.query({ query });

    expect(data).toEqual({
      postRequiringReview: {
        __typename: "Post",
        id: postRequiringReview.id,
        title: postRequiringReview.title,
        loggedInReviewerId,
      },
      reviewerDetails,
    });
  });

  it("should support setting a @client @export variable, loaded via a local resolver, on a virtual field that is combined into a remote query.", async () => {
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

    const link = new ApolloLink(({ variables }) => {
      expect(variables).toMatchObject({ reviewerId: currentReviewer.id });
      return of({
        data: {
          postRequiringReview,
          reviewerDetails,
        },
      });
    });

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link,
      resolvers: {
        Post: {
          currentReviewer() {
            return currentReviewer;
          },
        },
      },
    });

    {
      using _ = spyOnConsole("error");
      cache.writeQuery({
        query,
        data: {
          postRequiringReview: {
            __typename: "Post",
          },
        },
      });
    }

    const { data } = await client.query({ query });

    expect(data).toMatchObject({
      postRequiringReview: {
        id: postRequiringReview.id,
        title: postRequiringReview.title,
        currentReviewer,
      },
      reviewerDetails,
    });
  });

  it("should support combining @client @export variables, calculated by a local resolver, with remote mutations", async () => {
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

    const link = new ApolloLink(({ variables }) => {
      expect(variables).toMatchObject({ postId: testPostId });
      return of({
        data: {
          upvotePost: testPost,
        },
      });
    });

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      resolvers: {
        Mutation: {
          topPost() {
            return testPostId;
          },
        },
      },
    });

    const { data } = await client.mutate({ mutation });

    expect(data).toEqual({
      topPost: 100,
      upvotePost: testPost,
    });
  });

  it("should support combining @client @export variables, calculated by reading from the cache, with remote mutations", async () => {
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

    const link = new ApolloLink(({ variables }) => {
      expect(variables).toMatchObject({ postId: testPostId });
      return of({
        data: {
          upvotePost: testPost,
        },
      });
    });

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link,
      resolvers: {},
    });

    cache.writeQuery({
      query: gql`
        {
          topPost
        }
      `,
      data: {
        topPost: testPostId,
      },
    });

    const { data } = await client.mutate({ mutation });

    expect(data).toEqual({
      upvotePost: testPost,
    });
  });

  it("should not add __typename to @export-ed objects (#4691)", async () => {
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

    const expectedServerQuery = gql`
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

    const client = new ApolloClient({
      link: new ApolloLink((request) => {
        expect(request.variables.where).toEqual(currentFilter);
        expect(print(request.query)).toBe(print(expectedServerQuery));
        return of({ data });
      }),
      cache: new InMemoryCache(),
      resolvers: {
        Query: {
          currentFilter() {
            return currentFilter;
          },
        },
      },
    });

    const result = await client.query({ query });

    expect(result.data).toEqual({
      currentFilter,
      ...data,
    });
  });

  it("should use the value of the last @export variable defined, if multiple variables are defined with the same name", async () => {
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

    const link = new ApolloLink(({ variables }) => {
      expect(variables).toMatchObject({ reviewerId: secondaryReviewerId });
      return of({
        data: {
          post,
        },
      });
    });

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link,
      resolvers: {},
    });

    {
      using _ = spyOnConsole("error");
      cache.writeQuery({
        query,
        data: {
          primaryReviewerId,
          secondaryReviewerId,
        },
      });
    }

    const { data } = await client.query({ query });

    expect(data).toEqual({
      post,
      primaryReviewerId,
      secondaryReviewerId,
    });
  });

  it("should refetch if an @export variable changes, the current fetch policy is not cache-only, and the query includes fields that need to be resolved remotely", async () => {
    using _consoleSpies = spyOnConsole.takeSnapshots("error");
    const query = gql`
      query currentAuthorPostCount($authorId: Int!) {
        currentAuthorId @client @export(as: "authorId")
        postCount(authorId: $authorId)
      }
    `;

    const testAuthorId1 = 100;
    const testPostCount1 = 200;

    const testAuthorId2 = 101;
    const testPostCount2 = 201;

    let currentAuthorId = testAuthorId1;

    const link = new ApolloLink(() =>
      of({
        data: {
          postCount:
            currentAuthorId === testAuthorId1 ? testPostCount1 : testPostCount2,
        },
      })
    );

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link,
      resolvers: {},
    });

    client.writeQuery({
      query,
      data: { currentAuthorId },
    });

    const obs = client.watchQuery({ query });
    const stream = new ObservableStream(obs);

    await expect(stream).toEmitTypedValue({
      data: {
        currentAuthorId: testAuthorId1,
        postCount: testPostCount1,
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    currentAuthorId = testAuthorId2;
    client.writeQuery({
      query,
      data: { currentAuthorId },
    });

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: {
        currentAuthorId: testAuthorId2,
        postCount: testPostCount2,
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });

  it("should NOT refetch if an @export variable has not changed, the current fetch policy is not cache-only, and the query includes fields that need to be resolved remotely", async () => {
    using _consoleSpies = spyOnConsole.takeSnapshots("error");
    const query = gql`
      query currentAuthorPostCount($authorId: Int!) {
        currentAuthorId @client @export(as: "authorId")
        postCount(authorId: $authorId)
      }
    `;

    const testAuthorId1 = 100;
    const testPostCount1 = 200;

    const testPostCount2 = 201;

    let fetchCount = 0;
    const link = new ApolloLink(() => {
      fetchCount += 1;
      return of({
        data: {
          postCount: testPostCount1,
        },
      });
    });

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link,
      resolvers: {},
    });

    client.writeQuery({
      query,
      data: { currentAuthorId: testAuthorId1 },
    });

    const obs = client.watchQuery({ query });
    const stream = new ObservableStream(obs);

    await expect(stream).toEmitTypedValue({
      data: {
        currentAuthorId: testAuthorId1,
        postCount: testPostCount1,
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
    expect(fetchCount).toBe(1);

    client.writeQuery({
      query,
      variables: { authorId: testAuthorId1 },
      data: { postCount: testPostCount2 },
    });

    await expect(stream).toEmitNext();
    expect(fetchCount).toBe(1);
  });

  it("should NOT attempt to refetch over the network if an @export variable has changed, the current fetch policy is cache-first, and the remote part of the query (that leverages the @export variable) can be fully found in the cache.", async () => {
    const query = gql`
      query currentAuthorPostCount($authorId: Int!) {
        currentAuthorId @client @export(as: "authorId")
        postCount(authorId: $authorId)
      }
    `;

    const testAuthorId1 = 1;
    const testPostCount1 = 100;

    const testAuthorId2 = 2;
    const testPostCount2 = 200;

    let fetchCount = 0;
    const link = new ApolloLink(() => {
      fetchCount += 1;
      return of({
        data: {
          postCount: testPostCount1,
        },
      });
    });

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link,
      resolvers: {},
    });

    client.writeQuery({
      query: gql`
        {
          currentAuthorId
        }
      `,
      data: { currentAuthorId: testAuthorId1 },
    });

    const obs = client.watchQuery({ query, fetchPolicy: "cache-first" });
    const stream = new ObservableStream(obs);

    await expect(stream).toEmitTypedValue({
      data: {
        currentAuthorId: testAuthorId1,
        postCount: testPostCount1,
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
    // The initial result is fetched over the network.
    expect(fetchCount).toBe(1);

    client.writeQuery({
      query,
      variables: { authorId: testAuthorId2 },
      data: { postCount: testPostCount2 },
    });
    client.writeQuery({
      query: gql`
        {
          currentAuthorId
        }
      `,
      data: { currentAuthorId: testAuthorId2 },
    });

    await expect(stream).toEmitTypedValue({
      data: {
        currentAuthorId: testAuthorId2,
        postCount: testPostCount2,
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
    // The updated result should not have been fetched over the
    // network, as it can be found in the cache.
    expect(fetchCount).toBe(1);
  });

  it("should update @client @export variables on each broadcast if they've changed", async () => {
    const cache = new InMemoryCache();

    const widgetCountQuery = gql`
      {
        widgetCount @client
      }
    `;
    cache.writeQuery({
      query: widgetCountQuery,
      data: {
        widgetCount: 100,
      },
    });

    const client = new ApolloClient({
      cache,
      resolvers: {
        Query: {
          doubleWidgets(_, { widgetCount }) {
            return widgetCount ? widgetCount * 2 : 0;
          },
        },
      },
    });

    const doubleWidgetsQuery = gql`
      query DoubleWidgets($widgetCount: Int!) {
        widgetCount @client @export(as: "widgetCount")
        doubleWidgets(widgetCount: $widgetCount) @client
      }
    `;

    const obs = client.watchQuery({ query: doubleWidgetsQuery });
    const stream = new ObservableStream(obs);

    await expect(stream).toEmitTypedValue({
      data: {
        widgetCount: 100,
        doubleWidgets: 200,
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    client.writeQuery({
      query: widgetCountQuery,
      data: {
        widgetCount: 500,
      },
    });

    await expect(stream).toEmitTypedValue({
      data: undefined,
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: {
        widgetCount: 500,
        doubleWidgets: 1000,
      },
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });
});
