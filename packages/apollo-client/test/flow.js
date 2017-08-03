/*

  This file is used to validate the flow typings for apollo client.
  Currently it just serves as a smoke test around used imports and
  common usage patterns.

  Ideally this should include tests for all of the functionality of
  apollo-client

*/

// @flow
import ApolloClient, { createNetworkInterface, ApolloError } from "../src";
import type {
  ApolloQueryResult,
  MiddlewareInterface,
  AfterwareInterface,
  Request,
  HTTPNetworkInterface,
} from "../src";
import { combineReducers, createStore, applyMiddleware } from "redux";
import type { Store as ReduxStore } from "redux";
import type { DocumentNode } from "graphql";
import gql from "graphql-tag";

const query: DocumentNode = gql`
  {
    foo
  }
`;
const mutation: DocumentNode = gql`
  mutation {
    foo
  }
`;
// common errors

// $ExpectError
const client = new ApolloClient("localhost:3000");

// $ExpectError
const client1 = new ApolloClient({ networkInterface: true });

const networkInterface1 = createNetworkInterface("localhost:3000");

const middleware: MiddlewareInterface[] = [
  {
    applyMiddleware(req, next) {
      const token = localStorage.getItem("token") || "";
      if (!req.options.headers) {
        req.options.headers = { authorization: token };
      } else if (req.options.headers instanceof Headers) {
        req.options.headers.set("authorization", token);
      } else {
        req.options.headers.authorization = token;
      }
      next();
    },
  },
];
networkInterface1.use(middleware);

const afterware: AfterwareInterface[] = [
  {
    applyAfterware({ response }, next) {
      if (response.status === 401) {
        next();
      }
      next();
    },
  },
];

networkInterface1.useAfter(afterware);

const client2 = new ApolloClient({ networkInterface: networkInterface1 });

// $ExpectError
client2.query(query);

// $ExpectError
client2.mutate(mutation);

const data = client.query({ query });

// $ExpectError
console.log(data.loading);

class CustomNetworkInterface {
  networkInterface: HTTPNetworkInterface;

  constructor(networkInterface: HTTPNetworkInterface) {
    this.networkInterface = networkInterface;
  }

  query(request: Request) {
    return this.networkInterface.query(request);
  }
}

const client3 = new ApolloClient({
  networkInterface: new CustomNetworkInterface(networkInterface1),
});

class BadCustomNetworkInterface {}

const client4 = new ApolloClient({
  // $ExpectError
  networkInterface: BadCustomNetworkInterface,
});

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
