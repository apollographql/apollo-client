import { gql } from "@apollo/client";
import { getQueryDefinition } from "@apollo/client/utilities";
import {
  checkDocument,
  getDefaultValues,
} from "@apollo/client/utilities/internal";

describe("checkDocument", () => {
  it("should correctly check a document for correctness", () => {
    const multipleQueries = gql`
      query {
        author {
          firstName
          lastName
        }
      }

      query {
        author {
          address
        }
      }
    `;
    expect(() => {
      checkDocument(multipleQueries);
    }).toThrow();

    const namedFragment = gql`
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
    expect(() => {
      checkDocument(namedFragment);
    }).not.toThrow();
  });
});

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
