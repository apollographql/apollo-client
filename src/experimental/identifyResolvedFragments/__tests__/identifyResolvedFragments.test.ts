import { makeExecutableSchema } from "@graphql-tools/schema";
import { execute, print } from "graphql";

import { ApolloClient, ApolloLink, gql, InMemoryCache } from "@apollo/client";

import { identifyResolvedFragments } from "../index.js";
import exp from "constants";

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
  const schema = makeExecutableSchema({
    typeDefs,
  });

  expect(print(query)).toMatchInlineSnapshot(`
"query Pets {
  pets {
    ... on Dog {
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
  ... on Person {
    name
    age
  }
  ... on Shelter {
    name
    operationType
  }
}"
`);
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
    experiments: [identifyResolvedFragments],
  });
  const transformed = client.documentTransform.transformDocument(query);

  const result = await execute({
    schema,
    document: transformed,
    rootValue: {
      pets: [
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
      ],
    },
  });

  expect(result).toMatchInlineSnapshot(`
Object {
  "data": Object {
    "pets": Array [
      Object {
        "__ac_match_Dog": "Dog",
        "__ac_match_VetInfo": "Dog",
        "__typename": "Dog",
        "barkVolume": 3,
        "owner": Object {
          "__ac_match_OwnerInfo": "Person",
          "__ac_match_Person": "Person",
          "__typename": "Person",
          "age": 35,
          "name": "Jon",
        },
        "vaccinated": true,
      },
      Object {
        "__ac_match_Cat": "Cat",
        "__ac_match_VetInfo": "Cat",
        "__typename": "Cat",
        "meowVolume": 2,
        "owner": Object {
          "__ac_match_OwnerInfo": "Shelter",
          "__ac_match_Shelter": "Shelter",
          "__typename": "Shelter",
          "name": "Paws and Claws",
          "operationType": "Non-profit",
        },
        "vaccinated": false,
      },
    ],
  },
}
`);

  expect(print(transformed)).toMatchInlineSnapshot(`
"query Pets {
  pets {
    ... on Dog {
      barkVolume
      __typename
      __ac_match_Dog: __typename
    }
    ... on Cat {
      meowVolume
      __typename
      __ac_match_Cat: __typename
    }
    ...VetInfo
    owner {
      ...OwnerInfo
      __typename
    }
    __typename
  }
}

fragment VetInfo on Pet {
  vaccinated
  __typename
  __ac_match_VetInfo: __typename
}

fragment OwnerInfo on Owner {
  ... on Person {
    name
    age
    __typename
    __ac_match_Person: __typename
  }
  ... on Shelter {
    name
    operationType
    __typename
    __ac_match_Shelter: __typename
  }
  __typename
  __ac_match_OwnerInfo: __typename
}"
`);
});
