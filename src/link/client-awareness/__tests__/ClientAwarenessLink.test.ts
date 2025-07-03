import { ApolloClient, gql, InMemoryCache, version } from "@apollo/client";
import { ClientAwarenessLink } from "@apollo/client/link/client-awareness";
import { MockSubscriptionLink } from "@apollo/client/testing";

const query = gql`
  query {
    hello
  }
`;

describe("feature: client awareness", () => {
  test("does not add headers without options", () => {
    const terminatingLink = new MockSubscriptionLink();
    const client = new ApolloClient({
      link: new ClientAwarenessLink().concat(terminatingLink),
      cache: new InMemoryCache(),
    });

    void client.query({ query });
    // note that the headers are not set to default values, but `headers` itself is still defined
    // as an empty object - this is okay
    const headers = terminatingLink.operation?.getContext().headers;
    expect(headers).toStrictEqual({});
  });

  test("can be enabled from `ApolloClient` options", () => {
    const terminatingLink = new MockSubscriptionLink();
    const client = new ApolloClient({
      link: new ClientAwarenessLink().concat(terminatingLink),
      cache: new InMemoryCache(),
      clientAwareness: {
        name: "test-client",
        version: "1.0.0",
      },
    });

    void client.query({ query });
    const headers = terminatingLink.operation?.getContext().headers;
    expect(headers).toStrictEqual({
      "apollographql-client-name": "test-client",
      "apollographql-client-version": "1.0.0",
    });
  });

  test("can be enabled from context", () => {
    const terminatingLink = new MockSubscriptionLink();
    const client = new ApolloClient({
      link: new ClientAwarenessLink().concat(terminatingLink),
      cache: new InMemoryCache(),
    });

    void client.query({
      query,
      context: {
        clientAwareness: {
          name: "test-client",
          version: "1.0.0",
        },
      },
    });
    const headers = terminatingLink.operation?.getContext().headers;
    expect(headers).toStrictEqual({
      "apollographql-client-name": "test-client",
      "apollographql-client-version": "1.0.0",
    });
  });

  test("can be enabled from `ClientAwarenessLink` constructor", () => {
    const terminatingLink = new MockSubscriptionLink();
    const client = new ApolloClient({
      link: new ClientAwarenessLink({
        clientAwareness: {
          name: "test-client",
          version: "1.0.0",
        },
      }).concat(terminatingLink),
      cache: new InMemoryCache(),
    });

    void client.query({ query });
    const headers = terminatingLink.operation?.getContext().headers;
    expect(headers).toStrictEqual({
      "apollographql-client-name": "test-client",
      "apollographql-client-version": "1.0.0",
    });
  });

  test("can be disabled from `ClientAwarenessLink` constructor, even with options present", () => {
    const terminatingLink = new MockSubscriptionLink();
    const client = new ApolloClient({
      link: new ClientAwarenessLink({
        clientAwareness: { transport: false },
      }).concat(terminatingLink),
      cache: new InMemoryCache(),
      clientAwareness: {
        name: "test-client",
        version: "1.0.0",
      },
    });

    void client.query({ query });
    const headers = terminatingLink.operation?.getContext().headers;
    expect(headers).toStrictEqual(undefined);
  });

  test("can set `name` without setting `version`", () => {
    const terminatingLink = new MockSubscriptionLink();
    const client = new ApolloClient({
      link: new ClientAwarenessLink().concat(terminatingLink),
      cache: new InMemoryCache(),
      clientAwareness: {
        name: "test-client",
      },
    });

    void client.query({ query });
    const headers = terminatingLink.operation?.getContext().headers;
    expect(headers).toStrictEqual({
      "apollographql-client-name": "test-client",
    });
  });

  test("can set `version` without setting `name`", () => {
    const terminatingLink = new MockSubscriptionLink();
    const client = new ApolloClient({
      link: new ClientAwarenessLink().concat(terminatingLink),
      cache: new InMemoryCache(),
      clientAwareness: {
        version: "1.0.0",
      },
    });

    void client.query({ query });
    const headers = terminatingLink.operation?.getContext().headers;
    expect(headers).toStrictEqual({
      "apollographql-client-version": "1.0.0",
    });
  });

  describe("option priorities", () => {
    test("context overrides `ApolloClient` options", () => {
      const terminatingLink = new MockSubscriptionLink();
      const client = new ApolloClient({
        link: new ClientAwarenessLink().concat(terminatingLink),
        cache: new InMemoryCache(),
        clientAwareness: {
          name: "test-client",
          version: "1.0.0",
        },
      });

      void client.query({
        query,
        context: {
          clientAwareness: {
            name: "overridden-client",
            version: "2.0.0",
          },
        },
      });

      const headers = terminatingLink.operation?.getContext().headers;
      expect(headers).toStrictEqual({
        "apollographql-client-name": "overridden-client",
        "apollographql-client-version": "2.0.0",
      });
    });

    test("context overrides `ClientAwarenessLink` options", () => {
      const terminatingLink = new MockSubscriptionLink();
      const client = new ApolloClient({
        link: new ClientAwarenessLink({
          clientAwareness: {
            name: "test-client",
            version: "1.0.0",
          },
        }).concat(terminatingLink),
        cache: new InMemoryCache(),
      });

      void client.query({
        query,
        context: {
          clientAwareness: {
            name: "overridden-client",
            version: "2.0.0",
          },
        },
      });
      const headers = terminatingLink.operation?.getContext().headers;
      expect(headers).toStrictEqual({
        "apollographql-client-name": "overridden-client",
        "apollographql-client-version": "2.0.0",
      });
    });

    test("`ClientAwarenessLink` options override `ApolloClient` options", () => {
      const terminatingLink = new MockSubscriptionLink();
      const client = new ApolloClient({
        link: new ClientAwarenessLink({
          clientAwareness: {
            name: "overridden-client",
            version: "2.0.0",
          },
        }).concat(terminatingLink),
        cache: new InMemoryCache(),
        clientAwareness: {
          name: "test-client",
          version: "1.0.0",
        },
      });

      void client.query({ query });
      const headers = terminatingLink.operation?.getContext().headers;
      expect(headers).toStrictEqual({
        "apollographql-client-name": "overridden-client",
        "apollographql-client-version": "2.0.0",
      });
    });

    test("merge-overrides `ClientAwarenessLink` and `ApolloClient` options", () => {
      const terminatingLink = new MockSubscriptionLink();
      const client = new ApolloClient({
        link: new ClientAwarenessLink({
          clientAwareness: {
            version: "2.0.0",
          },
        }).concat(terminatingLink),
        cache: new InMemoryCache(),
        clientAwareness: {
          name: "test-client",
          version: "1.0.0",
        },
      });

      void client.query({ query });
      const headers = terminatingLink.operation?.getContext().headers;
      expect(headers).toStrictEqual({
        "apollographql-client-name": "test-client",
        "apollographql-client-version": "2.0.0",
      });
    });

    test("merge-overrides `context` and `ApolloClient` options", () => {
      const terminatingLink = new MockSubscriptionLink();
      const client = new ApolloClient({
        link: new ClientAwarenessLink().concat(terminatingLink),
        cache: new InMemoryCache(),
        clientAwareness: {
          name: "test-client",
          version: "1.0.0",
        },
      });

      void client.query({
        query,
        context: {
          clientAwareness: {
            version: "2.0.0",
          },
        },
      });
      const headers = terminatingLink.operation?.getContext().headers;
      expect(headers).toStrictEqual({
        "apollographql-client-name": "test-client",
        "apollographql-client-version": "2.0.0",
      });
    });

    test("merge-overrides `ClientAwarenessLink` and `context` options", () => {
      const terminatingLink = new MockSubscriptionLink();
      const client = new ApolloClient({
        link: new ClientAwarenessLink({
          clientAwareness: {
            name: "test-client",
            version: "1.0.0",
          },
        }).concat(terminatingLink),
        cache: new InMemoryCache(),
      });

      void client.query({
        query,
        context: {
          clientAwareness: {
            version: "2.0.0",
          },
        },
      });
      const headers = terminatingLink.operation?.getContext().headers;
      expect(headers).toStrictEqual({
        "apollographql-client-name": "test-client",
        "apollographql-client-version": "2.0.0",
      });
    });
  });
});

describe("feature: enhanced client awareness", () => {
  test("is enabled by default", () => {
    const terminatingLink = new MockSubscriptionLink();
    const client = new ApolloClient({
      link: new ClientAwarenessLink().concat(terminatingLink),
      cache: new InMemoryCache(),
    });

    void client.query({ query });
    expect(terminatingLink.operation?.extensions).toStrictEqual({
      clientLibrary: {
        name: "@apollo/client",
        version,
      },
    });
  });

  test("can be disabled from `ApolloClient` options", () => {
    const terminatingLink = new MockSubscriptionLink();
    const client = new ApolloClient({
      link: new ClientAwarenessLink().concat(terminatingLink),
      cache: new InMemoryCache(),
      enhancedClientAwareness: { transport: false },
    });

    void client.query({ query });
    expect(terminatingLink.operation?.extensions).toStrictEqual({});
  });

  test("can be disabled from `ClientAwarenessLink` constructor", () => {
    const terminatingLink = new MockSubscriptionLink();
    const client = new ApolloClient({
      link: new ClientAwarenessLink({
        enhancedClientAwareness: { transport: false },
      }).concat(terminatingLink),
      cache: new InMemoryCache(),
    });

    void client.query({ query });
    expect(terminatingLink.operation?.extensions).toStrictEqual({});
  });
});
