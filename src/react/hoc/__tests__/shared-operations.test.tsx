import React from "react";
import { render } from "@testing-library/react";
import gql from "graphql-tag";
import { DocumentNode } from "graphql";

import { ApolloClient } from "../../../core";
import { ApolloProvider } from "../../context";
import { InMemoryCache as Cache } from "../../../cache";
import { ApolloLink } from "../../../link/core";
import { itAsync, mockSingleLink } from "../../../testing";
import { graphql } from "../graphql";
import { ChildProps, DataValue } from "../types";
import { withApollo } from "../withApollo";

function compose(...funcs: Function[]) {
  const functions = funcs.reverse();
  return function (...args: any[]) {
    const [firstFunction, ...restFunctions] = functions;
    let result = firstFunction.apply(null, args);
    restFunctions.forEach((fnc) => {
      result = fnc.call(null, result);
    });
    return result;
  };
}

describe("shared operations", () => {
  describe("withApollo", () => {
    it("passes apollo-client to props", () => {
      const client = new ApolloClient({
        link: new ApolloLink((o, f) => (f ? f(o) : null)),
        cache: new Cache(),
      });

      @withApollo
      class ContainerWithData extends React.Component<any> {
        render(): React.ReactNode {
          expect(this.props.client).toEqual(client);
          return null;
        }
      }

      render(
        <ApolloProvider client={client}>
          <ContainerWithData />
        </ApolloProvider>
      );
    });
  });

  it("binds two queries to props", () => {
    const peopleQuery: DocumentNode = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;
    const peopleData = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
    interface PeopleData {
      allPeople: { people: [{ name: string }] };
    }

    const shipsQuery: DocumentNode = gql`
      query ships {
        allships(first: 1) {
          ships {
            name
          }
        }
      }
    `;
    const shipsData = { allships: { ships: [{ name: "Tie Fighter" }] } };
    interface ShipsData {
      allShips: { ships: [{ name: string }] };
    }

    const link = mockSingleLink(
      { request: { query: peopleQuery }, result: { data: peopleData } },
      { request: { query: shipsQuery }, result: { data: shipsData } }
    );
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    interface PeopleChildProps {
      people: DataValue<PeopleData>;
    }

    // Since we want to test decorators usage, and this does not play well with TypeScript,
    // we resort to setting everything as any to avoid type checking.
    const withPeople: any = graphql<{}, PeopleData, {}, PeopleChildProps>(
      peopleQuery,
      {
        name: "people",
      }
    );

    interface ShipsChildProps {
      ships: DataValue<PeopleData>;
    }
    const withShips: any = graphql<{}, ShipsData, {}, ShipsChildProps>(
      shipsQuery,
      {
        name: "ships",
      }
    );

    @withPeople
    @withShips
    class ContainerWithData extends React.Component<any> {
      render() {
        const { people, ships } = this.props;
        expect(people).toBeTruthy();
        expect(people.loading).toBeTruthy();

        expect(ships).toBeTruthy();
        expect(ships.loading).toBeTruthy();
        return null;
      }
    }

    const { unmount } = render(
      <ApolloProvider client={client}>
        <ContainerWithData />
      </ApolloProvider>
    );
    // unmount here or else the query will resolve later and schedule an update that's not wrapped in act.
    unmount();
  });

  it("binds two queries to props with different syntax", () => {
    const peopleQuery: DocumentNode = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;
    const peopleData = { allPeople: { people: [{ name: "Luke Skywalker" }] } };
    interface PeopleData {
      allPeople: { people: [{ name: string }] };
    }
    const shipsQuery: DocumentNode = gql`
      query ships {
        allships(first: 1) {
          ships {
            name
          }
        }
      }
    `;
    const shipsData = { allships: { ships: [{ name: "Tie Fighter" }] } };
    interface ShipsData {
      allShips: { ships: [{ name: string }] };
    }

    const link = mockSingleLink(
      { request: { query: peopleQuery }, result: { data: peopleData } },
      { request: { query: shipsQuery }, result: { data: shipsData } }
    );
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    interface PeopleChildProps {
      people: DataValue<PeopleData>;
    }

    const withPeople = graphql<{}, PeopleData, {}, PeopleChildProps>(
      peopleQuery,
      {
        name: "people",
      }
    );

    interface ShipsAndPeopleChildProps extends PeopleChildProps {
      ships: DataValue<PeopleData>;
    }
    const withShips = graphql<
      PeopleChildProps,
      ShipsData,
      {},
      ShipsAndPeopleChildProps
    >(shipsQuery, {
      name: "ships",
    });

    const ContainerWithData = withPeople(
      withShips((props: ShipsAndPeopleChildProps) => {
        const { people, ships } = props;
        expect(people).toBeTruthy();
        expect(people.loading).toBeTruthy();

        expect(ships).toBeTruthy();
        expect(ships.loading).toBeTruthy();
        return null;
      })
    );

    const { unmount } = render(
      <ApolloProvider client={client}>
        <ContainerWithData />
      </ApolloProvider>
    );

    // unmount here or else the query will resolve later and schedule an update that's not wrapped in act.
    unmount();
  });

  it("binds two operations to props", () => {
    const peopleQuery: DocumentNode = gql`
      query people {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;
    const peopleData = { allPeople: { people: [{ name: "Luke Skywalker" }] } };

    const peopleMutation: DocumentNode = gql`
      mutation addPerson {
        allPeople(first: 1) {
          people {
            name
          }
        }
      }
    `;
    const peopleMutationData = {
      allPeople: { people: [{ name: "Leia Skywalker" }] },
    };

    const link = mockSingleLink(
      { request: { query: peopleQuery }, result: { data: peopleData } },
      {
        request: { query: peopleMutation },
        result: { data: peopleMutationData },
      }
    );
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const withPeople = graphql(peopleQuery, { name: "people" });
    const withPeopleMutation = graphql(peopleMutation, { name: "addPerson" });

    const ContainerWithData = withPeople(
      withPeopleMutation(
        class extends React.Component<any> {
          render() {
            const { people, addPerson } = this.props;
            expect(people).toBeTruthy();
            expect(people.loading).toBeTruthy();

            expect(addPerson).toBeTruthy();
            return null;
          }
        }
      )
    );

    const { unmount } = render(
      <ApolloProvider client={client}>
        <ContainerWithData />
      </ApolloProvider>
    );

    // unmount here or else the query will resolve later and schedule an update that's not wrapped in act.
    unmount();
  });

  itAsync("allows options to take an object", (resolve, reject) => {
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

    let queryExecuted = false;
    const Container = graphql<{}, Data>(query, { skip: true })(
      class extends React.Component<ChildProps<{}, Data>> {
        componentDidUpdate() {
          queryExecuted = true;
        }
        render() {
          expect(this.props.data).toBeUndefined();
          return null;
        }
      }
    );

    render(
      <ApolloProvider client={client}>
        <Container />
      </ApolloProvider>
    );

    setTimeout(() => {
      if (!queryExecuted) {
        resolve();
        return;
      }
      reject(new Error("query ran even though skip present"));
    }, 25);
  });

  describe("compose", () => {
    it("binds two queries to props with different syntax", () => {
      const peopleQuery: DocumentNode = gql`
        query people {
          allPeople(first: 1) {
            people {
              name
            }
          }
        }
      `;
      const peopleData = {
        allPeople: { people: [{ name: "Luke Skywalker" }] },
      };

      type PeopleData = typeof peopleData;

      const shipsQuery: DocumentNode = gql`
        query ships {
          allships(first: 1) {
            ships {
              name
            }
          }
        }
      `;
      const shipsData = { allships: { ships: [{ name: "Tie Fighter" }] } };

      type ShipsData = typeof shipsData;

      const link = mockSingleLink(
        { request: { query: peopleQuery }, result: { data: peopleData } },
        { request: { query: shipsQuery }, result: { data: shipsData } }
      );
      const client = new ApolloClient({
        link,
        cache: new Cache({ addTypename: false }),
      });

      interface PeopleChildProps {
        people: DataValue<PeopleData>;
      }

      interface ShipsAndPeopleChildProps {
        people: DataValue<PeopleData>;
        ships: DataValue<PeopleData>;
      }

      const enhanced = compose(
        graphql<{}, PeopleData, {}, PeopleChildProps>(peopleQuery, {
          name: "people",
        }),
        graphql<PeopleChildProps, ShipsData, {}, ShipsAndPeopleChildProps>(
          shipsQuery,
          {
            name: "ships",
          }
        )
      );

      const ContainerWithData = enhanced((props: ShipsAndPeopleChildProps) => {
        const { people, ships } = props;
        expect(people).toBeTruthy();
        expect(people.loading).toBeTruthy();

        expect(ships).toBeTruthy();
        expect(ships.loading).toBeTruthy();
        return null;
      });

      const { unmount } = render(
        <ApolloProvider client={client}>
          <ContainerWithData />
        </ApolloProvider>
      );

      // unmount here or else the query will resolve later and schedule an update that's not wrapped in act.
      unmount();
    });
  });
});
