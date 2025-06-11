import fetchMock from "fetch-mock";

import {
  ApolloClient,
  gql,
  HttpLink,
  InMemoryCache,
  version,
} from "@apollo/client";
import {
  BaseBatchHttpLink,
  BatchHttpLink,
} from "@apollo/client/link/batch-http";
import { ClientAwarenessLink } from "@apollo/client/link/client-awareness";
import { BaseHttpLink } from "@apollo/client/link/http";
import { MockSubscriptionLink } from "@apollo/client/testing";
import { wait } from "@apollo/client/testing/internal";

const query = gql`
  query {
    hello
  }
`;
const response = {
  data: { hello: "world" },
};
const uri = "https://example.com/graphql";

afterEach(() => fetchMock.reset());

describe("client awareness", () => {
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
      name: "test-client",
      version: "1.0.0",
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
        name: "test-client",
        version: "1.0.0",
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
        clientAwareness: false,
      }).concat(terminatingLink),
      cache: new InMemoryCache(),
      name: "test-client",
      version: "1.0.0",
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
      name: "test-client",
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
      version: "1.0.0",
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
        name: "test-client",
        version: "1.0.0",
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
          name: "test-client",
          version: "1.0.0",
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
          name: "overridden-client",
          version: "2.0.0",
        }).concat(terminatingLink),
        cache: new InMemoryCache(),
        name: "test-client",
        version: "1.0.0",
      });

      void client.query({ query });
      const headers = terminatingLink.operation?.getContext().headers;
      expect(headers).toStrictEqual({
        "apollographql-client-name": "overridden-client",
        "apollographql-client-version": "2.0.0",
      });
    });
  });

  describe("HttpLink integration", () => {
    test("is part of `HttpLink`", () => {
      fetchMock.postOnce(uri, response);
      const client = new ApolloClient({
        link: new HttpLink({
          uri,
        }),
        cache: new InMemoryCache(),
        name: "test-client",
        version: "1.0.0",
      });

      void client.query({ query });
      const headers = fetchMock.lastCall()![1]?.headers;
      expect(headers).toStrictEqual({
        accept: "application/graphql-response+json,application/json;q=0.9",
        "content-type": "application/json",
        "apollographql-client-name": "test-client",
        "apollographql-client-version": "1.0.0",
      });
    });

    test("is not part of `BaseHttpLink`", () => {
      fetchMock.postOnce(uri, response);
      const client = new ApolloClient({
        link: new BaseHttpLink({
          uri,
        }),
        cache: new InMemoryCache(),
        name: "test-client",
        version: "1.0.0",
      });

      void client.query({ query });
      const headers = fetchMock.lastCall()![1]?.headers;
      expect(headers).toStrictEqual({
        accept: "application/graphql-response+json,application/json;q=0.9",
        "content-type": "application/json",
      });
    });

    test("`HttpLink` options have priotity over `ApolloClient` options", () => {
      fetchMock.postOnce(uri, response);
      const client = new ApolloClient({
        link: new HttpLink({
          uri,
          name: "overridden-client",
          version: "2.0.0",
        }),
        cache: new InMemoryCache(),
        name: "test-client",
        version: "1.0.0",
      });

      void client.query({ query });
      const headers = fetchMock.lastCall()![1]?.headers;
      expect(headers).toStrictEqual({
        accept: "application/graphql-response+json,application/json;q=0.9",
        "content-type": "application/json",
        "apollographql-client-name": "overridden-client",
        "apollographql-client-version": "2.0.0",
      });
    });
  });

  describe("BatchHttpLink integration", () => {
    test("is part of `BatchHttpLink`", async () => {
      fetchMock.postOnce(uri, [response, response]);
      const client = new ApolloClient({
        link: new BatchHttpLink({
          uri,
        }),
        cache: new InMemoryCache(),
        name: "test-client",
        version: "1.0.0",
      });

      void client.query({ query });
      void client.query({ query, context: { queryDeduplication: false } });
      await wait(10);

      const headers = fetchMock.lastCall()![1]?.headers;
      expect(headers).toStrictEqual({
        accept: "application/graphql-response+json,application/json;q=0.9",
        "content-type": "application/json",
        "apollographql-client-name": "test-client",
        "apollographql-client-version": "1.0.0",
      });
    });

    test("is not part of `BaseBatchHttpLink`", async () => {
      fetchMock.postOnce(uri, response);
      const client = new ApolloClient({
        link: new BaseBatchHttpLink({
          uri,
        }),
        cache: new InMemoryCache(),
        name: "test-client",
        version: "1.0.0",
      });

      void client.query({ query });
      await wait(10);

      const headers = fetchMock.lastCall()![1]?.headers;
      expect(headers).toStrictEqual({
        accept: "application/graphql-response+json,application/json;q=0.9",
        "content-type": "application/json",
      });
    });

    test("`BatchHttpLink` options have priotity over `ApolloClient` options", async () => {
      fetchMock.postOnce(uri, response);
      const client = new ApolloClient({
        link: new BatchHttpLink({
          uri,
          name: "overridden-client",
          version: "2.0.0",
        }),
        cache: new InMemoryCache(),
        name: "test-client",
        version: "1.0.0",
      });

      void client.query({ query });
      await wait(10);

      const headers = fetchMock.lastCall()![1]?.headers;
      expect(headers).toStrictEqual({
        accept: "application/graphql-response+json,application/json;q=0.9",
        "content-type": "application/json",
        "apollographql-client-name": "overridden-client",
        "apollographql-client-version": "2.0.0",
      });
    });

    test("will batch requests with equal options", async () => {
      fetchMock.postOnce(uri, [response, response]);
      const client = new ApolloClient({
        link: new BatchHttpLink({
          uri,
        }),
        cache: new InMemoryCache(),
        name: "test-client",
        version: "1.0.0",
      });

      void client.query({ query, context: { queryDeduplication: false } });
      void client.query({ query, context: { queryDeduplication: false } });
      await wait(10);

      const headers = fetchMock.lastCall()![1]?.headers;
      expect(headers).toStrictEqual({
        accept: "application/graphql-response+json,application/json;q=0.9",
        "content-type": "application/json",
        "apollographql-client-name": "test-client",
        "apollographql-client-version": "1.0.0",
      });
    });

    test("will not batch requests with different options", async () => {
      fetchMock.post(uri, [response], { repeat: 2 });
      const client = new ApolloClient({
        link: new BatchHttpLink({
          uri,
        }),
        cache: new InMemoryCache(),
        name: "test-client",
        version: "1.0.0",
      });

      void client.query({ query, context: { queryDeduplication: false } });
      void client.query({
        query,
        context: {
          queryDeduplication: false,
          clientAwareness: {
            name: "overridden-client",
            version: "2.0.0",
          },
        },
      });
      await wait(10);

      expect(fetchMock.calls()[0][1]?.headers).toStrictEqual({
        accept: "application/graphql-response+json,application/json;q=0.9",
        "content-type": "application/json",
        "apollographql-client-name": "test-client",
        "apollographql-client-version": "1.0.0",
      });
      expect(fetchMock.calls()[1][1]?.headers).toStrictEqual({
        accept: "application/graphql-response+json,application/json;q=0.9",
        "content-type": "application/json",
        "apollographql-client-name": "overridden-client",
        "apollographql-client-version": "2.0.0",
      });
    });
  });
});

describe("enhanced client awareness", () => {
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

  test("can be disabled from `ClientAwarenessLink` constructor", () => {
    const terminatingLink = new MockSubscriptionLink();
    const client = new ApolloClient({
      link: new ClientAwarenessLink({
        enhancedClientAwareness: false,
      }).concat(terminatingLink),
      cache: new InMemoryCache(),
    });

    void client.query({ query });
    expect(terminatingLink.operation?.extensions).toStrictEqual({});
  });

  describe("HttpLink integration", () => {
    test("is part of `HttpLink`", () => {
      fetchMock.postOnce(uri, response);
      const client = new ApolloClient({
        link: new HttpLink({
          uri,
        }),
        cache: new InMemoryCache(),
      });

      void client.query({ query });
      const body = JSON.parse(fetchMock.lastCall()![1]?.body as string);
      expect(body.extensions).toStrictEqual({
        clientLibrary: {
          name: "@apollo/client",
          version,
        },
      });
    });

    test("is not part of `BaseHttpLink`", () => {
      fetchMock.postOnce(uri, response);
      const client = new ApolloClient({
        link: new BaseHttpLink({
          uri,
        }),
        cache: new InMemoryCache(),
      });

      void client.query({ query });
      const body = JSON.parse(fetchMock.lastCall()![1]?.body as string);
      expect(body.extensions).not.toBeDefined();
    });

    test("can be disabled from `HttpLink`", () => {
      fetchMock.postOnce(uri, response);
      const client = new ApolloClient({
        link: new HttpLink({
          uri,
          enhancedClientAwareness: false,
        }),
        cache: new InMemoryCache(),
      });

      void client.query({ query });
      const body = JSON.parse(fetchMock.lastCall()![1]?.body as string);
      expect(body.extensions).not.toBeDefined();
    });

    test("can also be disabled by disabling `includeExtensions`", () => {
      fetchMock.postOnce(uri, response);
      const client = new ApolloClient({
        link: new HttpLink({
          uri,
          includeExtensions: false,
        }),
        cache: new InMemoryCache(),
      });

      void client.query({ query });
      const body = JSON.parse(fetchMock.lastCall()![1]?.body as string);
      expect(body.extensions).not.toBeDefined();
    });
  });

  describe("BatchHttpLink integration", () => {
    test("is part of `BatchHttpLink`", async () => {
      fetchMock.postOnce(uri, [response, response]);
      const client = new ApolloClient({
        link: new BatchHttpLink({
          uri,
        }),
        cache: new InMemoryCache(),
      });

      void client.query({ query });
      void client.query({ query, context: { queryDeduplication: false } });
      await wait(10);

      const body = JSON.parse(fetchMock.lastCall()![1]?.body as string);
      expect(body[0].extensions).toStrictEqual({
        clientLibrary: {
          name: "@apollo/client",
          version,
        },
      });
      expect(body[1].extensions).toStrictEqual({
        clientLibrary: {
          name: "@apollo/client",
          version,
        },
      });
    });

    test("is not part of `BaseBatchHttpLink`", async () => {
      fetchMock.postOnce(uri, [response, response]);
      const client = new ApolloClient({
        link: new BaseBatchHttpLink({
          uri,
        }),
        cache: new InMemoryCache(),
      });

      void client.query({ query });
      void client.query({ query, context: { queryDeduplication: false } });
      await wait(10);

      const body = JSON.parse(fetchMock.lastCall()![1]?.body as string);
      expect(body[0].extensions).not.toBeDefined();
      expect(body[1].extensions).not.toBeDefined();
    });

    test("can be disabled by disabling `includeExtensions`", async () => {
      fetchMock.postOnce(uri, [response, response]);
      const client = new ApolloClient({
        link: new BatchHttpLink({
          uri,
          includeExtensions: false,
        }),
        cache: new InMemoryCache(),
      });

      void client.query({ query });
      void client.query({ query, context: { queryDeduplication: false } });
      await wait(10);

      const body = JSON.parse(fetchMock.lastCall()![1]?.body as string);
      expect(body[0].extensions).not.toBeDefined();
      expect(body[1].extensions).not.toBeDefined();
    });

    test("can send mixed requests with ECA enabled and disabled", async () => {
      fetchMock.postOnce(uri, [response, response]);
      const client = new ApolloClient({
        link: new BatchHttpLink({
          uri,
        }),
        cache: new InMemoryCache(),
      });

      void client.query({ query });
      void client.query({
        query,
        context: {
          queryDeduplication: false,
          clientAwareness: {
            // this is not documented and we don't officially support it,
            // but this feature can also be disabled from the `ApolloClient`
            // constructor options or context key `clientAwareness.enhancedClientAwareness`
            // for this test this is very useful
            // @ts-expect-error
            enhancedClientAwareness: false,
          },
        },
      });
      await wait(10);

      const body = JSON.parse(fetchMock.lastCall()![1]?.body as string);
      expect(body[0].extensions).toStrictEqual({
        clientLibrary: {
          name: "@apollo/client",
          version,
        },
      });
      expect(body[1].extensions).not.toBeDefined();
    });
  });
});
