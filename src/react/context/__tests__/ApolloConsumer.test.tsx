import React from "react";
import { render, screen } from "@testing-library/react";

import { ApolloLink } from "../../../link/core";
import { ApolloClient } from "../../../core";
import { InMemoryCache as Cache } from "../../../cache";
import { ApolloProvider } from "../ApolloProvider";
import { ApolloConsumer } from "../ApolloConsumer";
import { getApolloContext } from "../ApolloContext";
import { itAsync } from "../../../testing";

const client = new ApolloClient({
  cache: new Cache(),
  link: new ApolloLink((o, f) => (f ? f(o) : null)),
});

describe("<ApolloConsumer /> component", () => {
  itAsync("has a render prop", (resolve, reject) => {
    render(
      <ApolloProvider client={client}>
        <ApolloConsumer>
          {(clientRender) => {
            try {
              expect(clientRender).toBe(client);
              resolve();
            } catch (e) {
              reject(e);
            }
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
