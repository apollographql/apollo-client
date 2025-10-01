import { makeExecutableSchema } from "@graphql-tools/schema";
import { print } from "graphql";
import { tap } from "rxjs";

import { ApolloClient, ApolloLink, gql, InMemoryCache } from "@apollo/client";
import { identifyResolvedFragments } from "@apollo/client/experimental/identifyResolvedFragments";
import { SchemaLink } from "@apollo/client/link/schema";

const typeDefs = gql`
    interface Pet {
      id: ID!
      name: String!
      vaccinated: Boolean!
      owner: Owner
    }
    type Dog implements Pet {
      id: ID!
      name: String!
      vaccinated: Boolean!
      barkVolume: Int!
      owner: Owner
    }
    type Cat implements Pet {
      id: ID!
      name: String!
      vaccinated: Boolean!
      meowVolume: Int!
      owner: Owner
    }
    interface Owner {
      id: ID!
      name: String!
    }
    type Person implements Owner {
      id: ID!
      name: String!
      age: Int!
    }
    type Shelter implements Owner {
      id: ID!
      name: String!
      operationType: String!
    }
    type Query {
      pets: [Pet!]!
    }
    `;

const somePets = [
  {
    __typename: "Dog",
    id: "1",
    name: "Odie",
    barkVolume: 3,
    vaccinated: true,
    owner: { __typename: "Person", id: "2", name: "Jon", age: 35 },
  },
  {
    __typename: "Cat",
    id: "3",
    name: "Garfield",
    meowVolume: 2,
    vaccinated: false,
    owner: {
      __typename: "Shelter",
      id: "4",
      name: "Paws and Claws",
      operationType: "Non-profit",
    },
  },
];

test("basic test", async () => {
  const query = gql`
    query Pets {
      pets {
        ...on Dog {
          barkVolume
        }
        ... on Cat {
          meowVolume
        }
        ...VetInfo
        owner {
          ...OwnerInfo
        }
      }
    }

    fragment VetInfo on Pet {
      vaccinated
    }
    fragment OwnerInfo on Owner {
      ...on Person {
        name
        age
      }
      ...on Shelter {
        name
        operationType
      }
    }`;

  const schema = makeExecutableSchema({
    typeDefs,
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink((operation, forward) => {
      return forward(operation).pipe(
        tap((v) => console.dir(v, { depth: null }))
      );
    }).concat(new SchemaLink({ schema, rootValue: { pets: somePets } })),
    experiments: [identifyResolvedFragments],
  });
  console.log(print(client.documentTransform.transformDocument(query)));
  console.dir(await client.query({ query }), { depth: null });
  console.log(client.extract());
});
