import React from "react";
import { render } from "@testing-library/react";
import gql from "graphql-tag";
import { DocumentNode } from "graphql";

import { ApolloClient } from "../../../../core";
import { createMockClient, itAsync, MockedProvider } from "../../../../testing";
import { NormalizedCacheObject } from "../../../../cache";
import { ApolloProvider } from "../../../context";
import { graphql } from "../../graphql";
import { ChildProps } from "../../types";

const query: DocumentNode = gql`
  mutation addPerson {
    allPeople(first: 1) {
      people {
        name
      }
    }
  }
`;

interface Data {
  allPeople: {
    people: { name: string }[];
  };
}

interface Variables {
  name: string;
}

const expectedData = {
  allPeople: { people: [{ name: "Luke Skywalker" }] },
};

describe("graphql(mutation)", () => {
  let error: typeof console.error;
  let client: ApolloClient<NormalizedCacheObject>;
  beforeEach(() => {
    error = console.error;
    console.error = jest.fn(() => {});
    client = createMockClient(expectedData, query);
  });

  afterEach(() => {
    console.error = error;
  });

  it("binds a mutation to props", () => {
    const ContainerWithData = graphql(query)(({ mutate, result }) => {
      expect(mutate).toBeTruthy();
      expect(result).toBeTruthy();
      expect(typeof mutate).toBe("function");
      expect(typeof result).toBe("object");
      return null;
    });

    render(
      <ApolloProvider client={client}>
        <ContainerWithData />
      </ApolloProvider>
    );
  });

  it("binds a mutation result to props", () => {
    type InjectedProps = {
      result: any;
    };

    const ContainerWithData = graphql<{}, Data, Variables, InjectedProps>(
      query
    )(({ result }) => {
      const { loading, error } = result;
      expect(result).toBeTruthy();
      expect(typeof loading).toBe("boolean");
      expect(error).toBeFalsy();

      return null;
    });

    render(
      <ApolloProvider client={client}>
        <ContainerWithData />
      </ApolloProvider>
    );
  });

  it("binds a mutation to props with a custom name", () => {
    interface Props {}

    type InjectedProps = {
      customMutation: any;
      customMutationResult: any;
    };

    const ContainerWithData = graphql<Props, Data, Variables, InjectedProps>(
      query,
      { name: "customMutation" }
    )(({ customMutation, customMutationResult }) => {
      expect(customMutation).toBeTruthy();
      expect(customMutationResult).toBeTruthy();
      expect(typeof customMutation).toBe("function");
      expect(typeof customMutationResult).toBe("object");
      return null;
    });

    render(
      <ApolloProvider client={client}>
        <ContainerWithData />
      </ApolloProvider>
    );
  });

  it("binds a mutation to custom props", () => {
    interface Props {
      methodName: string;
    }
    type InjectedProps = {
      [name: string]: (name: string) => void;
    };
    const ContainerWithData = graphql<Props, Data, Variables, InjectedProps>(
      query,
      {
        props: ({ ownProps, mutate: addPerson }) => ({
          [ownProps.methodName]: (name: string) =>
            addPerson!({ variables: { name } }),
        }),
      }
    )(({ myInjectedMutationMethod }) => {
      expect(myInjectedMutationMethod).toBeTruthy();
      expect(typeof myInjectedMutationMethod).toBe("function");
      return null;
    });

    render(
      <ApolloProvider client={client}>
        <ContainerWithData methodName="myInjectedMutationMethod" />
      </ApolloProvider>
    );
  });

  itAsync("does not swallow children errors", (resolve, reject) => {
    let bar: any;
    const ContainerWithData = graphql(query)(() => {
      bar(); // this will throw
      return null;
    });

    class ErrorBoundary extends React.Component<React.PropsWithChildren> {
      componentDidCatch(e: Error) {
        expect(e.name).toMatch(/TypeError/);
        expect(e.message).toMatch(/bar is not a function/);
        resolve();
      }

      render() {
        // eslint-disable-next-line testing-library/no-node-access
        return this.props.children;
      }
    }

    render(
      <ApolloProvider client={client}>
        <ErrorBoundary>
          <ContainerWithData />
        </ErrorBoundary>
      </ApolloProvider>
    );
  });

  itAsync("can execute a mutation", (resolve, reject) => {
    const Container = graphql(query)(
      class extends React.Component<ChildProps> {
        componentDidMount() {
          this.props.mutate!().then((result) => {
            expect(result && result.data).toEqual(expectedData);
            resolve();
          });
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
  });

  itAsync(
    "can execute a mutation with variables from props",
    (resolve, reject) => {
      const queryWithVariables = gql`
        mutation addPerson($first: Int) {
          allPeople(first: $first) {
            people {
              name
            }
          }
        }
      `;
      client = createMockClient(expectedData, queryWithVariables, {
        first: 1,
      });

      interface Props {
        first: number;
      }

      const Container = graphql<Props>(queryWithVariables)(
        class extends React.Component<ChildProps<Props>> {
          componentDidMount() {
            this.props.mutate!().then((result) => {
              expect(result && result.data).toEqual(expectedData);
              resolve();
            });
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
    }
  );

  itAsync(
    "can execute a mutation with variables from BOTH options and arguments",
    (resolve, reject) => {
      const queryWithVariables = gql`
        mutation addPerson($first: Int!, $second: Int!) {
          allPeople(first: $first) {
            people {
              name
            }
          }
        }
      `;

      const mocks = [
        {
          request: {
            query: queryWithVariables,
            variables: {
              first: 1,
              second: 2,
            },
          },
          result: { data: expectedData },
        },
      ];

      interface Props {}

      const Container = graphql<Props>(queryWithVariables, {
        options: () => ({
          variables: { first: 1 },
        }),
      })(
        class extends React.Component<ChildProps<Props>> {
          componentDidMount() {
            this.props.mutate!({
              variables: { second: 2 },
            }).then((result) => {
              expect(result && result.data).toEqual(expectedData);
              resolve();
            });
          }
          render() {
            return null;
          }
        }
      );

      render(
        <MockedProvider mocks={mocks}>
          <Container />
        </MockedProvider>
      );
    }
  );
});
