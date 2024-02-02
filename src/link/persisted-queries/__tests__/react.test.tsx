/** @jest-environment node */
import * as React from "react";
import * as ReactDOM from "react-dom/server";
import gql from "graphql-tag";
import { print } from "graphql";
import fetchMock from "fetch-mock";
import crypto from "crypto";

import { ApolloProvider } from "../../../react/context";
import { InMemoryCache as Cache } from "../../../cache/inmemory/inMemoryCache";
import { ApolloClient } from "../../../core/ApolloClient";
import { createHttpLink } from "../../http/createHttpLink";
import { graphql } from "../../../react/hoc/graphql";
import { getDataFromTree } from "../../../react/ssr/getDataFromTree";
import { createPersistedQueryLink as createPersistedQuery, VERSION } from "..";

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
const queryString = print(query);

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
      cache: new Cache({ addTypename: false }),
      ssrMode: true,
    });

    const Query = graphql<React.PropsWithChildren>(query)(({
      data,
      children,
    }) => {
      if (data!.loading) return null;

      return (
        <div>
          {(data as any).foo.bar && "data was returned!"}
          {children}
        </div>
      );
    });
    const app = (
      <ApolloProvider client={client}>
        <Query {...variables}>
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
      cache: new Cache({ addTypename: false }),
      ssrMode: true,
    });

    const app2 = (
      <ApolloProvider client={client2}>
        <Query {...variables2}>
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
