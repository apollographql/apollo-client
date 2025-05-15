import { gql } from "@apollo/client";
import {
  getDefaultValues,
  getQueryDefinition,
} from "@apollo/client/utilities/internal";

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
