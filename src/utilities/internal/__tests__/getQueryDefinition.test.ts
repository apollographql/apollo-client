import type { OperationDefinitionNode } from "graphql";
import { print } from "graphql";

import { gql } from "@apollo/client";
import { getQueryDefinition } from "@apollo/client/utilities/internal";

test("should get the correct query definition out of a query containing multiple fragments", () => {
  const queryWithFragments = gql`
    fragment authorDetails on Author {
      firstName
      lastName
    }

    fragment moreAuthorDetails on Author {
      address
    }

    query {
      author {
        ...authorDetails
        ...moreAuthorDetails
      }
    }
  `;
  const expectedDoc = gql`
    query {
      author {
        ...authorDetails
        ...moreAuthorDetails
      }
    }
  `;
  const expectedResult: OperationDefinitionNode = expectedDoc
    .definitions[0] as OperationDefinitionNode;
  const actualResult = getQueryDefinition(queryWithFragments);

  expect(print(actualResult)).toEqual(print(expectedResult));
});

test("should throw if we try to get the query definition of a document with no query", () => {
  const mutationWithFragments = gql`
    fragment authorDetails on Author {
      firstName
      lastName
    }

    mutation {
      createAuthor(firstName: "John", lastName: "Smith") {
        ...authorDetails
      }
    }
  `;
  expect(() => {
    getQueryDefinition(mutationWithFragments);
  }).toThrow();
});

test("should throw if type definitions found in document", () => {
  const queryWithTypeDefinition = gql`
    fragment authorDetails on Author {
      firstName
      lastName
    }

    query ($search: AuthorSearchInputType) {
      author(search: $search) {
        ...authorDetails
      }
    }

    input AuthorSearchInputType {
      firstName: String
    }
  `;
  expect(() => {
    getQueryDefinition(queryWithTypeDefinition);
  }).toThrowError(
    'Schema type definitions not allowed in queries. Found: "InputObjectTypeDefinition"'
  );
});
