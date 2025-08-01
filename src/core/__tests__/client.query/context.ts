import { of } from "rxjs";

import { ApolloClient, ApolloLink, gql, InMemoryCache } from "@apollo/client";

test("can get the client from the operation", async () => {
  const query = gql`
    query {
      greeting
    }
  `;
  const request = jest.fn((_: ApolloLink.Operation) => {
    return of({ data: { greeting: "Hello" } });
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(request),
  });

  await client.query({ query });
  const [operation] = request.mock.calls[0];

  expect(operation.client).toBe(client);
});

test("allows custom context", async () => {
  const query = gql`
    query {
      greeting
    }
  `;
  const request = jest.fn((_: ApolloLink.Operation) => {
    return of({ data: { greeting: "Hello" } });
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(request),
  });

  await client.query({ query, context: { foo: true } });
  const [operation] = request.mock.calls[0];

  expect(operation.getContext()).toStrictEqualTyped({
    foo: true,
    queryDeduplication: true,
  });
});

test("uses context from defaultContext", async () => {
  const query = gql`
    query {
      greeting
    }
  `;
  const request = jest.fn((_: ApolloLink.Operation) => {
    return of({ data: { greeting: "Hello" } });
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(request),
    defaultContext: {
      foo: true,
    },
  });

  await client.query({ query });
  const [operation] = request.mock.calls[0];

  expect(operation.getContext()).toStrictEqualTyped({
    foo: true,
    queryDeduplication: true,
  });
});

test("can override global default", async () => {
  const query = gql`
    query {
      greeting
    }
  `;
  const request = jest.fn((_: ApolloLink.Operation) => {
    return of({ data: { greeting: "Hello" } });
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(request),
    defaultContext: {
      foo: true,
    },
  });

  await client.query({ query, context: { foo: false } });
  const [operation] = request.mock.calls[0];

  expect(operation.getContext()).toStrictEqualTyped({
    foo: false,
    queryDeduplication: true,
  });
});
