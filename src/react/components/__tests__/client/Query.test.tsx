import React from "react";
import gql from "graphql-tag";
import { DocumentNode } from "graphql";
import { render, screen, waitFor } from "@testing-library/react";

import { ApolloClient, NetworkStatus } from "../../../../core";
import { ApolloError } from "../../../../errors";
import { ApolloLink } from "../../../../link/core";
import { InMemoryCache } from "../../../../cache";
import { ApolloProvider } from "../../../context";
import { itAsync, MockedProvider, mockSingleLink } from "../../../../testing";
import { Query } from "../../Query";
import { QueryResult } from "../../../types/types";
import {
  disableActEnvironment,
  createRenderStream,
} from "@testing-library/react-render-stream";

const allPeopleQuery: DocumentNode = gql`
  query people {
    allPeople(first: 1) {
      people {
        name
      }
    }
  }
`;

interface Data {
  allPeople: {
    people: Array<{ name: string }>;
  };
}

const allPeopleData: Data = {
  allPeople: { people: [{ name: "Luke Skywalker" }] },
};
const allPeopleMocks = [
  {
    request: { query: allPeopleQuery },
    result: { data: allPeopleData },
  },
];

const AllPeopleQuery = Query;

describe("Query component", () => {
  itAsync("calls the children prop", (resolve, reject) => {
    let finished = false;
    const link = mockSingleLink({
      request: { query: allPeopleQuery },
      result: { data: allPeopleData },
    });
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({ addTypename: false }),
    });

    const Component = () => (
      <Query query={allPeopleQuery}>
        {(result: any) => {
          const {
            client: clientResult,
            observable,
            fetchMore,
            refetch,
            reobserve,
            startPolling,
            stopPolling,
            subscribeToMore,
            updateQuery,
            ...rest
          } = result;
          try {
            if (result.loading) {
              expect(rest).toEqual({
                called: true,
                loading: true,
                networkStatus: 1,
                previousData: undefined,
                variables: {},
              });
              expect(clientResult).toBe(client);
            } else {
              expect(rest).toEqual({
                called: true,
                data: {
                  allPeople: {
                    people: [
                      {
                        name: "Luke Skywalker",
                      },
                    ],
                  },
                },
                error: undefined,
                loading: false,
                networkStatus: 7,
                previousData: undefined,
                variables: {},
              });
              finished = true;
            }
          } catch (err) {
            reject(err);
          }
          return null;
        }}
      </Query>
    );

    render(
      <ApolloProvider client={client}>
        <Component />
      </ApolloProvider>
    );

    waitFor(() => {
      expect(finished).toBe(true);
    }).then(resolve, reject);
  });

  it("renders using the children prop", async () => {
    const Component = () => (
      <Query query={allPeopleQuery}>{(_: any) => <div>test</div>}</Query>
    );

    render(
      <MockedProvider mocks={allPeopleMocks}>
        <Component />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("test")).toBeTruthy();
    });
  });

  describe("result provides", () => {
    let consoleWarn = console.warn;
    beforeAll(() => {
      console.warn = () => null;
    });

    afterAll(() => {
      console.warn = consoleWarn;
    });

    itAsync("client", (resolve, reject) => {
      let count = 0;
      const queryWithVariables: DocumentNode = gql`
        query people($first: Int) {
          allPeople(first: $first) {
            people {
              name
            }
          }
        }
      `;

      const mocksWithVariable = [
        {
          request: {
            query: queryWithVariables,
            variables: {
              first: 1,
            },
          },
          result: { data: allPeopleData },
        },
      ];

      const variables = {
        first: 1,
      };

      const Component = () => (
        <Query query={queryWithVariables} variables={variables}>
          {({ client }: any) => {
            ++count;
            try {
              expect(client).not.toBeFalsy();
              expect(client.version).not.toBeFalsy();
            } catch (error) {
              reject(error);
            }
            return null;
          }}
        </Query>
      );

      render(
        <MockedProvider mocks={mocksWithVariable}>
          <Component />
        </MockedProvider>
      );

      waitFor(() => {
        expect(count).toBe(2);
      }).then(resolve, reject);
    });

    itAsync("error", (resolve, reject) => {
      let finished = false;
      const mockError = [
        {
          request: { query: allPeopleQuery },
          error: new Error("error occurred"),
        },
      ];

      const Component = () => (
        <Query query={allPeopleQuery} data-ref={React.useRef(void 0)}>
          {(result: any) => {
            if (result.loading) {
              return null;
            }
            try {
              expect(result.error).toEqual(
                new ApolloError({ networkError: new Error("error occurred") })
              );
              finished = true;
            } catch (error) {
              reject(error);
            }
            return null;
          }}
        </Query>
      );

      render(
        <MockedProvider mocks={mockError}>
          <Component />
        </MockedProvider>
      );

      waitFor(() => {
        expect(finished).toBe(true);
      }).then(resolve, reject);
    });

    itAsync("refetch", (resolve, reject) => {
      const queryRefetch: DocumentNode = gql`
        query people($first: Int) {
          allPeople(first: $first) {
            people {
              name
            }
          }
        }
      `;

      const data1 = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
      const data2 = { allPeople: { people: [{ name: "Han Solo" }] } };
      const data3 = { allPeople: { people: [{ name: "Darth Vader" }] } };

      const refetchVariables = {
        first: 1,
      };

      const mocks = [
        {
          request: { query: queryRefetch, variables: refetchVariables },
          result: { data: data1 },
        },
        {
          request: { query: queryRefetch, variables: refetchVariables },
          result: { data: data2 },
        },
        {
          request: { query: queryRefetch, variables: { first: 2 } },
          result: { data: data3 },
        },
      ];

      let count = 0;
      let hasRefetched = false;

      const Component = () => (
        <AllPeopleQuery
          query={queryRefetch}
          variables={refetchVariables}
          notifyOnNetworkStatusChange
        >
          {(result: any) => {
            const { data, loading } = result;
            if (loading) {
              count++;
              return null;
            }

            try {
              if (count === 1) {
                // first data
                expect(data).toEqual(data1);
              }
              if (count === 3) {
                // second data
                expect(data).toEqual(data2);
              }
              if (count === 5) {
                // third data
                expect(data).toEqual(data3);
              }
            } catch (error) {
              reject(error);
            }

            count++;
            if (hasRefetched) {
              return null;
            }

            hasRefetched = true;
            setTimeout(() => {
              result
                .refetch()
                .then((result1: any) => {
                  expect(result1.data).toEqual(data2);
                  return result.refetch({ first: 2 });
                })
                .then((result2: any) => {
                  expect(result2.data).toEqual(data3);
                })
                .catch(reject);
            });

            return null;
          }}
        </AllPeopleQuery>
      );

      render(
        <MockedProvider mocks={mocks} addTypename={false}>
          <Component />
        </MockedProvider>
      );

      waitFor(() => {
        expect(count).toBe(6);
      }).then(resolve, reject);
    });

    itAsync("fetchMore", (resolve, reject) => {
      const data1 = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
      const data2 = { allPeople: { people: [{ name: "Han Solo" }] } };

      const variables = {
        first: 2,
      };

      const mocks = [
        {
          request: { query: allPeopleQuery, variables: { first: 2 } },
          result: { data: data1 },
        },
        {
          request: { query: allPeopleQuery, variables: { first: 1 } },
          result: { data: data2 },
        },
      ];

      let count = 0;

      const Component = () => (
        <AllPeopleQuery query={allPeopleQuery} variables={variables}>
          {(result: any) => {
            if (result.loading) {
              return null;
            }
            if (count === 0) {
              setTimeout(() => {
                result
                  .fetchMore({
                    variables: { first: 1 },
                    updateQuery: (prev: any, { fetchMoreResult }: any) =>
                      fetchMoreResult ?
                        {
                          allPeople: {
                            people: [
                              ...prev.allPeople.people,
                              ...fetchMoreResult.allPeople.people,
                            ],
                          },
                        }
                      : prev,
                  })
                  .then((result2: any) => {
                    expect(result2.data).toEqual(data2);
                  })
                  .catch(reject);
              });
            } else if (count === 1) {
              try {
                expect(result.data).toEqual({
                  allPeople: {
                    people: [
                      ...data1.allPeople.people,
                      ...data2.allPeople.people,
                    ],
                  },
                });
              } catch (error) {
                reject(error);
              }
            }

            count++;
            return null;
          }}
        </AllPeopleQuery>
      );

      render(
        <MockedProvider mocks={mocks} addTypename={false}>
          <Component />
        </MockedProvider>
      );

      waitFor(() => expect(count).toBe(2)).then(resolve, reject);
    });

    itAsync("startPolling", (resolve, reject) => {
      const data1 = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
      const data2 = { allPeople: { people: [{ name: "Han Solo" }] } };
      const data3 = { allPeople: { people: [{ name: "Darth Vader" }] } };

      const mocks = [
        {
          request: { query: allPeopleQuery },
          result: { data: data1 },
        },
        {
          request: { query: allPeopleQuery },
          result: { data: data2 },
        },
        {
          request: { query: allPeopleQuery },
          result: { data: data3 },
        },
      ];

      let count = 0;
      let isPolling = false;

      const POLL_INTERVAL = 5;

      let unmount: any;
      const Component = () => (
        <Query query={allPeopleQuery}>
          {(result: any) => {
            if (result.loading) {
              return null;
            }
            if (!isPolling) {
              isPolling = true;
              result.startPolling(POLL_INTERVAL);
            }

            try {
              if (count === 0) {
                expect(result.data).toEqual(data1);
              } else if (count === 1) {
                expect(result.data).toEqual(data2);
              } else if (count === 2) {
                expect(result.data).toEqual(data3);
                setTimeout(unmount);
              }
            } catch (error) {
              reject(error);
            }

            count++;
            return null;
          }}
        </Query>
      );

      unmount = render(
        <MockedProvider mocks={mocks} addTypename={false}>
          <Component />
        </MockedProvider>
      ).unmount;

      waitFor(() => expect(count).toBe(3)).then(resolve, reject);
    });

    itAsync("stopPolling", (resolve, reject) => {
      const data1 = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
      const data2 = { allPeople: { people: [{ name: "Han Solo" }] } };
      const data3 = { allPeople: { people: [{ name: "Darth Vader" }] } };

      const mocks = [
        {
          request: { query: allPeopleQuery },
          result: { data: data1 },
        },
        {
          request: { query: allPeopleQuery },
          result: { data: data2 },
        },
        {
          request: { query: allPeopleQuery },
          result: { data: data3 },
        },
      ];

      const POLL_COUNT = 2;
      const POLL_INTERVAL = 5;
      let count = 0;

      const Component = () => (
        <Query query={allPeopleQuery} pollInterval={POLL_INTERVAL}>
          {(result: any) => {
            if (result.loading) {
              return null;
            }
            if (count === 0) {
              expect(result.data).toEqual(data1);
            } else if (count === 1) {
              expect(result.data).toEqual(data2);
              result.stopPolling();
            }
            count++;
            return null;
          }}
        </Query>
      );

      render(
        <MockedProvider mocks={mocks} addTypename={false}>
          <Component />
        </MockedProvider>
      );

      waitFor(() => expect(count).toBe(POLL_COUNT)).then(resolve, reject);
    });

    itAsync("updateQuery", (resolve, reject) => {
      const data1 = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
      const data2 = { allPeople: { people: [{ name: "Han Solo" }] } };
      const variables = {
        first: 2,
      };
      const mocks = [
        {
          request: { query: allPeopleQuery, variables },
          result: { data: data1 },
        },
      ];

      let isUpdated = false;

      let count = 0;
      const Component = () => (
        <AllPeopleQuery query={allPeopleQuery} variables={variables}>
          {(result: any) => {
            if (result.loading) {
              return null;
            }

            if (isUpdated) {
              try {
                expect(result.data).toEqual(data2);
              } catch (error) {
                reject(error);
              }
              return null;
            }

            isUpdated = true;
            setTimeout(() => {
              result.updateQuery(
                (prev: any, { variables: variablesUpdate }: any) => {
                  count += 1;
                  try {
                    expect(prev).toEqual(data1);
                    expect(variablesUpdate).toEqual({ first: 2 });
                  } catch (error) {
                    reject(error);
                  }
                  return data2;
                }
              );
            });

            return null;
          }}
        </AllPeopleQuery>
      );

      render(
        <MockedProvider mocks={mocks} addTypename={false}>
          <Component />
        </MockedProvider>
      );

      waitFor(() => expect(count).toBe(1)).then(resolve, reject);
    });
  });

  describe("props allow", () => {
    it("custom fetch-policy", async () => {
      let count = 0;
      const Component = () => (
        <Query query={allPeopleQuery} fetchPolicy={"cache-only"}>
          {(result: any) => {
            if (!result.loading) {
              expect(result.networkStatus).toBe(NetworkStatus.ready);
            }
            count += 1;
            return null;
          }}
        </Query>
      );

      render(
        <MockedProvider mocks={allPeopleMocks}>
          <Component />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(count).toBe(2);
      });
    });

    it("default fetch-policy", async () => {
      let count = 0;
      const Component = () => (
        <Query query={allPeopleQuery}>
          {(result: any) => {
            if (!result.loading) {
              expect(result.networkStatus).toBe(NetworkStatus.ready);
            }
            count += 1;
            return null;
          }}
        </Query>
      );

      render(
        <MockedProvider
          defaultOptions={{ watchQuery: { fetchPolicy: "cache-only" } }}
          mocks={allPeopleMocks}
        >
          <Component />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(count).toBe(2);
      });
    });

    itAsync("notifyOnNetworkStatusChange", (resolve, reject) => {
      const data1 = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
      const data2 = { allPeople: { people: [{ name: "Han Solo" }] } };

      const mocks = [
        {
          request: { query: allPeopleQuery },
          result: { data: data1 },
        },
        {
          request: { query: allPeopleQuery },
          result: { data: data2 },
        },
      ];

      let count = 0;
      const Component = () => (
        <Query query={allPeopleQuery} notifyOnNetworkStatusChange>
          {(result: any) => {
            try {
              if (count === 0) {
                expect(result.loading).toBeTruthy();
              }
              if (count === 1) {
                expect(result.loading).toBeFalsy();
                setTimeout(() => {
                  result.refetch();
                });
              }
              if (count === 2) {
                expect(result.loading).toBeTruthy();
              }
              if (count === 3) {
                expect(result.loading).toBeFalsy();
              }

              count++;
            } catch (error) {
              reject(error);
            }
            return null;
          }}
        </Query>
      );

      render(
        <MockedProvider mocks={mocks} addTypename={false}>
          <Component />
        </MockedProvider>
      );

      waitFor(() => {
        expect(count).toBe(4);
      }).then(resolve, reject);
    });

    itAsync("pollInterval", (resolve, reject) => {
      const data1 = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
      const data2 = { allPeople: { people: [{ name: "Han Solo" }] } };
      const data3 = { allPeople: { people: [{ name: "Darth Vader" }] } };

      const mocks = [
        {
          request: { query: allPeopleQuery },
          result: { data: data1 },
        },
        {
          request: { query: allPeopleQuery },
          result: { data: data2 },
        },
        {
          request: { query: allPeopleQuery },
          result: { data: data3 },
        },
      ];

      let count = 0;
      const POLL_COUNT = 3;
      const POLL_INTERVAL = 30;

      const Component = () => (
        <Query query={allPeopleQuery} pollInterval={POLL_INTERVAL}>
          {(result: any) => {
            if (result.loading) {
              return null;
            }
            if (count === 0) {
              expect(result.data).toEqual(data1);
            } else if (count === 1) {
              expect(result.data).toEqual(data2);
            } else if (count === 2) {
              expect(result.data).toEqual(data3);
              result.stopPolling();
            }
            count++;
            return null;
          }}
        </Query>
      );

      render(
        <MockedProvider mocks={mocks} addTypename={false}>
          <Component />
        </MockedProvider>
      );

      waitFor(() => expect(count).toBe(POLL_COUNT)).then(resolve, reject);
    });

    itAsync("skip", (resolve, reject) => {
      let finished = false;
      const Component = () => (
        <Query query={allPeopleQuery} skip>
          {(result: any) => {
            try {
              expect(result.loading).toBeFalsy();
              expect(result.data).toBe(undefined);
              expect(result.error).toBe(undefined);
              finished = true;
            } catch (error) {
              reject(error);
            }
            return null;
          }}
        </Query>
      );

      render(
        <MockedProvider mocks={allPeopleMocks} addTypename={false}>
          <Component />
        </MockedProvider>
      );

      waitFor(() => {
        expect(finished).toBe(true);
      }).then(resolve, reject);
    });

    it("onCompleted with data", async () => {
      const query = gql`
        query people($first: Int) {
          allPeople(first: $first) {
            people {
              name
            }
          }
        }
      `;

      const data1 = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
      const data2 = { allPeople: { people: [{ name: "Han Solo" }] } };
      const mocks = [
        {
          request: { query, variables: { first: 1 } },
          result: { data: data1 },
        },
        {
          request: { query, variables: { first: 2 } },
          result: { data: data2 },
        },
      ];

      let count = 0;

      class Component extends React.Component {
        state = {
          variables: {
            first: 1,
          },
        };

        componentDidMount() {
          setTimeout(() => {
            this.setState({ variables: { first: 2 } });
          }, 10);
        }

        onCompleted(data: Data | {}) {
          if (count === 0) {
            expect(data).toEqual(data1);
          }
          if (count === 1) {
            expect(data).toEqual(data2);
          }
          count += 1;
        }

        render() {
          const { variables } = this.state;
          return (
            <AllPeopleQuery
              query={query}
              variables={variables}
              onCompleted={this.onCompleted}
            >
              {() => null}
            </AllPeopleQuery>
          );
        }
      }

      render(
        <MockedProvider mocks={mocks} addTypename={false}>
          <Component />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(count).toBe(2);
      });
    });

    itAsync("onError with data", (resolve, reject) => {
      let finished = false;
      const data = { allPeople: { people: [{ name: "Luke Skywalker" }] } };

      const mocks = [
        {
          request: { query: allPeopleQuery },
          result: { data: data },
        },
      ];

      const onErrorFunc = (queryError: ApolloError) => {
        expect(queryError).toEqual(null);
      };

      const onError = jest.fn();

      const Component = () => (
        <Query query={allPeopleQuery} onError={onErrorFunc}>
          {({ loading }: any) => {
            if (!loading) {
              expect(onError).not.toHaveBeenCalled();
              finished = true;
            }
            return null;
          }}
        </Query>
      );

      render(
        <MockedProvider mocks={mocks} addTypename={false}>
          <Component />
        </MockedProvider>
      );

      waitFor(() => {
        expect(finished).toBe(true);
      }).then(resolve, reject);
    });
  });

  describe("props disallow", () => {
    it("Mutation provided as query", () => {
      const mutation = gql`
        mutation submitRepository {
          submitRepository(repoFullName: "apollographql/apollo-client") {
            createdAt
          }
        }
      `;

      // Prevent error from being logged in console of test.
      const errorLogger = console.error;
      console.error = () => {};
      expect(() => {
        render(
          <MockedProvider>
            <Query query={mutation}>{() => null}</Query>
          </MockedProvider>
        );
      }).toThrowError(
        "Running a Query requires a graphql Query, but a Mutation was used " +
          "instead."
      );

      console.error = errorLogger;
    });

    it("Subscription provided as query", () => {
      const subscription = gql`
        subscription onCommentAdded($repoFullName: String!) {
          commentAdded(repoFullName: $repoFullName) {
            id
            content
          }
        }
      `;

      // Prevent error from being logged in console of test.
      const errorLogger = console.error;
      console.error = () => {};
      expect(() => {
        render(
          <MockedProvider>
            <Query query={subscription}>{() => null}</Query>
          </MockedProvider>
        );
      }).toThrowError(
        "Running a Query requires a graphql Query, but a Subscription was " +
          "used instead."
      );

      console.error = errorLogger;
    });

    itAsync("onCompleted with error", (resolve, reject) => {
      let finished = false;
      const mockError = [
        {
          request: { query: allPeopleQuery },
          error: new Error("error occurred"),
        },
      ];

      const onCompleted = jest.fn();

      const Component = () => (
        <Query query={allPeopleQuery} onCompleted={onCompleted}>
          {({ error }: any) => {
            if (error) {
              expect(onCompleted).not.toHaveBeenCalled();
              finished = true;
            }
            return null;
          }}
        </Query>
      );

      render(
        <MockedProvider mocks={mockError} addTypename={false}>
          <Component />
        </MockedProvider>
      );

      waitFor(() => {
        expect(finished).toBe(true);
      }).then(resolve, reject);
    });

    it("onError with error", async () => {
      let finished = false;
      const error = new Error("error occurred");
      const mockError = [
        {
          request: { query: allPeopleQuery },
          error: error,
        },
      ];

      const onErrorFunc = (queryError: ApolloError) => {
        expect(queryError.networkError).toEqual(error);
        finished = true;
      };

      const Component = () => (
        <Query query={allPeopleQuery} onError={onErrorFunc}>
          {() => {
            return null;
          }}
        </Query>
      );

      render(
        <MockedProvider mocks={mockError} addTypename={false}>
          <Component />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(finished).toBe(true);
      });
    });
  });

  describe("should update", () => {
    itAsync("if props change", (resolve, reject) => {
      const query = gql`
        query people($first: Int) {
          allPeople(first: $first) {
            people {
              name
            }
          }
        }
      `;

      const data1 = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
      const data2 = { allPeople: { people: [{ name: "Han Solo" }] } };
      const mocks = [
        {
          request: { query, variables: { first: 1 } },
          result: { data: data1 },
        },
        {
          request: { query, variables: { first: 2 } },
          result: { data: data2 },
        },
      ];

      let count = 0;

      class Component extends React.Component {
        state = {
          variables: {
            first: 1,
          },
        };

        render() {
          const { variables } = this.state;

          return (
            <AllPeopleQuery query={query} variables={variables}>
              {(result: any) => {
                try {
                  switch (++count) {
                    case 1:
                      expect(result.loading).toBe(true);
                      expect(result.data).toBeUndefined();
                      expect(variables).toEqual({ first: 1 });
                      break;
                    case 2:
                      expect(result.loading).toEqual(false);
                      expect(result.data).toEqual(data1);
                      expect(variables).toEqual({ first: 1 });
                      setTimeout(() => {
                        this.setState({
                          variables: {
                            first: 2,
                          },
                        });
                      });
                      break;
                    case 3:
                      expect(result.loading).toEqual(true);
                      expect(result.data).toBeUndefined();
                      expect(variables).toEqual({ first: 2 });
                      break;
                    case 4:
                      expect(result.loading).toEqual(false);
                      expect(result.data).toEqual(data2);
                      expect(variables).toEqual({ first: 2 });
                      break;
                    default:
                      reject(`Too many renders (${count})`);
                  }
                } catch (error) {
                  reject(error);
                }

                return null;
              }}
            </AllPeopleQuery>
          );
        }
      }

      render(
        <MockedProvider mocks={mocks} addTypename={false}>
          <Component />
        </MockedProvider>
      );

      waitFor(() => expect(count).toBe(4)).then(resolve, reject);
    });

    itAsync("if the query changes", (resolve, reject) => {
      const query1 = allPeopleQuery;
      const query2 = gql`
        query people {
          allPeople(first: 1) {
            people {
              id
              name
            }
          }
        }
      `;

      const data1 = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
      const data2 = { allPeople: { people: [{ name: "Han Solo", id: "1" }] } };
      const mocks = [
        {
          request: { query: query1 },
          result: { data: data1 },
        },
        {
          request: { query: query2 },
          result: { data: data2 },
        },
      ];

      let count = 0;

      class Component extends React.Component {
        state = {
          query: query1,
        };

        render() {
          const { query } = this.state;

          return (
            <Query query={query}>
              {(result: any) => {
                if (result.loading) return null;
                try {
                  switch (++count) {
                    case 1:
                      expect(query).toEqual(query1);
                      expect(result.data).toEqual(data1);
                      setTimeout(() => {
                        this.setState({ query: query2 });
                      });
                      break;
                    case 2:
                      expect(query).toEqual(query2);
                      expect(result.data).toEqual(data2);
                      break;
                    default:
                      reject(`Too many renders (${count})`);
                      break;
                  }
                } catch (error) {
                  reject(error);
                }

                return null;
              }}
            </Query>
          );
        }
      }

      render(
        <MockedProvider mocks={mocks} addTypename={false}>
          <Component />
        </MockedProvider>
      );

      waitFor(() => expect(count).toBe(2)).then(resolve, reject);
    });

    it("with data while loading", async () => {
      const query = gql`
        query people($first: Int) {
          allPeople(first: $first) {
            people {
              name
            }
          }
        }
      `;

      const data1 = {
        allPeople: {
          people: [{ name: "Luke Skywalker" }],
        },
      };
      const data2 = {
        allPeople: { people: [{ name: "Han Solo" }] },
      };
      const mocks = [
        {
          request: { query, variables: { first: 1 } },
          result: { data: data1 },
        },
        {
          request: { query, variables: { first: 2 } },
          result: { data: data2 },
        },
      ];

      let count = 0;

      class Component extends React.Component {
        state = {
          variables: {
            first: 1,
          },
        };

        render() {
          const { variables } = this.state;

          return (
            <AllPeopleQuery query={query} variables={variables}>
              {(result: any) => {
                try {
                  switch (++count) {
                    case 1:
                      expect(result.loading).toBe(true);
                      expect(result.data).toBeUndefined();
                      expect(result.networkStatus).toBe(NetworkStatus.loading);
                      break;
                    case 2:
                      expect(result.loading).toBe(false);
                      expect(result.data).toEqual(data1);
                      expect(result.networkStatus).toBe(NetworkStatus.ready);
                      setTimeout(() => {
                        this.setState({ variables: { first: 2 } });
                      });
                      break;
                    case 3:
                      expect(result.loading).toBe(true);
                      expect(result.data).toBeUndefined();
                      expect(result.networkStatus).toBe(
                        NetworkStatus.setVariables
                      );
                      break;
                    case 4:
                      expect(result.loading).toBe(false);
                      expect(result.data).toEqual(data2);
                      expect(result.networkStatus).toBe(NetworkStatus.ready);
                      break;
                  }
                } catch (err) {
                  fail(err);
                }
                return null;
              }}
            </AllPeopleQuery>
          );
        }
      }

      render(
        <MockedProvider mocks={mocks} addTypename={false}>
          <Component />
        </MockedProvider>
      );
    });

    itAsync(
      "should update if a manual `refetch` is triggered after a state change",
      (resolve, reject) => {
        const query: DocumentNode = gql`
          query {
            allPeople {
              people {
                name
              }
            }
          }
        `;

        const data1 = { allPeople: { people: [{ name: "Luke Skywalker" }] } };

        const link = mockSingleLink(
          {
            request: { query },
            result: { data: data1 },
          },
          {
            request: { query },
            result: { data: data1 },
          },
          {
            request: { query },
            result: { data: data1 },
          }
        );

        const client = new ApolloClient({
          link,
          cache: new InMemoryCache({ addTypename: false }),
        });

        let count = 0;

        class SomeComponent extends React.Component {
          constructor(props: any) {
            super(props);
            this.state = {
              open: false,
            };
            this.toggle = this.toggle.bind(this);
          }

          toggle() {
            this.setState((prevState: any) => ({
              open: !prevState.open,
            }));
          }

          render() {
            const { open } = this.state as any;
            return (
              <Query client={client} query={query} notifyOnNetworkStatusChange>
                {(props: any) => {
                  try {
                    switch (count) {
                      case 0:
                        // Loading first response
                        expect(props.loading).toBe(true);
                        expect(open).toBe(false);
                        break;
                      case 1:
                        // First response loaded, change state value
                        expect(props.data).toEqual(data1);
                        expect(open).toBe(false);
                        setTimeout(() => {
                          this.toggle();
                        });
                        break;
                      case 2:
                        // State value changed, fire a refetch
                        expect(open).toBe(true);
                        setTimeout(() => {
                          props.refetch();
                        });
                        break;
                      case 3:
                        // Second response loading
                        expect(props.loading).toBe(true);
                        break;
                      case 4:
                        // Second response received, fire another refetch
                        expect(props.data).toEqual(data1);
                        setTimeout(() => {
                          props.refetch();
                        });
                        break;
                      case 5:
                        // Third response loading
                        expect(props.loading).toBe(true);
                        break;
                      case 6:
                        // Third response received
                        expect(props.data).toEqual(data1);
                        break;
                      default:
                        reject("Unknown count");
                    }
                    count += 1;
                  } catch (error) {
                    reject(error);
                  }
                  return null;
                }}
              </Query>
            );
          }
        }

        render(<SomeComponent />);

        waitFor(() => {
          expect(count).toBe(7);
        }).then(resolve, reject);
      }
    );
  });

  it("should error if the query changes type to a subscription", async () => {
    let finished = false;
    const subscription = gql`
      subscription onCommentAdded($repoFullName: String!) {
        commentAdded(repoFullName: $repoFullName) {
          id
          content
        }
      }
    `;

    // Prevent error from showing up in console.
    const errorLog = console.error;
    console.error = () => {};

    class Component extends React.Component {
      state = { query: allPeopleQuery };

      componentDidCatch(error: any) {
        const expectedError = new Error(
          "Running a Query requires a graphql Query, but a Subscription was " +
            "used instead."
        );
        expect(error).toEqual(expectedError);
        finished = true;
      }

      componentDidMount() {
        setTimeout(() => {
          this.setState({
            query: subscription,
          });
        });
      }

      render() {
        const { query } = this.state;
        return <Query query={query}>{() => null}</Query>;
      }
    }

    render(
      <MockedProvider mocks={allPeopleMocks} addTypename={false}>
        <Component />
      </MockedProvider>
    );

    await waitFor(
      () => {
        expect(finished).toBe(true);
      },
      { interval: 1 }
    );
    console.error = errorLog;
  });

  it("should be able to refetch after there was a network error", async () => {
    const query: DocumentNode = gql`
      query somethingelse {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;

    const data = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
    const dataTwo = { allPeople: { people: [{ name: "Princess Leia" }] } };
    const link = mockSingleLink(
      { request: { query }, result: { data } },
      { request: { query }, error: new Error("This is an error!") },
      { request: { query }, result: { data: dataTwo }, delay: 10 }
    );
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({ addTypename: false }),
    });

    const noop = () => null;

    const AllPeopleQuery2 = Query;

    function Container() {
      return (
        <AllPeopleQuery2 query={query} notifyOnNetworkStatusChange={true}>
          {(r: any) => {
            replaceSnapshot(r);
            return null;
          }}
        </AllPeopleQuery2>
      );
    }

    using _disabledAct = disableActEnvironment();
    const { takeRender, replaceSnapshot, render } =
      createRenderStream<QueryResult>();
    await render(
      <ApolloProvider client={client}>
        <Container />
      </ApolloProvider>
    );

    {
      const { snapshot } = await takeRender();
      expect(snapshot.loading).toBe(true);
    }

    {
      const { snapshot } = await takeRender();
      expect(snapshot.loading).toBe(false);
      expect(snapshot.data.allPeople).toEqual(data.allPeople);
      // First result is loaded, run a refetch to get the second result
      // which is an error.
      snapshot.refetch().then(() => {
        fail("Expected error value on first refetch.");
      }, noop);
    }

    {
      const { snapshot } = await takeRender();
      // Waiting for the second result to load
      expect(snapshot.loading).toBe(true);
    }

    {
      const { snapshot } = await takeRender();
      expect(snapshot.loading).toBe(false);
      expect(snapshot.error).toBeTruthy();
      // The error arrived, run a refetch to get the third result
      // which should now contain valid data.
      snapshot.refetch().catch(() => {
        fail("Expected good data on second refetch.");
      });
    }

    {
      const { snapshot } = await takeRender();
      expect(snapshot.loading).toBe(true);
      expect(snapshot.error).toBeFalsy();
    }

    {
      const { snapshot } = await takeRender();
      expect(snapshot.loading).toBe(false);
      expect(snapshot.error).toBeFalsy();
      expect(snapshot.data.allPeople).toEqual(dataTwo.allPeople);
    }
  });

  itAsync(
    "should not persist previous result errors when a subsequent valid result is received",
    (resolve, reject) => {
      const query: DocumentNode = gql`
        query somethingelse($variable: Boolean) {
          allPeople(first: 1, yetisArePeople: $variable) {
            people {
              name
            }
          }
        }
      `;

      const data = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
      const variableGood = { variable: true };
      const variableBad = { variable: false };

      const link = mockSingleLink(
        {
          request: {
            query,
            variables: variableGood,
          },
          result: {
            data,
          },
        },
        {
          request: {
            query,
            variables: variableBad,
          },
          result: {
            errors: [new Error("This is an error!")],
          },
        },
        {
          request: {
            query,
            variables: variableGood,
          },
          result: {
            data,
          },
        }
      );

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({ addTypename: false }),
      });

      let count = 0;
      const DummyComp = (props: any) => {
        try {
          switch (count++) {
            case 0:
              expect(props.loading).toBeTruthy();
              break;
            case 1:
              expect(props.data.allPeople).toBeTruthy();
              expect(props.error).toBeFalsy();
              // Change query variables to trigger bad result.
              setTimeout(() => {
                render(
                  <Query client={client} query={query} variables={variableBad}>
                    {(result: any) => {
                      return <DummyComp id="dummyId" {...result} />;
                    }}
                  </Query>
                );
              });
              break;
            case 2:
              expect(props.loading).toBeTruthy();
              break;
            case 3:
              // Error should be received.
              expect(props.error).toBeTruthy();
              // Change query variables to trigger a good result.
              setTimeout(() => {
                render(
                  <Query client={client} query={query} variables={variableGood}>
                    {(result: any) => {
                      return <DummyComp id="dummyId" {...result} />;
                    }}
                  </Query>
                );
              });
              break;
            case 4:
              // Good result should be received without any errors.
              expect(props.error).toBeFalsy();
              expect(props.data.allPeople).toBeTruthy();
              break;
            default:
              reject("Unknown count");
          }
        } catch (error) {
          reject(error);
        }
        return null;
      };

      render(
        <Query client={client} query={query} variables={variableGood}>
          {(result: any) => {
            return <DummyComp id="dummyId" {...result} />;
          }}
        </Query>
      );

      waitFor(() => expect(count).toBe(5)).then(resolve, reject);
    }
  );

  it("should support mixing setState and onCompleted", async () => {
    const query = gql`
      query people($first: Int) {
        allPeople(first: $first) {
          people {
            name
          }
        }
      }
    `;

    const data1 = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
    const data2 = { allPeople: { people: [{ name: "Han Solo" }] } };
    const mocks = [
      {
        request: { query, variables: { first: 1 } },
        result: { data: data1 },
      },
      {
        request: { query, variables: { first: 2 } },
        result: { data: data2 },
      },
    ];

    let renderCount = 0;
    let onCompletedCallCount = 0;
    class Component extends React.Component {
      state = {
        variables: {
          first: 1,
        },
      };

      componentDidMount() {
        setTimeout(() => {
          this.setState({ variables: { first: 2 } });
        }, 10);
      }

      onCompleted() {
        onCompletedCallCount += 1;
      }

      render() {
        const { variables } = this.state;
        return (
          <AllPeopleQuery
            query={query}
            variables={variables}
            onCompleted={this.onCompleted}
          >
            {({ loading, data }: any) => {
              switch (++renderCount) {
                case 1:
                  expect(loading).toBe(true);
                  expect(data).toBeUndefined();
                  break;
                case 2:
                  expect(loading).toBe(false);
                  expect(data).toEqual(data1);
                  break;
                case 3:
                  expect(loading).toBe(true);
                  expect(data).toBeUndefined();
                  break;
                case 4:
                  expect(loading).toBe(false);
                  expect(data).toEqual(data2);
                  setTimeout(() => {
                    this.setState({ variables: { first: 1 } });
                  });
                  break;
                case 5:
                  expect(loading).toBe(false);
                  expect(data).toEqual(data1);
                  break;
                default:
                  console.error(`Too many renders (${renderCount})`);
              }
              return null;
            }}
          </AllPeopleQuery>
        );
      }
    }

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <Component />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(renderCount).toBe(5);
    });
    await waitFor(() => {
      expect(onCompletedCallCount).toBe(3);
    });
  });

  itAsync(
    "should not repeatedly call onError if setState in it",
    (resolve, reject) => {
      const mockError = [
        {
          request: { query: allPeopleQuery, variables: { first: 1 } },
          error: new Error("error occurred"),
        },
      ];

      let unmount: any;
      let onErrorCallCount = 0;
      class Component extends React.Component {
        state = {
          variables: {
            first: 1,
          },
        };
        onError = () => {
          onErrorCallCount += 1;
          this.setState({ causeUpdate: true });
        };
        render() {
          return (
            <Query
              query={allPeopleQuery}
              variables={this.state.variables}
              onError={this.onError}
            >
              {({ loading }: any) => {
                if (!loading) {
                  setTimeout(unmount);
                }
                return null;
              }}
            </Query>
          );
        }
      }

      unmount = render(
        <MockedProvider mocks={mockError} addTypename={false}>
          <Component />
        </MockedProvider>
      ).unmount;

      waitFor(() => {
        expect(onErrorCallCount).toBe(1);
      }).then(resolve, reject);
    }
  );

  describe("Partial refetching", () => {
    let errorSpy!: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
      errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterAll(() => {
      errorSpy.mockRestore();
    });

    // TODO(brian): This is a terrible legacy test which is causing console
    // error calls no matter what I try and I do not want to care about it
    // anymore :)
    itAsync.skip(
      "should attempt a refetch when the query result was marked as being " +
        "partial, the returned data was reset to an empty Object by the " +
        "Apollo Client QueryManager (due to a cache miss), and the " +
        "`partialRefetch` prop is `true`",
      (resolve, reject) => {
        const allPeopleQuery: DocumentNode = gql`
          query people {
            allPeople(first: 1) {
              people {
                name
              }
            }
          }
        `;

        let count = 0;
        const allPeopleData = {
          allPeople: { people: [{ name: "Luke Skywalker" }] },
        };
        const query = allPeopleQuery;
        const link = mockSingleLink(
          { request: { query }, result: { data: {} } },
          { request: { query }, result: { data: allPeopleData } }
        );

        const client = new ApolloClient({
          link,
          cache: new InMemoryCache(),
        });

        const Component = () => (
          <Query query={query} partialRefetch>
            {(result: any) => {
              count += 1;
              const { data, loading } = result;
              try {
                if (!loading) {
                  expect(data).toEqual(allPeopleData);
                  expect(errorSpy).toHaveBeenCalledTimes(1);
                  expect(errorSpy.mock.calls[0][0]).toMatch("Missing field");
                }
              } catch (err) {
                reject(err);
              }
              return null;
            }}
          </Query>
        );

        render(
          <ApolloProvider client={client}>
            <Component />
          </ApolloProvider>
        );

        waitFor(() => {
          expect(count).toBe(3);
        }).then(resolve, reject);
      }
    );

    itAsync.skip(
      "should not refetch when an empty partial is returned if the " +
        "`partialRefetch` prop is false/not set",
      (resolve, reject) => {
        let finished = false;
        const query = allPeopleQuery;
        const link = mockSingleLink({
          request: { query },
          result: { data: {} },
        });

        const client = new ApolloClient({
          link,
          cache: new InMemoryCache({ addTypename: false }),
        });

        const Component = () => (
          <Query query={allPeopleQuery}>
            {(result: any) => {
              const { data } = result;
              expect(data).toBe(undefined);
              finished = true;
              return null;
            }}
          </Query>
        );

        render(
          <ApolloProvider client={client}>
            <Component />
          </ApolloProvider>
        );

        waitFor(() => {
          expect(finished).toBe(true);
        }).then(resolve, reject);
      }
    );
  });

  itAsync(
    "should keep data for a `Query` component using `no-cache` when the " +
      "tree is re-rendered",
    (resolve, reject) => {
      const query1 = allPeopleQuery;

      const query2: DocumentNode = gql`
        query Things {
          allThings {
            thing {
              description
            }
          }
        }
      `;

      interface ThingData {
        allThings: {
          thing: Array<{ description: string }>;
        };
      }

      const allThingsData: ThingData = {
        allThings: {
          thing: [{ description: "Thing 1" }, { description: "Thing 2" }],
        },
      };

      const link = mockSingleLink(
        { request: { query: query1 }, result: { data: allPeopleData } },
        { request: { query: query2 }, result: { data: allThingsData } },
        { request: { query: query1 }, result: { data: allPeopleData } }
      );

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({ addTypename: false }),
      });

      let expectCount = 0;

      const People = () => {
        let renderCount = 0;
        return (
          <Query query={query1} fetchPolicy="no-cache">
            {({ data, loading }: any) => {
              if (renderCount > 0 && !loading) {
                expect(data).toEqual(allPeopleData);
                expectCount += 1;
              }
              renderCount += 1;
              return null;
            }}
          </Query>
        );
      };

      const Things = () => (
        <Query query={query2}>
          {({ data, loading }: any) => {
            if (!loading) {
              expect(data).toEqual(allThingsData);
              expectCount += 1;
            }
            return null;
          }}
        </Query>
      );

      const App = () => (
        <ApolloProvider client={client}>
          <People />
          <Things />
        </ApolloProvider>
      );

      render(<App />);

      waitFor(() => expect(expectCount).toBe(2)).then(resolve, reject);
    }
  );

  describe("Return partial data", () => {
    const origConsoleWarn = console.warn;

    beforeAll(() => {
      console.warn = () => null;
    });

    afterAll(() => {
      console.warn = origConsoleWarn;
    });

    it("should not return partial cache data when `returnPartialData` is false", async () => {
      let finished = false;
      const cache = new InMemoryCache();
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

      const App = () => (
        <ApolloProvider client={client}>
          <Query query={partialQuery}>
            {({ data }: any) => {
              expect(data).toBeUndefined();
              finished = true;
              return null;
            }}
          </Query>
        </ApolloProvider>
      );

      render(<App />);

      await waitFor(() => {
        expect(finished).toBe(true);
      });
    });

    it("should return partial cache data when `returnPartialData` is true", async () => {
      let finished = false;
      const cache = new InMemoryCache();
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

      const App = () => (
        <ApolloProvider client={client}>
          <Query query={partialQuery} returnPartialData>
            {({ data }: any) => {
              expect(data).toEqual({
                cars: [
                  {
                    __typename: "Car",
                    repairs: [
                      {
                        __typename: "Repair",
                        date: "2019-05-08",
                      },
                    ],
                  },
                ],
              });
              finished = true;
              return null;
            }}
          </Query>
        </ApolloProvider>
      );

      render(<App />);

      await waitFor(() => {
        expect(finished).toBe(true);
      });
    });
  });
});
