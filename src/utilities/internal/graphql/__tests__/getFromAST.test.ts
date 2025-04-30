import type { OperationDefinitionNode } from "graphql";
import { print } from "graphql";

import { gql } from "@apollo/client";
import {
  getDefaultValues,
  getOperationName,
  getQueryDefinition,
} from "@apollo/client/utilities/internal";

describe("getDefaultValues", () => {
  test("will create an empty variable object if no default values are provided", () => {
    const basicQuery = gql`
      query people($first: Int, $second: String) {
        allPeople(first: $first) {
          people {
            name
          }
        }
      }
    `;

    expect(getDefaultValues(getQueryDefinition(basicQuery))).toEqual({});
  });

  test("will create a variable object based on the definition node with default values", () => {
    const basicQuery = gql`
      query people($first: Int = 1, $second: String!) {
        allPeople(first: $first) {
          people {
            name
          }
        }
      }
    `;

    expect(getDefaultValues(getQueryDefinition(basicQuery))).toEqual({
      first: 1,
    });
  });
});

describe("getOperationName", () => {
  test("should get the operation name out of a query", () => {
    const query = gql`
      query nameOfQuery {
        fortuneCookie
      }
    `;

    const operationName = getOperationName(query);

    expect(operationName).toEqual("nameOfQuery");
  });

  test("should get the operation name out of a mutation", () => {
    const query = gql`
      mutation nameOfMutation {
        fortuneCookie
      }
    `;

    const operationName = getOperationName(query);

    expect(operationName).toEqual("nameOfMutation");
  });

  test("should return null if the query does not have an operation name", () => {
    const query = gql`
      {
        fortuneCookie
      }
    `;

    const operationName = getOperationName(query);

    expect(operationName).toEqual(null);
  });
});

describe("getQueryDefinition", () => {
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
});
