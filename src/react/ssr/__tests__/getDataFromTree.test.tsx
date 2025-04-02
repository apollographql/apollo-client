import "../../../testing/internal/messageChannelPolyfill.js";
import type { DocumentNode } from "graphql";
import { gql } from "graphql-tag";
import React from "react";

import { InMemoryCache as Cache } from "@apollo/client/cache";
import type { TypedDocumentNode } from "@apollo/client/core";
import { ApolloClient, CombinedGraphQLErrors } from "@apollo/client/core";
import { ApolloProvider, getApolloContext } from "@apollo/client/react/context";
import { useQuery } from "@apollo/client/react/hooks";
import { getDataFromTree } from "@apollo/client/react/ssr";
import { mockSingleLink } from "@apollo/client/testing";

describe("SSR", () => {
  describe("`getDataFromTree`", () => {
    it("should support passing a root context", async () => {
      const client = new ApolloClient({
        name: "oyez",
        cache: new Cache(),
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

      const html = await getDataFromTree(<App />, {
        client,
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
            new CombinedGraphQLErrors({
              data: { allPeople: { people: null } },
              errors: [{ message: "this is an error" }],
            })
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
