/** @jest-environment node */
import React from "react";
import gql from "graphql-tag";
import { DocumentNode } from "graphql";

import { ApolloClient } from "../../../../core";
import { InMemoryCache as Cache } from "../../../../cache";
import {
  ApolloProvider,
  getApolloContext,
  ApolloContextValue,
} from "../../../context";
import { getDataFromTree } from "../../../ssr";
import { itAsync, mockSingleLink } from "../../../../testing";
import { Query } from "../../Query";

describe("SSR", () => {
  describe("`getDataFromTree`", () => {
    it("should support passing a root context", () => {
      const apolloContext = getApolloContext() as unknown as React.Context<
        ApolloContextValue & { text: string }
      >;
      class Consumer extends React.Component {
        static contextType = apolloContext;
        declare context: React.ContextType<typeof apolloContext>;

        render() {
          return <div>{this.context.text}</div>;
        }
      }

      return getDataFromTree(<Consumer />, {
        text: "oyez",
      }).then((html) => {
        expect(html).toEqual("<div>oyez</div>");
      });
    });

    it("should run through all of the queries (also defined via Query component) that want SSR", () => {
      const query = gql`
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

      const WrappedElement = () => (
        <Query query={query}>
          {({ data, loading }: { data: Data; loading: boolean }) => (
            <div>
              {loading || !data ? "loading" : data.currentUser!.firstName}
            </div>
          )}
        </Query>
      );

      const app = (
        <ApolloProvider client={apolloClient}>
          <WrappedElement />
        </ApolloProvider>
      );

      return getDataFromTree(app).then((markup) => {
        expect(markup).toMatch(/James/);
      });
    });

    itAsync(
      'should pass any GraphQL errors in props along with data during a SSR when errorPolicy="all"',
      (resolve, reject) => {
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

        const app = (
          <ApolloProvider client={client}>
            <Query query={query} errorPolicy="all">
              {({ loading, data, error }: any) => {
                if (!loading) {
                  expect(data).toMatchObject({ allPeople: { people: null } });
                  expect(error).toBeDefined();
                  expect(error.graphQLErrors[0].message).toEqual(
                    "this is an error"
                  );
                  resolve();
                }
                return null;
              }}
            </Query>
          </ApolloProvider>
        );

        getDataFromTree(app);
      }
    );
  });
});
