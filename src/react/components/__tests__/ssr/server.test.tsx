/** @jest-environment node */
import React from "react";
import {
  print,
  graphql as execute,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLList,
  GraphQLString,
  GraphQLID,
} from "graphql";
import gql from "graphql-tag";

import { ApolloClient } from "../../../../core";
import { InMemoryCache as Cache } from "../../../../cache";
import { ApolloProvider } from "../../../context";
import { ApolloLink } from "../../../../link/core";
import { Observable } from "../../../../utilities";
import { renderToStringWithData } from "../../../ssr";
import { Query } from "../../Query";

const planetMap = new Map([["Planet:1", { id: "Planet:1", name: "Tatooine" }]]);

const shipMap = new Map([
  [
    "Ship:2",
    {
      id: "Ship:2",
      name: "CR90 corvette",
      films: ["Film:4", "Film:6", "Film:3"],
    },
  ],
  [
    "Ship:3",
    {
      id: "Ship:3",
      name: "Star Destroyer",
      films: ["Film:4", "Film:5", "Film:6"],
    },
  ],
]);

const filmMap = new Map([
  ["Film:3", { id: "Film:3", title: "Revenge of the Sith" }],
  ["Film:4", { id: "Film:4", title: "A New Hope" }],
  ["Film:5", { id: "Film:5", title: "the Empire Strikes Back" }],
  ["Film:6", { id: "Film:6", title: "Return of the Jedi" }],
]);

const PlanetType = new GraphQLObjectType({
  name: "Planet",
  fields: {
    id: { type: GraphQLID },
    name: { type: GraphQLString },
  },
});

const FilmType = new GraphQLObjectType({
  name: "Film",
  fields: {
    id: { type: GraphQLID },
    title: { type: GraphQLString },
  },
});

const ShipType = new GraphQLObjectType({
  name: "Ship",
  fields: {
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    films: {
      type: new GraphQLList(FilmType),
      resolve: ({ films }) => films.map((id: string) => filmMap.get(id)),
    },
  },
});

const QueryType = new GraphQLObjectType({
  name: "Query",
  fields: {
    allPlanets: {
      type: new GraphQLList(PlanetType),
      resolve: () => Array.from(planetMap.values()),
    },
    allShips: {
      type: new GraphQLList(ShipType),
      resolve: () => Array.from(shipMap.values()),
    },
    ship: {
      type: ShipType,
      args: { id: { type: GraphQLID } },
      resolve: (_, { id }) => shipMap.get(id),
    },
    film: {
      type: FilmType,
      args: { id: { type: GraphQLID } },
      resolve: (_, { id }) => filmMap.get(id),
    },
  },
});

const Schema = new GraphQLSchema({ query: QueryType });

describe("SSR", () => {
  it("should work with React.createContext", async () => {
    let defaultValue = "default";
    let Context = React.createContext(defaultValue);
    let providerValue = "provider";
    expect(
      await renderToStringWithData(
        <React.Fragment>
          <Context.Provider value={providerValue} />
          <Context.Consumer>
            {(val) => {
              expect(val).toBe(defaultValue);
              return val;
            }}
          </Context.Consumer>
        </React.Fragment>
      )
    ).toBe(defaultValue);
    expect(
      await renderToStringWithData(
        <Context.Provider value={providerValue}>
          <Context.Consumer>
            {(val) => {
              expect(val).toBe(providerValue);
              return val;
            }}
          </Context.Consumer>
        </Context.Provider>
      )
    ).toBe(providerValue);
    expect(
      await renderToStringWithData(
        <Context.Consumer>
          {(val) => {
            expect(val).toBe(defaultValue);
            return val;
          }}
        </Context.Consumer>
      )
    ).toBe(defaultValue);
    let ContextForUndefined = React.createContext<void | string>(defaultValue);

    expect(
      await renderToStringWithData(
        <ContextForUndefined.Provider value={undefined}>
          <ContextForUndefined.Consumer>
            {(val) => {
              expect(val).toBeUndefined();
              return val === undefined ? "works" : "broken";
            }}
          </ContextForUndefined.Consumer>
        </ContextForUndefined.Provider>
      )
    ).toBe("works");

    const apolloClient = new ApolloClient({
      link: new ApolloLink((config) => {
        return new Observable((observer) => {
          execute({
            schema: Schema,
            source: print(config.query),
            variableValues: config.variables,
            operationName: config.operationName,
          })
            .then((result) => {
              observer.next(result);
              observer.complete();
            })
            .catch((e) => {
              observer.error(e);
            });
        });
      }),
      cache: new Cache(),
    });

    expect(
      await renderToStringWithData(
        <ApolloProvider client={apolloClient}>
          <Context.Provider value={providerValue}>
            <Query
              query={gql`
                query ShipIds {
                  allShips {
                    id
                  }
                }
              `}
            >
              {() => (
                <Context.Consumer>
                  {(val) => {
                    expect(val).toBe(providerValue);
                    return val;
                  }}
                </Context.Consumer>
              )}
            </Query>
          </Context.Provider>
        </ApolloProvider>
      )
    ).toBe(providerValue);
  });
});
