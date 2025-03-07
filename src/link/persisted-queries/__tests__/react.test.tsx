/** @jest-environment node */
import crypto from "crypto";

import fetchMock from "fetch-mock";
import { print } from "graphql";
import { gql } from "graphql-tag";
import * as React from "react";
import * as ReactDOM from "react-dom/server";

import { OperationVariables } from "@apollo/client/core";
import {
  createPersistedQueryLink as createPersistedQuery,
  VERSION,
} from "@apollo/client/link/persisted-queries";
import { useQuery } from "@apollo/client/react";
import { ApolloProvider } from "@apollo/client/react/context";
import { addTypenameToDocument } from "@apollo/client/utilities";

import { InMemoryCache as Cache } from "../../../cache/inmemory/inMemoryCache.js";
import { ApolloClient } from "../../../core/ApolloClient.js";
import { getDataFromTree } from "../../../react/ssr/getDataFromTree.js";
import { createHttpLink } from "../../http/createHttpLink.js";

function sha256(data: string) {
  const hash = crypto.createHash("sha256");
  hash.update(data);
  return hash.digest("hex");
}

// Necessary configuration in order to mock multiple requests
// to a single (/graphql) endpoint
// see: http://www.wheresrhys.co.uk/fetch-mock/#usageconfiguration
fetchMock.config.overwriteRoutes = false;

afterAll(() => {
  fetchMock.config.overwriteRoutes = true;
});

const query = gql`
  query Test($filter: FilterObject) {
    foo(filter: $filter) {
      bar
    }
  }
`;

const variables = {
  filter: {
    $filter: "smash",
  },
};
const variables2 = {
  filter: null,
};
const data = {
  foo: { bar: true },
};
const data2 = {
  foo: { bar: false },
};
const response = JSON.stringify({ data });
const response2 = JSON.stringify({ data: data2 });
const queryString = print(addTypenameToDocument(query));

const hash = sha256(queryString);

describe("react application", () => {
  beforeEach(async () => {
    fetchMock.restore();
  });
  it("works on a simple tree", async () => {
    fetchMock.post(
      "/graphql",
      () => new Promise((resolve) => resolve({ body: response })),
      { repeat: 1 }
    );
    // `repeat: 1` simulates a `mockResponseOnce` API with fetch-mock:
    // it limits the number of times the route can be used,
    // after which the call to `fetch()` will fall through to be
    // handled by any other routes defined...
    // With `overwriteRoutes = false`, this means
    // subsequent /graphql mocks will be used
    // see: http://www.wheresrhys.co.uk/fetch-mock/#usageconfiguration
    fetchMock.post(
      "/graphql",
      () => new Promise((resolve) => resolve({ body: response2 })),
      { repeat: 1 }
    );

    const link = createPersistedQuery({ sha256 }).concat(createHttpLink());

    const client = new ApolloClient({
      link,
      cache: new Cache(),
      ssrMode: true,
    });

    const Query = ({
      children,
      variables,
    }: {
      children: React.ReactNode;
      variables: OperationVariables;
    }) => {
      const { data, loading } = useQuery(query, { variables });
      if (loading) return null;

      return (
        <div>
          {(data as any).foo.bar && "data was returned!"}
          {children}
        </div>
      );
    };
    const app = (
      <ApolloProvider client={client}>
        <Query variables={variables}>
          <h1>Hello!</h1>
        </Query>
      </ApolloProvider>
    );

    // preload all the data for client side request (with filter)
    const result = await getDataFromTree(app);
    expect(result).toContain("data was returned");
    const [[, request]] = fetchMock.calls();
    expect(request!.body).toBe(
      JSON.stringify({
        operationName: "Test",
        variables,
        extensions: {
          persistedQuery: {
            version: VERSION,
            sha256Hash: hash,
          },
        },
      })
    );

    // reset client and try with different input object
    const client2 = new ApolloClient({
      link,
      cache: new Cache(),
      ssrMode: true,
    });

    const app2 = (
      <ApolloProvider client={client2}>
        <Query variables={variables2}>
          <h1>Hello!</h1>
        </Query>
      </ApolloProvider>
    );

    // change filter object to different variables and SSR
    await getDataFromTree(app2);
    const view = ReactDOM.renderToString(app2);

    const [, [, request2]] = fetchMock.calls();

    expect(view).not.toContain("data was returned");
    expect(request2!.body).toBe(
      JSON.stringify({
        operationName: "Test",
        variables: variables2,
        extensions: {
          persistedQuery: {
            version: VERSION,
            sha256Hash: hash,
          },
        },
      })
    );
  });
});
