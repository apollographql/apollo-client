import React from "react";
import { render, waitFor } from "@testing-library/react";
import gql from "graphql-tag";
import { DocumentNode } from "graphql";

import { ApolloClient } from "../../../core";
import { ApolloProvider } from "../../context";
import { InMemoryCache as Cache } from "../../../cache";
import { itAsync, mockSingleLink } from "../../../testing";
import { graphql } from "../graphql";
import { ChildProps } from "../types";

describe("client option", () => {
  it("renders with client from options", () => {
    const query: DocumentNode = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;
    const data = { allPeople: { people: [{ name: "Luke Skywalker" }] } };

    type Data = typeof data;

    const link = mockSingleLink({
      request: { query },
      result: { data },
    });
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });
    const config = {
      options: {
        client,
      },
    };
    const ContainerWithData = graphql<{}, Data>(query, config)(() => null);
    const { unmount } = render(
      <ApolloProvider
        client={
          new ApolloClient({
            link,
            cache: new Cache({ addTypename: false }),
          })
        }
      >
        <ContainerWithData />
      </ApolloProvider>
    );
    unmount();
  });

  itAsync("doesnt require a recycler", (resolve, reject) => {
    const query = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;
    const data = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
    type Data = typeof data;

    const link = mockSingleLink({
      request: { query },
      result: { data },
    });
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });
    const config = {
      options: {
        client,
      },
    };
    let renderCount = 0;
    const ContainerWithData = graphql<{}, Data>(
      query,
      config
    )(() => {
      renderCount += 1;
      return null;
    });
    render(<ContainerWithData />);

    waitFor(() => {
      expect(renderCount).toBe(2);
    }).then(resolve, reject);
  });

  itAsync(
    "ignores client from context if client from options is present",
    (resolve, reject) => {
      let done = false;
      const query: DocumentNode = gql`
        query people {
          allPeople(first: 1) {
            people {
              name
            }
          }
        }
      `;
      const dataProvider = {
        allPeople: { people: [{ name: "Leia Organa Solo" }] },
      };

      type Data = typeof dataProvider;
      const linkProvider = mockSingleLink({
        request: { query },
        result: { data: dataProvider },
      });
      const clientProvider = new ApolloClient({
        link: linkProvider,
        cache: new Cache({ addTypename: false }),
      });
      const dataOptions = {
        allPeople: { people: [{ name: "Luke Skywalker" }] },
      };
      const linkOptions = mockSingleLink({
        request: { query },
        result: { data: dataOptions },
      });
      const clientOptions = new ApolloClient({
        link: linkOptions,
        cache: new Cache({ addTypename: false }),
      });

      const config = {
        options: {
          client: clientOptions,
        },
      };

      class Container extends React.Component<ChildProps<{}, Data>> {
        componentDidUpdate() {
          const { data } = this.props;
          expect(data!.loading).toBeFalsy(); // first data
          expect(data!.allPeople).toEqual({
            people: [{ name: "Luke Skywalker" }],
          });
          done = true;
        }
        render() {
          return null;
        }
      }
      const ContainerWithData = graphql<{}, Data>(query, config)(Container);
      render(
        <ApolloProvider client={clientProvider}>
          <ContainerWithData />
        </ApolloProvider>
      );

      waitFor(() => {
        expect(done).toBe(true);
      }).then(resolve, reject);
    }
  );

  itAsync("exposes refetch as part of the props api", (resolve, reject) => {
    let done = false;
    const query: DocumentNode = gql`
      query people($first: Int) {
        allPeople(first: $first) {
          people {
            name
          }
        }
      }
    `;
    const variables = { first: 1 };
    type Variables = typeof variables;

    const data1 = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
    type Data = typeof data1;

    const link = mockSingleLink({
      request: { query, variables },
      result: { data: data1 },
    });
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const Container = graphql<Variables, Data, Variables>(query)(
      class extends React.Component<ChildProps<Variables, Data, Variables>> {
        componentDidUpdate() {
          const { data } = this.props;
          expect(data!.loading).toBeFalsy(); // first data
          done = true;
        }
        render() {
          return null;
        }
      }
    );

    render(
      <ApolloProvider client={client}>
        <Container first={1} />
      </ApolloProvider>
    );

    waitFor(() => {
      expect(done).toBe(true);
    }).then(resolve, reject);
  });
});
