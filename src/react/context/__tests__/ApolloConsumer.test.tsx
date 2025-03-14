import { render, screen } from "@testing-library/react";
import React from "react";

import { InMemoryCache as Cache } from "@apollo/client/cache";
import { ApolloClient } from "@apollo/client/core";
import { ApolloLink } from "@apollo/client/link/core";

import { ApolloConsumer } from "../ApolloConsumer.js";
import { getApolloContext } from "../ApolloContext.js";
import { ApolloProvider } from "../ApolloProvider.js";

const client = new ApolloClient({
  cache: new Cache(),
  link: new ApolloLink((o, f) => (f ? f(o) : null)),
});

describe("<ApolloConsumer /> component", () => {
  it("has a render prop", (done) => {
    render(
      <ApolloProvider client={client}>
        <ApolloConsumer>
          {(clientRender) => {
            expect(clientRender).toBe(client);
            done();
            return null;
          }}
        </ApolloConsumer>
      </ApolloProvider>
    );
  });

  it("renders the content in the children prop", () => {
    render(
      <ApolloProvider client={client}>
        <ApolloConsumer>{() => <div>Test</div>}</ApolloConsumer>
      </ApolloProvider>
    );

    expect(screen.getByText("Test")).toBeTruthy();
  });

  it("errors if there is no client in the context", () => {
    // Prevent Error about missing context type from appearing in the console.
    const errorLogger = console.error;
    console.error = () => {};
    expect(() => {
      // We're wrapping the `ApolloConsumer` component in a
      // `ApolloContext.Provider` component, to reset the context before
      // testing.
      const ApolloContext = getApolloContext();
      render(
        <ApolloContext.Provider value={{}}>
          <ApolloConsumer>{() => null}</ApolloConsumer>
        </ApolloContext.Provider>
      );
    }).toThrowError(
      'Could not find "client" in the context of ApolloConsumer. Wrap the root component in an <ApolloProvider>'
    );

    console.error = errorLogger;
  });
});
