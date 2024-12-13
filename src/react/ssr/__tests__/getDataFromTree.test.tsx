import "../../../testing/internal/messageChannelPolyfill";
import React from "react";

import gql from "graphql-tag";
import { DocumentNode } from "graphql";

import { ApolloClient, TypedDocumentNode } from "../../../core";
import { InMemoryCache as Cache } from "../../../cache";
import { getDataFromTree } from "../getDataFromTree";
import { mockSingleLink } from "../../../testing";
import { useQuery } from "../../hooks";
import { ApolloProvider, getApolloContext } from "../../context";

describe("SSR", () => {
  describe("`getDataFromTree`", () => {
    it("should support passing a root context", async () => {
      type CustomContext = { text: string };
      const ApolloContext = getApolloContext();

      function App() {
        return (
          <ApolloContext.Consumer>
            {(context) => <div>{(context as CustomContext).text}</div>}
          </ApolloContext.Consumer>
        );
      }

      const html = await getDataFromTree(<App />, {
        text: "oyez",
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
        cache: new Cache({ addTypename: false }),
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
          errors: [new Error("this is an error")],
        },
      });

      const client = new ApolloClient({
        link,
        cache: new Cache({ addTypename: false }),
      });

      function App() {
        const { data, loading, error } = useQuery(query, {
          errorPolicy: "all",
        });

        if (!loading) {
          expect(data).toMatchObject({ allPeople: { people: null } });
          expect(error).toBeDefined();
          expect(error?.graphQLErrors[0].message).toEqual("this is an error");
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
