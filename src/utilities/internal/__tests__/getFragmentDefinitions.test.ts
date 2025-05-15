import type { FragmentDefinitionNode } from "graphql";
import { print } from "graphql";

import { gql } from "@apollo/client";
import { getFragmentDefinitions } from "@apollo/client/utilities/internal";

test("should get fragment definitions from a document containing a single fragment", () => {
  const singleFragmentDefinition = gql`
    query {
      author {
        ...authorDetails
      }
    }

    fragment authorDetails on Author {
      firstName
      lastName
    }
  `;
  const expectedDoc = gql`
    fragment authorDetails on Author {
      firstName
      lastName
    }
  `;
  const expectedResult: FragmentDefinitionNode[] = [
    expectedDoc.definitions[0] as FragmentDefinitionNode,
  ];
  const actualResult = getFragmentDefinitions(singleFragmentDefinition);

  expect(actualResult.length).toEqual(expectedResult.length);
  expect(print(actualResult[0])).toBe(print(expectedResult[0]));
});

test("should get fragment definitions from a document containing a multiple fragments", () => {
  const multipleFragmentDefinitions = gql`
    query {
      author {
        ...authorDetails
        ...moreAuthorDetails
      }
    }

    fragment authorDetails on Author {
      firstName
      lastName
    }

    fragment moreAuthorDetails on Author {
      address
    }
  `;
  const expectedDoc = gql`
    fragment authorDetails on Author {
      firstName
      lastName
    }

    fragment moreAuthorDetails on Author {
      address
    }
  `;
  const expectedResult: FragmentDefinitionNode[] = [
    expectedDoc.definitions[0] as FragmentDefinitionNode,
    expectedDoc.definitions[1] as FragmentDefinitionNode,
  ];
  const actualResult = getFragmentDefinitions(multipleFragmentDefinitions);
  expect(actualResult.map(print)).toEqual(expectedResult.map(print));
});
