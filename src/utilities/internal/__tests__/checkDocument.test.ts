import { gql } from "@apollo/client";
import { checkDocument } from "@apollo/client/utilities/internal";

test("should correctly check a document for correctness", () => {
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
