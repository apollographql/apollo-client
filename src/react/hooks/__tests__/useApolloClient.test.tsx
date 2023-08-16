import React from "react";
import { render } from "@testing-library/react";
import { InvariantError } from "ts-invariant";

import { ApolloClient } from "../../../core";
import { ApolloLink } from "../../../link/core";
import { ApolloProvider } from "../../context";
import { InMemoryCache } from "../../../cache";
import { useApolloClient } from "../useApolloClient";

describe("useApolloClient Hook", () => {
  it("should return a client instance from the context if available", () => {
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
    });

    function App() {
      expect(useApolloClient()).toEqual(client);
      return null;
    }

    render(
      <ApolloProvider client={client}>
        <App />
      </ApolloProvider>
    );
  });

  it("should error if a client instance can't be found in the context", () => {
    function App() {
      expect(() => useApolloClient()).toThrow(InvariantError);
      return null;
    }

    render(<App />);
  });
});
