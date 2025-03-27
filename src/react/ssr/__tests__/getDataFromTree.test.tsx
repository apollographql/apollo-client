import "../../../testing/internal/messageChannelPolyfill.js";
import { expectTypeOf } from "expect-type";
import { DocumentNode } from "graphql";
import { gql } from "graphql-tag";
import React from "react";
import {
  getDataFromTree,
  renderToStaticMarkup,
  renderToString,
} from "react-dom/server";

import { InMemoryCache, InMemoryCache as Cache } from "@apollo/client/cache";
import {
  ApolloClient,
  CombinedGraphQLErrors,
  TypedDocumentNode,
} from "@apollo/client/core";
import { ApolloProvider, getApolloContext } from "@apollo/client/react/context";
import { useQuery } from "@apollo/client/react/hooks";
import { mockSingleLink } from "@apollo/client/testing";

import { prerenderStatic } from "../prerenderStatic.js";

describe("SSR", () => {
  describe("`getDataFromTree`", () => {
    it("should support passing a root context", async () => {
      const client = new ApolloClient({
        name: "oyez",
        cache: new InMemoryCache(),
      });
      const ApolloContext = getApolloContext();

      function App() {
        return (
          <ApolloContext.Consumer>
            {(context) => (
              <div>
                {context?.client?.["queryManager"]["clientAwareness"].name}
              </div>
            )}
          </ApolloContext.Consumer>
        );
      }

      const { result: html } = await prerenderStatic({
        tree: <App />,
        context: { client },
        renderFunction: renderToStaticMarkup,
      });

      expect(html).toEqual("<div>oyez</div>");
    });

    it("should run through all of the queries (also defined via Query component) that want SSR", async () => {
      const query: TypedDocumentNode<Data> = gql`
        {
          currentUser {
            firstName
          }
        }
      `;
      const data1 = { currentUser: { firstName: "James" } };
      const link = mockSingleLink({
        request: { query },
        result: { data: data1 },
        delay: 50,
      });
      const apolloClient = new ApolloClient({
        link,
        cache: new Cache(),
      });

      interface Data {
        currentUser?: {
          firstName: string;
        };
      }

      function App() {
        const { data, loading } = useQuery(query);

        return (
          <div>
            {loading || !data ? "loading" : data.currentUser!.firstName}
          </div>
        );
      }

      const app = (
        <ApolloProvider client={apolloClient}>
          <App />
        </ApolloProvider>
      );

      const markup = await getDataFromTree(app);

      expect(markup).toMatch(/James/);
    });

    it('should pass any GraphQL errors in props along with data during a SSR when errorPolicy="all"', async () => {
      expect.assertions(3);
      const query: DocumentNode = gql`
        query people {
          allPeople {
            people {
              name
            }
          }
        }
      `;
      const link = mockSingleLink({
        request: { query },
        result: {
          data: {
            allPeople: {
              people: null,
            },
          },
          errors: [{ message: "this is an error" }],
        },
      });

      const client = new ApolloClient({
        link,
        cache: new Cache(),
      });

      function App() {
        const { data, loading, error } = useQuery(query, {
          errorPolicy: "all",
        });

        if (!loading) {
          expect(data).toMatchObject({ allPeople: { people: null } });
          expect(error).toBeDefined();
          expect(error).toEqual(
            new CombinedGraphQLErrors([{ message: "this is an error" }])
          );
        }

        return null;
      }

      await getDataFromTree(
        <ApolloProvider client={client}>
          <App />
        </ApolloProvider>
      );
    });
  });
});

it.skip("type tests", async () => {
  expectTypeOf(
    await prerenderStatic({
      tree: <div />,
      renderFunction: renderToStaticMarkup,
    })
  ).toEqualTypeOf<{ result: string; aborted: boolean }>();
  expectTypeOf(
    await prerenderStatic({
      tree: <div />,
      renderFunction: renderToString,
    })
  ).toEqualTypeOf<{ result: string; aborted: boolean }>();
  if (React.version.startsWith("19")) {
    const { prerender, prerenderToNodeStream } =
      require("react-dom/static") as typeof import("react-dom/static");

    expectTypeOf(
      await prerenderStatic({
        tree: <div />,
        renderFunction: prerender,
      })
    ).toEqualTypeOf<{ result: string; aborted: boolean }>();
    expectTypeOf(
      await prerenderStatic({
        tree: <div />,
        renderFunction: prerenderToNodeStream,
      })
    ).toEqualTypeOf<{ result: string; aborted: boolean }>();
  }
});
