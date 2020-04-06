import React from "react";
import { render } from "react-dom";
import { ApolloClient } from "apollo-client";
import { createHttpLink } from "apollo-link-http";
import { InMemoryCache } from "apollo-cache-inmemory";
import { ApolloProvider } from "@apollo/react-hooks";

import App from "./App";

const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: createHttpLink({
    uri: 'https://countries.trevorblades.com/',
  }),
});

render(
  <ApolloProvider client={client}>
    <App />
  </ApolloProvider>,
  document.getElementById("root")
);
