import { Observable } from "rxjs";

import { ApolloClient, ApolloLink, gql, InMemoryCache } from "@apollo/client";
import {
  CombinedGraphQLErrors,
  NetworkError,
  UnconventionalError,
} from "@apollo/client/errors";
import { MockLink } from "@apollo/client/testing";

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

  test("handles errors emitted as strings", async () => {
    const client = new ApolloClient({
      link: createErrorLink("Oops"),
      cache: new InMemoryCache(),
    });

    const error = await client.mutate({ mutation }).catch((error) => error);
    expect(error).toEqual(new Error("Oops"));

    expect(NetworkError.is(error)).toBe(true);
  });

  test("handles errors emitted from unconventional types", async () => {
    const symbol = Symbol();
    const client = new ApolloClient({
      link: createErrorLink(symbol),
      cache: new InMemoryCache(),
    });

    const error = await client.mutate({ mutation }).catch((error) => error);
    expect(error).toEqual(new UnconventionalError(symbol));

    expect(NetworkError.is(error)).toBe(true);
  });
});
