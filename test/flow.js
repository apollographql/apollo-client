/*

  This file is used to validate the flow typings for apollo client.
  Currently it just serves as a smoke test around used imports and
  common usage patterns.

  Ideally this should include tests for all of the functionality of
  apollo-client

*/

// @flow
import ApolloClient, { createNetworkInterface, ApolloError } from "apollo-client";
import type { ApolloQueryResult } from "apollo-client";
import type { DocumentNode } from "graphql";
import gql from "graphql-tag";

const query: DocumentNode = gql`{ foo }`;
const mutation: DocumentNode = gql`mutation { foo }`;


// common errors

// $ExpectError
const client = new ApolloClient("localhost:3000");

// $ExpectError
const client1 = new ApolloClient({
  networkInterface: true,
});

const networkInterface1 = createNetworkInterface("localhost:3000");
const client2 = new ApolloClient({ networkInterface: networkInterface1 });

// $ExpectError
client2.query(query);

// $ExpectError
client2.mutate(mutation);

const data = client.query({ query });

// $ExpectError
console.log(data.loading);

// $ExpectError
const status: Promise<ApolloError | boolean> = data.then(({ data, error }) => {
  const foo = data.loading;
  if (error) return error;
  return foo;
});


const observable = client2.watchQuery({ query });

// $ExpectError
const result: ApolloQueryResult<mixed> = observable.result();

// $ExpectError
const current: Promise<ApolloQueryResult<mixed>> = observable.currentResult();
