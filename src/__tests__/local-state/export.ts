import { print } from "graphql";
import { gql } from "graphql-tag";
import { of } from "rxjs";

import { ApolloClient, LocalStateError, NetworkStatus } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { ApolloLink } from "@apollo/client/link";
import { LocalState } from "@apollo/client/local-state";
import { MockSubscriptionLink } from "@apollo/client/testing";
import {
  ObservableStream,
  spyOnConsole,
  wait,
} from "@apollo/client/testing/internal";
import { InvariantError } from "@apollo/client/utilities/invariant";

describe("@client @export tests", () => {
  test("throws when exported variable has no definition", async () => {
    const query = gql`
      {
        field @client @export(as: "someVar")
      }
    `;

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link: ApolloLink.empty(),
      localState: new LocalState(),
    });

    cache.writeQuery({
      query,
      data: { field: 1 },
    });

    await expect(client.query({ query })).rejects.toEqual(
      new LocalStateError(
        "`@export` directive on field 'field' cannot export the '$someVar' variable as it is missing in the query definition.",
        { path: ["field"] }
      )
    );
  });

  test("throws when nested @export does not contain variable definition", async () => {
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
      localState: new LocalState(),
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

    await expect(client.query({ query })).rejects.toEqual(
      new LocalStateError(
        "`@export` directive on field 'torque' cannot export the '$torque' variable as it is missing in the query definition.",
        { path: ["car", "engine", "torque"] }
      )
    );
  });

  test("should store the @client field value in the specified @export variable, and make it available to a subsequent resolver", async () => {
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
      link: ApolloLink.empty(),
      localState: new LocalState({
        resolvers: {
          Query: {
            postCount(_, { authorId }) {
              return authorId === testAuthorId ? testPostCount : 0;
            },
          },
        },
      }),
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

  test("should store the @client nested field value in the specified @export variable, and make it available to a subsequent resolver", async () => {
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
      link: ApolloLink.empty(),
      localState: new LocalState({
        resolvers: {
          Query: {
            postCount(_, { authorId }) {
              return authorId === testAuthor.authorId ? testPostCount : 0;
            },
          },
        },
      }),
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

  test("should allow @client @export variables to be used with remote queries", async () => {
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
        localState: new LocalState(),
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

  test("should support @client @export variables that are nested multiple levels deep", async () => {
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
      localState: new LocalState(),
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

  test("should ignore @export directives if not used with @client", async () => {
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
      localState: new LocalState(),
    });

    const { data } = await client.query({ query });

    expect(data).toEqual({
      currentAuthor: testAuthor,
      postCount: testPostCount,
    });
  });

  test("should support setting an @client @export variable, loaded from the cache, on a virtual field that is combined into a remote query.", async () => {
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
      localState: new LocalState(),
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

  test("should support setting a @client @export variable, loaded via a local resolver, on a virtual field that is combined into a remote query.", async () => {
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
      localState: new LocalState({
        resolvers: {
          Post: {
            currentReviewer() {
              return currentReviewer;
            },
          },
        },
      }),
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

  test("should support combining @client @export variables, calculated by a local resolver, with remote mutations", async () => {
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
      localState: new LocalState({
        resolvers: {
          Mutation: {
            topPost() {
              return testPostId;
            },
          },
        },
      }),
    });

    const { data } = await client.mutate({ mutation });

    expect(data).toEqual({
      topPost: 100,
      upvotePost: testPost,
    });
  });

  test("should support combining @client @export variables, calculated by reading from the cache, with remote mutations", async () => {
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
      localState: new LocalState(),
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

    expect(data).toStrictEqualTyped({
      topPost: testPostId,
      upvotePost: testPost,
    });
  });

  test("should not add __typename to @export-ed objects (#4691)", async () => {
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
      localState: new LocalState({
        resolvers: {
          Query: {
            currentFilter() {
              return { __typename: "LessonFilter", ...currentFilter };
            },
          },
        },
      }),
    });

    const result = await client.query({ query });

    expect(result.data).toEqual({
      currentFilter,
      ...data,
    });
  });

  test("should use the value of the last @export variable defined, if multiple variables are defined with the same name", async () => {
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
      localState: new LocalState(),
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

  test("should refetch if an @export variable changes, the current fetch policy is not cache-only, and the query includes fields that need to be resolved remotely", async () => {
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
      localState: new LocalState(),
    });

    client.writeQuery({
      query,
      data: { currentAuthorId },
    });

    const obs = client.watchQuery({ query });
    const stream = new ObservableStream(obs);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: {
        currentAuthorId: testAuthorId1,
        postCount: testPostCount1,
      },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    currentAuthorId = testAuthorId2;
    client.writeQuery({
      query,
      data: { currentAuthorId },
    });

    await expect(stream).toEmitSimilarValue({
      expected: (previous) => ({
        ...previous,
        loading: true,
        networkStatus: NetworkStatus.loading,
      }),
    });

    await expect(stream).toEmitTypedValue({
      data: {
        currentAuthorId: testAuthorId2,
        postCount: testPostCount2,
      },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });

  test("should NOT refetch if an @export variable has not changed, the current fetch policy is not cache-only, and the query includes fields that need to be resolved remotely", async () => {
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
      localState: new LocalState(),
    });

    client.writeQuery({
      query,
      data: { currentAuthorId: testAuthorId1 },
    });

    const obs = client.watchQuery({ query });
    const stream = new ObservableStream(obs);

    await expect(stream).toEmitTypedValue({
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: {
        currentAuthorId: testAuthorId1,
        postCount: testPostCount1,
      },
      dataState: "complete",
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

    await expect(stream).toEmitSimilarValue({
      expected: (previous) => ({
        ...previous,
        data: { ...previous.data!, postCount: testPostCount2 },
        dataState: "complete",
      }),
    });
    expect(fetchCount).toBe(1);
  });

  test("should NOT attempt to refetch over the network if an @export variable has changed, the current fetch policy is cache-first, and the remote part of the query (that leverages the @export variable) can be fully found in the cache.", async () => {
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
      localState: new LocalState(),
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
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: {
        currentAuthorId: testAuthorId1,
        postCount: testPostCount1,
      },
      dataState: "complete",
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
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
    // The updated result should not have been fetched over the
    // network, as it can be found in the cache.
    expect(fetchCount).toBe(1);
  });

  test("should update @client @export variables on each broadcast if they've changed", async () => {
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
      link: ApolloLink.empty(),
      localState: new LocalState({
        resolvers: {
          Query: {
            doubleWidgets(_, { widgetCount }) {
              return widgetCount ? widgetCount * 2 : 0;
            },
          },
        },
      }),
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
      data: undefined,
      dataState: "empty",
      loading: true,
      networkStatus: NetworkStatus.loading,
      partial: true,
    });

    await expect(stream).toEmitTypedValue({
      data: {
        widgetCount: 100,
        doubleWidgets: 200,
      },
      dataState: "complete",
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

    await expect(stream).toEmitSimilarValue({
      expected: (previous) => ({
        ...previous,
        loading: true,
        networkStatus: NetworkStatus.loading,
      }),
    });

    await expect(stream).toEmitTypedValue({
      data: {
        widgetCount: 500,
        doubleWidgets: 1000,
      },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });
  });

  test("adds exported variables to subscriptions", async () => {
    const subscription = gql`
      subscription ($userId: ID!) {
        currentUserId @client @export(as: "userId")
        count(for: $userId)
      }
    `;

    const link = new ApolloLink((operation) =>
      operation.variables.userId === 1 ?
        of({ data: { count: 1 } }, { data: { count: 2 } })
      : of({ errors: [{ message: "Wrong user id" }] })
    );

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      localState: new LocalState({
        resolvers: {
          Subscription: {
            currentUserId: () => 1,
          },
        },
      }),
    });

    const stream = new ObservableStream(
      client.subscribe({ query: subscription })
    );

    await expect(stream).toEmitTypedValue({
      data: { currentUserId: 1, count: 1 },
    });
    await expect(stream).toEmitTypedValue({
      data: { currentUserId: 1, count: 2 },
    });
    await expect(stream).toComplete();
  });

  test("can use exported variables with restart function", async () => {
    const subscription = gql`
      subscription ($userId: ID!) {
        currentUserId @client @export(as: "userId")
        count(for: $userId)
      }
    `;

    const onSubscribe = jest.fn();
    const onUnsubscribe = jest.fn();
    const link = new MockSubscriptionLink();
    link.onSetup(onSubscribe);
    link.onUnsubscribe(onUnsubscribe);

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      localState: new LocalState({
        resolvers: {
          Subscription: {
            currentUserId: () => {
              return 1;
            },
          },
        },
      }),
    });

    const observable = client.subscribe({ query: subscription });
    const stream = new ObservableStream(observable);

    // Ensure we wait for the local resolver to run
    await wait(0);

    expect(onSubscribe).toHaveBeenCalledTimes(1);
    expect(onUnsubscribe).not.toHaveBeenCalled();

    link.simulateResult({ result: { data: { count: 1 } } });

    await expect(stream).toEmitTypedValue({
      data: { currentUserId: 1, count: 1 },
    });

    observable.restart();

    expect(onUnsubscribe).toHaveBeenCalledTimes(1);
    expect(onSubscribe).toHaveBeenCalledTimes(2);

    link.simulateResult({ result: { data: { count: 2 } } }, true);

    await expect(stream).toEmitTypedValue({
      data: { currentUserId: 1, count: 2 },
    });
    await expect(stream).toComplete();
  });

  test("throws when running a query with exported client fields when local state is not configured", async () => {
    const query = gql`
      query currentAuthorPostCount($authorId: Int!) {
        currentAuthorId @client @export(as: "authorId")
        postCount(authorId: $authorId)
      }
    `;

    const testPostCount = 200;

    const link = new ApolloLink((operation) => {
      return operation.variables.authorId === undefined ?
          of({ errors: [{ message: "Did not export author ID" }] })
        : of({ data: { postCount: testPostCount } });
    });

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    await expect(client.query({ query })).rejects.toEqual(
      new InvariantError(
        "Query 'currentAuthorPostCount' contains `@client` fields with variables provided by `@export` but local state has not been configured."
      )
    );
  });

  test("throws when running a mutation with exported client fields when local state is not configured", async () => {
    const mutation = gql`
      mutation UpdatePostCount($authorId: Int!) {
        currentAuthorId @client @export(as: "authorId")
        updatePostCount(authorId: $authorId)
      }
    `;

    const testPostCount = 200;

    const link = new ApolloLink((operation) => {
      return operation.variables.authorId === undefined ?
          of({ errors: [{ message: "Did not export author ID" }] })
        : of({ data: { updatePostCount: testPostCount } });
    });

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    await expect(client.mutate({ mutation })).rejects.toEqual(
      new InvariantError(
        "Mutation 'UpdatePostCount' contains `@client` fields with variables provided by `@export` but local state has not been configured."
      )
    );
  });

  test("throws when running a subscription with exported client fields when local state is not configured", async () => {
    const subscription = gql`
      subscription OnPostCountUpdated($authorId: Int!) {
        currentAuthorId @client @export(as: "authorId")
        postCount(authorId: $authorId)
      }
    `;

    const link = new MockSubscriptionLink();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    expect(() => client.subscribe({ query: subscription })).toThrow(
      new InvariantError(
        "Subscription 'OnPostCountUpdated' contains `@client` fields with variables provided by `@export` but local state has not been configured."
      )
    );
  });
});
