import { Observable } from "rxjs";

import { ApolloClient, ApolloLink, gql, InMemoryCache } from "@apollo/client";
import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
  NetworkError,
  UnconventionalError,
} from "@apollo/client/errors";
import { MockLink, MockSubscriptionLink } from "@apollo/client/testing";
import {
  mockMultipartSubscriptionStream,
  ObservableStream,
  spyOnConsole,
} from "@apollo/client/testing/internal";

const query = gql`
  query {
    foo
  }
`;

const mutation = gql`
  mutation {
    foo
  }
`;

const subscription = gql`
  subscription {
    foo
  }
`;

function createErrorLink(error: unknown) {
  return new ApolloLink(() => {
    return new Observable((observer) => {
      observer.error(error);
    });
  });
}

test("error is not registered until emitted from the link chain", async () => {
  const error = new Error("Oops");
  const client = new ApolloClient({
    link: createErrorLink(error),
    cache: new InMemoryCache(),
  });

  // Error has not yet been emitted from the link chain
  expect(NetworkError.is(error)).toBe(false);

  const actual = await client.query({ query }).catch((error) => error);
  expect(actual).toBe(error);

  // We've run the operation and the error has been emitted from the link chain,
  expect(NetworkError.is(actual)).toBe(true);
});

test("handles errors emitted as strings", async () => {
  const client = new ApolloClient({
    link: createErrorLink("Oops"),
    cache: new InMemoryCache(),
  });

  const error = await client.query({ query }).catch((error) => error);
  expect(error).toEqual(new Error("Oops"));

  expect(NetworkError.is(error)).toBe(true);
});

test("handles errors emitted from unconventional types", async () => {
  const symbol = Symbol();
  const client = new ApolloClient({
    link: createErrorLink(symbol),
    cache: new InMemoryCache(),
  });

  const error = await client.query({ query }).catch((error) => error);
  expect(error).toEqual(new UnconventionalError(symbol));

  expect(NetworkError.is(error)).toBe(true);
});

describe("client.query", () => {
  test("errors emitted from the link chain are network errors", async () => {
    const error = new Error("Oops");
    const client = new ApolloClient({
      link: createErrorLink(error),
      cache: new InMemoryCache(),
    });

    const actual = await client.query({ query }).catch((error) => error);
    expect(actual).toBe(error);

    expect(NetworkError.is(actual)).toBe(true);
  });

  test("does not register GraphQL errors as network errors", async () => {
    const client = new ApolloClient({
      link: new MockLink([
        { request: { query }, result: { errors: [{ message: "Oops" }] } },
      ]),
      cache: new InMemoryCache(),
    });

    const error = await client.query({ query }).catch((error) => error);
    expect(error).toEqual(
      new CombinedGraphQLErrors({ errors: [{ message: "Oops" }] })
    );

    expect(NetworkError.is(error)).toBe(false);
  });
});

describe("client.watchQuery", () => {
  test("errors emitted from the link chain are network errors", async () => {
    const error = new Error("Oops");
    const client = new ApolloClient({
      link: createErrorLink(error),
      cache: new InMemoryCache(),
    });

    const stream = new ObservableStream(
      client.watchQuery({ query, notifyOnNetworkStatusChange: false })
    );

    const result = await stream.takeNext();

    expect(result.error).toBe(error);
    expect(NetworkError.is(result.error)).toBe(true);
  });

  test("does not register GraphQL errors as network errors", async () => {
    const client = new ApolloClient({
      link: new MockLink([
        { request: { query }, result: { errors: [{ message: "Oops" }] } },
      ]),
      cache: new InMemoryCache(),
    });

    const stream = new ObservableStream(
      client.watchQuery({ query, notifyOnNetworkStatusChange: false })
    );

    const result = await stream.takeNext();

    expect(result.error).toEqual(
      new CombinedGraphQLErrors({ errors: [{ message: "Oops" }] })
    );
    expect(NetworkError.is(result.error)).toBe(false);
  });
});

describe("client.mutate", () => {
  test("errors emitted from the link chain are network errors", async () => {
    const error = new Error("Oops");
    const client = new ApolloClient({
      link: createErrorLink(error),
      cache: new InMemoryCache(),
    });

    const actual = await client.mutate({ mutation }).catch((error) => error);
    expect(actual).toBe(error);

    expect(NetworkError.is(actual)).toBe(true);
  });

  test("does not register GraphQL errors as network errors", async () => {
    const client = new ApolloClient({
      link: new MockLink([
        {
          request: { query: mutation },
          result: { errors: [{ message: "Oops" }] },
        },
      ]),
      cache: new InMemoryCache(),
    });

    const error = await client.mutate({ mutation }).catch((error) => error);
    expect(error).toEqual(
      new CombinedGraphQLErrors({ errors: [{ message: "Oops" }] })
    );

    expect(NetworkError.is(error)).toBe(false);
  });

  test("does not report as a network error if error is thrown when updating the cache", async () => {
    const error = new Error("Error updating cache");
    const client = new ApolloClient({
      link: new MockLink([
        {
          request: { query: mutation },
          result: { data: { foo: "bar" } },
        },
      ]),
      cache: new InMemoryCache(),
    });

    const actual = await client
      .mutate({
        mutation,
        update: () => {
          throw error;
        },
      })
      .catch((error) => error);
    expect(actual).toBe(error);

    expect(NetworkError.is(actual)).toBe(false);
  });
});

describe("client.subscribe", () => {
  test("errors emitted from the link chain are network errors", async () => {
    const error = new Error("Oops");
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const stream = new ObservableStream(
      client.subscribe({ query: subscription })
    );
    link.simulateResult({ error });

    const result = await stream.takeNext();
    expect(result.error).toBe(error);

    expect(NetworkError.is(result.error)).toBe(true);
  });

  test("does not register GraphQL errors as network errors", async () => {
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const stream = new ObservableStream(
      client.subscribe({ query: subscription })
    );
    link.simulateResult({ result: { errors: [{ message: "Oops" }] } });

    const result = await stream.takeNext();
    expect(result.error).toEqual(
      new CombinedGraphQLErrors({ errors: [{ message: "Oops" }] })
    );

    expect(NetworkError.is(result.error)).toBe(false);
  });

  test("does not register protocol errors as network errors", async () => {
    // silence warning for cache write
    using _ = spyOnConsole("error");
    const { httpLink, enqueueProtocolErrors } =
      mockMultipartSubscriptionStream();

    const client = new ApolloClient({
      link: httpLink,
      cache: new InMemoryCache(),
    });

    const stream = new ObservableStream(
      client.subscribe({ query: subscription })
    );

    enqueueProtocolErrors([{ message: "Oops" }]);

    const result = await stream.takeNext();
    expect(result.error).toEqual(
      new CombinedProtocolErrors([{ message: "Oops" }])
    );

    expect(NetworkError.is(result.error)).toBe(false);
  });
});
