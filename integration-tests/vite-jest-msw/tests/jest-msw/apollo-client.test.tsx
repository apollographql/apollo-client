import { render as rtlRender, screen } from "@testing-library/react";
import {
  ApolloClient,
  ApolloProvider,
  NormalizedCacheObject,
} from "@apollo/client";
import App, { client } from "../../src/App";
import { schemaProxy } from "../mocks/handlers";

const render = (renderedClient: ApolloClient<NormalizedCacheObject>) =>
  rtlRender(
    <ApolloProvider client={renderedClient}>
      <App />
    </ApolloProvider>
  );

beforeEach(() => {
  // since all our tests now use our "real" production Apollo Client instance,
  // we need to reset the client cache before each test
  return client.cache.reset();
});

describe("IndexRoute", () => {
  test("renders", async () => {
    render(client);

    expect(await screen.findByText(/blue jays hat/i)).toBeInTheDocument();
  });

  test("allows resolvers to be updated via schemaProxy", async () => {
    schemaProxy.add({
      resolvers: {
        Query: {
          products: () => {
            return [
              {
                id: "2",
                title: "Mets Hat",
              },
            ];
          },
        },
      },
    });

    render(client);

    // the resolver has been updated
    expect(await screen.findByText(/mets hat/i)).toBeInTheDocument();
  });

  test("reset method works", async () => {
    schemaProxy.reset();

    render(client);

    expect(await screen.findByText(/blue jays hat/i)).toBeInTheDocument();
  });
});
