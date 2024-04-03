import { Suspense } from "react";
import { describe, test, expect, beforeEach } from "@jest/globals";
import { render as rtlRender, screen } from "@testing-library/react";
import {
  ApolloClient,
  ApolloProvider,
  InMemoryCache,
  NormalizedCacheObject,
} from "@apollo/client";
import App from "../../src/App";
import { schemaProxy } from "../mocks/handlers";

const client = new ApolloClient({
  cache: new InMemoryCache(),
  uri: "http://localhost:3000/graphql",
});

const render = (client: ApolloClient<NormalizedCacheObject>) =>
  rtlRender(
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  );

beforeEach(() => {
  // since all our tests now use our production Apollo Client instance
  // we need to reset the client cache before each test
  return client.cache.reset();
});

describe("IndexRoute", () => {
  test("renders", async () => {
    render(client);

    screen.debug();
    expect(await screen.findByText(/product/i)).toBeInTheDocument();
    // expect(await screen.findByText(/this is my playlist/i)).toBeInTheDocument();
    // expect(await screen.findByText(/description/i)).toBeInTheDocument();
  });

  // test("allows resolvers to be updated via schemaProxy", async () => {
  //   // using _restore = replaceSchema(
  //   //   schemaProxy.fork({
  //   //     resolvers: {
  //   //       FeaturedPlaylistConnection: {
  //   //         message: () => "purple seahorse",
  //   //         edges: () => [{}],
  //   //       },
  //   //     },
  //   //   })
  //   // );

  //   render(client);

  //   // the resolver has been updated
  //   // expect(await screen.findByText(/afternoon delight/i)).toBeInTheDocument();
  //   expect(await screen.findByText(/purple seahorse/i)).toBeInTheDocument();
  // });

  // test("reset method works", async () => {
  //   schemaProxy.reset();

  //   render(client);

  //   expect(await screen.findByText(/afternoon delight/i)).toBeInTheDocument();
  // });
});
