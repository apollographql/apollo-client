import { of } from "rxjs";

import type { Operation } from "@apollo/client";
import { ApolloClient, ApolloLink, gql, InMemoryCache } from "@apollo/client";

test("can get apollo context from getApolloContext", async () => {
  const query = gql`
    query {
      greeting
    }
  `;
  const request = jest.fn((_: Operation) => {
    return of({ data: { greeting: "Hello" } });
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(request),
  });

  await client.query({ query });
  const [operation] = request.mock.calls[0];

  expect(operation.getApolloContext()).toStrictEqualTyped(
    { client },
    { includeKnownClassInstances: true }
  );
});

test("allows custom context", async () => {
  const query = gql`
    query {
      greeting
    }
  `;
  const request = jest.fn((_: Operation) => {
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
    clientAwareness: { name: undefined, version: undefined },
  });
  expect(operation.getApolloContext()).toStrictEqualTyped(
    { client },
    { includeKnownClassInstances: true }
  );
});

test("uses context from defaultOptions", async () => {
  const query = gql`
    query {
      greeting
    }
  `;
  const request = jest.fn((_: Operation) => {
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
    clientAwareness: { name: undefined, version: undefined },
  });
  expect(operation.getApolloContext()).toStrictEqualTyped(
    { client },
    { includeKnownClassInstances: true }
  );
});

test("can override global default", async () => {
  const query = gql`
    query {
      greeting
    }
  `;
  const request = jest.fn((_: Operation) => {
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
    clientAwareness: { name: undefined, version: undefined },
  });
  expect(operation.getApolloContext()).toStrictEqualTyped(
    { client },
    { includeKnownClassInstances: true }
  );
});
