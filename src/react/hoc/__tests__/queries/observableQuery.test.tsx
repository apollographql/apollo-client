import React from "react";
import userEvent from "@testing-library/user-event";
import { render, waitFor, screen } from "@testing-library/react";
import gql from "graphql-tag";
import { DocumentNode } from "graphql";

import { ApolloClient } from "../../../../core";
import { ApolloProvider } from "../../../context";
import { InMemoryCache as Cache } from "../../../../cache";
import { itAsync, mockSingleLink } from "../../../../testing";
import { graphql } from "../../graphql";
import { ChildProps } from "../../types";

describe("[queries] observableQuery", () => {
  // observableQuery
  it("will recycle `ObservableQuery`s when re-rendering the entire tree", async () => {
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

    const link = mockSingleLink(
      { request: { query }, result: { data } },
      { request: { query }, result: { data } }
    );
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    let count = 0;

    const assert1 = async () => {
      const keys = Array.from(
        ((client as any).queryManager as any).queries.keys()
      );
      await waitFor(() => expect(keys).toEqual(["1"]), { interval: 1 });
    };

    const assert2 = async () => {
      const keys = Array.from(
        ((client as any).queryManager as any).queries.keys()
      );
      await waitFor(() => expect(keys).toEqual(["1"]), { interval: 1 });
    };

    let done = false;
    const Container = graphql<{}, Data>(query, {
      options: { fetchPolicy: "cache-and-network" },
    })(
      class extends React.Component<ChildProps<{}, Data>> {
        async componentDidUpdate() {
          if (count === 2) {
            expect(this.props.data!.loading).toBeFalsy();
            expect(this.props.data!.allPeople).toEqual(data.allPeople);

            // ensure first assertion and umount tree
            await assert1();

            await userEvent.click(screen.getByText("Break things"));

            // ensure cleanup
            await assert2();
          }

          if (count === 4) {
            done = true;
          }
        }

        render() {
          // during the first mount, the loading prop should be true;
          if (count === 0) {
            expect(this.props.data!.loading).toBeTruthy();
          }

          // during the second mount, the loading prop should be false, and data should
          // be present;
          if (count === 3) {
            expect(this.props.data!.loading).toBeFalsy();
            expect(this.props.data!.allPeople).toEqual(data.allPeople);
          }
          count++;
          return null;
        }
      }
    );

    class RedirectOnMount extends React.Component<{ onMount: () => void }> {
      componentDidMount() {
        this.props.onMount();
      }

      render() {
        return null;
      }
    }

    class AppWrapper extends React.Component<{}, { renderRedirect: boolean }> {
      state = {
        renderRedirect: false,
      };

      goToRedirect = () => {
        this.setState({ renderRedirect: true });
      };

      handleRedirectMount = () => {
        this.setState({ renderRedirect: false });
      };

      render() {
        if (this.state.renderRedirect) {
          return <RedirectOnMount onMount={this.handleRedirectMount} />;
        } else {
          return (
            <div>
              <Container />
              <button id="break" onClick={this.goToRedirect}>
                Break things
              </button>
            </div>
          );
        }
      }
    }

    render(
      <ApolloProvider client={client}>
        <AppWrapper />
      </ApolloProvider>
    );

    await waitFor(() => {
      expect(done).toBeTruthy();
    });
  });

  itAsync(
    "will recycle `ObservableQuery`s when re-rendering a portion of the tree but not return stale data if variables don't match",
    (resolve, reject) => {
      const query: DocumentNode = gql`
        query people($first: Int!) {
          allPeople(first: $first) {
            people {
              name
              friends(id: $first) {
                name
              }
            }
          }
        }
      `;
      const variables1 = { first: 1 };
      const variables2 = { first: 2 };
      const data = {
        allPeople: {
          people: [{ name: "Luke Skywalker", friends: [{ name: "r2d2" }] }],
        },
      };
      const data2 = {
        allPeople: {
          people: [{ name: "Leia Skywalker", friends: [{ name: "luke" }] }],
        },
      };

      type Data = typeof data;
      type Vars = typeof variables1;

      const link = mockSingleLink(
        { request: { query, variables: variables1 }, result: { data } },
        { request: { query, variables: variables2 }, result: { data: data2 } }
      );
      const client = new ApolloClient({
        link,
        cache: new Cache({ addTypename: false }),
      });
      let remount: any;

      const Container = graphql<Vars, Data, Vars>(query)(
        class extends React.Component<ChildProps<Vars, Data, Vars>> {
          render() {
            try {
              const { variables, loading, allPeople } = this.props.data!;
              // first variable render
              if (variables.first === 1) {
                if (loading) expect(allPeople).toBeUndefined();
                if (!loading) {
                  expect(allPeople).toEqual(data.allPeople);
                }
              }

              if (variables.first === 2) {
                // second variables render
                if (loading) expect(allPeople).toBeUndefined();
                if (!loading) expect(allPeople).toEqual(data2.allPeople);
              }
            } catch (e) {
              reject(e);
            }

            return null;
          }
        }
      );

      class Remounter extends React.Component<
        { render: typeof Container },
        { showChildren: boolean; variables: Vars }
      > {
        state = {
          showChildren: true,
          variables: variables1,
        };

        componentDidMount() {
          remount = () => {
            this.setState({ showChildren: false }, () => {
              setTimeout(() => {
                this.setState({
                  showChildren: true,
                  variables: variables2,
                });
              }, 10);
            });
          };
        }

        render() {
          if (!this.state.showChildren) return null;
          const Thing = this.props.render;
          return <Thing first={this.state.variables.first} />;
        }
      }

      // the initial mount fires off the query
      // the same as episode id = 1
      render(
        <ApolloProvider client={client}>
          <Remounter render={Container} />
        </ApolloProvider>
      );

      // after the initial data has been returned
      // the user navigates to a different page
      // but the query is recycled
      let done = false;
      setTimeout(() => {
        // move to the "home" page from the "episode" page
        remount();
        setTimeout(() => {
          // move to a new "epsiode" page
          // epsiode id = 2
          // wait to verify the data isn't stale then end
          done = true;
        }, 20);
      }, 5);

      return waitFor(() => expect(done).toBeTruthy()).then(resolve, reject);
    }
  );

  it("not overly rerender", async () => {
    const query: DocumentNode = gql`
      query people($first: Int!) {
        allPeople(first: $first) {
          people {
            name
            friends(id: $first) {
              name
            }
          }
        }
      }
    `;

    const variables = { first: 1 };
    const data = {
      allPeople: {
        people: [{ name: "Luke Skywalker", friends: [{ name: "r2d2" }] }],
      },
    };
    type Data = typeof data;
    type Vars = typeof variables;

    const link = mockSingleLink({
      request: { query, variables },
      result: { data },
    });

    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });
    let remount: any;

    let count = 0;
    const Container = graphql<Vars, Data, Vars>(query)(
      class extends React.Component<ChildProps<Vars, Data, Vars>> {
        render() {
          count++;
          const { loading, allPeople } = this.props.data!;
          switch (count) {
            case 1:
              expect(loading).toBe(true);
              break;
            case 2:
              expect(loading).toBe(false);
              expect(allPeople).toEqual(data.allPeople);
              break;
            case 3:
              expect(loading).toBe(false);
              expect(allPeople).toEqual(data.allPeople);
              break;
            default: // Do nothing
          }

          return null;
        }
      }
    );

    class Remounter extends React.Component<
      { render: typeof Container },
      { showChildren: boolean; variables: Vars }
    > {
      state = {
        showChildren: true,
        variables,
      };

      componentDidMount() {
        remount = () => {
          this.setState({ showChildren: false }, () => {
            setTimeout(() => {
              this.setState({ showChildren: true, variables });
            }, 10);
          });
        };
      }

      render() {
        if (!this.state.showChildren) return null;
        const Thing = this.props.render;
        return <Thing first={this.state.variables.first} />;
      }
    }

    // the initial mount fires off the query
    // the same as episode id = 1
    render(
      <ApolloProvider client={client}>
        <Remounter render={Container} />
      </ApolloProvider>
    );

    // after the initial data has been returned
    // the user navigates to a different page
    // but the query is recycled
    let done = false;
    setTimeout(() => {
      // move to the "home" page from the "episode" page
      remount();
      setTimeout(() => {
        // move to the same "episode" page
        // make sure we dont over render
        done = true;
      }, 20);
    }, 5);

    await waitFor(() => {
      expect(done).toBeTruthy();
    });
  });

  itAsync(
    "does rerender if query returns differnt result",
    (resolve, reject) => {
      const query: DocumentNode = gql`
        query people($first: Int!) {
          allPeople(first: $first) {
            people {
              name
              friends(id: $first) {
                name
              }
            }
          }
        }
      `;

      const variables = { first: 1 };
      const dataOne = {
        allPeople: {
          people: [{ name: "Luke Skywalker", friends: [{ name: "r2d2" }] }],
        },
      };
      const dataTwo = {
        allPeople: {
          people: [
            { name: "Luke Skywalker", friends: [{ name: "Leia Skywalker" }] },
          ],
        },
      };

      type Data = typeof dataOne;
      type Vars = typeof variables;

      const link = mockSingleLink(
        {
          request: { query, variables },
          result: { data: dataOne },
        },
        {
          request: { query, variables },
          result: { data: dataTwo },
        }
      );

      const client = new ApolloClient({
        link,
        cache: new Cache({ addTypename: false }),
      });

      let count = 0;
      const Container = graphql<Vars, Data, Vars>(query)(
        class extends React.Component<ChildProps<Vars, Data, Vars>> {
          render() {
            count++;
            try {
              const { loading, allPeople, refetch } = this.props.data!;
              // first variable render
              if (count === 1) {
                expect(loading).toBe(true);
              }
              if (count === 2) {
                expect(loading).toBe(false);
                expect(allPeople).toEqual(dataOne.allPeople);
                refetch();
              }
              if (count === 3) {
                expect(loading).toBe(false);
                expect(allPeople).toEqual(dataTwo.allPeople);
              }
              if (count > 3) {
                throw new Error("too many renders");
              }
            } catch (e) {
              reject(e);
            }

            return null;
          }
        }
      );

      // the initial mount fires off the query
      // the same as episode id = 1
      render(
        <ApolloProvider client={client}>
          <Container first={1} />
        </ApolloProvider>
      );

      return waitFor(() => expect(count).toBe(3)).then(resolve, reject);
    }
  );
});
