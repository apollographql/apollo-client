import { render } from "@testing-library/react";
import React from "react";

import { InMemoryCache } from "@apollo/client/cache";
import { ApolloClient } from "@apollo/client/core";
import { ApolloLink } from "@apollo/client/link/core";
import { ApolloProvider , useApolloClient } from "@apollo/client/react";
import { InvariantError } from "@apollo/client/utilities/invariant";

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
