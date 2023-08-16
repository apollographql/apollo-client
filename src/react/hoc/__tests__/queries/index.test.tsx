import React from "react";
import PropTypes from "prop-types";
import { render, waitFor } from "@testing-library/react";
import gql from "graphql-tag";
import { DocumentNode } from "graphql";

import { ApolloClient } from "../../../../core";
import { ApolloProvider } from "../../../context";
import { InMemoryCache as Cache } from "../../../../cache";
import { ApolloLink } from "../../../../link/core";
import { itAsync, mockSingleLink } from "../../../../testing";
import { graphql } from "../../graphql";
import { ChildProps, DataProps } from "../../types";

describe("queries", () => {
  let error: typeof console.error;
  beforeEach(() => {
    error = console.error;
    console.error = jest.fn(() => {});
  });

  afterEach(() => {
    console.error = error;
  });

  // general api
  it("binds a query to props", async () => {
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
    const link = mockSingleLink({
      request: { query },
      result: { data: { allPeople: { people: [{ name: "Luke Skywalker" }] } } },
    });
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    interface Data {
      allPeople?: {
        people: { name: string }[];
      };
    }

    const ContainerWithData = graphql<any, Data>(query)(({
      data,
    }: DataProps<Data>) => {
      expect(data).toBeTruthy();
      done = true;
      return null;
    });

    render(
      <ApolloProvider client={client}>
        <ContainerWithData />
      </ApolloProvider>
    );

    await waitFor(() => {
      expect(done).toBe(true);
    });
  });

  itAsync("includes the variables in the props", (resolve, reject) => {
    const TIME_SCALE = 5000;
    let renderCount = 0;
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
    const link = mockSingleLink({
      request: { query, variables },
      result: { data: { allPeople: { people: [{ name: "Luke Skywalker" }] } } },
    });
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    // Ensure variable types work correctly here

    interface Data {
      allPeople: {
        people: {
          name: string;
        };
      };
    }

    interface Variables {
      first: number;
    }

    const ContainerWithData = graphql<Variables, Data, Variables>(query)(({
      data,
    }: ChildProps<Variables, Data, Variables>) => {
      expect(data).toBeTruthy();
      expect(data!.variables).toEqual(variables);
      renderCount += 1;
      return null;
    });

    render(
      <ApolloProvider client={client}>
        <ContainerWithData first={1} />
      </ApolloProvider>
    );

    waitFor(
      () => {
        expect(renderCount).toBe(2);
      },
      { timeout: TIME_SCALE }
    ).then(resolve, reject);
  });

  itAsync(
    "should update query variables when props change",
    (resolve, reject) => {
      const query: DocumentNode = gql`
        query people($someId: ID) {
          allPeople(someId: $someId) {
            people {
              name
            }
          }
        }
      `;

      const link = mockSingleLink(
        {
          request: { query, variables: { someId: 1 } },
          result: {
            data: { allPeople: { people: [{ name: "Luke Skywalker" }] } },
          },
        },
        {
          request: { query, variables: { someId: 2 } },
          result: {
            data: { allPeople: { people: [{ name: "Darth Vader" }] } },
          },
        }
      );
      const client = new ApolloClient({
        link,
        cache: new Cache({ addTypename: false }),
      });

      interface Data {
        allPeople: {
          people: {
            name: string;
          };
        };
      }

      interface Variables {
        someId: number;
      }

      const options = {
        options: {},
      };

      let count = 0;
      const ContainerWithData = graphql<Variables, Data, Variables>(
        query,
        options
      )(({ data }: ChildProps<Variables, Data, Variables>) => {
        expect(data).toBeTruthy();
        switch (++count) {
          case 1:
            expect(data!.loading).toBe(true);
            expect(data!.variables).toEqual({ someId: 1 });
            break;
          case 2:
            expect(data!.loading).toBe(true);
            expect(data!.variables).toEqual({ someId: 2 });
            break;
          case 3:
            expect(data!.loading).toBe(false);
            expect(data!.variables).toEqual({ someId: 2 });
            break;
          default:
            reject(`too many renders (${count})`);
        }

        return null;
      });

      const { rerender } = render(
        <ApolloProvider client={client}>
          <ContainerWithData someId={1} />
        </ApolloProvider>
      );
      rerender(
        <ApolloProvider client={client}>
          <ContainerWithData someId={2} />
        </ApolloProvider>
      );

      waitFor(() => {
        expect(count).toBe(3);
      }).then(resolve, reject);
    }
  );

  it("shouldn't warn about fragments", () => {
    const oldWarn = console.warn;
    const warnings: any[] = [];
    console.warn = (str: any) => warnings.push(str);

    try {
      graphql(gql`
        query foo {
          bar
        }
      `);
      expect(warnings.length).toEqual(0);
    } finally {
      console.warn = oldWarn;
    }
  });

  itAsync("executes a query", (resolve, reject) => {
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

    const Container = graphql<{}, Data>(query)(
      class extends React.Component<ChildProps<{}, Data>> {
        componentDidUpdate() {
          const { props } = this;
          expect(props.data!.loading).toBeFalsy();
          expect(props.data!.allPeople).toEqual(data.allPeople);
          done = true;
        }
        render() {
          return null;
        }
      }
    );

    render(
      <ApolloProvider client={client}>
        <Container />
      </ApolloProvider>
    );

    waitFor(() => {
      expect(done).toBe(true);
    }).then(resolve, reject);
  });

  itAsync("executes a query with two root fields", (resolve, reject) => {
    let done = false;
    const query: DocumentNode = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
        otherPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;
    const data = {
      allPeople: { people: [{ name: "Luke Skywalker" }] },
      otherPeople: { people: [{ name: "Luke Skywalker" }] },
    };
    type Data = typeof data;

    const link = mockSingleLink({
      request: { query },
      result: { data },
    });
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const Container = graphql<{}, Data>(query)(
      class extends React.Component<ChildProps<{}, Data>> {
        componentDidUpdate() {
          const { props } = this;
          expect(props.data!.loading).toBeFalsy();
          expect(props.data!.allPeople).toEqual(data.allPeople);
          expect(props.data!.otherPeople).toEqual(data.otherPeople);
          done = true;
        }
        render() {
          return null;
        }
      }
    );

    render(
      <ApolloProvider client={client}>
        <Container />
      </ApolloProvider>
    );

    waitFor(() => {
      expect(done).toBe(true);
    }).then(resolve, reject);
  });

  itAsync("maps props as variables if they match", (resolve, reject) => {
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
    const data = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
    type Data = typeof data;

    const variables = { first: 1 };
    type Vars = typeof variables;

    const link = mockSingleLink({
      request: { query, variables },
      result: { data },
    });
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const Container = graphql<Vars, Data, Vars>(query)(
      class extends React.Component<ChildProps<Vars, Data, Vars>> {
        componentDidUpdate() {
          const { props } = this;
          expect(props.data!.loading).toBeFalsy();
          expect(props.data!.allPeople).toEqual(data.allPeople);
          expect(props.data!.variables).toEqual(this.props.data!.variables);
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

  itAsync(
    "doesn't care about the order of variables in a request",
    (resolve, reject) => {
      let done = false;
      const query: DocumentNode = gql`
        query people($first: Int, $jedi: Boolean) {
          allPeople(first: $first, jedi: $jedi) {
            people {
              name
            }
          }
        }
      `;
      const data = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
      type Data = typeof data;
      const variables = { jedi: true, first: 1 };
      type Vars = typeof variables;

      const mocks = [
        {
          request: {
            query,
            variables,
          },
          result: {
            data,
          },
        },
      ];
      const link = mockSingleLink.apply(null, mocks);
      const client = new ApolloClient({
        link,
        cache: new Cache({ addTypename: false }),
      });
      const options = {
        options: {
          variables: {
            jedi: true,
            first: 1,
          },
        },
      };

      const Container = graphql<{}, Data, Vars>(
        query,
        options
      )(
        class extends React.Component<ChildProps<{}, Data, Vars>> {
          componentDidUpdate() {
            const { props } = this;
            try {
              expect(props.data!.loading).toBeFalsy();
              expect(props.data!.allPeople).toEqual(data.allPeople);
              done = true;
            } catch (error) {
              reject(error);
            }
          }
          render() {
            return null;
          }
        }
      );

      render(
        <ApolloProvider client={client}>
          <Container />
        </ApolloProvider>
      );

      waitFor(() => {
        expect(done).toBe(true);
      }).then(resolve, reject);
    }
  );

  itAsync(
    "allows falsy values in the mapped variables from props",
    (resolve, reject) => {
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
      const data = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
      type Data = typeof data;

      const variables = { first: null };
      type Vars = typeof variables;

      const link = mockSingleLink({
        request: { query, variables },
        result: { data },
      });
      const client = new ApolloClient({
        link,
        cache: new Cache({ addTypename: false }),
      });

      const Container = graphql<Partial<Vars>, Data, Vars>(query)(
        class extends React.Component<ChildProps<Partial<Vars>, Data, Vars>> {
          componentDidUpdate() {
            const { props } = this;
            expect(props.data!.loading).toBeFalsy();
            expect(props.data!.allPeople).toEqual(data.allPeople);
            done = true;
          }
          render() {
            return null;
          }
        }
      );

      render(
        <ApolloProvider client={client}>
          <Container first={null} />
        </ApolloProvider>
      );

      waitFor(() => {
        expect(done).toBe(true);
      }).then(resolve, reject);
    }
  );

  it("doesn't error on optional required props", () => {
    const query: DocumentNode = gql`
      query people($first: Int) {
        allPeople(first: $first) {
          people {
            name
          }
        }
      }
    `;
    const data = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
    type Data = typeof data;

    const variables = { first: 1 };
    type Vars = typeof variables;

    const link = mockSingleLink({
      request: { query, variables },
      result: { data },
    });
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });
    const Container = graphql<Vars, Data>(query)(() => null);

    let errorCaught = null;
    try {
      const { unmount } = render(
        <ApolloProvider client={client}>
          <Container first={1} />
        </ApolloProvider>
      );
      unmount();
    } catch (e) {
      errorCaught = e;
    }

    expect(errorCaught).toBeNull();
  });

  // context
  itAsync("allows context through updates", (resolve, reject) => {
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

    const Container = graphql<{}, Data>(query)(
      class extends React.Component<ChildProps<React.PropsWithChildren, Data>> {
        componentDidUpdate() {
          const { props } = this;
          expect(props.data!.loading).toBeFalsy();
          expect(props.data!.allPeople).toEqual(data.allPeople);
        }
        render() {
          // eslint-disable-next-line testing-library/no-node-access
          return <div>{this.props.children}</div>;
        }
      }
    );

    class ContextContainer extends React.Component<
      React.PropsWithChildren,
      { color: string }
    > {
      constructor(props: {}) {
        super(props);
        this.state = { color: "purple" };
      }

      getChildContext() {
        return { color: this.state.color };
      }

      componentDidMount() {
        setTimeout(() => {
          this.setState({ color: "green" });
        }, 50);
      }

      render() {
        // eslint-disable-next-line testing-library/no-node-access
        return <div>{this.props.children}</div>;
      }
    }

    (ContextContainer as any).childContextTypes = {
      color: PropTypes.string,
    };

    let count = 0;
    let done = false;
    class ChildContextContainer extends React.Component<React.PropsWithChildren> {
      render() {
        const { color } = this.context as any;
        if (count === 0) expect(color).toBe("purple");
        if (count === 1) {
          expect(color).toBe("green");
          done = true;
        }

        count++;
        // eslint-disable-next-line testing-library/no-node-access
        return <div>{this.props.children}</div>;
      }
    }

    (ChildContextContainer as any).contextTypes = {
      color: PropTypes.string,
    };

    render(
      <ApolloProvider client={client}>
        <ContextContainer>
          <Container>
            <ChildContextContainer />
          </Container>
        </ContextContainer>
      </ApolloProvider>
    );

    waitFor(() => expect(done).toBeTruthy()).then(resolve, reject);
  });

  // meta
  it("stores the component name", () => {
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
    const Container = graphql<{}, Data>(query)(
      class Container extends React.Component<ChildProps<{}, Data>> {
        render() {
          return null;
        }
      }
    );

    expect(Container.displayName).toEqual("Apollo(Container)");
  });

  it("uses a custom wrapped component name when 'alias' is specified", () => {
    const query: DocumentNode = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;
    @graphql(query, {
      alias: "withFoo",
    })
    class Container extends React.Component {
      render(): React.ReactNode {
        return null;
      }
    }
    // );

    // Not sure why I have to cast Container to any
    expect((Container as any).displayName).toEqual("withFoo(Container)");
  });

  itAsync("passes context to the link", (resolve, reject) => {
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
    const link = new ApolloLink((o, f) => {
      expect(o.getContext().fromProps).toBe(true);
      done = true;
      return f ? f(o) : null;
    }).concat(
      mockSingleLink({
        request: { query },
        result: {
          data: { allPeople: { people: [{ name: "Luke Skywalker" }] } },
        },
      })
    );
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    interface Data {
      allPeople?: {
        people: { name: string }[];
      };
    }

    const ContainerWithData = graphql<any, Data>(query, {
      options: (props) => ({ context: { fromProps: props.context } }),
    })(() => null);

    render(
      <ApolloProvider client={client}>
        <ContainerWithData context={true} />
      </ApolloProvider>
    );

    waitFor(() => {
      expect(done).toBe(true);
    }).then(resolve, reject);
  });

  describe("Return partial data", () => {
    const consoleWarn = console.warn;
    beforeAll(() => {
      console.warn = () => null;
    });

    afterAll(() => {
      console.warn = consoleWarn;
    });

    it("should not return partial cache data when `returnPartialData` is false", () => {
      const cache = new Cache();
      const client = new ApolloClient({
        cache,
        link: ApolloLink.empty(),
      });

      const fullQuery = gql`
        query {
          cars {
            make
            model
            repairs {
              date
              description
            }
          }
        }
      `;

      cache.writeQuery({
        query: fullQuery,
        data: {
          cars: [
            {
              __typename: "Car",
              make: "Ford",
              model: "Mustang",
              vin: "PONY123",
              repairs: [
                {
                  __typename: "Repair",
                  date: "2019-05-08",
                  description: "Could not get after it.",
                },
              ],
            },
          ],
        },
      });

      const partialQuery = gql`
        query {
          cars {
            repairs {
              date
              cost
            }
          }
        }
      `;

      const ComponentWithData = graphql<any, any>(partialQuery)(
        class Compnent extends React.Component<any> {
          render() {
            expect(this.props.data.cars).toBeUndefined();
            return null;
          }
        }
      );

      const App = () => (
        <ApolloProvider client={client}>
          <ComponentWithData />
        </ApolloProvider>
      );

      render(<App />);
    });

    it("should return partial cache data when `returnPartialData` is true", () => {
      const cache = new Cache();
      const client = new ApolloClient({
        cache,
        link: ApolloLink.empty(),
      });

      const fullQuery = gql`
        query {
          cars {
            make
            model
            repairs {
              date
              description
            }
          }
        }
      `;

      cache.writeQuery({
        query: fullQuery,
        data: {
          cars: [
            {
              __typename: "Car",
              make: "Ford",
              model: "Mustang",
              vin: "PONY123",
              repairs: [
                {
                  __typename: "Repair",
                  date: "2019-05-08",
                  description: "Could not get after it.",
                },
              ],
            },
          ],
        },
      });

      const partialQuery = gql`
        query {
          cars {
            repairs {
              date
              cost
            }
          }
        }
      `;

      const ComponentWithData = graphql<any, any>(partialQuery, {
        options: {
          returnPartialData: true,
        },
      })(
        class Compnent extends React.Component<any> {
          render() {
            if (!this.props.data.loading) {
              expect(this.props.data.cars).toEqual([
                {
                  __typename: "Car",
                  repairs: [
                    {
                      __typename: "Repair",
                      date: "2019-05-08",
                    },
                  ],
                },
              ]);
            }
            return null;
          }
        }
      );

      const App = () => (
        <ApolloProvider client={client}>
          <ComponentWithData />
        </ApolloProvider>
      );

      render(<App />);
    });
  });
});
