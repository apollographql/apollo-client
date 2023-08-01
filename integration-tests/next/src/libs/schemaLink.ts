import { makeExecutableSchema } from "@graphql-tools/schema";
import { gql } from "graphql-tag";
import { SchemaLink } from "@apollo/client/link/schema";

const typeDefs = gql`
  type Product {
    id: String!
    title: String!
  }
  type Query {
    products: [Product!]!
  }
`;

const resolvers = {
  Query: {
    products: async () => [
      {
        id: "product:5",
        title: "Soft Warm Apollo Beanie",
      },
      {
        id: "product:2",
        title: "Stainless Steel Water Bottle",
      },
      {
        id: "product:3",
        title: "Athletic Baseball Cap",
      },
      {
        id: "product:4",
        title: "Baby Onesies",
      },
      {
        id: "product:1",
        title: "The Apollo T-Shirt",
      },
      {
        id: "product:6",
        title: "The Apollo Socks",
      },
    ],
  },
};

export const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

export const schemaLink = new SchemaLink({ schema });
