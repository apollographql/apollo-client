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
  DocumentNode,
} from "graphql";
import gql from "graphql-tag";

import { ApolloClient } from "../../../../core";
import { ApolloProvider } from "../../../context";
import { InMemoryCache as Cache } from "../../../../cache";
import { ApolloLink } from "../../../../link/core";
import { Observable } from "../../../../utilities";
import { renderToStringWithData } from "../../../ssr";
import { graphql } from "../../graphql";
import { ChildProps } from "../../types";

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
  describe("`renderToStringWithData`", () => {
    // XXX break into smaller tests
    // XXX mock all queries
    it("should work on a non trivial example", function () {
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

      @graphql(
        gql`
          query data($id: ID!) {
            film(id: $id) {
              title
            }
          }
        ` as DocumentNode
      )
      class Film extends React.Component<any, any> {
        render(): React.ReactNode {
          const { data } = this.props;
          if (data.loading) return null;
          const { film } = data;
          return <h6>{film.title}</h6>;
        }
      }

      interface ShipData {
        ship: {
          name: string;
          films: { id: string }[];
        };
      }

      interface ShipVariables {
        id: string;
      }

      @graphql<ShipVariables, ShipData, ShipVariables>(
        gql`
          query data($id: ID!) {
            ship(id: $id) {
              name
              films {
                id
              }
            }
          }
        ` as DocumentNode
      )
      class Starship extends React.Component<
        ChildProps<ShipVariables, ShipData, ShipVariables>
      > {
        render(): React.ReactNode {
          const { data } = this.props;
          if (!data || data.loading || !data.ship) return null;
          const { ship } = data;
          return (
            <div>
              <h4>{ship.name} appeared in the following films:</h4>
              <br />
              <ul>
                {ship.films.map((film: any, key: any) => (
                  <li key={key}>
                    <Film id={film.id} />
                  </li>
                ))}
              </ul>
            </div>
          );
        }
      }

      interface AllShipsData {
        allShips: { id: string }[];
      }

      @graphql<{}, AllShipsData>(
        gql`
          query data {
            allShips {
              id
            }
          }
        ` as DocumentNode
      )
      class AllShips extends React.Component<ChildProps<{}, AllShipsData>> {
        render(): React.ReactNode {
          const { data } = this.props;
          return (
            <ul>
              {data &&
                !data.loading &&
                data.allShips &&
                data.allShips.map((ship: any, key: any) => (
                  <li key={key}>
                    <Starship id={ship.id} />
                  </li>
                ))}
            </ul>
          );
        }
      }

      interface AllPlanetsData {
        allPlanets: { name: string }[];
      }

      @graphql<{}, AllPlanetsData>(
        gql`
          query data {
            allPlanets {
              name
            }
          }
        ` as DocumentNode
      )
      class AllPlanets extends React.Component<ChildProps<{}, AllPlanetsData>> {
        render(): React.ReactNode {
          const { data } = this.props;
          if (!data || data.loading) return null;
          return (
            <div>
              <h1>Planets</h1>
              {(data.allPlanets || []).map((planet: any, key: any) => (
                <div key={key}>{planet.name}</div>
              ))}
            </div>
          );
        }
      }

      const Bar = () => (
        <div>
          <h2>Bar</h2>
          <AllPlanets />
        </div>
      );
      const Foo = () => (
        <div>
          <h1>Foo</h1>
          <Bar />
        </div>
      );

      const app = (
        <ApolloProvider client={apolloClient}>
          <div>
            <Foo />
            <hr />
            <AllShips />
          </div>
        </ApolloProvider>
      );

      return renderToStringWithData(app).then((markup) => {
        expect(markup).toMatch(/CR90 corvette/);
        expect(markup).toMatch(/Return of the Jedi/);
        expect(markup).toMatch(/A New Hope/);
        expect(markup).toMatch(/Planets/);
        expect(markup).toMatch(/Tatooine/);
      });
    });
  });
});
